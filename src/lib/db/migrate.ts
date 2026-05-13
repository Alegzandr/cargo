import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../env.js';
import { log } from '../log/index.js';

async function main(): Promise<void> {
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: './drizzle' });
  await sql.end();
}

main().catch((err) => {
  log.error('migrate.failed', { code: (err as { code?: string }).code ?? 'unknown' });
  process.exit(1);
});
