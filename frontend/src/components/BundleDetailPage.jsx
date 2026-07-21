import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  Download,
  Monitor,
  Smartphone,
  Sliders,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { WALLPAPER_BUNDLES } from '../data';
import BundleCard from './BundleCard';
import GoogleAd from './GoogleAd';
import { useAuth } from '../context/AuthContext';
import { useDownload } from '../context/DownloadContext';

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

const getProxiedImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.includes('drive.google.com')) {
    const match = url.match(/[?&]id=([^&]+)/);
    if (match) {
      return `${API_URL}/api/proxy-image?id=${match[1]}`;
    }
  }
  if (url.startsWith('/uploads/')) {
    return `${API_URL}${url}`;
  }
  return url.replace('http://localhost:5001', API_URL);
};

const SAMPLE_RATIOS = [
  { w: '16', h: '9' },
  { w: '2.1', h: '1' },
  { w: '32', h: '9' },
  { w: '4', h: '3' },
  { w: '21', h: '9' }
];

function timeAgo(dateString) {
  if (!dateString) return '2 weeks ago';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`;
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`;
}

function getOptionIcon(optionId, isLandscape = true) {
  const id = optionId.toLowerCase();
  
  if (id.includes('original')) {
    return isLandscape ? <Monitor size={14} style={{ marginRight: '6px', flexShrink: 0 }} /> : <Smartphone size={14} style={{ marginRight: '6px', flexShrink: 0 }} />;
  }

  if (id.includes('desktop') || id.includes('ultrawide') || id.includes('triple') || id.includes('landscape')) {
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
  onBack,
  onOpenBundle,
  onOpenChannel,
  user,
  loginWithGoogle,
  bundles = []
}) {
  const { userProfile, subscriptions = [], toggleSubscriptionLocal } = useAuth();
  const { startDownload } = useDownload();
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

    // Always ensure 'Original' option exists and has native ratio in label!
    const nativeRatio = bundle.ratio && bundle.ratio.includes(':') ? bundle.ratio : null;
    const originalIdx = filtered.findIndex(p => p.id === 'original');
    if (originalIdx === -1) {
      filtered.unshift({
        id: 'original',
        label: nativeRatio ? `Original • ${nativeRatio}` : 'Original',
        subtitle: 'Uncropped high-res wallpapers',
        resolution: 'Original',
        size: 'Full Size ZIP',
        formats: ['PNG', 'JPG']
      });
    } else {
      // Patch the label to always include native ratio
      filtered[originalIdx] = {
        ...filtered[originalIdx],
        label: nativeRatio ? `Original • ${nativeRatio}` : 'Original',
      };
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

  const pickerTabsRef = useRef(null);
  const [canScrollPickerRight, setCanScrollPickerRight] = useState(false);
  const [canScrollPickerLeft, setCanScrollPickerLeft] = useState(false);

  const handlePickerScroll = () => {
    if (pickerTabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = pickerTabsRef.current;
      setCanScrollPickerRight(scrollLeft + clientWidth < scrollWidth - 2);
      setCanScrollPickerLeft(scrollLeft > 2);
    }
  };

  useEffect(() => {
    handlePickerScroll();
    const currentRef = pickerTabsRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', handlePickerScroll);
    }
    window.addEventListener('resize', handlePickerScroll);
    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', handlePickerScroll);
      }
      window.removeEventListener('resize', handlePickerScroll);
    };
  }, [allOptions]);

  const scrollPickerRight = () => {
    if (pickerTabsRef.current) {
      pickerTabsRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  const scrollPickerLeft = () => {
    if (pickerTabsRef.current) {
      pickerTabsRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

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
  const [showTransferHud, setShowTransferHud] = useState(false);
  const [hudMetrics, setHudMetrics] = useState({
    progress: 0,
    speedMbps: 0,
    transferredMB: 0,
    totalMB: 0,
    etaSeconds: 0,
    stage: '',
    steps: []
  });
  const [reaction, setReaction] = useState(null);
  const isSubscribed = bundle.author?.uid ? subscriptions.includes(bundle.author.uid) : false;
  const [subscribeAnimEnabled, setSubscribeAnimEnabled] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(bundle.author?.subscribers || 0);
  const [viewsCount, setViewsCount] = useState(bundle.stats?.views || 0);
  const [downloadsCount, setDownloadsCount] = useState(bundle.stats?.downloads || 0);
  const [likeCount, setLikeCount] = useState(bundle.stats?.likes || 0);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authActionLabel, setAuthActionLabel] = useState('continue');
  const [selectedSidebarGenre, setSelectedSidebarGenre] = useState('All');


  const [authorProfile, setAuthorProfile] = useState(null);
  const resolvedAuthorProfile = useMemo(() => {
    const targetUid = bundle.author?.uid || 'admin-mock-999';
    const isOwnBundle = (userProfile && userProfile.uid === targetUid) || (user && user.uid === targetUid);
    const liveProfile = isOwnBundle ? userProfile : null;
    const remoteProfile = authorProfile || {};

    return {
      ...bundle.author,
      ...remoteProfile,
      ...(liveProfile || {}),
      uid: liveProfile?.uid || remoteProfile.uid || targetUid,
      displayName:
        liveProfile?.displayName ||
        remoteProfile.displayName ||
        bundle.author?.name || 'Infernape',
      photoURL:
        liveProfile?.photoURL ||
        remoteProfile.photoURL ||
        bundle.author?.avatar,
      about: liveProfile?.about !== undefined ? liveProfile.about : (remoteProfile.about !== undefined ? remoteProfile.about : ''),
      youtubeUrl: liveProfile?.youtubeUrl || remoteProfile.youtubeUrl || '',
      instagramUrl: liveProfile?.instagramUrl || remoteProfile.instagramUrl || '',
      twitterUrl: liveProfile?.twitterUrl || remoteProfile.twitterUrl || '',
      joined: liveProfile?.joined || remoteProfile.joined || null,
    };
  }, [authorProfile, bundle.author, userProfile, user]);

  // Sync real-time MongoDB metrics (views, likes, downloads, subscribers)
  useEffect(() => {
    // 1. Reset local metric counts when bundle changes
    setViewsCount(bundle.stats?.views || 0);
    setDownloadsCount(bundle.stats?.downloads || 0);
    setLikeCount(bundle.stats?.likes || 0);

    // 2. Fetch live bundle metrics from MongoDB
    const fetchLiveBundleStatus = async () => {
      try {
        const uidParam = user ? `?uid=${user.uid}` : '';
        const res = await fetch(`${API_URL}/api/bundles/${bundle.id}/status${uidParam}`);
        if (res.ok) {
          const data = await res.json();
          if (data.stats) {
            setViewsCount(data.stats.views || 0);
            setDownloadsCount(data.stats.downloads || 0);
            setLikeCount(data.stats.likes || 0);
            if (bundle.stats) {
              bundle.stats.views = data.stats.views || 0;
              bundle.stats.downloads = data.stats.downloads || 0;
              bundle.stats.likes = data.stats.likes || 0;
            }
          }
          if (data.reaction) {
            setReaction(data.reaction);
          } else {
            setReaction(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch live bundle status:', err);
      }
    };
    
    // 3. Fetch author subscriber count & profile from MongoDB
    const fetchSubscriptionStatus = async () => {
      if (!bundle.author || !bundle.author.uid) return;
      try {
        const uidParam = user ? `?uid=${user.uid}` : '';
        const res = await fetch(`${API_URL}/api/authors/${bundle.author.uid}/status${uidParam}`);
        if (res.ok) {
          const data = await res.json();
          setSubscribersCount(data.subscribers);
          setAuthorProfile(data.profile);
        }
      } catch (err) {
        console.error('Failed to fetch author subscription status:', err);
      }
    };

    // 4. Increment view count in MongoDB (silent persistent browser caching: 1 User = 1 View per wallpaper)
    const incrementViewCount = async () => {
      try {
        let viewedSet = [];
        try {
          const stored = localStorage.getItem('slidepapers_unique_views');
          if (stored) viewedSet = JSON.parse(stored);
        } catch (_) {}

        if (Array.isArray(viewedSet) && viewedSet.includes(bundle.id)) {
          return; // Already counted for this user/browser!
        }

        // Mark as viewed silently in browser cache
        if (!Array.isArray(viewedSet)) viewedSet = [];
        viewedSet.push(bundle.id);
        localStorage.setItem('slidepapers_unique_views', JSON.stringify(viewedSet));

        const res = await fetch(`${API_URL}/api/bundles/${bundle.id}/view`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.views !== undefined) {
            setViewsCount(data.views);
            if (bundle.stats) bundle.stats.views = data.views;
          }
        }
      } catch (err) {
        console.error('Failed to increment views:', err);
      }
    };

    fetchLiveBundleStatus();
    fetchSubscriptionStatus();
    incrementViewCount();
  }, [bundle.id, user]);

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
        setLikeCount(data.likes);
        if (bundle.stats) bundle.stats.likes = data.likes;
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
    setSubscribeAnimEnabled(true);
    if (!bundle.author || !bundle.author.uid) return;
    if (user.uid === bundle.author.uid) {
      alert('You cannot subscribe to yourself!');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/authors/${bundle.author.uid}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        })
      });
      
      toggleSubscriptionLocal(bundle.author.uid);
      
      if (res.ok) {
        const data = await res.json();
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

  // Memoized predicted ZIP size in bytes for the selected aspect ratio
  const predictedZipBytes = useMemo(() => {
    const sumBytes = bundle.images.reduce((sum, img) => sum + (img.size || 1500000), 0);
    if (selectedDownloadId === 'original') return sumBytes * 0.95;

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
    factor = Math.max(0.05, Math.min(1.0, factor));

    return sumBytes * factor * 0.95;
  }, [selectedDownloadId, customRatioWidth, customRatioHeight, bundle.images, bundle.ratio, presets]);

  const predictedTotalMB = useMemo(() => predictedZipBytes / (1024 * 1024), [predictedZipBytes]);

  // Size label inside the download button
  const bundleSizeLabel = useMemo(() => {
    if (predictedZipBytes >= 1024 * 1024) {
      return `${(predictedZipBytes / (1024 * 1024)).toFixed(2)} MB ZIP`;
    } else {
      return `${(predictedZipBytes / 1024).toFixed(0)} KB ZIP`;
    }
  }, [predictedZipBytes]);



  const runAuthedAction = async (label, action) => {
    if (!user) {
      setAuthActionLabel(label);
      setShowAuthPrompt(true);
      return;
    }

    action();
  };

  const handleDownload = async () => {
    if (selectedDownloadId === 'custom' && !customIsValid) return;
    startDownload(bundle, selectedDownloadId, customRatioWidth, customRatioHeight, presets);
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
    return ['All', 'Desktop', 'Mobile', ...Array.from(uniqueTags)];
  }, [allBundlesList]);

  const genresScrollRef = useRef(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);

  const handleGenresScroll = () => {
    if (genresScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = genresScrollRef.current;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    handleGenresScroll();
    window.addEventListener('resize', handleGenresScroll);
    return () => window.removeEventListener('resize', handleGenresScroll);
  }, [genres]);

  const scrollGenres = (direction) => {
    if (genresScrollRef.current) {
      const amount = direction === 'left' ? -150 : 150;
      genresScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
      setTimeout(handleGenresScroll, 300);
    }
  };

  const filteredRelatedBundles = useMemo(() => {
    const others = allBundlesList.filter((item) => item.id !== bundle.id);
    if (selectedSidebarGenre === 'All') return others;
    if (selectedSidebarGenre === 'Desktop') return others.filter((item) => item.orientation === 'landscape');
    if (selectedSidebarGenre === 'Mobile') return others.filter((item) => item.orientation === 'portrait');
    return others.filter((item) => item.tags && item.tags.includes(selectedSidebarGenre));
  }, [bundle.id, selectedSidebarGenre, allBundlesList]);

  const activeIndex = useMemo(() => {
    return allOptions.findIndex((option) => option.id === selectedDownloadId);
  }, [selectedDownloadId, allOptions]);



  return (
    <div className="bundle-youtube-page">
      <section className="bundle-youtube-layout" style={{ gridAutoFlow: 'dense', alignItems: 'start' }}>
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
            <div className="bundle-youtube-title-row responsive-title-row" style={{ width: '100%', padding: '0 0.25rem' }}>
              <div className="responsive-title-group" style={{ display: 'flex', flexDirection: 'column' }}>
                <h1 className="bundle-youtube-title responsive-bundle-title" style={{ margin: 0 }}>{bundle.name}</h1>
                
                <div className="responsive-bundle-stats" style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-secondary)',
                  margin: '0.25rem 0 0 0',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  flexWrap: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  <span>{formatNumber(viewsCount)} views</span>
                  <span>{timeAgo(bundle.createdAt)}</span>
                  <span>{formatNumber(downloadsCount)} downloads</span>
                </div>
              </div>
              
              <div className="youtube-actions-group responsive-actions-group" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div className="youtube-like-dislike-pill">
                  <button
                    className={`youtube-like-btn ${reaction === 'like' ? 'active' : ''}`}
                    onClick={() => runAuthedAction('like this bundle', handleLikeToggle)}
                    title="I like this"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill={reaction === 'like' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={reaction === 'like' ? '0' : '2'} style={{ marginRight: '6px' }}>
                      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                    </svg>
                    <span>{formatNumber(likeCount)}</span>
                  </button>
                  <div className="youtube-pill-divider"></div>
                  <button
                    className={`youtube-dislike-btn ${reaction === 'dislike' ? 'active' : ''}`}
                    onClick={() => runAuthedAction('dislike this bundle', handleDislikeToggle)}
                    title="I dislike this"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill={reaction === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={reaction === 'dislike' ? '0' : '2'}>
                      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
                    </svg>
                  </button>
                </div>
                
                <button
                  className="youtube-action-pill-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Share URL copied to clipboard!');
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: '4px' }}>
                    <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
                  </svg>
                  <span>Share</span>
                </button>
              </div>
            </div>

            <div className="bundle-youtube-meta-row" style={{ marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', padding: '0 0.25rem', position: 'relative' }}>
                <div className="bundle-author-banner" style={{
                  width: '100%',
                  borderRadius: '12px',
                  background: resolvedAuthorProfile.bannerURL ? `url(${getProxiedImageUrl(resolvedAuthorProfile.bannerURL)}) center/cover no-repeat` : 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)',
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  cursor: 'pointer'
                }}
                onClick={() => onOpenChannel && onOpenChannel(resolvedAuthorProfile)}
                >
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  padding: '0 0.5rem',
                  flexWrap: 'wrap'
                }} className="channel-header-block responsive-channel-header">
                  <div className="bundle-author-avatar" style={{
                    position: 'relative',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    background: 'var(--bg-secondary)',
                    flexShrink: 0,
                    cursor: 'pointer'
                  }}
                  onClick={() => onOpenChannel && onOpenChannel(resolvedAuthorProfile)}
                  >
                    <img
                      src={getProxiedImageUrl(resolvedAuthorProfile.photoURL) || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'}
                      alt={resolvedAuthorProfile.displayName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'; }}
                    />
                  </div>

                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'nowrap', minWidth: 0 }}>
                    <div className="bundle-author-meta-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                      <h1 
                        className="bundle-author-title"
                        style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)', cursor: 'pointer' }}
                        onClick={() => onOpenChannel && onOpenChannel(resolvedAuthorProfile)}
                      >
                        {resolvedAuthorProfile.displayName || 'Creator Name'}
                      </h1>
                      <span className="verified-badge-circle" title="Verified Creator" style={{ width: '16px', height: '16px', background: '#3b82f6', color: '#fff', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" style={{ width: '10px', height: '10px' }}>
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
                        </svg>
                      </span>
                    </div>

                    <div className="responsive-author-stats" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', flexWrap: 'nowrap', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>@{resolvedAuthorProfile.displayName ? resolvedAuthorProfile.displayName.toLowerCase().replace(/\s+/g, '') : 'creator'}</span>
                      <span>•</span>
                      <span>{formatSubscribers(subscribersCount)}</span>
                      <span>•</span>
                      <span>{resolvedAuthorProfile.totalBundles || 1} wallpapers</span>
                    </div>
                  </div>

                  <div className="responsive-subscribe-container">
                    <button
                      className={`youtube-subscribe-btn responsive-subscribe-btn ${isSubscribed ? 'subscribed' : ''}`}
                      style={!subscribeAnimEnabled ? { transition: 'none' } : {}}
                      onClick={() => {
                        setSubscribeAnimEnabled(true);
                        runAuthedAction('subscribe to this author', handleSubscribeToggle);
                      }}
                    >
                      {isSubscribed ? (
                        <>
                          <Bell size={18} />
                          <span>Subscribed</span>
                        </>
                      ) : (
                        <span>Subscribe</span>
                      )}
                    </button>
                  </div>
                </div>
                </div>
              </div>
            </div>
 
            <div className="apple-download-panel" style={{ marginTop: '0.5rem', marginBottom: '1.25rem' }}>
              {supportsLandscapeDownloads ? (
                  <div className={`apple-picker-wrapper ${selectedDownloadId === 'custom' ? 'has-custom' : ''}`} style={{ position: 'relative', overflow: 'hidden' }}>
                    {canScrollPickerLeft && (
                      <div className="genre-scroll-left-overlay" style={{ borderRadius: '9999px' }}>
                        <button className="genre-scroll-left-btn" onClick={scrollPickerLeft}>
                          <ChevronLeft size={20} />
                        </button>
                      </div>
                    )}
                    
                    <div className="apple-picker-container" ref={pickerTabsRef} style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
                      <style dangerouslySetInnerHTML={{__html: `
                        .apple-picker-container::-webkit-scrollbar { display: none; }
                      `}} />
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
                          onClick={() => {
                            setSelectedDownloadId(option.id);
                            setDownloadState('idle');
                          }}
                        >
                          {getOptionIcon(option.id, bundle.orientation === 'landscape')}
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>

                    {canScrollPickerRight && (
                      <div className="genre-scroll-right-overlay" style={{ borderRadius: '9999px' }}>
                        <button className="genre-scroll-right-btn" onClick={scrollPickerRight}>
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    )}

                    {selectedDownloadId === 'custom' && (
                      <div className="apple-custom-input-group">
                        <input
                          type="text"
                          placeholder={activeSample.w}
                          value={customRatioWidth}
                          onChange={(e) => {
                            setCustomRatioWidth(e.target.value);
                            setDownloadState('idle');
                          }}
                          className="apple-custom-input"
                        />
                        <span className="apple-custom-divider">:</span>
                        <input
                          type="text"
                          placeholder={activeSample.h}
                          value={customRatioHeight}
                          onChange={(e) => {
                            setCustomRatioHeight(e.target.value);
                            setDownloadState('idle');
                          }}
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
            </div>

        </div>

        {/* The top right sidebar genre filters */}
        <div className="sidebar-genres-header-container genre-tabs-container-wrapper" style={{ position: 'relative', overflow: 'hidden' }}>
          {showLeftScroll && (
            <div className="genre-scroll-left-overlay">
              <button className="genre-scroll-left-btn" onClick={() => scrollGenres('left')}>
                <ChevronLeft size={20} />
              </button>
            </div>
          )}
          
          <div className="sidebar-genres-header" ref={genresScrollRef} onScroll={handleGenresScroll}>
            {genres.map((genre) => (
              <button
                key={genre}
                className={`sidebar-genre-tab ${selectedSidebarGenre === genre ? 'active' : ''}`}
                onClick={() => setSelectedSidebarGenre(genre)}
              >
                {genre === 'Desktop' && <Monitor size={14} style={{ marginRight: '6px' }} />}
                {genre === 'Mobile' && <Smartphone size={14} style={{ marginRight: '6px' }} />}
                {genre}
              </button>
            ))}
          </div>

          {showRightScroll && (
            <div className="genre-scroll-right-overlay">
              <button className="genre-scroll-right-btn" onClick={() => scrollGenres('right')}>
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* All bundles follow directly in the grid. CSS Grid Auto-Placement handles everything! */}
        {filteredRelatedBundles.map((item) => (
          <BundleCard
            key={item.id}
            bundle={item}
            onClick={() => onOpenBundle?.(item)}
            showOverlay={true}
            className="bundle-card--unified-grid bundle-youtube-grid-item"
          />
        ))}

        {filteredRelatedBundles.length === 0 && (
          <span className="sidebar-empty-note">No other bundles in this genre.</span>
        )}
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
