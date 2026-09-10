'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="text-neutral-600">
        We hit an unexpected error. Please try again — if it keeps happening, contact us directly.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
      >
        Try again
      </button>
    </main>
  );
}
