import Script from "next/script";

const GA4 = /^G-[A-Z0-9]{4,15}$/;
const PIXEL = /^\d{5,20}$/;

/** Google Analytics 4 and Meta Pixel, when the store has IDs set (validated, so nothing else can be injected). */
export function Analytics({ ga4Id, metaPixelId }: { ga4Id: string | null; metaPixelId: string | null }) {
  const ga = ga4Id && GA4.test(ga4Id) ? ga4Id : null;
  const pixel = metaPixelId && PIXEL.test(metaPixelId) ? metaPixelId : null;
  return (
    <>
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
        </>
      )}
      {pixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
