import 'dotenv/config';
import { DataSource } from 'typeorm';
import { sembrarDemo } from './demo-seed';
import { dsSeed } from './seed-datasource';

/** Ejecutable del seed: `pnpm seed`. */
async function main(): Promise<void> {
  const ds = dsSeed();
  try {
    await ds.initialize();
    await sembrarDemo(ds);
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.error('Seed falló:', e);
  process.exit(1);
});
