import csv
import json
import logging
import re
from operator import itemgetter
from pathlib import Path
from argparse import ArgumentParser

import boto3
import toml


def get_timeout(message):
    pattern = r'after (\d+\.?\d*) seconds'
    match = re.search(pattern, message)
    if match:
        return float(match[1])
    else:
        return None


def fetch_timeouts(region, lambda_id):
    timeouts = []

    logs = boto3.client('logs', region_name=region)
    log_group_name = f'/aws/lambda/{lambda_id}'
    paginator = logs.get_paginator('filter_log_events')
    pages = paginator.paginate(logGroupName=log_group_name,
                               filterPattern='Task timed out')
    for res in pages:
        for e in res['events']:
            msg = e['message']
            duration_s = get_timeout(msg)
            if duration_s is None:
                logging.warning(
                    f'Missing timeout duration for message:\n{msg}')
                continue
            ts = float(e['timestamp']) / 1000
            timeouts.append({
                'query_start': ts,
                'duration_ms': duration_s * 1000
            })

    return timeouts


def fetch_data(region, lambda_id):
    lam = boto3.client('lambda', region_name=region)
    res = lam.invoke(FunctionName=lambda_id)
    res_dict = json.loads(res['Payload'].read().decode('utf-8'))
    return res_dict


def get_lambda_ids(region, stack_name):
    cfn = boto3.client('cloudformation', region_name=region)
    stack_info = cfn.describe_stack_resources(StackName=stack_name)
    lambda_ids = {}
    lambda_names = {'FetchFunc', 'MeasureFunc'}
    for resource in stack_info['StackResources']:
        lid = resource['LogicalResourceId']
        if lid in lambda_names:
            lambda_ids[lid] = resource['PhysicalResourceId']
    return lambda_ids


def save_csv(out_dir, items, name):
    if len(items) == 0:
        logging.warning(f'Items for {name} is empty')
        return

    items.sort(key=itemgetter('query_start'))
    with open(out_dir / f'{name}.csv', 'w') as f:
        writer = csv.writer(f)
        keys = sorted(items[0].keys())
        writer.writerow(keys)
        for el in items:
            row = []
            for k in keys:
                row.append(el[k])
            writer.writerow(row)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)

    parser = ArgumentParser()
    parser.add_argument('out_dir', type=Path,
                        help='The output directory')
    args = parser.parse_args()

    with open('samconfig.toml') as f:
        config = toml.load(f)
    params = config['default']['deploy']['parameters']
    region = params['region']
    stack_name = params['stack_name']

    logging.info('Retrieving lambda ids...')
    lambda_ids = get_lambda_ids(region, stack_name)
    logging.info('Exporting data from DB...')
    data = fetch_data(region, lambda_ids['FetchFunc'])
    logging.info('Fetching timeouts for measurement lambda...')
    timeouts = fetch_timeouts(region, lambda_ids['MeasureFunc'])
    # If the lambda timed out before the DB started, the cold start wasn't
    # recorded in the DB so we add it here.
    data['cold_starts'].extend(timeouts)

    save_csv(args.out_dir, data['cold_starts'], 'cold_starts')
    save_csv(args.out_dir, data['inserts'], 'inserts')
    save_csv(args.out_dir, data['selects'], 'selects')
    logging.info(f'Saved results to {args.out_dir}')

