# Measure AWS Aurora Serverless Latencies

This repo contains code to measure AWS Aurora Serverless cold starts and warm latencies using the Data API. The DB is configured to stop after 5 mins (see `RDSCluster` in [template.yml](template.yaml) for all the DB parameters). 

The measurements consist of:

1. Cold start SELECT 1 item
2. Warm start INSERT 1 item
3. Warm start SELECT 1 item

The interval between measurements is randomized and one measurement is expected to be carried out every hour in the `us-east-1` AWS region with a Lambda function using 512MB memory.

## How To Reproduce

Note that reproducing this experiment will incur AWS costs on your behalf and that an RDS snapshot will remain after deleting the stack that has an ongoing cost. 

Note that older versions of the AWS SDK have a [bug](https://github.com/aws/aws-sdk-js/pull/2931) with RDSDataService retries. Make sure to use the latest version.

### Prerequisites

1. An AWS account with local credentials configured
1. The AWS and SAM CLIs installed (`pip install awscli aws-sam-cli`)

### Deployment 

#### First deployment

```shell script
sam deploy --guided
sam deploy
```

#### Subsequent deployments

`sam build && sam deploy`

Note the Lambda function names in the values of the outputs of the CloudFormation stack after deployment for use in the next steps.

### Set up database

`aws lambda invoke --region ${YOUR_REGION} --function-name ${YOUR_SETUP_DB_FUNC_NAME} /dev/null`

### Capture data

Measurements are automatic and randomized. There is 1 expected measurement per hour. Wait a few days to gather enough data.

### Export data

`aws lambda invoke --region ${YOUR_REGION} --function-name ${YOUR_FETCH_FUNC_NAME} data.json`


