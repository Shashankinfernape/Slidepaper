import { useMemo, useState, useEffect } from 'react';
import {
  Bell,
  Check,
  Download,
} from 'lucide-react';
import { WALLPAPER_BUNDLES } from '../data';
import BundleCard from './BundleCard';
import GoogleAd from './GoogleAd';

const SAMPLE_RATIOS = [
  { w: '16', h: '9' },
  { w: '2.1', h: '1' },
  { w: '32', h: '9' },
  { w: '4', h: '3' },
  { w: '21', h: '9' }
];

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
}) {
  const presets = useMemo(() => bundle.ratioOptions || [], [bundle]);
  const supportsLandscapeDownloads = bundle.orientation !== 'vertical';

  const allOptions = useMemo(() => {
    return [...presets, { id: 'custom', label: 'Custom Ratio' }];
  }, [presets]);

  const [selectedDownloadId, setSelectedDownloadId] = useState(
    supportsLandscapeDownloads && allOptions.length > 0 ? allOptions[0].id : 'original'
  );
  const [customRatioWidth, setCustomRatioWidth] = useState('16');
  const [customRatioHeight, setCustomRatioHeight] = useState('9');
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
  const customIsValid = Number(customRatioWidth) > 0 && Number(customRatioHeight) > 0;

  const selectedDownload = useMemo(() => {
    if (!supportsLandscapeDownloads) {
      return { id: 'original', device: 'Original', ratio: bundle.ratio || 'Source', size: '12.5 MB' };
    }

    if (selectedDownloadId === 'custom') {
      return { id: 'custom', device: 'Custom', ratio: customRatio, size: 'Estimate' };
    }

    const matchedPreset = presets.find((p) => p.id === selectedDownloadId);
    return matchedPreset ? { id: matchedPreset.id, device: matchedPreset.label, ratio: matchedPreset.label.split(' ')[0], size: matchedPreset.size } : { id: 'unknown', device: 'Preset', ratio: '16:9', size: '15.4 MB' };
  }, [bundle.ratio, customRatio, selectedDownloadId, supportsLandscapeDownloads, presets]);

  // Size label inside the download button
  const bundleSizeLabel = useMemo(() => {
    if (selectedDownloadId === 'custom') {
      const w = Number(customRatioWidth) || 16;
      const h = Number(customRatioHeight) || 9;
      const baseCount = bundle.images.length;
      // Estimate size based on w/h ratio
      const factor = Math.min(2.5, Math.max(0.5, (w / h) / (16/9)));
      return `${(baseCount * 4.2 * factor).toFixed(0)} MB ZIP`;
    }
    const matchedPreset = presets.find((p) => p.id === selectedDownloadId);
    return matchedPreset ? matchedPreset.size : '12.5 MB ZIP';
  }, [selectedDownloadId, customRatioWidth, customRatioHeight, bundle.images.length, presets]);

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

  const handleDownload = () => {
    if (downloadState !== 'idle') return;
    if (selectedDownloadId === 'custom' && !customIsValid) return;

    setDownloadState('downloading');

    window.setTimeout(() => {
      const content = [
        `Bundle: ${bundle.name}`,
        `Device preset: ${selectedDownload.device}`,
        `Ratio: ${selectedDownload.ratio}`,
        '',
        'Mock payload for future ratio conversion backend.',
      ].join('\n');

      const blob = new Blob([content], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `${bundle.id}_${selectedDownload.id}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadState('completed');

      window.setTimeout(() => {
        setDownloadState('idle');
      }, 1600);
    }, 900);
  };

  const handleLoginFromPrompt = async () => {
    try {
      await loginWithGoogle?.();
      setShowAuthPrompt(false);
    } catch (error) {
      console.error('Google login failed:', error);
    }
  };

  const genres = useMemo(() => {
    const uniqueTags = new Set();
    WALLPAPER_BUNDLES.forEach((item) => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((tag) => {
          if (tag) uniqueTags.add(tag);
        });
      }
    });
    return ['All', ...Array.from(uniqueTags)];
  }, []);

  const filteredRelatedBundles = useMemo(() => {
    const others = WALLPAPER_BUNDLES.filter((item) => item.id !== bundle.id);
    if (selectedSidebarGenre === 'All') return others;
    return others.filter((item) => item.tags.includes(selectedSidebarGenre));
  }, [bundle.id, selectedSidebarGenre]);

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
              <div className="apple-picker-wrapper">
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
                      <span className="apple-custom-error-text">Enter ratio</span>
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
            {filteredRelatedBundles.slice(0, 3).map((item) => (
              <BundleCard
                key={item.id}
                bundle={item}
                onClick={() => onOpenBundle?.(item)}
                showOverlay={true}
                className="bundle-card--sidebar-grid"
              />
            ))}
          </div>

          {filteredRelatedBundles.length > 0 && <GoogleAd type="sidebar" />}

          <div className="sidebar-bundles-list" style={{ marginTop: '1.25rem' }}>
            {filteredRelatedBundles.slice(3).map((item) => (
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
