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
import TransferHUD from './TransferHUD';
import { useAuth } from '../context/AuthContext';

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
  onBack,
  onOpenBundle,
  onOpenChannel,
  user,
  loginWithGoogle,
  bundles = []
}) {
  const { userProfile } = useAuth();
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
  const [isSubscribed, setIsSubscribed] = useState(false);
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
    const isOwnBundle = (userProfile && (userProfile.uid === targetUid || targetUid === 'admin-mock-999' || !bundle.author?.uid)) ||
                        (user && (user.uid === targetUid || targetUid === 'admin-mock-999'));
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
          setIsSubscribed(data.isSubscribed);
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
    setShowTransferHud(true);
    const stepStart = Date.now();

    // Live preparation ticker interval with smooth percentage ramping (5% -> 24%)
    const prepTimer = setInterval(() => {
      const elapsedMs = Date.now() - stepStart;
      const elapsedSec = (elapsedMs / 1000).toFixed(1);
      const prepProgress = Math.min(24, Math.max(5, Math.floor(5 + (elapsedMs / 120))));

      let step1Status = 'active', step1Dur = `${elapsedSec}s`;
      let step2Status = 'pending', step2Dur = '';
      let step3Status = 'pending', step3Dur = '';

      if (elapsedMs >= 600) {
        step1Status = 'done'; step1Dur = '0.6s';
        step2Status = 'active'; step2Dur = `${((elapsedMs - 600) / 1000).toFixed(1)}s`;
      }
      if (elapsedMs >= 1400) {
        step2Status = 'done'; step2Dur = '0.8s';
        step3Status = 'active'; step3Dur = `${((elapsedMs - 1400) / 1000).toFixed(1)}s`;
      }

      setHudMetrics(prev => {
        if (prev.stage.includes('Downloading payload stream')) return prev;
        return {
          ...prev,
          progress: prepProgress,
          stage: `Preparing cloud payload (${elapsedSec}s)...`,
          steps: [
            { label: 'Cloud asset restore', status: step1Status, duration: step1Dur },
            { label: 'ImageMagick ratio crop', status: step2Status, duration: step2Dur },
            { label: 'Level-1 zip archive build', status: step3Status, duration: step3Dur },
            { label: 'Payload stream delivery', status: 'pending', duration: '' }
          ]
        };
      });
    }, 100);

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

      clearInterval(prepTimer);

      if (!response.ok) {
        let errorMessage = 'Failed to process wallpaper bundle';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type') || '';
      const finishDownload = () => {
        setShowTransferHud(false);
        setDownloadState('completed');
        setTimeout(() => setDownloadState('idle'), 2500);
      };

      // Case A: Cache Hit or Signed URL (JSON response)
      if (contentType.includes('application/json')) {
        const data = await response.json();

        if (data.downloads !== undefined) {
          setDownloadsCount(data.downloads);
          if (bundle.stats) bundle.stats.downloads = data.downloads;
        }

        const downloadUrl = data.downloadUrl.startsWith('http') ? data.downloadUrl : `${API_URL}${data.downloadUrl}`;
        const startTime = Date.now();
        let lastLoaded = 0;
        let lastTime = startTime;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', downloadUrl, true);
        xhr.responseType = 'blob';

        xhr.onprogress = (e) => {
          const totalBytes = e.lengthComputable && e.total > 0 ? e.total : (18 * 1024 * 1024);
          const loadedBytes = e.loaded;
          const pct = Math.min(99, Math.max(25, (loadedBytes / totalBytes) * 100));

          const currentTime = Date.now();
          const timeDelta = (currentTime - lastTime) / 1000;

          if (timeDelta >= 0.1) {
            const bytesDelta = loadedBytes - lastLoaded;
            const speedBps = bytesDelta / timeDelta;
            const speedMbps = (speedBps * 8) / (1024 * 1024);
            const remainingBytes = Math.max(0, totalBytes - loadedBytes);
            const eta = speedBps > 0 ? (remainingBytes / speedBps) : 0.5;

            setHudMetrics({
              progress: pct,
              speedMbps: Math.max(4.2, speedMbps),
              transferredMB: loadedBytes / (1024 * 1024),
              totalMB: totalBytes / (1024 * 1024),
              etaSeconds: eta,
              stage: 'Downloading payload stream...',
              steps: [
                { label: 'Cloud asset restore', status: 'done', duration: '0.1s' },
                { label: 'GCS cache signed URL', status: 'done', duration: '0.0s' },
                { label: 'Direct GCS stream delivery', status: 'active', duration: `${((Date.now() - startTime)/1000).toFixed(1)}s` }
              ]
            });

            lastLoaded = loadedBytes;
            lastTime = currentTime;
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            const blob = xhr.response;
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `${bundle.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_pack.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(blobUrl);

            setHudMetrics(prev => ({ ...prev, progress: 100, stage: 'Complete' }));
            setTimeout(finishDownload, 1000);
          } else {
            window.location.href = downloadUrl;
            finishDownload();
          }
        };

        xhr.onerror = () => {
          window.location.href = downloadUrl;
          finishDownload();
        };

        xhr.send();
        return;
      }

      // Case B: Direct Pure RAM Stream (Binary ZIP response)
      const reader = response.body.getReader();
      const contentLength = +(response.headers.get('content-length') || response.headers.get('x-content-length') || 0);
      const chunks = [];
      let receivedBytes = 0;
      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;

        const currentTime = Date.now();
        const timeDelta = (currentTime - lastTime) / 1000;

        if (timeDelta >= 0.1) {
          const bytesDelta = receivedBytes - lastLoaded;
          const speedBps = bytesDelta / timeDelta;
          const speedMbps = (speedBps * 8) / (1024 * 1024);
          const estimatedTotal = contentLength > 0 ? contentLength : (60 * 1024 * 1024);
          const pct = Math.min(99, Math.max(10, (receivedBytes / estimatedTotal) * 100));
          const remainingBytes = Math.max(0, estimatedTotal - receivedBytes);
          const eta = speedBps > 0 ? (remainingBytes / speedBps) : 0.5;

          setHudMetrics({
            progress: pct,
            speedMbps: Math.max(4.2, speedMbps),
            transferredMB: receivedBytes / (1024 * 1024),
            totalMB: estimatedTotal / (1024 * 1024),
            etaSeconds: eta,
            stage: 'Streaming pure RAM payload...',
            steps: [
              { label: 'Drive image stream fetch', status: 'done', duration: '0.2s' },
              { label: 'Native C++ ratio crop', status: 'done', duration: '0.4s' },
              { label: 'Pure RAM zip stream', status: 'done', duration: '0.1s' },
              { label: 'Real-time stream delivery', status: 'active', duration: `${((currentTime - startTime)/1000).toFixed(1)}s` }
            ]
          });

          lastLoaded = receivedBytes;
          lastTime = currentTime;
        }
      }

      const blob = new Blob(chunks, { type: 'application/zip' });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${bundle.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_pack.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      setHudMetrics(prev => ({ ...prev, progress: 100, stage: 'Complete' }));
      setTimeout(finishDownload, 1000);

    } catch (error) {
      clearInterval(prepTimer);
      console.warn('Custom ratio stream error:', error.message);
      
      if (bundle.driveUrl) {
        const a = document.createElement('a');
        a.href = bundle.driveUrl;
        a.download = `${bundle.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_pack.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert('Server is currently compiling this high-res pack. Please try downloading again in a few seconds.');
      }
      setShowTransferHud(false);
      setDownloadState('idle');
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

            {/* YouTube style view, date, and downloads meta line under title (lean compact spacing) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              margin: '0.1rem 0 0.25rem 0',
              fontWeight: 500
            }}>
              <span>{formatNumber(viewsCount)} views</span>
              <span>2 weeks ago</span>
              <span>{formatNumber(downloadsCount)} downloads</span>
            </div>

            <div className="bundle-youtube-meta-row">
              <div className="bundle-youtube-author-block">
                <div 
                  className="bundle-youtube-author-main"
                  onClick={() => onOpenChannel && onOpenChannel(resolvedAuthorProfile)}
                  style={{ cursor: 'pointer' }}
                  title="View Channel Page"
                >
                  <img
                    src={getProxiedImageUrl(resolvedAuthorProfile.photoURL) || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'}
                    alt={resolvedAuthorProfile.displayName}
                    className="bundle-youtube-author-avatar"
                    onError={(e) => { e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'; }}
                  />
                  <div className="bundle-youtube-author-copy">
                    <span className="bundle-youtube-author-name">
                      {resolvedAuthorProfile.displayName}
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
                    <svg viewBox="0 0 24 24" width="18" height="18" fill={reaction === 'like' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={reaction === 'like' ? '0' : '2'} style={{ marginRight: '6px' }}>
                      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                    </svg>
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
                    <svg viewBox="0 0 24 24" width="18" height="18" fill={reaction === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={reaction === 'dislike' ? '0' : '2'}>
                      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
                    </svg>
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

      {/* Floating Transfer HUD Indicator - Root Level */}
      {showTransferHud && (
        <TransferHUD
          type="download"
          title="Downloading Wallpaper Pack"
          fileName={`${bundle.name} (${selectedDownloadId === 'custom' ? customRatio : selectedDownload?.ratio || '16:9'})`}
          progress={hudMetrics.progress}
          speedMbps={hudMetrics.speedMbps}
          transferredMB={hudMetrics.transferredMB}
          totalMB={hudMetrics.totalMB}
          etaSeconds={hudMetrics.etaSeconds}
          stage={hudMetrics.stage}
          steps={hudMetrics.steps}
          onClose={() => setShowTransferHud(false)}
        />
      )}
    </div>
  );
}
