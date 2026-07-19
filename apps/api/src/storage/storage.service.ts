import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandInput,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9000';
    const region = config.get<string>('S3_REGION') ?? 'us-east-1';
    const accessKey = config.get<string>('S3_ACCESS_KEY') ?? 'vaeloom';
    const secretKey = config.get<string>('S3_SECRET_KEY') ?? 'vaeloom_dev_minio';
    const forcePathStyle = config.get<string>('S3_FORCE_PATH_STYLE') === 'true';
    this.bucket = config.get<string>('S3_BUCKET') ?? 'vaeloom-storage';

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: '.healthcheck-init', Body: '' }),
      );
      this.logger.log(`Connected to S3 at bucket="${this.bucket}"`);
    } catch (err) {
      this.logger.warn({ err }, 'S3 bucket not ready yet — will retry at first operation');
    }
  }

  async upload(file: Buffer | Readable | string, key: string): Promise<{ key: string; etag?: string }> {
    const body = typeof file === 'string' ? file : file;
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body });
    const result = await this.client.send(cmd);
    return { key, etag: result.ETag };
  }

  async download(key: string): Promise<Readable> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const result = await this.client.send(cmd);
    if (!result.Body) throw new NoSuchKey({ message: `Object "${key}" has no body`, $metadata: {} } as any);
    return result.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    const cmd = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await this.client.send(cmd);
  }

  async list(prefix: string): Promise<Array<{ key: string; size: number; lastModified?: Date }>> {
    const input: ListObjectsV2CommandInput = { Bucket: this.bucket, Prefix: prefix };
    const cmd = new ListObjectsV2Command(input);
    const result = await this.client.send(cmd);
    return (result.Contents ?? []).map((o) => ({
      key: o.Key!,
      size: o.Size ?? 0,
      lastModified: o.LastModified,
    }));
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }
}
