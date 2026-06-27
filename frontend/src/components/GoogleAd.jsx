import { useEffect } from 'react';

export default function GoogleAd({ type = 'leaderboard', client, slot }) {
  // Read AdSense Client ID & Slot IDs from env variables or props
  const adClient = client || import.meta.env.VITE_ADSENSE_CLIENT_ID;
  const adSlot = slot || (
    type === 'leaderboard' 
      ? import.meta.env.VITE_ADSENSE_SLOT_LEADERBOARD 
      : (type === 'sidebar' ? import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR : import.meta.env.VITE_ADSENSE_SLOT_INGRID)
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
  if (adClient && adSlot) {
    return (
      <div className={`ad-wrapper ad-wrapper-${type}`} style={{ margin: '1rem 0', width: '100%', overflow: 'hidden' }}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={adClient}
          data-ad-slot={adSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // Development / Demo Mode Placeholder UI (when environment variables are not set)
  if (type === 'leaderboard') {
    return (
      <div className="ad-slot-leaderboard" style={{ marginTop: '1.5rem' }}>
        <span className="ad-label">Sponsored</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="ad-accent-bar"></div>
          <span style={{ fontWeight: 600, letterSpacing: '0.05em' }}>GOOGLE ADSENSE BANNER</span>
          <div className="ad-accent-bar"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-slot-in-grid">
      <span className="ad-label">Sponsored Ad</span>
      <div className="ad-accent-bar" style={{ width: '60px' }}></div>
      <h3 className="ad-title">
        Looking for Custom Themes?
      </h3>
      <p className="ad-desc">
        Discover curated designer accessories and workspace gear that match your screens.
      </p>
      <button className="ad-cta-btn" onClick={() => window.open('https://google.com', '_blank')}>
        Learn More
      </button>
    </div>
  );
}
