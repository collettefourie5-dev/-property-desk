'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export interface PixelEvent {
  name: 'Lead' | 'Schedule';
  eventId: string;
}

/**
 * Fires the browser-side half of each Meta event, using the same event_id the server sent via
 * the Conversions API, so Meta dedupes the two instead of double-counting. Guarded by
 * localStorage so refreshing or revisiting the confirmation page never re-fires an event that
 * already landed — each (booking, event) pair fires at most once from this browser.
 */
export function FirePixelEvents({ bookingId, events }: { bookingId: string; events: PixelEvent[] }) {
  useEffect(() => {
    if (!window.fbq) return;
    for (const event of events) {
      const key = `pd_pixel_${bookingId}_${event.name}`;
      try {
        if (localStorage.getItem(key)) continue;
        window.fbq('track', event.name, {}, { eventID: event.eventId });
        localStorage.setItem(key, '1');
      } catch {
        // localStorage can throw (private browsing, storage disabled) — fire-once best effort only.
        window.fbq('track', event.name, {}, { eventID: event.eventId });
      }
    }
  }, [bookingId, events]);

  return null;
}
