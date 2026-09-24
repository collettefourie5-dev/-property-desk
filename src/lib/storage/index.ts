import { getEnv } from '@/lib/env';
import { LocalStorage } from '@/lib/storage/local';
import { S3Storage } from '@/lib/storage/s3';

/** Where booking documents live. Never the app container's own filesystem in TEST/PROD. */
export interface FileStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType?: string }>;
  delete(key: string): Promise<void>;
}

let instance: FileStorage | undefined;

export function getStorage(): FileStorage {
  if (instance) return instance;
  const env = getEnv();

  if (env.STORAGE_DRIVER === 's3') {
    instance = new S3Storage({
      endpoint: env.STORAGE_S3_ENDPOINT!,
      region: env.STORAGE_S3_REGION!,
      bucket: env.STORAGE_S3_BUCKET!,
      accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID!,
      secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY!,
      forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE ?? false,
    });
  } else {
    instance = new LocalStorage(env.STORAGE_LOCAL_DIR);
  }
  return instance;
}
