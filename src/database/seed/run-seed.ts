import 'dotenv/config';
import { sembrarDatosDemo } from './demo-seed';
import { dsSeed } from './seed-datasource';

/** Ejecutable del seed: `pnpm seed`. */
async function main(): Promise<void> {
  const ds = dsSeed();
  try {
    await ds.initialize();
    await ds.transaction((manager) => sembrarDatosDemo(manager));
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.error('Seed falló:', e);
  process.exit(1);
});
