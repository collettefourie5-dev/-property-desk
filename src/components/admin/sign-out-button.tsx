'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth/auth-client';

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await signOut();
        router.push('/admin/login');
        router.refresh();
      }}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
    >
      Sign out
    </button>
  );
}
