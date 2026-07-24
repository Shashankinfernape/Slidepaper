import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, Check, LogOut, Search, Bell, Shield, AlertCircle, Monitor, Smartphone, Plus, Sparkles
} from 'lucide-react';
import { WALLPAPER_BUNDLES } from './data';
import WallpaperGrid from './components/WallpaperGrid';
import BundleDetailPage from './components/BundleDetailPage';
import ChannelPage from './components/ChannelPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DownloadProvider } from './context/DownloadContext';
import TransferHUD from './components/TransferHUD';
import AdminDashboard from './components/AdminDashboard';
import LegalModal from './components/LegalModal';
import NotificationDropdown from './components/NotificationDropdown';
import CuratorDashboard from './components/CuratorDashboard';

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

function HeroSection({ onGetStarted, bundles }) {
  const heroBundle = useMemo(() => {
    if (!bundles || bundles.length === 0) return null;
    return bundles.find(b => b.isHero) || bundles[0];
  }, [bundles]);

  const sampleImages = useMemo(() => {
    if (!heroBundle || !heroBundle.images || heroBundle.images.length === 0) {
      return null;
    }
    const imgs = heroBundle.images;
    if (imgs.length >= 3) {
      return [imgs[0], imgs[1], imgs[2]];
    } else if (imgs.length === 2) {
      return [imgs[0], imgs[1], imgs[0]];
    } else if (imgs.length === 1) {
      return [imgs[0], imgs[0], imgs[0]];
    }
    return null;
  }, [heroBundle]);

  return (
    <section className="hero-section">
      {/* Centered Heading */}
      <h1 className="hero-title">Nostalgicize Your Screen!</h1>

      {/* Horizontal Sequence Row (1 -> Cinematic Double Chevron -> 2 -> Cinematic Double Chevron -> 3) */}
      <div className="hero-visual-row">
        {sampleImages ? (
          <>
            <div className="sequence-card">
              <img src={sampleImages[0].previewUrl || sampleImages[0].url} alt={sampleImages[0].label} className="sequence-img" />
            </div>

            {/* Cinematic Double-Chevron Crystal Arrow */}
            <div className="glassy-arrow" title="Transition Sequence">
              <svg width="80" height="50" viewBox="0 0 80 50" style={{ overflow: 'visible' }}>
                <defs>
                  {/* Cinematic Chrome-Glass Gradient */}
                  <linearGradient id="cinematicGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                    <stop offset="30%" stopColor="#e5e7eb" stopOpacity="0.35" />
                    <stop offset="70%" stopColor="#ffffff" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#9ca3af" stopOpacity="0.15" />
                  </linearGradient>

                  {/* Anamorphic Flare Gradient */}
                  <linearGradient id="flareGrad" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                    <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>

                  {/* Cinematic Glass Shadow & Glow */}
                  <filter id="cinematicGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.6" />
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#ffffff" floodOpacity="0.15" />
                  </filter>
                </defs>

                {/* Left Chevron (Faded glass motion trail) */}
                <path
                  d="M16 10l15 15-15 15"
                  fill="none"
                  stroke="url(#cinematicGlass)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.25"
                />
                <path
                  d="M15.5 10.5l14.5 14.5-14.5 14.5"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.35"
                />

                {/* Right Chevron (Main solid glass body shadow) */}
                <path
                  d="M32 10l15 15-15 15"
                  fill="none"
                  stroke="#000000"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.5"
                  style={{ filter: 'blur(3px)' }}
                />

                {/* Right Chevron (Main solid glass body) */}
                <path
                  d="M32 10l15 15-15 15"
                  fill="none"
                  stroke="url(#cinematicGlass)"
                  strokeWidth="7.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#cinematicGlow)"
                />

                {/* Specular Light Reflection (Caught on upper edge) */}
                <path
                  d="M30.5 11l14 14-14 14"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.95"
                />

                {/* Anamorphic Light Flare on the main chevron apex */}
                <path
                  d="M45 13l4 12-4 12"
                  fill="none"
                  stroke="url(#flareGrad)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.8"
                  style={{ filter: 'blur(0.5px)' }}
                />
              </svg>
            </div>

            <div className="sequence-card">
              <img src={sampleImages[1].previewUrl || sampleImages[1].url} alt={sampleImages[1].label} className="sequence-img" />
            </div>

            {/* Cinematic Double-Chevron Crystal Arrow */}
            <div className="glassy-arrow" title="Transition Sequence">
              <svg width="80" height="50" viewBox="0 0 80 50" style={{ overflow: 'visible' }}>
                <defs>
                  {/* Cinematic Chrome-Glass Gradient */}
                  <linearGradient id="cinematicGlass3" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                    <stop offset="30%" stopColor="#e5e7eb" stopOpacity="0.35" />
                    <stop offset="70%" stopColor="#ffffff" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#9ca3af" stopOpacity="0.15" />
                  </linearGradient>

                  {/* Anamorphic Flare Gradient */}
                  <linearGradient id="flareGrad3" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                    <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>

                  {/* Cinematic Glass Shadow & Glow */}
                  <filter id="cinematicGlow3" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.6" />
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#ffffff" floodOpacity="0.15" />
                  </filter>
                </defs>

                {/* Left Chevron (Faded glass motion trail) */}
                <path
                  d="M16 10l15 15-15 15"
                  fill="none"
                  stroke="url(#cinematicGlass3)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.25"
                />
                <path
                  d="M15.5 10.5l14.5 14.5-14.5 14.5"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.35"
                />

                {/* Right Chevron (Main solid glass body shadow) */}
                <path
                  d="M32 10l15 15-15 15"
                  fill="none"
                  stroke="#000000"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.5"
                  style={{ filter: 'blur(3px)' }}
                />

                {/* Right Chevron (Main solid glass body) */}
                <path
                  d="M32 10l15 15-15 15"
                  fill="none"
                  stroke="url(#cinematicGlass3)"
                  strokeWidth="7.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#cinematicGlow3)"
                />

                {/* Specular Light Reflection (Caught on upper edge) */}
                <path
                  d="M30.5 11l14 14-14 14"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.95"
                />

                {/* Anamorphic Light Flare on the main chevron apex */}
                <path
                  d="M45 13l4 12-4 12"
                  fill="none"
                  stroke="url(#flareGrad3)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.8"
                  style={{ filter: 'blur(0.5px)' }}
                />
              </svg>
            </div>

            <div className="sequence-card">
              <img src={sampleImages[2].previewUrl || sampleImages[2].url} alt={sampleImages[2].label} className="sequence-img" />
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-secondary)', padding: '2rem', minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <div className="download-spinner-tiny" style={{ borderTopColor: 'var(--color-google-blue)', width: '20px', height: '20px' }}></div>
            <span style={{ marginLeft: '10px' }}>Loading screen sequence...</span>
          </div>
        )}
      </div>

      {/* Underneath Action Button */}
      <button className="hero-cta" onClick={onGetStarted}>
        Get Started
      </button>
    </section>
  );
}

function AppContent() {
  const { user, userProfile, isAdmin, isCurator, loginWithGoogle, loginAdminWithGoogle, loginWithEmail, logout, isFirebaseReal } = useAuth();
  
  // Curator Studio & Drop Modal States
  const [showDropStudioModal, setShowDropStudioModal] = useState(false);
  const [showCuratorAppModal, setShowCuratorAppModal] = useState(false);

  // Secret admin modal states
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  
  // Refs for input focus transitions
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  
  // Track keys for secret JDX triggers
  const keySequenceRef = useRef('');

  // Refs and states for genre tabs scrolling
  const genreTabsRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  
  // Autofocus email input when admin modal is opened
  useEffect(() => {
    if (showAdminLoginModal) {
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 80);
    }
  }, [showAdminLoginModal]);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Safety check for undefined key events
      if (!e || !e.key) return;

      // Trigger 1: Ctrl + Shift + X (Simple, no browser conflicts)
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'X') {
        e.preventDefault();
        setShowAdminLoginModal(true);
        return;
      }

      // Trigger 2: Secret "JDX" typing sequence (without Ctrl/Shift, ignored inside inputs)
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
      
      if (!isInput) {
        const key = e.key.toUpperCase();
        if (key === 'J') {
          keySequenceRef.current = 'J';
        } else if (key === 'D' && keySequenceRef.current === 'J') {
          keySequenceRef.current = 'JD';
        } else if (key === 'X' && keySequenceRef.current === 'JD') {
          keySequenceRef.current = '';
          e.preventDefault();
          setShowAdminLoginModal(true);
        } else {
          // Clear sequence if other keys are pressed
          if (key !== 'J' && key !== 'D' && key !== 'X') {
            keySequenceRef.current = '';
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    console.log('[App] handleAdminLogin called with:', adminEmail, adminPassword);
    setAdminLoginLoading(true);
    setAdminLoginError('');
    try {
      await loginWithEmail(adminEmail, adminPassword);
      console.log('[App] loginWithEmail completed successfully! Closing modal and opening admin view...');
      setShowAdminLoginModal(false);
      setAdminEmail('');
      setAdminPassword('');
      setCurrentView('admin');
    } catch (err) {
      console.error('[App] Error in handleAdminLogin:', err);
      setAdminLoginError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setAdminLoginLoading(true);
    setAdminLoginError('');
    try {
      await loginAdminWithGoogle();
      setShowAdminLoginModal(false);
      setCurrentView('admin');
    } catch (err) {
      setAdminLoginError(err.message || 'Google authorization failed.');
    } finally {
      setAdminLoginLoading(false);
    }
  };
  const [theme, setTheme] = useState('dark');
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'feed' | 'bundle' | 'channel'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [sortOption, setSortOption] = useState('default'); // default, views, downloads
  const [bundles, setBundles] = useState([]);
  const [activeBundle, setActiveBundle] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [legalModalType, setLegalModalType] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch live notifications from backend
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const uidParam = user ? `?uid=${user.uid}` : '';
        const res = await fetch(`${API_URL}/api/notifications${uidParam}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setNotifications(data);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };
    fetchNotifications();
  }, [user, currentView]);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  const handleMarkAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await fetch(`${API_URL}/api/notifications/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user?.uid })
      });
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  };

  const handleSelectNotification = async (item) => {
    setShowNotifications(false);
    // Mark as read locally
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
    try {
      await fetch(`${API_URL}/api/notifications/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifIds: [item.id] })
      });
    } catch (_) {}

    // Find bundle and open it
    if (item.bundleId) {
      const target = bundles.find(b => b.id === item.bundleId);
      if (target) {
        handleOpenBundle(target);
      }
    }
  };

  // Fetch bundles dynamically from backend JSON database
  useEffect(() => {
    fetch(`${API_URL}/api/bundles`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('API server returned error status');
      })
      .then((data) => {
        if (Array.isArray(data)) {
          // Normalize image URLs by replacing localhost:5001 and proxying Google Drive links
          const normalized = data.map(bundle => ({
            ...bundle,
            images: bundle.images.map(img => ({
              ...img,
              url: getProxiedImageUrl(img.url),
              previewUrl: img.previewUrl ? getProxiedImageUrl(img.previewUrl) : undefined
            }))
          }));
          setBundles(normalized);
        }
      })
      .catch((err) => {
        console.warn('[API] Using local fallback static bundles:', err.message);
      });
  }, []);

  // URL route synchronization
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.startsWith('/feed')) {
        setCurrentView('feed');
      } else if (path.startsWith('/admin')) {
        setCurrentView('admin');
      } else if (path.startsWith('/curator')) {
        setCurrentView('curator');
      } else if (path.startsWith('/bundle/')) {
        const bundleId = path.split('/bundle/')[1];
        if (bundleId && bundles.length > 0) {
          const found = bundles.find(b => String(b.id).toLowerCase() === bundleId.toLowerCase());
          if (found) {
            setActiveBundle(found);
            setCurrentView('bundle');
          }
        }
      } else if (path.startsWith('/channel/')) {
        const channelId = decodeURIComponent(path.split('/channel/')[1]);
        if (channelId) {
          const channelIdLower = channelId.toLowerCase();
          const matchedBundle = bundles.find(b => 
            String(b.author?.uid || '').toLowerCase() === channelIdLower ||
            String(b.author?.name || '').toLowerCase() === channelIdLower ||
            String(b.author?.displayName || '').toLowerCase() === channelIdLower ||
            String(b.author?.handle || '').toLowerCase() === channelIdLower
          );
          if (matchedBundle && matchedBundle.author) {
            setActiveChannel(matchedBundle.author);
          } else {
            // Clean up raw database UID string if URL uses UID (e.g. /channel/lhjdk8l8ps...)
            const isRawUid = channelId.length > 20 && !channelId.includes(' ');
            const cleanFallbackName = isRawUid ? 'Creator' : channelId;
            setActiveChannel({ uid: channelId, displayName: cleanFallbackName, name: cleanFallbackName });
          }
          setCurrentView('channel');
        }
      } else if (path.startsWith('/privacy')) {
        setLegalModalType('privacy');
      } else if (path.startsWith('/terms')) {
        setLegalModalType('terms');
      } else if (path.startsWith('/dmca')) {
        setLegalModalType('dmca');
      } else if (path.startsWith('/about')) {
        setLegalModalType('about');
      } else if (path.startsWith('/contact')) {
        setLegalModalType('contact');
      } else if (path === '/' || path === '') {
        setCurrentView('landing');
      }
    };

    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [bundles]);

  // Dropdown UI states
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  // unlockPhase: null | 'dim' | 'spotlight' | 'reveal' | 'done'
  const [unlockPhase, setUnlockPhase] = useState(null);
  const profileBadgeRef = useRef(null);

  const isUnlockingCurator = unlockPhase !== null;

  const handleDropClick = () => {
    if (!user) {
      loginWithGoogle();
      return;
    }

    if (isCurator) {
      setCurrentView('curator');
      window.history.pushState(null, '', '/curator/profile');
      return;
    }

    // Activate creator in background (non-blocking!)
    fetch(`${API_URL}/api/curator/activate-instant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid })
    }).then(res => res.json()).then(data => {
      if (data.success && data.user) updateUserProfileState(data.user);
    }).catch(err => console.error('Error activating creator:', err));

    // Step 1 (0.0s) — Lights Off (85% Blackout Overlay)
    setUnlockPhase('dim');

    // Step 2 (0.5s) — Open profile dropdown (showing ONLY Sign Out) & Hold for 0.8s
    setTimeout(() => {
      setUnlockPhase('spotlight');
      setShowProfileMenu(true);
    }, 500);

    // Step 3 (1.3s) — Start 2.0-second slow, cinematic Creator's Dashboard reveal
    setTimeout(() => {
      setUnlockPhase('reveal');
    }, 1300);

    // Step 4 (3.5s — 0.2s split second after 2.0s reveal finishes) — Lights turn 100% back to normal!
    setTimeout(() => {
      setUnlockPhase(null); // Lights turn 100% back to normal!
      setShowProfileMenu(true); // Keep menu open!
      confetti({ particleCount: 160, spread: 85, origin: { y: 0.08 } });
    }, 3500);
  };

  // Refs for closing dropdowns when clicking outside
  const sortRef = useRef(null);
  const profileRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Apply theme to document element and dynamically update mobile status bar color
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const metaThemeColor = document.getElementById('theme-color-meta');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
    }
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentView, activeBundle]);

  // Toggle between dark (OLED) and light (Cream) themes
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Switch to feed view
  const handleGetStarted = () => {
    setCurrentView('feed');
    window.history.pushState(null, '', '/feed');
  };

  const handleOpenBundle = (bundle) => {
    setActiveBundle(bundle);
    setCurrentView('bundle');
    if (bundle && bundle.id) {
      window.history.pushState(null, '', `/bundle/${bundle.id}`);
    }
  };

  const handleCloseBundle = () => {
    setCurrentView('feed');
    setActiveBundle(null);
    window.history.pushState(null, '', '/feed');
  };

  const handleOpenChannel = (channel) => {
    setActiveChannel(channel);
    setCurrentView('channel');
    const channelSlug = channel?.uid || channel?.displayName || channel?.name || 'studio';
    window.history.pushState(null, '', `/channel/${encodeURIComponent(channelSlug)}`);
  };

  // Extract unique genres/categories dynamically from all wallpaper bundle tags
  const genres = useMemo(() => {
    const uniqueTags = new Set();
    bundles.forEach((bundle) => {
      if (bundle.tags && Array.isArray(bundle.tags)) {
        bundle.tags.forEach((tag) => {
          if (tag) uniqueTags.add(tag);
        });
      }
    });
    return ['All', 'Desktop', 'Mobile', ...Array.from(uniqueTags)];
  }, [bundles]);

  const handleGenreScroll = () => {
    if (genreTabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = genreTabsRef.current;
      // Buffer of 2px to handle fractional scroll values
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
      setCanScrollLeft(scrollLeft > 1);
    }
  };

  const scrollGenresRight = () => {
    if (genreTabsRef.current) {
      genreTabsRef.current.scrollBy({ left: 180, behavior: 'smooth' });
      setTimeout(handleGenreScroll, 350);
    }
  };

  const scrollGenresLeft = () => {
    if (genreTabsRef.current) {
      genreTabsRef.current.scrollBy({ left: -180, behavior: 'smooth' });
      setTimeout(handleGenreScroll, 350);
    }
  };

  useEffect(() => {
    handleGenreScroll();
    const currentRef = genreTabsRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', handleGenreScroll);
    }
    window.addEventListener('resize', handleGenreScroll);
    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', handleGenreScroll);
      }
      window.removeEventListener('resize', handleGenreScroll);
    };
  }, [genres]);

  // Filter wallpaper bundles by search query and selected genre
  const filteredBundles = bundles.filter((bundle) => {
    let matchesGenre = false;
    if (selectedGenre === 'All') {
      matchesGenre = true;
    } else if (selectedGenre === 'Desktop') {
      matchesGenre = bundle.orientation === 'landscape';
    } else if (selectedGenre === 'Mobile') {
      matchesGenre = bundle.orientation === 'portrait';
    } else {
      matchesGenre = bundle.tags && bundle.tags.includes(selectedGenre);
    }

    const matchesSearch =
      bundle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bundle.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bundle.tags && bundle.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      bundle.type.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesGenre && matchesSearch;
  });

  // Sort filtered bundles
  const sortedBundles = [...filteredBundles].sort((a, b) => {
    if (sortOption === 'views') {
      return b.stats.views - a.stats.views;
    }
    if (sortOption === 'downloads') {
      return b.stats.downloads - a.stats.downloads;
    }
    return 0; // default (order in data file)
  });

  const isFeedView = currentView === 'feed';
  const isBundleView = currentView === 'bundle' && activeBundle;

  return (
    <div className="webapp-container">
      {/* Sleek Minimalist Header */}
      <header className="header-nav">
        {/* Brand Logo & Search Bar */}
        <div className="header-left">
          <a
            href="/"
            className="brand-logo"
            onClick={(e) => {
              e.preventDefault();
              setCurrentView('landing');
              setActiveBundle(null);
              setSearchQuery('');
              setSelectedGenre('All');
            }}
          >
            <div className="brand-dots">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
            <span className="brand-name">Slidepapers</span>
          </a>
        </div>

        {/* Centered Search Bar */}
        {(isFeedView || isBundleView) && (
          <div className="search-container-header">
            <Search size={16} className="search-icon-header" />
            <input
              type="text"
              placeholder="Search wallpapers..."
              className="search-input-header"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (currentView === 'bundle') {
                  setCurrentView('feed');
                }
              }}
            />
          </div>
        )}

        {/* Right Nav Utilities & Authentication */}
        <div className="header-right">
          {/* + Drop Button (YouTube / OLX Style Creator CTA) */}
          <button
            className="drop-cta-btn"
            title="Publish a new wallpaper drop"
            onClick={handleDropClick}
          >
            <Plus size={16} className="drop-plus-icon" />
            <span>Drop</span>
          </button>

          {/* Light/Dark Toggle */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Cream Theme' : 'Switch to OLED Black Theme'}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            )}
          </button>

          {/* YouTube Authentic Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button
              className="notification-btn-header"
              title="Notifications"
              onClick={() => {
                if (!showNotifications) {
                  handleMarkAllNotificationsRead();
                }
                setShowNotifications(!showNotifications);
              }}
            >
              <Bell size={18} />
              {unreadNotificationsCount > 0 && (
                <span className="notification-badge-count">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <NotificationDropdown
                notifications={notifications}
                unreadCount={unreadNotificationsCount}
                onClose={() => setShowNotifications(false)}
                onSelectNotification={handleSelectNotification}
                onMarkAllAsRead={handleMarkAllNotificationsRead}
              />
            )}
          </div>

          {/* Firebase Authentication controls */}
          {user ? (
            <div
              className={`dropdown-container header-profile-dropdown${isUnlockingCurator ? ' creator-spotlight-elevated' : ''}`}
              ref={profileRef}
            >
              <div
                className="profile-badge"
                ref={profileBadgeRef}
                onClick={() => !isUnlockingCurator && setShowProfileMenu(!showProfileMenu)}
              >
                <img
                  src={getProxiedImageUrl(userProfile?.photoURL || user?.photoURL) || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'}
                  alt={user.displayName}
                  className="profile-avatar"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'; }}
                />
              </div>
              {showProfileMenu && (
                <div className={`dropdown-menu align-right${isUnlockingCurator ? ' creator-unlock-dropdown' : ''}`}>
                  {/* Creator's Dashboard — ONLY shown to non-admin creators or during reveal/done phase */}
                  {!isAdmin && localStorage.getItem('slidepapers_admin_session') !== 'true' && (isCurator || unlockPhase === 'reveal' || unlockPhase === 'done') && (
                    <div
                      className={`dropdown-item${unlockPhase === 'reveal' ? ' creator-btn-reveal' : ''}`}
                      onClick={() => {
                        if (isUnlockingCurator) return;
                        setShowProfileMenu(false);
                        setCurrentView('curator');
                        window.history.pushState(null, '', '/curator/profile');
                      }}
                      style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.25rem', whiteSpace: 'nowrap' }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Creator's Dashboard</span>
                      <Sparkles size={14} style={{ color: 'var(--color-google-yellow)', flexShrink: 0 }} />
                    </div>
                  )}
                  {(isAdmin || localStorage.getItem('slidepapers_admin_session') === 'true') && (
                    <div className="dropdown-item" onClick={() => { setCurrentView('admin'); window.history.pushState(null, '', '/admin'); setShowProfileMenu(false); }} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-google-yellow)' }}>Admin Dashboard</span>
                      <Shield size={14} style={{ color: 'var(--color-google-yellow)' }} />
                    </div>
                  )}
                  <div className="dropdown-item" onClick={() => { logout(); setShowProfileMenu(false); if (currentView === 'admin' || currentView === 'curator') setCurrentView('landing'); }}>
                    <span>Sign Out</span>
                    <LogOut size={14} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button className="auth-btn-google" onClick={loginWithGoogle}>
              <span>Login</span>
            </button>
          )}
        </div>

        {/* Cinematic dim backdrop — punches out around elevated profile zone */}
        {(unlockPhase === 'dim' || unlockPhase === 'spotlight' || unlockPhase === 'reveal' || unlockPhase === 'done') && (
          <div className={`creator-cinematic-dim${unlockPhase === 'done' ? ' creator-cinematic-dim--out' : ''}`} />
        )}

        {/* Genre Tabs Bar (Only on feed view) */}
        {currentView === 'feed' && (
          <div className="genre-tabs-bar">
            {/* Sort Dropdown — outside the scrollable div so dropdown isn't clipped */}
            {isFeedView && (
              <div className="dropdown-container genres-sort-dropdown" ref={sortRef}>
                <button
                  className="dropdown-trigger"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                >
                  <span>Sort</span>
                  <ChevronDown size={14} />
                </button>
                {showSortMenu && (
                  <div className="dropdown-menu">
                    <div
                      className={`dropdown-item ${sortOption === 'default' ? 'active' : ''}`}
                      onClick={() => { setSortOption('default'); setShowSortMenu(false); }}
                    >
                      <span>Default</span>
                      {sortOption === 'default' && <Check size={14} />}
                    </div>
                    <div
                      className={`dropdown-item ${sortOption === 'views' ? 'active' : ''}`}
                      onClick={() => { setSortOption('views'); setShowSortMenu(false); }}
                    >
                      <span>Popularity</span>
                      {sortOption === 'views' && <Check size={14} />}
                    </div>
                    <div
                      className={`dropdown-item ${sortOption === 'downloads' ? 'active' : ''}`}
                      onClick={() => { setSortOption('downloads'); setShowSortMenu(false); }}
                    >
                      <span>Downloads</span>
                      {sortOption === 'downloads' && <Check size={14} />}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="genre-tabs-container-wrapper" style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}>
              {canScrollLeft && (
                <div className="genre-scroll-left-overlay">
                  <button className="genre-scroll-left-btn" onClick={scrollGenresLeft}>
                    <ChevronLeft size={20} />
                  </button>
                </div>
              )}
              
              <div className="genre-tabs" ref={genreTabsRef} onScroll={handleGenreScroll}>
                {genres.map((genre) => (
                  <button
                    key={genre}
                    className={`genre-tab-btn ${selectedGenre === genre ? 'active' : ''}`}
                    onClick={() => setSelectedGenre(genre)}
                  >
                    {genre === 'Desktop' && <Monitor size={14} style={{ marginRight: '6px' }} />}
                    {genre === 'Mobile' && <Smartphone size={14} style={{ marginRight: '6px' }} />}
                    {genre}
                  </button>
                ))}
              </div>
              
              {canScrollRight && (
                <div className="genre-scroll-right-overlay">
                  <button className="genre-scroll-right-btn" onClick={scrollGenresRight}>
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Container Content */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {currentView === 'landing' ? (
          <HeroSection onGetStarted={handleGetStarted} bundles={bundles} />
        ) : currentView === 'admin' && (isAdmin || localStorage.getItem('slidepapers_admin_session') === 'true') ? (
          <AdminDashboard 
            onBack={() => setCurrentView('feed')} 
            logout={() => { logout(); setCurrentView('landing'); }} 
          />
        ) : currentView === 'curator' ? (
          <AdminDashboard 
            onBack={() => setCurrentView('feed')} 
            logout={() => { logout(); setCurrentView('landing'); }} 
            isCreatorMode={true}
          />
        ) : isBundleView ? (
          <BundleDetailPage
            key={activeBundle.id}
            bundle={activeBundle}
            onBack={handleCloseBundle}
            onOpenBundle={handleOpenBundle}
            onOpenChannel={handleOpenChannel}
            user={user}
            loginWithGoogle={loginWithGoogle}
            bundles={bundles}
          />
        ) : currentView === 'channel' && activeChannel ? (
          <ChannelPage
            channel={activeChannel}
            bundles={bundles}
            onSelectBundle={handleOpenBundle}
            onBack={() => setCurrentView('feed')}
            user={user}
          />
        ) : (
          <>
            <div>
              <WallpaperGrid
                bundles={sortedBundles}
                onSelectBundle={handleOpenBundle}
              />
            </div>
          </>
        )}
      </main>

      {/* Publisher & Policy Footer required for Google AdSense compliance */}
      <footer className="publisher-footer" style={{ borderTop: '1px solid var(--border-color)', marginTop: '3rem', padding: '2.5rem 1.5rem', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div style={{ maxWidth: '480px' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Slidepapers</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Slidepapers is a curated wallpaper continuity hub providing ultra-high-definition 4K &amp; HD wallpaper sets tailored for desktop (16:9) and mobile (9:16) devices.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <button onClick={() => setLegalModalType('privacy')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>Privacy Policy</button>
              <button onClick={() => setLegalModalType('terms')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>Terms of Service</button>
              <button onClick={() => setLegalModalType('dmca')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>DMCA &amp; Content</button>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span>&copy; {new Date().getFullYear()} Slidepapers. All rights reserved.</span>
            <span>Ca-Pub: ca-pub-6764886759571309</span>
          </div>
        </div>
      </footer>


      {/* Legal & Compliance Modal */}
      {legalModalType && (
        <LegalModal type={legalModalType} onClose={() => setLegalModalType(null)} />
      )}

      {/* Secret Admin Login Modal */}
      {showAdminLoginModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal" style={{ width: 'min(100%, 24rem)' }}>
            <h2>Admin Authorization</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
              Sign in with email and password to access dashboard.
            </p>

            {adminLoginError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0.8rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  <AlertCircle size={16} />
                  <span>Authentication Failed</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.9, lineHeight: '1.4' }}>{adminLoginError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setAdminLoginError('');
                    setAdminEmail('');
                    setAdminPassword('');
                    emailInputRef.current?.focus();
                  }}
                  className="admin-btn secondary"
                  style={{ alignSelf: 'flex-start', padding: '4px 10px', fontSize: '0.72rem', marginTop: '4px' }}
                >
                  Clear & Retry
                </button>
              </div>
            )}

            <div className="admin-modal-form" style={{ marginTop: '0.5rem' }}>
              <div className="admin-modal-field">
                <label>Admin ID / Email</label>
                <input 
                  type="text" 
                  required
                  ref={emailInputRef}
                  autoComplete="new-username"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    if (adminLoginError) setAdminLoginError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      passwordInputRef.current?.focus();
                    }
                  }}
                  className="admin-modal-input" 
                />
              </div>

              <div className="admin-modal-field">
                <label>Password</label>
                <input 
                  type="text" 
                  required
                  ref={passwordInputRef}
                  autoComplete="new-password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    if (adminLoginError) setAdminLoginError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdminLogin(e);
                    }
                  }}
                  className="admin-modal-input admin-password-input" 
                />
              </div>

              <div className="admin-modal-actions" style={{ marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAdminLoginModal(false);
                    setAdminLoginError('');
                    setAdminEmail('');
                    setAdminPassword('');
                  }}
                  className="admin-btn secondary"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleAdminLogin}
                  disabled={adminLoginLoading}
                  className="admin-btn primary"
                >
                  {adminLoginLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
      <TransferHUD />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DownloadProvider>
        <AppContent />
      </DownloadProvider>
    </AuthProvider>
  );
}
