const AWS = require('aws-sdk');
const Knex = require('knex');

function measurementTable(table) {
  table.increments('id');
  table.specificType('query_start', 'double').notNullable();
  table.specificType('duration_ms', 'double').notNullable();

  table.index(['query_start']);
}

exports.handler = async (event, context) => {
  console.log('started setting up db')

  const sm = new AWS.SecretsManager();
  const smRes = await sm.getSecretValue({
    SecretId: process.env.DB_USER_SECRET_ARN
  }).promise();
  const dbUser = JSON.parse(smRes.SecretString);
  console.log('retrieved user secret from SSM')

  const knex = Knex({
    client: 'mysql',
    connection: {
      host : process.env.DB_CLUSTER_ENDPOINT,
      user : dbUser.username,
      password : dbUser.password,
      database : process.env.DB_NAME,
      connectionTimeout: 60000
    }
  });

  console.log('creating schema')
  await knex.schema
    .createTable('cold_starts', measurementTable)
    .createTable('inserts', measurementTable)
    .createTable('selects', measurementTable)
  console.log('finished creating scheme')
}
