import { useMemo, useState, useEffect } from 'react';
import {
  Bell,
  Check,
  Download,
  Monitor,
  Smartphone,
  Sliders,
} from 'lucide-react';
import { WALLPAPER_BUNDLES } from '../data';
import BundleCard from './BundleCard';
import GoogleAd from './GoogleAd';

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Automatically upgrade HTTP to HTTPS in production to avoid mixed content block on mobile
if (
  typeof window !== 'undefined' &&
  window.location.protocol === 'https:' &&
  API_URL.startsWith('http://') &&
  !API_URL.includes('localhost') &&
  !API_URL.includes('127.0.0.1')
) {
  API_URL = API_URL.replace('http://', 'https://');
}

const SAMPLE_RATIOS = [
  { w: '16', h: '9' },
  { w: '2.1', h: '1' },
  { w: '32', h: '9' },
  { w: '4', h: '3' },
  { w: '21', h: '9' }
];

function getOptionIcon(optionId) {
  const id = optionId.toLowerCase();
  if (id.includes('desktop') || id.includes('ultrawide') || id.includes('triple') || id.includes('landscape') || id.includes('original')) {
    return <Monitor size={14} style={{ marginRight: '6px', flexShrink: 0 }} />;
  }
  if (id.includes('mobile') || id.includes('phone') || id.includes('portrait')) {
    return <Smartphone size={14} style={{ marginRight: '6px', flexShrink: 0 }} />;
  }
  if (id.includes('custom')) {
    return <Sliders size={14} style={{ marginRight: '6px', flexShrink: 0 }} />;
  }
  return <Monitor size={14} style={{ marginRight: '6px', flexShrink: 0 }} />;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}



function formatSubscribers(value) {
  if (!value) return '0 subscribers';

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace('.0', '')}M subscribers`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace('.0', '')}K subscribers`;
  }

  return `${value} subscribers`;
}

export default function BundleDetailPage({
  bundle,
  onOpenBundle,
  user,
  loginWithGoogle,
  bundles = [],
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 768px)');
    setIsMobile(media.matches);
    const listener = (e) => setIsMobile(e.matches);
    if (media.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else {
      media.addListener(listener);
      return () => media.removeListener(listener);
    }
  }, []);

  const isPortrait = bundle.orientation === 'portrait' || bundle.orientation === 'vertical';
  const isLandscape = !isPortrait;

  const presets = useMemo(() => {
    const rawPresets = bundle.ratioOptions || [];
    let filtered = [];
    if (isLandscape) {
      // Filter out presets that are mobile/portrait and also filter out triple monitor presets
      filtered = rawPresets.filter(p => {
        const id = p.id.toLowerCase();
        const label = p.label.toLowerCase();
        const isMobile = id.includes('mobile') || id.includes('phone') || id.includes('portrait') || label.includes('mobile') || label.includes('phone') || label.includes('portrait');
        const isTriple = id.includes('triple') || label.includes('triple') || label.includes('48:9');
        return !isMobile && !isTriple;
      });
    } else {
      // Portrait: Filter out presets that are desktop/landscape
      filtered = rawPresets.filter(p => {
        const id = p.id.toLowerCase();
        const label = p.label.toLowerCase();
        return id.includes('mobile') || id.includes('phone') || id.includes('portrait') || label.includes('mobile') || label.includes('phone') || label.includes('portrait');
      });
    }

    // Always ensure 'Original' option exists!
    const hasOriginal = filtered.some(p => p.id === 'original');
    if (!hasOriginal) {
      filtered.unshift({
        id: 'original',
        label: 'Original',
        subtitle: 'Uncropped high-res wallpapers',
        resolution: 'Original',
        size: 'Full Size ZIP',
        formats: ['PNG', 'JPG']
      });
    }

    return filtered;
  }, [bundle, isLandscape]);

  const supportsLandscapeDownloads = true;

  const allOptions = useMemo(() => {
    return [...presets, { id: 'custom', label: 'Custom Ratio' }];
  }, [presets]);

  const [selectedDownloadId, setSelectedDownloadId] = useState(
    allOptions.length > 0 ? allOptions[0].id : 'custom'
  );
  const [customRatioWidth, setCustomRatioWidth] = useState(isPortrait ? '9' : '16');
  const [customRatioHeight, setCustomRatioHeight] = useState(isPortrait ? '16' : '9');

  // Reset selected option and custom ratio inputs when bundle changes
  useEffect(() => {
    if (presets.length > 0) {
      setSelectedDownloadId(presets[0].id);
    } else {
      setSelectedDownloadId('custom');
    }
    setCustomRatioWidth(isPortrait ? '9' : '16');
    setCustomRatioHeight(isPortrait ? '16' : '9');
  }, [bundle, presets, isPortrait]);

  const [downloadState, setDownloadState] = useState('idle');
  const [reaction, setReaction] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(bundle.author.subscribers || 0);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authActionLabel, setAuthActionLabel] = useState('continue');
  const [selectedSidebarGenre, setSelectedSidebarGenre] = useState('All');
  const [authorProfile, setAuthorProfile] = useState(null);

  // Fetch real subscriber count and subscription status
  useEffect(() => {
    if (user && bundle.likedBy && Array.isArray(bundle.likedBy)) {
      if (bundle.likedBy.includes(user.uid)) {
        setReaction('like');
      } else {
        setReaction(null);
      }
    } else {
      setReaction(null);
    }
    
    const fetchSubscriptionStatus = async () => {
      if (!bundle.author || !bundle.author.uid) return;
      try {
        const uidParam = user ? `?uid=${user.uid}` : '';
        const res = await fetch(`${API_URL}/api/authors/${bundle.author.uid}/status${uidParam}`);
        if (res.ok) {
          const data = await res.json();
          setIsSubscribed(data.isSubscribed);
          setSubscribersCount(data.subscribers);
          setAuthorProfile(data.profile);
        }
      } catch (err) {
        console.error('Failed to fetch author subscription status:', err);
      }
    };

    const incrementViewCount = async () => {
      try {
        await fetch(`${API_URL}/api/bundles/${bundle.id}/view`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to increment views:', err);
      }
    };

    fetchSubscriptionStatus();
    incrementViewCount();
  }, [bundle, user]);

  const handleLikeToggle = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bundles/${bundle.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid })
      });
      if (res.ok) {
        const data = await res.json();
        setReaction(data.liked ? 'like' : null);
        bundle.stats.likes = data.likes;
        bundle.likedBy = data.likedBy;
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleDislikeToggle = async () => {
    if (reaction === 'like') {
      await handleLikeToggle();
    }
    setReaction(prev => prev === 'dislike' ? null : 'dislike');
  };

  const handleSubscribeToggle = async () => {
    if (!bundle.author || !bundle.author.uid) return;
    if (user.uid === bundle.author.uid) {
      alert('You cannot subscribe to yourself!');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/authors/${bundle.author.uid}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid })
      });
      if (res.ok) {
        const data = await res.json();
        setIsSubscribed(data.subscribed);
        setSubscribersCount(data.subscribers);
      }
    } catch (err) {
      console.error('Failed to toggle subscription:', err);
    }
  };

  // Rotating example placeholder states
  const [sampleIndex, setSampleIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSampleIndex((prev) => (prev + 1) % SAMPLE_RATIOS.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const activeSample = SAMPLE_RATIOS[sampleIndex];

  // Custom aspect ratio is w:h typed by user
  const customRatio = `${customRatioWidth || activeSample.w}:${customRatioHeight || activeSample.h}`;
  const customIsValid = useMemo(() => {
    const w = Number(customRatioWidth);
    const h = Number(customRatioHeight);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return false;
    return isLandscape ? w >= h : h >= w;
  }, [customRatioWidth, customRatioHeight, isLandscape]);

  const selectedDownload = useMemo(() => {
    if (selectedDownloadId === 'custom') {
      return { id: 'custom', device: 'Custom', ratio: customRatio, size: 'Estimate' };
    }

    const matchedPreset = presets.find((p) => p.id === selectedDownloadId);
    return matchedPreset ? { id: matchedPreset.id, device: matchedPreset.label, ratio: matchedPreset.label.split(' ')[0], size: matchedPreset.size } : { id: 'unknown', device: 'Preset', ratio: isLandscape ? '16:9' : '9:16', size: '15.4 MB' };
  }, [customRatio, selectedDownloadId, presets, isLandscape]);

  // Size label inside the download button
  const bundleSizeLabel = useMemo(() => {
    // Sum up the sizes of all images in the bundle (with fallback of 1.5MB per image if not defined yet)
    const sumBytes = bundle.images.reduce((sum, img) => sum + (img.size || 1500000), 0);

    if (selectedDownloadId === 'original') {
      const originalZipBytes = sumBytes * 0.95;
      if (originalZipBytes >= 1024 * 1024) {
        return `${(originalZipBytes / (1024 * 1024)).toFixed(2)} MB ZIP`;
      } else {
        return `${(originalZipBytes / 1024).toFixed(0)} KB ZIP`;
      }
    }

    let w = 16;
    let h = 9;

    if (selectedDownloadId === 'custom') {
      w = parseFloat(customRatioWidth) || 16;
      h = parseFloat(customRatioHeight) || 9;
    } else {
      const matchedPreset = presets.find((p) => p.id === selectedDownloadId);
      if (matchedPreset) {
        const ratioStr = matchedPreset.label.split(' ')[0];
        const [wStr, hStr] = ratioStr.split(':');
        w = parseFloat(wStr) || 16;
        h = parseFloat(hStr) || 9;
      }
    }

    const targetRatio = w / h;
    let sourceW = 16, sourceH = 9;
    if (bundle.ratio && bundle.ratio.includes(':')) {
      const parts = bundle.ratio.split(':');
      sourceW = parseFloat(parts[0]) || 16;
      sourceH = parseFloat(parts[1]) || 9;
    }
    const sourceRatio = sourceW / sourceH;

    let factor = 1.0;
    if (targetRatio > sourceRatio) {
      factor = sourceRatio / targetRatio;
    } else {
      factor = targetRatio / sourceRatio;
    }

    // Clamp factor to avoid division by zero or extreme crops
    factor = Math.max(0.05, Math.min(1.0, factor));

    // 0.95 factor represents ZIP compression on PNG files
    const totalBytes = sumBytes * factor * 0.95;

    if (totalBytes >= 1024 * 1024) {
      return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB ZIP`;
    } else {
      return `${(totalBytes / 1024).toFixed(0)} KB ZIP`;
    }
  }, [selectedDownloadId, customRatioWidth, customRatioHeight, bundle.images, bundle.ratio, presets]);

  const likeCount =
    bundle.stats.likes + (reaction === 'like' ? 1 : 0) - (reaction === 'dislike' ? 1 : 0);

  const runAuthedAction = async (label, action) => {
    if (!user) {
      setAuthActionLabel(label);
      setShowAuthPrompt(true);
      return;
    }

    action();
  };

  const handleDownload = async () => {
    if (downloadState !== 'idle') return;
    if (selectedDownloadId === 'custom' && !customIsValid) return;

    setDownloadState('downloading');

    try {
      let wStr, hStr;
      if (selectedDownloadId === 'original') {
        wStr = 'original';
        hStr = 'original';
      } else {
        const ratioStr = selectedDownloadId === 'custom' ? customRatio : (selectedDownload.ratio || '16:9');
        [wStr, hStr] = ratioStr.split(':');
      }

      const response = await fetch(`${API_URL}/api/custom-ratio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bundleId: bundle.id,
          widthRatio: wStr,
          heightRatio: hStr,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process wallpaper bundle');
      }

      const data = await response.json();

      // Trigger actual browser download pointing to Google Drive (mobile-friendly fallback)
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        window.location.href = data.downloadUrl;
      } else {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.setAttribute('download', '');
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setDownloadState('completed');
    } catch (error) {
      console.error('Download error:', error);
      alert(`Download failed: ${error.message}`);
      setDownloadState('idle');
    } finally {
      window.setTimeout(() => {
        setDownloadState('idle');
      }, 2000);
    }
  };

  const handleLoginFromPrompt = async () => {
    try {
      await loginWithGoogle?.();
      setShowAuthPrompt(false);
    } catch (error) {
      console.error('Google login failed:', error);
    }
  };

  const allBundlesList = useMemo(() => {
    return bundles || [];
  }, [bundles]);

  const genres = useMemo(() => {
    const uniqueTags = new Set();
    allBundlesList.forEach((item) => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((tag) => {
          if (tag) uniqueTags.add(tag);
        });
      }
    });
    return ['All', ...Array.from(uniqueTags)];
  }, [allBundlesList]);

  const filteredRelatedBundles = useMemo(() => {
    const others = allBundlesList.filter((item) => item.id !== bundle.id);
    if (selectedSidebarGenre === 'All') return others;
    return others.filter((item) => item.tags.includes(selectedSidebarGenre));
  }, [bundle.id, selectedSidebarGenre, allBundlesList]);

  const activeIndex = useMemo(() => {
    return allOptions.findIndex((option) => option.id === selectedDownloadId);
  }, [selectedDownloadId, allOptions]);

  return (
    <div className="bundle-youtube-page">
      <section className="bundle-youtube-layout">
        <div className="bundle-youtube-main">
          <div className="bundle-youtube-hero">
            <BundleCard
              bundle={bundle}
              showOverlay={false}
              className="bundle-card--watch-hero"
              autoPlay={true}
              shuffleOnClick={true}
            />
          </div>

          <div className="bundle-youtube-info">
            <h1 className="bundle-youtube-title">{bundle.name}</h1>

            <div className="bundle-youtube-meta-row">
              <div className="bundle-youtube-author-block">
                <div className="bundle-youtube-author-main">
                  <img
                    src={bundle.author.avatar}
                    alt={bundle.author.name}
                    className="bundle-youtube-author-avatar"
                  />
                  <div className="bundle-youtube-author-copy">
                    <span className="bundle-youtube-author-name">
                      {bundle.author.name}
                      <span className="verified-badge-circle" title="Verified Creator">
                        <svg viewBox="0 0 24 24" className="verified-badge-svg">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
                        </svg>
                      </span>
                    </span>
                    <span className="bundle-youtube-author-subs">
                      {formatSubscribers(subscribersCount)}
                    </span>
                  </div>
                </div>
 
                <div className="bundle-youtube-author-actions">
                  <button
                    className={`youtube-subscribe-btn ${isSubscribed ? 'subscribed' : ''}`}
                    onClick={() =>
                      runAuthedAction('subscribe to this author', handleSubscribeToggle)
                    }
                  >
                    {isSubscribed ? (
                      <>
                        <Bell size={15} />
                        <span>Subscribed</span>
                      </>
                    ) : (
                      <span>Subscribe</span>
                    )}
                  </button>
                </div>
              </div>
 
              <div className="youtube-actions-group">
                <div className="youtube-like-dislike-pill">
                  <button
                    className={`youtube-like-btn ${reaction === 'like' ? 'active' : ''}`}
                    onClick={() =>
                      runAuthedAction('like this bundle', handleLikeToggle)
                    }
                    title="I like this"
                  >
                    {reaction === 'like' ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: '6px' }}>
                        <path d="M3 11h3v10H3zm15.3-1c0-1.66-1.34-3-3-3h-3.3l.9-3.6.1-.3c0-.4-.1-.8-.4-1L11.6 2 6.4 7.2C6.1 7.5 6 7.8 6 8.2V19c0 1.1.9 2 2 2h7.3c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.2-.5.2-.8v-2z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                      </svg>
                    )}
                    <span>{formatNumber(Math.max(0, likeCount))}</span>
                  </button>
                  <div className="youtube-pill-divider"></div>
                  <button
                    className={`youtube-dislike-btn ${reaction === 'dislike' ? 'active' : ''}`}
                    onClick={() =>
                      runAuthedAction('dislike this bundle', handleDislikeToggle)
                    }
                    title="I dislike this"
                  >
                    {reaction === 'dislike' ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M21 11h-3V1H8.7c-.8 0-1.5.5-1.8 1.2l-3 7c-.1.2-.2.5-.2.8v2c0 1.66 1.34 3 3 3h3.3l-.9 3.6-.1.3c0 .4.1.8.4 1l1.8 1.8 5.2-5.2c.3-.3.4-.6.4-1V11c0-1.1-.9-2-2-2z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
                      </svg>
                    )}
                  </button>
                </div>

                <button
                  className="youtube-action-pill-btn"
                  onClick={() => alert('Share URL copied to clipboard!')}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: '4px' }}>
                    <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
                  </svg>
                  <span>Share</span>
                </button>

                <button
                  className="youtube-action-pill-btn"
                  onClick={() => alert('Bundle saved to library!')}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: '6px' }}>
                    <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z" />
                  </svg>
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>

          <div className="apple-download-panel">
            {supportsLandscapeDownloads ? (
              <div className={`apple-picker-wrapper ${selectedDownloadId === 'custom' ? 'has-custom' : ''}`}>
                <div className="apple-picker-container">
                  {activeIndex !== -1 && allOptions.length > 0 && (
                    <div
                      className="apple-picker-indicator"
                      style={{
                        width: `${100 / allOptions.length}%`,
                        transform: `translateX(${activeIndex * 100}%)`,
                      }}
                    ></div>
                  )}
                  {allOptions.map((option) => (
                    <button
                      key={option.id}
                      className={`apple-picker-option ${selectedDownloadId === option.id ? 'active' : ''}`}
                      onClick={() => setSelectedDownloadId(option.id)}
                    >
                      {getOptionIcon(option.id)}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>

                {selectedDownloadId === 'custom' && (
                  <div className="apple-custom-input-group">
                    <input
                      type="text"
                      placeholder={activeSample.w}
                      value={customRatioWidth}
                      onChange={(e) => setCustomRatioWidth(e.target.value)}
                      className="apple-custom-input"
                    />
                    <span className="apple-custom-divider">:</span>
                    <input
                      type="text"
                      placeholder={activeSample.h}
                      value={customRatioHeight}
                      onChange={(e) => setCustomRatioHeight(e.target.value)}
                      className="apple-custom-input"
                    />
                    {!customIsValid && (
                      <span className="apple-custom-error-text" style={{ fontSize: '0.72rem', color: '#ef4444', minWidth: '120px', display: 'block', marginTop: '4px' }}>
                        {Number(customRatioWidth) <= 0 || Number(customRatioHeight) <= 0
                          ? 'Enter valid ratio'
                          : isLandscape
                          ? 'Width must be ≥ Height'
                          : 'Height must be ≥ Width'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <span className="bundle-youtube-orientation-note">
                Optimized for vertical layouts.
              </span>
            )}

            <button
              className="apple-download-action-btn"
              onClick={handleDownload}
              disabled={downloadState === 'downloading' || (selectedDownloadId === 'custom' && !customIsValid)}
            >
              {downloadState === 'idle' && (
                <>
                  <Download size={15} />
                  <span>Download ({bundleSizeLabel})</span>
                </>
              )}
              {downloadState === 'downloading' && (
                <>
                  <div className="download-spinner-tiny"></div>
                  <span>Preparing...</span>
                </>
              )}
              {downloadState === 'completed' && (
                <>
                  <Check size={15} />
                  <span>Ready</span>
                </>
              )}
            </button>
          </div>

          <div className="youtube-description-box">
            <div className="youtube-description-meta">
              <span className="youtube-desc-views">{formatNumber(bundle.stats.views)} views</span>
              <span className="youtube-desc-downloads">{formatNumber(bundle.stats.downloads)} downloads</span>
              <span className="youtube-desc-date">2 weeks ago</span>
            </div>
            <p className="youtube-description-text">
              {bundle.description || 'No description provided for this bundle. Enjoy these high quality screen outputs.'}
            </p>
          </div>

          {/* About the Creator Card */}
          <div className={`creator-about-section gradient-accent-${authorProfile?.accentGradient || 'midnight'}`} style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            background: 'var(--bg-primary)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
          }}>
            <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.75)' }}>
              About The Creator
            </h3>
            
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }} className="creator-about-body">
              <img
                src={authorProfile?.photoURL || bundle.author.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'}
                alt={authorProfile?.displayName || bundle.author.name}
                className="creator-avatar-img"
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  background: 'var(--bg-secondary)'
                }}
              />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '1.08rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {authorProfile?.displayName || bundle.author.name}
                      <span className="verified-badge-circle" title="Verified Creator" style={{ width: '13px', height: '13px', margin: 0, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                        <svg viewBox="0 0 24 24" className="verified-badge-svg" style={{ width: '100%', height: '100%' }}>
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
                        </svg>
                      </span>
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginTop: '1px' }}>
                      {authorProfile?.joined ? `Joined ${new Date(authorProfile.joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : 'Joined recently'}
                    </span>
                  </div>
                  
                  {/* Social Links */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {authorProfile?.youtubeUrl && (
                      <a href={authorProfile.youtubeUrl} target="_blank" rel="noopener noreferrer" title="YouTube" className="creator-social-icon youtube" style={{ width: '30px', height: '30px', background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}>
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.387.51C1.05 4.382.518 5.42.518 6.163C0 8.025 0 12 0 12s0 3.975.518 5.837c.252.743.785 1.282 2.095 1.51C4.475 19.855 12 19.855 12 19.855s7.524 0 9.388-.508c1.312-.228 1.844-1.267 2.095-1.51c.517-1.862.517-5.837.517-5.837s0-3.975-.517-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </a>
                    )}
                    {authorProfile?.instagramUrl && (
                      <a href={authorProfile.instagramUrl} target="_blank" rel="noopener noreferrer" title="Instagram" className="creator-social-icon instagram" style={{ width: '30px', height: '30px', background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}>
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                        </svg>
                      </a>
                    )}
                    {authorProfile?.twitterUrl && (
                      <a href={authorProfile.twitterUrl} target="_blank" rel="noopener noreferrer" title="Twitter / X" className="creator-social-icon twitter" style={{ width: '30px', height: '30px', background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
                
                <p style={{
                  margin: '0.2rem 0 0 0',
                  fontSize: '0.86rem',
                  lineHeight: '1.45',
                  color: 'rgba(255, 255, 255, 0.85)',
                  whiteSpace: 'pre-line'
                }}>
                  {authorProfile?.about || 'Professional digital artist and wallpaper creator. Enjoy the hand-crafted designs in this bundle!'}
                </p>
              </div>
            </div>
          </div>

          <GoogleAd type="leaderboard" />
        </div>

        <aside className="bundle-youtube-sidebar">
          <div className="sidebar-genres-header">
            {genres.map((genre) => (
              <button
                key={genre}
                className={`sidebar-genre-tab ${selectedSidebarGenre === genre ? 'active' : ''}`}
                onClick={() => setSelectedSidebarGenre(genre)}
              >
                {genre}
              </button>
            ))}
          </div>

          <div className="sidebar-bundles-list">
            {filteredRelatedBundles.map((item) => (
              <BundleCard
                key={item.id}
                bundle={item}
                onClick={() => onOpenBundle?.(item)}
                showOverlay={true}
                className="bundle-card--sidebar-grid"
              />
            ))}
            {filteredRelatedBundles.length === 0 && (
              <span className="sidebar-empty-note">No other bundles in this genre.</span>
            )}
          </div>

          {filteredRelatedBundles.length > 0 && <GoogleAd type="sidebar" />}
        </aside>
      </section>

      {showAuthPrompt && (
        <div className="bundle-auth-popup-backdrop" onClick={() => setShowAuthPrompt(false)}>
          <div className="bundle-auth-popup" onClick={(event) => event.stopPropagation()}>
            <h2 className="bundle-auth-popup-title">Sign in required</h2>
            <p className="bundle-auth-popup-copy">
              Please sign in with Google to {authActionLabel}.
            </p>
            <div className="bundle-auth-popup-actions">
              <button className="bundle-auth-popup-secondary" onClick={() => setShowAuthPrompt(false)}>
                Maybe later
              </button>
              <button className="bundle-auth-popup-primary" onClick={handleLoginFromPrompt}>
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
