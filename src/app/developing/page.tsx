import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/coming-soon';

export const metadata: Metadata = { title: 'Developing property' };

export default function DevelopingPage() {
  return <ComingSoon title="Developing property" blurb="Structure, contracts and compliance for your project." />;
}
