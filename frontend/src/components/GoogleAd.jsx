import { useEffect } from 'react';

export default function GoogleAd({ type = 'leaderboard', client, slot }) {
  // Read AdSense Client ID & Slot IDs from env variables, props, or publisher ID
  const adClient = client || import.meta.env.VITE_ADSENSE_CLIENT_ID || 'ca-pub-6764886759571309';
  const adSlot = slot || (
    type === 'leaderboard' 
      ? (import.meta.env.VITE_ADSENSE_SLOT_LEADERBOARD || '') 
      : (type === 'sidebar' ? (import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR || '') : (import.meta.env.VITE_ADSENSE_SLOT_INGRID || '7330250129'))
  );

  useEffect(() => {
    if (adClient && adSlot) {
      // 1. Automatically load Google AdSense script in head if not already present
      const scriptId = 'google-adsense-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`;
        script.async = true;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }

      // 2. Safely push ad request to window.adsbygoogle queue
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.warn('[GoogleAd] AdSense push error or adblocker detected:', err.message);
      }
    }
  }, [adClient, adSlot]);

  // Real Google AdSense unit (when Client ID is configured)
  if (adClient) {
    return (
      <div className={`ad-wrapper ad-wrapper-${type}`} style={{ margin: '0', width: '100%', overflow: 'hidden', borderRadius: '12px' }}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', borderRadius: '12px' }}
          data-ad-client={adClient}
          {...(adSlot ? { 'data-ad-slot': adSlot } : {})}
          data-ad-format={type === 'in-grid' ? 'fluid' : 'auto'}
          {...(type === 'in-grid' ? { 'data-ad-layout-key': '-fb+5w+4e-db+86' } : {})}
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  return null;
}
