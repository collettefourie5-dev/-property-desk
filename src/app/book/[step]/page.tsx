import { notFound, redirect } from 'next/navigation';
import { DocumentUploader } from '@/components/booking/document-uploader';
import { StepForm } from '@/components/booking/step-form';
import { getDraftToken } from '@/lib/booking-session';
import {
  MAX_DOCUMENTS,
  OWNERSHIPS,
  STAGES,
  STEPS,
  stepSchema,
  type Step,
} from '@/lib/validation/booking';
import {
  firstIncompleteStep,
  getBookingByToken,
  type BookingWithDocuments,
} from '@/server/services/booking';
import { stepConfig } from '../steps-config';

function defaultsFor(booking: BookingWithDocuments | null): Record<string, string> {
  if (!booking) return {};
  const values: Record<string, string | null | undefined> = {
    fullName: booking.fullName,
    email: booking.email,
    phone: booking.phone,
    consent: booking.consentGivenAt ? 'on' : undefined,
    propertyAddress: booking.propertyAddress,
    propertyType: booking.propertyType,
    stage: booking.stage,
    ownershipStructure: booking.ownershipStructure,
    otherParties: booking.otherParties,
    transactionSummary: booking.transactionSummary,
    mainConcern: booking.mainConcern,
    desiredOutcome: booking.desiredOutcome,
  };
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v)) as Record<string, string>;
}

const reviewRows = (b: BookingWithDocuments): { step: Step; label: string; value: string }[] => [
  { step: 'contact', label: 'Name', value: b.fullName ?? '' },
  { step: 'contact', label: 'Email', value: b.email ?? '' },
  { step: 'contact', label: 'Mobile', value: b.phone ?? '' },
  { step: 'property', label: 'Property', value: `${b.propertyAddress ?? ''} (${b.propertyType ?? ''})` },
  { step: 'stage', label: 'Stage', value: STAGES.find((s) => s.value === b.stage)?.label ?? '' },
  {
    step: 'ownership',
    label: 'Ownership',
    value: OWNERSHIPS.find((o) => o.value === b.ownershipStructure)?.label ?? '',
  },
  { step: 'parties', label: 'Other parties', value: b.otherParties ?? '' },
  { step: 'details', label: 'The transaction', value: b.transactionSummary ?? '' },
  { step: 'details', label: 'Main concern', value: b.mainConcern ?? '' },
  { step: 'documents', label: 'Documents', value: b.documents.map((d) => d.originalName).join(', ') || 'None uploaded' },
  { step: 'intent', label: 'Goal for the session', value: b.desiredOutcome ?? '' },
];

export default async function BookStepPage(props: PageProps<'/book/[step]'>) {
  const parsed = stepSchema.safeParse((await props.params).step);
  if (!parsed.success) notFound();
  const step: Step = parsed.data;

  const booking = await getBookingByToken(await getDraftToken());
  if (booking?.intakeSubmittedAt) redirect('/book/confirmation');

  // Server-side guard: nobody can jump ahead of the first step that still needs input.
  const allowed = firstIncompleteStep(booking, STEPS);
  if (STEPS.indexOf(step) > STEPS.indexOf(allowed)) redirect(`/book/${allowed}`);

  const index = STEPS.indexOf(step);
  const backHref = index > 0 ? `/book/${STEPS[index - 1]}` : undefined;

  return (
    <main>
      <p className="text-sm text-muted">
        Step {index + 1} of {STEPS.length}
      </p>
      <progress
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:bg-black/10 [&::-webkit-progress-value]:bg-accent"
        value={index + 1}
        max={STEPS.length}
        aria-label="Booking progress"
      />

      {step === 'documents' && booking ? (
        <>
          <h1 className="mt-6 mb-6 font-serif text-3xl">Your documents</h1>
          <DocumentUploader
            initial={booking.documents.map(({ id, originalName, sizeBytes }) => ({ id, originalName, sizeBytes }))}
            maxFiles={MAX_DOCUMENTS}
          />
        </>
      ) : step === 'review' && booking ? (
        <>
          <h1 className="mt-6 font-serif text-3xl">Check your details</h1>
          <p className="mt-2 mb-6 text-muted">
            When you send this request it goes straight to the attorney, who will contact you to arrange your
            session.
          </p>
          <dl className="mb-8 divide-y divide-black/10 rounded-lg border border-black/10 bg-white">
            {reviewRows(booking).map((row) => (
              <div key={`${row.step}-${row.label}`} className="flex flex-col gap-1 px-4 py-3">
                <dt className="flex items-center justify-between text-sm text-muted">
                  {row.label}
                  <a href={`/book/${row.step}`} className="underline underline-offset-2">
                    Edit
                  </a>
                </dt>
                <dd className="whitespace-pre-wrap break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
          <StepForm
            step="review"
            fields={[]}
            defaults={{}}
            submitLabel="Send my booking request"
            backHref={backHref}
          />
        </>
      ) : (
        (() => {
          const config = stepConfig[step as keyof typeof stepConfig];
          return (
            <>
              <h1 className="mt-6 font-serif text-3xl">{config.title}</h1>
              {config.intro && <p className="mt-2 text-muted">{config.intro}</p>}
              <div className="mt-6">
                <StepForm
                  step={step}
                  fields={config.fields}
                  defaults={defaultsFor(booking)}
                  submitLabel={config.submitLabel}
                  backHref={backHref}
                />
              </div>
            </>
          );
        })()
      )}
    </main>
  );
}
