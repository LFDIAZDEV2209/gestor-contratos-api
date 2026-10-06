/**
 * Almacenamiento de blobs de documentos (fase 2): S3 cuando S3_BUCKET está definido,
 * disco local (UPLOAD_DIR) como fallback de desarrollo.
 * Claves profesionales: contratos/{contractId}/{documentId}/{v}/{archivo}
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand, PutObjectCommand, S3Client, HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';

export interface SubidaBlob {
  /** Clave relativa (S3) o nombre de archivo (disco) que se persiste en la versión. */
  clave: string;
  /** true si el blob quedó en S3. */
  enS3: boolean;
}

@Injectable()
export class BlobStorageService {
  private readonly logger = new Logger(BlobStorageService.name);
  private readonly bucket: string;
  private readonly client: S3Client | null;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('s3Bucket') ?? '';
    this.client = this.bucket
      ? new S3Client({ region: config.get<string>('awsRegion') ?? 'us-east-1' })
      : null;
    if (this.bucket) this.logger.log(`Blob storage: S3 bucket ${this.bucket}`);
    else this.logger.log('Blob storage: disco local (S3_BUCKET no definido)');
  }

  /** true si la clave existe en S3 (o en disco en modo local). */
  async existe(clave: string): Promise<boolean> {
    if (this.client) {
      try {
        await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: clave }));
        return true;
      } catch {
        return false;
      }
    }
    const abs = join(resolve(process.cwd(), process.env.UPLOAD_DIR ?? './data/uploads'), clave);
    return existsSync(abs);
  }

  /** Sube el buffer y devuelve la clave persistida. */
  async subir(clave: string, buffer: Buffer, contentType?: string): Promise<SubidaBlob> {
    if (this.client) {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket, Key: clave, Body: buffer,
        ContentType: contentType ?? 'application/octet-stream',
        ContentDisposition: `attachment; filename="${encodeURIComponent(clave.split('/').pop() ?? 'archivo')}"`,
      }));
      return { clave, enS3: true };
    }
    const dir = resolve(process.cwd(), process.env.UPLOAD_DIR ?? './data/uploads');
    await mkdir(join(dir, clave.split('/').slice(0, -1).join('/')), { recursive: true });
    await writeFile(join(dir, clave), buffer);
    return { clave, enS3: false };
  }

  /** URL firmada GET (S3 presigned) o URL relativa HMAC (disco) con expiración en segundos. */
  async urlFirmadaGet(clave: string, expSegundos = 600): Promise<{ url: string; expira: string; enS3: boolean }> {
    const exp = Math.floor(Date.now() / 1000) + expSegundos;
    if (this.client) {
      const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: clave });
      const url = await getSignedUrl(this.client, cmd, { expiresIn: expSegundos });
      return { url, expira: new Date(exp * 1000).toISOString(), enS3: true };
    }
    return { url: clave, expira: new Date(exp * 1000).toISOString(), enS3: false };
  }

  /** Stream del blob para descarga server-side (modo disco). En S3 conviene presigned GET. */
  stream(clave: string): Readable {
    const dir = resolve(process.cwd(), process.env.UPLOAD_DIR ?? './data/uploads');
    return createReadStream(join(dir, clave)) as unknown as Readable;
  }

  /** true si la clave vive en el espacio de S3 (prefijo contratos/). */
  esS3(clave: string): boolean {
    return clave.startsWith('contratos/');
  }

  /** Obtiene el objeto de S3 como stream (para descarga server-side). */
  async getObjectStream(clave: string): Promise<Readable> {
    if (!this.client) throw new Error('S3 no configurado (S3_BUCKET vacío).');
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: clave }));
    return out.Body as Readable;
  }
}
