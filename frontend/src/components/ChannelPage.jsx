import { useState, useMemo } from 'react';
import { Check, ArrowLeft, Shield } from 'lucide-react';
import WallpaperGrid from './WallpaperGrid';
import { getProxiedImageUrl } from './AdminDashboard';

export default function ChannelPage({ channel, bundles = [], onSelectBundle, onBack, user }) {
  const [activeTab, setActiveTab] = useState('wallpapers');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(channel?.subscribers || 68400);

  const channelName = channel?.displayName || channel?.name || 'Creator Studio';
  const avatarUrl = getProxiedImageUrl(channel?.photoURL || channel?.avatar) || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80';
  const handleName = `@${channelName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // Filter wallpapers uploaded by this creator
  const creatorBundles = useMemo(() => {
    if (!bundles || bundles.length === 0) return [];
    return bundles.filter(b => {
      if (channel?.uid && b.author?.uid) {
        return b.author.uid === channel.uid;
      }
      return b.author?.name === channelName;
    });
  }, [bundles, channel, channelName]);

  const displayBundles = creatorBundles.length > 0 ? creatorBundles : bundles;

  const handleSubscribeToggle = () => {
    if (isSubscribed) {
      setIsSubscribed(false);
      setSubscribersCount(prev => Math.max(0, prev - 1));
    } else {
      setIsSubscribed(true);
      setSubscribersCount(prev => prev + 1);
    }
  };

  const formatSubscribers = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="youtube-channel-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      
      {/* Top Navigation Bar / Back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '0.6rem 1.2rem',
            borderRadius: '999px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.88rem',
            transition: 'all 0.2s'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Feed</span>
        </button>
      </div>

      {/* YouTube Style Channel Banner */}
      <div style={{
        width: '100%',
        height: '180px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 70% 30%, rgba(59, 130, 246, 0.15), transparent 60%)',
          pointerEvents: 'none'
        }} />
      </div>

      {/* YouTube Channel Header Block */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1.75rem',
        padding: '0 0.5rem',
        marginTop: '-2rem',
        flexWrap: 'wrap'
      }} className="channel-header-block">
        
        {/* Channel Avatar */}
        <div style={{
          position: 'relative',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '4px solid var(--bg-primary)',
          boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
          background: 'var(--bg-secondary)',
          flexShrink: 0
        }}>
          <img
            src={avatarUrl}
            alt={channelName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'; }}
          />
        </div>

        {/* Channel Copy & Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '240px', marginTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.5px' }}>{channelName}</h1>
            <span className="verified-badge-circle" title="Verified Creator" style={{ width: '18px', height: '18px', background: '#3b82f6', color: '#fff' }}>
              <svg viewBox="0 0 24 24" className="verified-badge-svg" style={{ width: '100%', height: '100%' }}>
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
              </svg>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.88rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{handleName}</span>
            <span>•</span>
            <span>{formatSubscribers(subscribersCount)} subscribers</span>
            <span>•</span>
            <span>{displayBundles.length} wallpapers</span>
          </div>

          <p style={{
            margin: '0.4rem 0 0 0',
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
            maxHeight: '2.8em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '1.4'
          }}>
            {channel?.about || 'Welcome to the official wallpaper studio channel! Explore high-resolution curated multi-screen wallpaper sets.'}
          </p>
        </div>

        {/* YouTube Subscribe Action */}
        <div style={{ marginTop: '2.2rem', flexShrink: 0 }}>
          <button
            onClick={handleSubscribeToggle}
            style={{
              padding: '0.75rem 1.8rem',
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              border: isSubscribed ? '1px solid var(--border-color)' : 'none',
              transition: 'all 0.2s',
              background: isSubscribed ? 'var(--bg-secondary)' : '#ffffff',
              color: isSubscribed ? 'var(--text-primary)' : '#000000',
              boxShadow: isSubscribed ? 'none' : '0 4px 14px rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isSubscribed ? (
              <>
                <Check size={16} />
                <span>Subscribed</span>
              </>
            ) : (
              <span>Subscribe</span>
            )}
          </button>
        </div>
      </div>

      {/* YouTube Channel Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '2rem',
        borderBottom: '1px solid var(--border-color)',
        paddingTop: '0.5rem',
        marginTop: '0.5rem'
      }}>
        {[
          { id: 'wallpapers', label: 'Wallpapers' },
          { id: 'about', label: 'About' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid var(--text-primary)' : '3px solid transparent',
              padding: '0.75rem 0.5rem',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'wallpapers' ? (
        <div>
          <WallpaperGrid
            bundles={displayBundles}
            onSelectBundle={onSelectBundle}
          />
        </div>
      ) : (
        <div style={{
          padding: '2rem',
          background: 'var(--bg-primary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          maxWidth: '700px'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Description</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.92rem' }}>
            {channel?.about || 'Welcome to the official wallpaper studio channel! Dedicated to crafting stunning multi-monitor, ultra-wide and mobile aesthetic wallpapers.'}
          </p>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Channel Details</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              <div>Joined: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{channel?.joined ? new Date(channel.joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'June 2026'}</span></div>
              <div>Location: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Global Studio</span></div>
            </div>
          </div>

          {(channel?.youtubeUrl || channel?.instagramUrl || channel?.twitterUrl) && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Links</h4>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {channel?.youtubeUrl && (
                  <a href={channel.youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.387.51C1.05 4.382.518 5.42.518 6.163C0 8.025 0 12 0 12s0 3.975.518 5.837c.252.743.785 1.282 2.095 1.51C4.475 19.855 12 19.855 12 19.855s7.524 0 9.388-.508c1.312-.228 1.844-1.267 2.095-1.51c.517-1.862.517-5.837.517-5.837s0-3.975-.517-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    YouTube
                  </a>
                )}
                {channel?.instagramUrl && (
                  <a href={channel.instagramUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e1306c', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                    Instagram
                  </a>
                )}
                {channel?.twitterUrl && (
                  <a href={channel.twitterUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1da1f2', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Twitter / X
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
