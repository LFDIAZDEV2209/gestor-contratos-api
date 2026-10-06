import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adjuntos polimórficos (soportes de entidades sin contrato, p. ej. cupos):
 * documents.contract_id pasa a nullable y se añade ref_id/ref_tipo + índice.
 */
export class DocumentsAttachmentsPolymorphic1730801000000 implements MigrationInterface {
  name = 'DocumentsAttachmentsPolymorphic1730801000000';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE documents ALTER COLUMN contract_id DROP NOT NULL`);
    await qr.query(`ALTER TABLE documents ADD COLUMN ref_id text`);
    await qr.query(`ALTER TABLE documents ADD COLUMN ref_tipo text`);
    await qr.query(`CREATE INDEX IF NOT EXISTS ix_documents_ref ON documents (ref_id)`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS ix_documents_ref`);
    await qr.query(`ALTER TABLE documents DROP COLUMN IF EXISTS ref_tipo`);
    await qr.query(`ALTER TABLE documents DROP COLUMN IF EXISTS ref_id`);
    await qr.query(`UPDATE documents SET contract_id = '' WHERE contract_id IS NULL`);
    await qr.query(`ALTER TABLE documents ALTER COLUMN contract_id SET NOT NULL`);
  }
}
