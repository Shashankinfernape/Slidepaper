

export default function GoogleAd({ type = 'leaderboard' }) {
  // In a real environment, this component would host:
  // (adsbygoogle = window.adsbygoogle || []).push({});
  
  if (type === 'leaderboard') {
    return (
      <div className="ad-slot-leaderboard">
        <span className="ad-label">Sponsored</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="ad-accent-bar"></div>
          <span style={{ fontWeight: 600, letterSpacing: '0.05em' }}>GOOGLE ADSENSE BANNER</span>
          <div className="ad-accent-bar"></div>
        </div>
      </div>
    );
  }

  // in-grid card ad
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
