import { useState, useEffect, useMemo } from 'react';
import { Check, ArrowLeft, DollarSign, Grid } from 'lucide-react';
import WallpaperGrid from './WallpaperGrid';
import MonetizationDashboard from './MonetizationDashboard';
import { getProxiedImageUrl } from './AdminDashboard';
import { useAuth } from '../context/AuthContext';

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
if (
  typeof window !== 'undefined' &&
  window.location.protocol === 'https:' &&
  API_URL.startsWith('http://') &&
  !API_URL.includes('localhost') &&
  !API_URL.includes('127.0.0.1')
) {
  API_URL = API_URL.replace('http://', 'https://');
}

export default function ChannelPage({ channel, bundles = [], onSelectBundle, onBack, user }) {
  const { userProfile, subscriptions = [], toggleSubscriptionLocal } = useAuth();
  const [remoteAuthor, setRemoteAuthor] = useState(null);
  
  const targetUid = channel?.uid || channel?.author?.uid;
  const isSubscribed = targetUid ? subscriptions.includes(targetUid) : false;
  
  const [subscribeAnimEnabled, setSubscribeAnimEnabled] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(channel?.subscribers || 0);
  const [activeTab, setActiveTab] = useState('wallpapers'); // 'wallpapers' | 'monetization'

  // Fetch remote author profile if needed
  useEffect(() => {
    const targetUid = channel?.uid || channel?.author?.uid;
    if (!targetUid) return;

    fetch(`${API_URL}/api/authors/${targetUid}/status?userUid=${user?.uid || ''}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && data.profile) {
          setRemoteAuthor(data.profile);
          if (data.profile.subscribers !== undefined) {
            setSubscribersCount(data.profile.subscribers);
          }
        }
      })
      .catch(() => {});
  }, [channel, user]);

  // Extract isOwnChannel outside to conditionally show admin tabs
  const isOwnChannel = Boolean(
    (targetUid && ((userProfile?.uid && userProfile.uid === targetUid) || (user?.uid && user.uid === targetUid))) ||
    (channel?.email && ((userProfile?.email && userProfile.email.toLowerCase() === channel.email.toLowerCase()) || (user?.email && user.email.toLowerCase() === channel.email.toLowerCase())))
  );

  // Resolve live profile parity (matches userProfile when viewing own channel)
  const resolvedProfile = useMemo(() => {
    const live = isOwnChannel ? userProfile : null;
    const remote = remoteAuthor || {};

    // Check if any bundle in bundles array has author info for this creator
    const targetSlug = String(channel?.uid || channel?.displayName || channel?.name || '').toLowerCase();
    const bundleAuthorMatch = (bundles || []).find(b => {
      const bUid = String(b.author?.uid || '').toLowerCase();
      const bName = String(b.author?.name || b.author?.displayName || '').toLowerCase();
      return (bUid && bUid === targetSlug) || (bName && bName === targetSlug);
    })?.author || {};

    const hasRealName = Boolean(live?.displayName || remote.displayName || (channel?.displayName && channel.displayName !== 'Creator') || (channel?.name && channel.name !== 'Creator') || bundleAuthorMatch.displayName || bundleAuthorMatch.name);

    const finalName = live?.displayName || remote.displayName || (channel?.displayName && channel.displayName !== 'Creator' ? channel.displayName : null) || (channel?.name && channel.name !== 'Creator' ? channel.name : null) || bundleAuthorMatch.displayName || bundleAuthorMatch.name || 'Creator';

    return {
      ...bundleAuthorMatch,
      ...channel,
      ...remote,
      ...(live || {}),
      displayName: finalName,
      isPlaceholderName: !hasRealName,
      photoURL: live?.photoURL || remote.photoURL || channel?.photoURL || channel?.avatar || bundleAuthorMatch.photoURL || bundleAuthorMatch.avatar,
      about: live?.about !== undefined ? live.about : (remote.about !== undefined ? remote.about : (channel?.about || bundleAuthorMatch.about || '')),
      bannerURL: live?.bannerURL || remote.bannerURL || channel?.bannerURL || bundleAuthorMatch.bannerURL || '',
      youtubeUrl: live?.youtubeUrl || remote.youtubeUrl || channel?.youtubeUrl || bundleAuthorMatch.youtubeUrl || '',
      instagramUrl: live?.instagramUrl || remote.instagramUrl || channel?.instagramUrl || bundleAuthorMatch.instagramUrl || '',
      twitterUrl: live?.twitterUrl || remote.twitterUrl || channel?.twitterUrl || bundleAuthorMatch.twitterUrl || '',
      joined: live?.joined || remote.joined || channel?.joined || bundleAuthorMatch.joined || null,
    };
  }, [channel, remoteAuthor, userProfile, user, bundles, isOwnChannel]);

  const channelName = resolvedProfile.displayName;
  const avatarUrl = getProxiedImageUrl(resolvedProfile.photoURL) || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
  const bannerUrl = getProxiedImageUrl(resolvedProfile.bannerURL);
  const handleName = `@${channelName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // Filter wallpapers uploaded specifically by this creator
  const creatorBundles = useMemo(() => {
    if (!bundles || bundles.length === 0) return [];

    const targetUid = String(resolvedProfile?.uid || channel?.uid || '').toLowerCase();
    const targetName = String(resolvedProfile?.displayName || channel?.displayName || channel?.name || channelName || '').toLowerCase();
    const targetEmail = String(resolvedProfile?.email || channel?.email || '').toLowerCase();

    return bundles.filter(b => {
      const bUid = String(b.author?.uid || '').toLowerCase();
      const bName = String(b.author?.name || b.author?.displayName || '').toLowerCase();
      const bEmail = String(b.author?.email || '').toLowerCase();

      // 1. Direct UID match
      if (targetUid && bUid && targetUid === bUid) return true;

      // 2. Direct Email match
      if (targetEmail && bEmail && targetEmail === bEmail) return true;

      // 3. Direct Name match
      if (targetName && bName && targetName === bName) return true;

      // 4. Flexible URL fallback match (if targetUid or targetName matches author name/uid)
      if (targetUid && (bName === targetUid || bUid === targetUid)) return true;
      if (targetName && (bUid === targetName || bName === targetName)) return true;

      return false;
    });
  }, [bundles, resolvedProfile, channelName, channel]);

  const displayBundles = creatorBundles;

  const handleSubscribeToggle = async () => {
    setSubscribeAnimEnabled(true);
    const resolvedTargetUid = resolvedProfile?.uid || 'admin-mock-999';
    
    if (isSubscribed) {
      setSubscribersCount(prev => Math.max(0, prev - 1));
    } else {
      setSubscribersCount(prev => prev + 1);
    }
    
    toggleSubscriptionLocal(resolvedTargetUid);

    if (user) {
      try {
        await fetch(`${API_URL}/api/authors/${resolvedTargetUid}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            uid: user.uid,
            email: user.email || userProfile?.email,
            displayName: user.displayName || userProfile?.displayName,
            photoURL: user.photoURL || userProfile?.photoURL
          })
        });
      } catch (_) {}
    }
  };

  const formatSubscribers = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formattedJoined = resolvedProfile.joined
    ? new Date(resolvedProfile.joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'June 2026';

  const isResolving = resolvedProfile.isPlaceholderName && (!bundles || bundles.length === 0);

  if (isResolving) {
    return (
      <div className="youtube-channel-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', padding: '2rem 0' }}>
        <div style={{ width: '100%', height: '200px', borderRadius: '18px', background: 'var(--bg-secondary)', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '0 1rem' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-secondary)', opacity: 0.5 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ width: '180px', height: '24px', borderRadius: '6px', background: 'var(--bg-secondary)', opacity: 0.5 }} />
            <div style={{ width: '120px', height: '16px', borderRadius: '4px', background: 'var(--bg-secondary)', opacity: 0.3 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="youtube-channel-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', position: 'relative' }}>
      
      {/* YouTube Style Channel Banner with integrated Glassmorphic Back Button */}
      <div style={{
        width: '100%',
        height: '200px',
        borderRadius: '18px',
        background: bannerUrl ? `url(${bannerUrl}) center/cover no-repeat` : 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
      }}>
        {!bannerUrl && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 75% 30%, rgba(59, 130, 246, 0.2), transparent 65%)',
            pointerEvents: 'none'
          }} />
        )}

        {/* Floating Glass Reworked Back Button */}
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            padding: '0.55rem 1.2rem',
            borderRadius: '999px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.75)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <ArrowLeft size={16} />
          <span>Back to Feed</span>
        </button>
      </div>

      {/* Channel Header Block */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1.75rem',
        padding: '0 0.5rem',
        marginTop: '-2.5rem',
        flexWrap: 'wrap'
      }} className="channel-header-block">
        
        {/* Channel Avatar */}
        <div style={{
          position: 'relative',
          width: '128px',
          height: '128px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '4px solid var(--bg-primary)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          background: 'var(--bg-secondary)',
          flexShrink: 0
        }}>
          <img
            src={avatarUrl}
            alt={channelName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'; }}
          />
        </div>

        {/* Channel Copy & Integrated Compact Profile Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1, minWidth: '260px', marginTop: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.5px' }}>{channelName}</h1>
              <span className="verified-badge-circle" title="Verified Creator" style={{ width: '18px', height: '18px', background: '#3b82f6', color: '#fff' }}>
                <svg viewBox="0 0 24 24" className="verified-badge-svg" style={{ width: '100%', height: '100%' }}>
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
                </svg>
              </span>
            </div>
          </div>

          {/* Meta line with aligned Subscribe Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.86rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{handleName}</span>
              <span>•</span>
              <span>{formatSubscribers(subscribersCount)} subscribers</span>
              <span>•</span>
              <span>{displayBundles.length} wallpapers</span>
              <span>•</span>
              <span>Joined {formattedJoined}</span>
            </div>

            {/* Subscribe Action aligned to same bottom line */}
            <div style={{ flexShrink: 0 }}>
              <button
                onClick={handleSubscribeToggle}
                style={{
                  padding: '0.5rem 1.4rem',
                  borderRadius: '999px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  border: isSubscribed ? '1px solid var(--border-color)' : 'none',
                  transition: subscribeAnimEnabled ? 'all 0.2s' : 'none',
                  background: isSubscribed ? 'var(--bg-secondary)' : '#ffffff',
                  color: isSubscribed ? 'var(--text-primary)' : '#000000',
                  boxShadow: isSubscribed ? 'none' : '0 4px 16px rgba(255,255,255,0.25)',
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

          {/* Compact Bio along profile */}
          {resolvedProfile.about && (
            <p style={{
              margin: '0.2rem 0 0 0',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.45',
              maxWidth: '750px'
            }}>
              {resolvedProfile.about}
            </p>
          )}

          {/* Compact Social Chips along profile */}
          {(resolvedProfile.youtubeUrl || resolvedProfile.instagramUrl || resolvedProfile.twitterUrl) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
              {resolvedProfile.youtubeUrl && (
                <a href={resolvedProfile.youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.387.51C1.05 4.382.518 5.42.518 6.163C0 8.025 0 12 0 12s0 3.975.518 5.837c.252.743.785 1.282 2.095 1.51C4.475 19.855 12 19.855 12 19.855s7.524 0 9.388-.508c1.312-.228 1.844-1.267 2.095-1.51c.517-1.862.517-5.837.517-5.837s0-3.975-.517-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  YouTube
                </a>
              )}
              {resolvedProfile.instagramUrl && (
                <a href={resolvedProfile.instagramUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(225, 48, 108, 0.12)', color: '#e1306c', border: '1px solid rgba(225, 48, 108, 0.25)', padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                  Instagram
                </a>
              )}
              {resolvedProfile.twitterUrl && (
                <a href={resolvedProfile.twitterUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(29, 161, 242, 0.12)', color: '#1da1f2', border: '1px solid rgba(29, 161, 242, 0.25)', padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Twitter / X
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Clean Tab Navigation */}
      <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', margin: '1rem 0 1.5rem 0' }}>
        <button
          onClick={() => setActiveTab('wallpapers')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'wallpapers' ? '3px solid #3b82f6' : '3px solid transparent',
            color: activeTab === 'wallpapers' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'wallpapers' ? 700 : 500,
            fontSize: '0.95rem',
            padding: '0.75rem 0.25rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Grid size={16} />
          <span>Wallpapers ({displayBundles.length})</span>
        </button>

        {isOwnChannel && (
          <button
            onClick={() => setActiveTab('monetization')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'monetization' ? '3px solid #22c55e' : '3px solid transparent',
              color: activeTab === 'monetization' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'monetization' ? 700 : 500,
              fontSize: '0.95rem',
              padding: '0.75rem 0.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <DollarSign size={16} style={{ color: '#22c55e' }} />
            <span>Monetization & Revenue</span>
          </button>
        )}
      </div>

      {/* Tab Content Showcase */}
      {activeTab === 'wallpapers' ? (
        <div>
          <WallpaperGrid
            bundles={displayBundles}
            onSelectBundle={onSelectBundle}
          />
        </div>
      ) : (
        <MonetizationDashboard isInline={true} creatorUid={resolvedProfile?.uid} />
      )}
    </div>
  );
}
