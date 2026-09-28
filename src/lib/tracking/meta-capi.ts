import { getEnv } from '@/lib/env';
import { hashEmail, hashPhone } from '@/lib/tracking/hash';

const GRAPH_API_VERSION = 'v26.0';

export interface CapiUserData {
  email?: string;
  phone?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  /** Meta's click-id/browser-id cookies (_fbc/_fbp) — read as-is, verbatim, never hashed. */
  fbc?: string;
  fbp?: string;
}

export interface CapiEvent {
  eventName: 'Lead' | 'Schedule';
  eventId: string;
  eventTime: Date;
  sourceUrl: string;
  userData: CapiUserData;
}

/**
 * Sends one event to Meta's Conversions API. `eventId` must match the id passed to the
 * client-side fbq() call for the same logical event, so Meta dedupes the browser and server
 * copies instead of double-counting. Never throws — callers persist success/failure themselves.
 */
export async function sendCapiEvent(event: CapiEvent): Promise<{ success: boolean; error?: string }> {
  const env = getEnv();
  if (!env.META_PIXEL_ID || !env.META_CAPI_ACCESS_TOKEN) {
    return { success: false, error: 'Meta CAPI is not configured (META_PIXEL_ID/META_CAPI_ACCESS_TOKEN unset)' };
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_ACCESS_TOKEN)}`;

  const userData: Record<string, string> = {};
  if (event.userData.email) userData.em = hashEmail(event.userData.email);
  if (event.userData.phone) userData.ph = hashPhone(event.userData.phone);
  if (event.userData.clientIpAddress) userData.client_ip_address = event.userData.clientIpAddress;
  if (event.userData.clientUserAgent) userData.client_user_agent = event.userData.clientUserAgent;
  if (event.userData.fbc) userData.fbc = event.userData.fbc;
  if (event.userData.fbp) userData.fbp = event.userData.fbp;

  const body = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(event.eventTime.getTime() / 1000),
        event_id: event.eventId,
        action_source: 'website',
        event_source_url: event.sourceUrl,
        user_data: userData,
      },
    ],
    ...(env.META_TEST_EVENT_CODE ? { test_event_code: env.META_TEST_EVENT_CODE } : {}),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { success: false, error: `Meta CAPI ${response.status}: ${text.slice(0, 300)}` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
