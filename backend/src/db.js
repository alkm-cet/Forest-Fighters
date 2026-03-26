const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function query(text, params) {
  if (params && params.length > 0) {
    return sql.query(text, params);
  }
  return sql.query(text);
}

module.exports = { query };
