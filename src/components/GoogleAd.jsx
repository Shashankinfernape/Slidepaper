

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
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.5rem 0 0.25rem 0' }}>
        Looking for Custom Themes?
      </h3>
      <p style={{ fontSize: '0.85rem', lineHeight: 1.5, opacity: 0.8, maxWidth: '240px' }}>
        Discover curated designer accessories and workspace gear that match your screens.
      </p>
      <button 
        style={{
          backgroundColor: 'var(--text-primary)',
          color: 'var(--bg-primary)',
          border: 'none',
          padding: '0.65rem 1.25rem',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.8rem',
          fontWeight: 700,
          cursor: 'pointer',
          marginTop: '0.5rem',
          transition: 'var(--transition-smooth)'
        }}
        onClick={() => window.open('https://google.com', '_blank')}
      >
        Learn More
      </button>
    </div>
  );
}
