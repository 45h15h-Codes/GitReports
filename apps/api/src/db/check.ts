import { Pool } from 'pg';

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
    console.log('  (no tables — migration may not have applied)');
  } else {
    r.rows.forEach((x: any) => console.log('  ✓', x.table_name));
  }
  pool.end();
}).catch((e: Error) => {
  console.error('DB error:', e.message);
  pool.end();
  process.exit(1);
});
