import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-neutral-600">The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.</p>
      <Link href="/" className="text-blue-700 underline underline-offset-2">
        Back to home
      </Link>
    </main>
  );
}
