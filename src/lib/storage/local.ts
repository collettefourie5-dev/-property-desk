import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FileStorage } from '@/lib/storage';

/** Dev/test only. Keys are generated server-side, but resolve defensively anyway. */
export class LocalStorage implements FileStorage {
  private readonly root: string;

  constructor(dir: string) {
    this.root = path.resolve(dir);
  }

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }

  async get(key: string) {
    return { body: await fs.readFile(this.resolve(key)) };
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}
