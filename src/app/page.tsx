import Link from 'next/link';
import { ComplianceFooter } from '@/components/marketing/compliance-footer';

const paths = [
  { href: '/selling', title: 'Selling', blurb: 'Get your legal position clear before you accept or sign an offer.' },
  { href: '/buying', title: 'Buying', blurb: 'Know what you are committing to before the OTP is signed.' },
  { href: '/developing', title: 'Developing', blurb: 'Structure, contracts and compliance for your project.' },
  { href: '/complicated', title: 'Something complicated', blurb: 'Trusts, estates, disputes, co-owners — talk it through first.' },
];

export default function HomePage() {
  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">The Property Desk</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">What are you doing?</h1>
        <p className="mt-3 text-lg text-muted">Choose the one that fits — we&rsquo;ll take you to the right place.</p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {paths.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="block h-full rounded-xl border border-black/10 bg-white p-6 shadow-sm transition hover:border-brand hover:shadow-md"
              >
                <span className="font-serif text-2xl">{p.title}</span>
                <span className="mt-2 block text-muted">{p.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <ComplianceFooter />
    </>
  );
}
