'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveStepAction, type FormState } from '@/app/book/actions';

export interface DayOption {
  key: string;
  label: string;
  slots: { id: string; time: string }[];
}

interface Props {
  days: DayOption[];
  languages: { value: string; label: string }[];
  defaultLanguage?: string;
  defaultSlotId?: string;
  backHref?: string;
}

export function SchedulePicker({ days, languages, defaultLanguage, defaultSlotId, backHref }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveStepAction, undefined);
  const initialDay =
    days.find((d) => d.slots.some((s) => s.id === defaultSlotId))?.key ?? days[0]?.key;
  const [dayKey, setDayKey] = useState(initialDay);
  const [slotId, setSlotId] = useState(defaultSlotId ?? '');
  const day = days.find((d) => d.key === dayKey);
  const errors = state?.errors ?? {};

  return (
    <form action={action} noValidate className="space-y-8">
      <input type="hidden" name="step" value="schedule" />
      <input type="hidden" name="slotId" value={slotId} />

      {state?.message && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-800">
          {state.message}
        </p>
      )}

      <fieldset aria-describedby={errors.sessionLanguage ? 'language-error' : undefined}>
        <legend className="mb-3 font-medium">Session language</legend>
        <div className="grid grid-cols-2 gap-3">
          {languages.map((l) => (
            <label
              key={l.value}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-black/20 bg-white px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-surface"
            >
              <input
                type="radio"
                name="sessionLanguage"
                value={l.value}
                defaultChecked={(state?.values?.sessionLanguage ?? defaultLanguage) === l.value}
                className="h-5 w-5 accent-brand"
              />
              <span className="text-base">{l.label}</span>
            </label>
          ))}
        </div>
        {errors.sessionLanguage && (
          <p id="language-error" role="alert" className="mt-2 text-sm text-red-700">
            {errors.sessionLanguage[0]}
          </p>
        )}
      </fieldset>

      <section aria-labelledby="when-heading">
        <h2 id="when-heading" className="mb-1 font-medium">
          Choose a date and time
        </h2>
        <p className="mb-3 text-sm text-muted">
          All times are South African time. We will personally confirm your session with you.
        </p>

        {days.length === 0 ? (
          <p className="rounded-lg bg-surface px-4 py-4">
            There are no open times at the moment. You can still send your request and we will contact you
            to arrange a time.
          </p>
        ) : (
          <>
            <div role="tablist" aria-label="Dates" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
              {days.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  role="tab"
                  aria-selected={d.key === dayKey}
                  onClick={() => setDayKey(d.key)}
                  className={`min-h-12 shrink-0 rounded-lg border px-4 py-2 text-left text-sm ${
                    d.key === dayKey
                      ? 'border-brand bg-brand text-white'
                      : 'border-black/20 bg-white hover:border-brand'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div role="radiogroup" aria-label="Times" className="mt-3 grid grid-cols-3 gap-3">
              {day?.slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === slotId}
                  onClick={() => setSlotId(s.id)}
                  className={`min-h-12 rounded-lg border px-3 py-2 text-base ${
                    s.id === slotId
                      ? 'border-brand bg-surface font-semibold ring-2 ring-brand'
                      : 'border-black/20 bg-white hover:border-brand'
                  }`}
                >
                  {s.time}
                </button>
              ))}
            </div>
          </>
        )}
        {errors.slotId && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {errors.slotId[0]}
          </p>
        )}
      </section>

      <div className="flex items-center gap-4">
        {backHref && (
          <Link href={backHref} className="px-2 py-3 underline underline-offset-2">
            Back
          </Link>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-brand px-6 py-4 text-lg font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </form>
  );
}
