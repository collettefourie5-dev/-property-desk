import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/coming-soon';

export const metadata: Metadata = { title: 'Something complicated' };

export default function ComplicatedPage() {
  return (
    <ComingSoon
      title="Something complicated"
      blurb="Trusts, estates, disputes, co-owners — talk it through with an attorney first."
    />
  );
}
