import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// src/lib/env.ts caches its parsed result for the life of the module, so each test that changes
// process.env needs a fresh module registry — otherwise it would see the previous test's env.
async function freshSendCapiEvent() {
  vi.resetModules();
  return (await import('@/lib/tracking/meta-capi')).sendCapiEvent;
}

const baseEvent = {
  eventName: 'Lead' as const,
  eventId: 'evt-1',
  eventTime: new Date('2026-09-24T08:00:00Z'),
  sourceUrl: 'https://desk.example/book/confirmation',
  userData: { email: 'Jane@Example.com', phone: '082 123 4567', clientIpAddress: '1.2.3.4' },
};

describe('sendCapiEvent', () => {
  it('does nothing (and does not throw) when Meta is not configured', async () => {
    process.env.META_PIXEL_ID = '';
    process.env.META_CAPI_ACCESS_TOKEN = '';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const sendCapiEvent = await freshSendCapiEvent();
    const result = await sendCapiEvent(baseEvent);
    expect(result.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts hashed email/phone, plaintext IP, and the shared event_id for dedup', async () => {
    process.env.META_PIXEL_ID = 'pixel123';
    process.env.META_CAPI_ACCESS_TOKEN = 'token123';
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);

    const sendCapiEvent = await freshSendCapiEvent();
    const result = await sendCapiEvent(baseEvent);
    expect(result.success).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v26.0/pixel123/events?access_token=token123');
    const body = JSON.parse(init.body);
    expect(body.data[0]).toMatchObject({
      event_name: 'Lead',
      event_id: 'evt-1',
      event_time: Math.floor(baseEvent.eventTime.getTime() / 1000),
      action_source: 'website',
      event_source_url: baseEvent.sourceUrl,
    });
    expect(body.data[0].user_data.em).toMatch(/^[a-f0-9]{64}$/);
    expect(body.data[0].user_data.em).not.toContain('jane');
    expect(body.data[0].user_data.ph).toMatch(/^[a-f0-9]{64}$/);
    expect(body.data[0].user_data.client_ip_address).toBe('1.2.3.4');
    expect(body.test_event_code).toBeUndefined();
  });

  it('includes test_event_code only when configured', async () => {
    process.env.META_PIXEL_ID = 'pixel123';
    process.env.META_CAPI_ACCESS_TOKEN = 'token123';
    process.env.META_TEST_EVENT_CODE = 'TEST12345';
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);

    const sendCapiEvent = await freshSendCapiEvent();
    await sendCapiEvent(baseEvent);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.test_event_code).toBe('TEST12345');
  });

  it('reports failure without throwing on a non-2xx response or a network error', async () => {
    process.env.META_PIXEL_ID = 'pixel123';
    process.env.META_CAPI_ACCESS_TOKEN = 'token123';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' }));
    let sendCapiEvent = await freshSendCapiEvent();
    const badResponse = await sendCapiEvent(baseEvent);
    expect(badResponse).toMatchObject({ success: false });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    sendCapiEvent = await freshSendCapiEvent();
    await expect(sendCapiEvent(baseEvent)).resolves.toMatchObject({ success: false, error: 'network down' });
  });
});
