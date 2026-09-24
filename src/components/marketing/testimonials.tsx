export interface Testimonial {
  quote: string;
  name: string;
  detail?: string;
}

/** Slot for client testimonials. Renders nothing until real, consented testimonials are supplied. */
export function Testimonials({ items = [] }: { items?: Testimonial[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="testimonials-heading" className="mt-14">
      <h2 id="testimonials-heading" className="font-serif text-2xl">
        What clients say
      </h2>
      <ul className="mt-4 space-y-4">
        {items.map((t) => (
          <li key={t.name} className="rounded-xl bg-surface p-5">
            <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
            <p className="mt-2 text-sm text-muted">
              {t.name}
              {t.detail ? ` — ${t.detail}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
