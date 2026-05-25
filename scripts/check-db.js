const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  ORDER BY table_name
`).then((r) => {
  console.log('\nTables on Neon PostgreSQL:');
  if (r.rows.length === 0) {
    console.log('  (no tables found — migration may not have run)');
  } else {
    r.rows.forEach((x) => console.log('  ✓', x.table_name));
  }
  pool.end();
}).catch((e) => {
  console.error('Connection error:', e.message);
  pool.end();
  process.exit(1);
});
