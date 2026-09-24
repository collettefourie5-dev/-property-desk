import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import './globals.css';
import { MetaPixel } from '@/components/tracking/meta-pixel';

const TITLE = 'The Property Desk — property legal strategy, before you sign';
const DESCRIPTION =
  'Selling, buying or developing property in South Africa? Get a clear legal strategy from an admitted attorney before you commit.';

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return {
    metadataBase: new URL(appUrl),
    title: { default: TITLE, template: '%s | The Property Desk' },
    description: DESCRIPTION,
    openGraph: { type: 'website', siteName: 'The Property Desk', title: TITLE, description: DESCRIPTION },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Request-time rendering: runtime config (pixel ID, LPC details) must not be frozen at build.
  await connection();

  return (
    <html lang="en-ZA" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <MetaPixel pixelId={process.env.META_PIXEL_ID || undefined} />
        {children}
      </body>
    </html>
  );
}
