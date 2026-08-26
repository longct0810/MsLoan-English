const fs = require('fs/promises');
const path = require('path');
const pool = require('../src/config/db');

async function main() {
  const schema = await fs.readFile(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Database schema migrated successfully.');
}

main()
  .catch((error) => {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
