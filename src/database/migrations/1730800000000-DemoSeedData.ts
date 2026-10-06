import { MigrationInterface, QueryRunner } from 'typeorm';
import { sembrarDatosDemo } from '../seed/demo-seed';

/** Siembra inicial de demostración; conserva cualquier base que ya tenga usuarios. */
export class DemoSeedData1730800000000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    const [{ total }] = await qr.query('SELECT COUNT(*) AS total FROM users');
    if (Number(total) > 0) {
      console.log('Seed demo omitido: ya existen usuarios.');
      return;
    }
    // Usa la misma conexión y transacción que abrió TypeORM para la migración.
    await sembrarDatosDemo(qr.manager);
  }

  async down(_qr: QueryRunner): Promise<void> {
    // Sin borrado físico: los datos demo se conservan al revertir la migración.
  }
}
