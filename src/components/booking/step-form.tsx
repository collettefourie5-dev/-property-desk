'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { saveStepAction, type FormState } from '@/app/book/actions';

export type FieldDef =
  | {
      kind: 'text' | 'email' | 'tel';
      name: string;
      label: string;
      hint?: string;
      autoComplete?: string;
      maxLength?: number;
    }
  | { kind: 'textarea'; name: string; label: string; hint?: string; rows?: number; maxLength: number }
  | { kind: 'select'; name: string; label: string; options: string[] }
  | { kind: 'radio'; name: string; label: string; options: { value: string; label: string }[] }
  | { kind: 'checkbox'; name: string; label: string; linkHref?: string; linkText?: string };

// text-base (16px) stops iOS Safari zooming the page when a field is focused.
const inputClass =
  'block w-full rounded-lg border border-black/20 bg-white px-4 py-3 text-base focus:border-brand focus:outline-none';

interface StepFormProps {
  step: string;
  fields: FieldDef[];
  defaults: Record<string, string>;
  submitLabel: string;
  backHref?: string;
}

export function StepForm({ step, fields, defaults, submitLabel, backHref }: StepFormProps) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveStepAction, undefined);
  const values = { ...defaults, ...state?.values };
  const errors = state?.errors ?? {};

  return (
    <form action={action} noValidate className="space-y-6">
      <input type="hidden" name="step" value={step} />

      {state?.message && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-800">
          {state.message}
        </p>
      )}

      {fields.map((field) => {
        const fieldErrors = errors[field.name];
        const errorId = `${field.name}-error`;
        const described = fieldErrors ? errorId : undefined;

        return (
          <div key={field.name}>
            {field.kind === 'radio' ? (
              <fieldset aria-describedby={described}>
                <legend className="mb-3 font-medium">{field.label}</legend>
                <div className="space-y-3">
                  {field.options.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-black/20 bg-white px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-surface"
                    >
                      <input
                        type="radio"
                        name={field.name}
                        value={opt.value}
                        defaultChecked={values[field.name] === opt.value}
                        className="h-5 w-5 accent-brand"
                      />
                      <span className="text-base">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : field.kind === 'checkbox' ? (
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name={field.name}
                  defaultChecked={values[field.name] === 'on'}
                  aria-describedby={described}
                  className="mt-1 h-6 w-6 shrink-0 accent-brand"
                />
                <span>
                  {field.label}
                  {field.linkHref && (
                    <>
                      {' '}
                      <Link href={field.linkHref} target="_blank" className="underline underline-offset-2">
                        {field.linkText}
                      </Link>
                    </>
                  )}
                </span>
              </label>
            ) : (
              <>
                <label htmlFor={field.name} className="mb-1 block font-medium">
                  {field.label}
                </label>
                {'hint' in field && field.hint && <p className="mb-2 text-sm text-muted">{field.hint}</p>}
                {field.kind === 'textarea' ? (
                  <textarea
                    id={field.name}
                    name={field.name}
                    rows={field.rows ?? 5}
                    maxLength={field.maxLength}
                    defaultValue={values[field.name] ?? ''}
                    aria-describedby={described}
                    aria-invalid={Boolean(fieldErrors)}
                    className={inputClass}
                  />
                ) : field.kind === 'select' ? (
                  <select
                    id={field.name}
                    name={field.name}
                    defaultValue={values[field.name] ?? ''}
                    aria-describedby={described}
                    aria-invalid={Boolean(fieldErrors)}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {field.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.kind}
                    autoComplete={field.autoComplete}
                    maxLength={field.maxLength}
                    defaultValue={values[field.name] ?? ''}
                    aria-describedby={described}
                    aria-invalid={Boolean(fieldErrors)}
                    className={inputClass}
                  />
                )}
              </>
            )}
            {fieldErrors && (
              <p id={errorId} role="alert" className="mt-2 text-sm text-red-700">
                {fieldErrors[0]}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-4 pt-2">
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
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
