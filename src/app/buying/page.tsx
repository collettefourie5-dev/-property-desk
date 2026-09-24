import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/coming-soon';

export const metadata: Metadata = { title: 'Buying property' };

export default function BuyingPage() {
  return <ComingSoon title="Buying property" blurb="Know what you are committing to before the OTP is signed." />;
}
