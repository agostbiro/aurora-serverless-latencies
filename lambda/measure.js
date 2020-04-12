const { performance } = require('perf_hooks');

const DAC = require('data-api-client')

// Retry for approx 2 minutes
const MAX_RETRIES = 120

function getParams(startStamp, endStamp) {
  const ts = (performance.timeOrigin + startStamp) / 1000
  return {
    query_start: ts,
    duration_ms: endStamp - startStamp
  }
}

async function insertMeasure(data, table, startStamp, endStamp) {
  await data.query(
    `INSERT INTO ${table} (query_start, duration_ms) VALUES(:query_start, :duration_ms)`,
    getParams(startStamp, endStamp)
  );
}


function customBackoff(retryCount) {
  if (retryCount >= MAX_RETRIES) {
    return -1
  } else {
    return Math.min(1000, Math.pow(2, retryCount) * 50);
  }
}

exports.handler = async (event, context) => {
  if (Math.random() >= 1 / 6) {
    console.log('Skipping measurements');
    return;
  } else {
    console.log('Performing measurements');
  }

  const data = DAC({
    secretArn: process.env.DB_USER_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME,
    options: {
      maxRetries: MAX_RETRIES,
      retryDelayOptions: { customBackoff }
    }
  });

  const t0 = performance.now();
  await data.query(`SELECT * FROM cold_starts ORDER BY id DESC LIMIT 1`);
  const t1 = performance.now();
  await insertMeasure(data, 'cold_starts', t0, t1);
  const t2 = performance.now();
  await insertMeasure(data, 'inserts', t1, t2);
  const t3 = performance.now();
  await data.query(`SELECT * FROM cold_starts ORDER BY id DESC LIMIT 1`);
  const t4 = performance.now();
  await insertMeasure(data, 'selects', t3, t4);
};
