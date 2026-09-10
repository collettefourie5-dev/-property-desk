'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p className="text-neutral-600">Please try again in a moment.</p>
        <button
          onClick={reset}
          className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
