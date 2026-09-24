import Script from 'next/script';

/**
 * Site-wide Meta Pixel base code. Renders nothing when META_PIXEL_ID is unset (local dev).
 * The ID is passed in from the (request-time) root layout rather than read from
 * NEXT_PUBLIC_*, so one Docker image serves TEST and PRODUCTION with different pixels.
 * Lead/Schedule/Purchase are fired at the moments that actually confirm them, with a shared
 * event_id so the server-side Conversions API call dedupes against the browser event.
 */
export function MetaPixel({ pixelId }: { pixelId?: string }) {
  if (!pixelId) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(pixelId)});fbq('track','PageView');`}
    </Script>
  );
}
