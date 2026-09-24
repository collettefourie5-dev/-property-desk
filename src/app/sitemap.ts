import type { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return ['/', '/selling', '/buying', '/developing', '/complicated', '/privacy'].map((path) => ({
    url: `${base}${path}`,
  }));
}
