const DAC = require('data-api-client')

function getParams(startStamp, endStamp) {
  const ts = (performance.timeOrigin + startStamp) / 1000
  return {
    query_start: ts,
    duration_ms: endStamp - startStamp
  }
}

async function fetchTable(data, table) {
  const q =`SELECT query_start, duration_ms FROM ${table} ORDER BY id DESC`
  return data.query(q);
}

exports.handler = async (event, context) => {
  const data = DAC({
    secretArn: process.env.DB_USER_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
  });

  console.log('Fetching measurements')
  const res = await Promise.all([
    fetchTable(data, 'cold_starts'),
    fetchTable(data, 'inserts'),
    fetchTable(data, 'selects')
  ]);
  return {
    'cold_starts': res[0].records,
    'inserts': res[1].records,
    'selects': res[2].records
  }
};
