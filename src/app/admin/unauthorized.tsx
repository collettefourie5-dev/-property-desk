import Link from 'next/link';

export default function AdminUnauthorized() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Please sign in</h1>
      <p className="text-neutral-600">You need to sign in to view this page.</p>
      <Link
        href="/admin/login"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Go to sign in
      </Link>
    </main>
  );
}
