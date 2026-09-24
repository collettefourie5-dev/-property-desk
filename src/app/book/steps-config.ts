import type { FieldDef } from '@/components/booking/step-form';
import { OWNERSHIPS, PROPERTY_TYPES, STAGES, type Step } from '@/lib/validation/booking';

export interface StepConfig {
  title: string;
  intro?: string;
  fields: FieldDef[];
  submitLabel: string;
}

/** Field definitions per step — plain data so they can cross into the client form component. */
export const stepConfig: Record<Exclude<Step, 'documents' | 'schedule' | 'review'>, StepConfig> = {
  contact: {
    title: 'Your contact details',
    intro: 'We use your email to personally confirm your session, take you through pricing, and ask anything further we need to know about the transaction.',
    submitLabel: 'Continue',
    fields: [
      { kind: 'text', name: 'fullName', label: 'Full name', autoComplete: 'name', maxLength: 120 },
      { kind: 'email', name: 'email', label: 'Email address', autoComplete: 'email', maxLength: 254 },
      { kind: 'tel', name: 'phone', label: 'Mobile number', autoComplete: 'tel', maxLength: 20 },
      {
        kind: 'checkbox',
        name: 'consent',
        label:
          'I have read the privacy notice and consent to my information being processed to arrange and hold my consultation.',
        linkHref: '/privacy',
        linkText: 'Read the privacy notice',
      },
    ],
  },
  property: {
    title: 'The property',
    submitLabel: 'Continue',
    fields: [
      { kind: 'textarea', name: 'propertyAddress', label: 'Property address', rows: 3, maxLength: 300 },
      { kind: 'select', name: 'propertyType', label: 'Type of property', options: [...PROPERTY_TYPES] },
    ],
  },
  stage: {
    title: 'Where are you in the transaction?',
    submitLabel: 'Continue',
    fields: [{ kind: 'radio', name: 'stage', label: 'Choose the closest match', options: [...STAGES] }],
  },
  ownership: {
    title: 'How is the property owned?',
    submitLabel: 'Continue',
    fields: [
      { kind: 'radio', name: 'ownershipStructure', label: 'Ownership structure', options: [...OWNERSHIPS] },
    ],
  },
  parties: {
    title: 'Who else is involved?',
    intro: 'Co-owners, the buyer, agents, bond providers, family members — anyone with a stake.',
    submitLabel: 'Continue',
    fields: [
      {
        kind: 'textarea',
        name: 'otherParties',
        label: 'Other parties involved',
        hint: 'If it is only you, write "None".',
        rows: 4,
        maxLength: 1000,
      },
    ],
  },
  details: {
    title: 'Tell me about the transaction',
    submitLabel: 'Continue',
    fields: [
      {
        kind: 'textarea',
        name: 'transactionSummary',
        label: 'Tell me about the transaction',
        hint: 'What is happening, and what has been agreed or signed so far?',
        rows: 6,
        maxLength: 4000,
      },
      {
        kind: 'textarea',
        name: 'mainConcern',
        label: 'What are you most concerned about?',
        rows: 4,
        maxLength: 2000,
      },
    ],
  },
  intent: {
    title: 'What would you like to achieve?',
    submitLabel: 'Continue',
    fields: [
      {
        kind: 'textarea',
        name: 'desiredOutcome',
        label: 'What would you like to achieve from this session?',
        rows: 4,
        maxLength: 1000,
      },
    ],
  },
};
