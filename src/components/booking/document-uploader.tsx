'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Doc {
  id: string;
  originalName: string;
  sizeBytes: number;
}

const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/*';

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentUploader({ initial, maxFiles }: { initial: Doc[]; maxFiles: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Doc[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/book/documents', { method: 'POST', body });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(`${file.name}: ${json?.error?.message ?? 'Upload failed. Please try again.'}`);
        break;
      }
      setDocs((prev) => [...prev, json.document]);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/book/documents/${id}`, { method: 'DELETE' });
    if (res.ok) setDocs((prev) => prev.filter((d) => d.id !== id));
    else setError('Could not remove that file. Please try again.');
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="documents" className="block font-medium">
          Upload your documents
        </label>
        <p className="mb-3 text-sm text-muted">
          OTP, agreement or correspondence — PDF, Word or photos. Up to {maxFiles} files, 8MB each. This step is
          optional.
        </p>
        <input
          ref={inputRef}
          id="documents"
          type="file"
          multiple
          accept={ACCEPT}
          disabled={busy || docs.length >= maxFiles}
          onChange={(e) => upload(e.target.files)}
          className="block w-full rounded-lg border border-dashed border-black/30 bg-white px-4 py-6 text-base file:mr-4 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:text-white"
        />
        {busy && <p className="mt-2 text-sm text-muted">Uploading…</p>}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {docs.length > 0 && (
        <ul className="divide-y divide-black/10 rounded-lg border border-black/10 bg-white">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate">
                {d.originalName} <span className="text-sm text-muted">({formatSize(d.sizeBytes)})</span>
              </span>
              <button
                type="button"
                onClick={() => remove(d.id)}
                className="shrink-0 px-2 py-1 text-sm underline underline-offset-2"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-4">
        <Link href="/book/details" className="px-2 py-3 underline underline-offset-2">
          Back
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => router.push('/book/intent')}
          className="flex-1 rounded-lg bg-brand px-6 py-4 text-lg font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {docs.length === 0 ? 'Skip for now' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
