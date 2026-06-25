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
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authActionLabel, setAuthActionLabel] = useState('continue');
  const [selectedSidebarGenre, setSelectedSidebarGenre] = useState('All');

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
    <div className="bundle-youtube-page" style={{ marginTop: isMobile ? '5.5rem' : '4rem' }}>
      <section className="bundle-youtube-layout">
        <div className="bundle-youtube-main">
          <div className="bundle-youtube-hero" style={{ marginTop: isMobile ? '3.5rem' : '2.5rem' }}>
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
                      {formatSubscribers(bundle.author.subscribers)}
                    </span>
                  </div>
                </div>

                <div className="bundle-youtube-author-actions">
                  <button
                    className={`youtube-subscribe-btn ${isSubscribed ? 'subscribed' : ''}`}
                    onClick={() =>
                      runAuthedAction('subscribe to this author', () => {
                        setIsSubscribed((prev) => !prev);
                      })
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
                      runAuthedAction('like this bundle', () => {
                        setReaction((prev) => (prev === 'like' ? null : 'like'));
                      })
                    }
                    title="I like this"
                  >
                    {reaction === 'like' ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: '6px' }}>
                        <path d="M3 11h3v10H3zm15.3-1c0-1.66-1.34-3-3-3h-3.3l.9-3.6.1-.3c0-.4-.1-.8-.4-1L11.6 2 6.4 7.2C6.1 7.5 6 7.8 6 8.2V19c0 1.1.9 2 2 2h7.3c.8 0 1.5-.5 1.8-1.2l3-7c.1-.2.2-.5.2-.8v-2z" />
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
                      runAuthedAction('dislike this bundle', () => {
                        setReaction((prev) => (prev === 'dislike' ? null : 'dislike'));
                      })
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
