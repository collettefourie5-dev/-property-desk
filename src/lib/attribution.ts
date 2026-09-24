import { z } from 'zod';

export const ATTRIBUTION_COOKIE = 'pd_attr';
export const ATTRIBUTION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const clean = z.string().trim().max(200);

export const attributionSchema = z.object({
  utmSource: clean.optional(),
  utmMedium: clean.optional(),
  utmCampaign: clean.optional(),
  utmContent: clean.optional(),
  utmTerm: clean.optional(),
  variant: clean.optional(),
});

export type Attribution = z.infer<typeof attributionSchema>;

const PARAM_MAP = {
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
  utm_term: 'utmTerm',
  v: 'variant',
} as const;

/** Extracts attribution from URL params. Returns undefined when the URL carries none, so an
 *  existing cookie from the original ad click isn't overwritten by internal navigation. */
export function attributionFromParams(params: URLSearchParams): Attribution | undefined {
  const raw: Record<string, string> = {};
  for (const [param, key] of Object.entries(PARAM_MAP)) {
    const value = params.get(param);
    if (value) raw[key] = value;
  }
  if (Object.keys(raw).length === 0) return undefined;
  const parsed = attributionSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export function parseAttributionCookie(value: string | undefined): Attribution {
  if (!value) return {};
  try {
    const parsed = attributionSchema.safeParse(JSON.parse(decodeURIComponent(value)));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function serializeAttribution(attribution: Attribution): string {
  return encodeURIComponent(JSON.stringify(attribution));
}
