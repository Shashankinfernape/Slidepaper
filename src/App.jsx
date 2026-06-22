import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronDown, Check, LogOut, Search, Bell
} from 'lucide-react';
import { WALLPAPER_BUNDLES } from './data';
import WallpaperGrid from './components/WallpaperGrid';
import BundleDetailPage from './components/BundleDetailPage';
import { AuthProvider, useAuth } from './context/AuthContext';

function HeroSection({ onGetStarted }) {
  const sampleImages = WALLPAPER_BUNDLES[0].images;

  return (
    <section className="hero-section">
      {/* Centered Heading */}
      <h1 className="hero-title">Nostalgicize Your Screen!</h1>

      {/* Horizontal Sequence Row (1 -> Cinematic Double Chevron -> 2 -> Cinematic Double Chevron -> 3) */}
      <div className="hero-visual-row">
        <div className="sequence-card">
          <img src={sampleImages[0].url} alt={sampleImages[0].label} className="sequence-img" />
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
          <img src={sampleImages[1].url} alt={sampleImages[1].label} className="sequence-img" />
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
          <img src={sampleImages[2].url} alt={sampleImages[2].label} className="sequence-img" />
        </div>
      </div>

      {/* Underneath Action Button */}
      <button className="hero-cta" onClick={onGetStarted}>
        Get Started
      </button>
    </section>
  );
}

function AppContent() {
  const { user, loginWithGoogle, logout, isFirebaseReal } = useAuth();
  const [theme, setTheme] = useState('dark');
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'feed' | 'bundle'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [sortOption, setSortOption] = useState('default'); // default, views, downloads
  const [activeBundle, setActiveBundle] = useState(null);

  // Dropdown UI states
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Refs for closing dropdowns when clicking outside
  const sortRef = useRef(null);
  const profileRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: currentView === 'bundle' ? 'smooth' : 'auto' });
  }, [currentView]);

  // Toggle between dark (OLED) and light (Cream) themes
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Switch to feed view
  const handleGetStarted = () => {
    setCurrentView('feed');
  };

  const handleOpenBundle = (bundle) => {
    setActiveBundle(bundle);
    setCurrentView('bundle');
  };

  const handleCloseBundle = () => {
    setCurrentView('feed');
    setActiveBundle(null);
  };

  // Extract unique genres/categories dynamically from all wallpaper bundle tags
  const genres = useMemo(() => {
    const uniqueTags = new Set();
    WALLPAPER_BUNDLES.forEach((bundle) => {
      if (bundle.tags && Array.isArray(bundle.tags)) {
        bundle.tags.forEach((tag) => {
          if (tag) uniqueTags.add(tag);
        });
      }
    });
    return ['All', ...Array.from(uniqueTags)];
  }, []);

  // Filter wallpaper bundles by search query and selected genre
  const filteredBundles = WALLPAPER_BUNDLES.filter((bundle) => {
    const matchesGenre =
      selectedGenre === 'All' ||
      bundle.tags.includes(selectedGenre);

    const matchesSearch =
      bundle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bundle.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bundle.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
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

        {/* Right Nav Utilities, Sort, & Authentication */}
        <div className="header-right">
          {(isFeedView || isBundleView) && (
            <div className="dropdown-container" ref={sortRef}>
              <button
                className="dropdown-trigger"
                onClick={() => setShowSortMenu(!showSortMenu)}
              >
                <span>Sort: {
                  sortOption === 'views' ? 'Popularity' :
                  sortOption === 'downloads' ? 'Most Downloaded' :
                  'Default'
                }</span>
                <ChevronDown size={14} />
              </button>
              {showSortMenu && (
                <div className="dropdown-menu">
                  <div
                    className={`dropdown-item ${sortOption === 'default' ? 'active' : ''}`}
                    onClick={() => {
                      setSortOption('default');
                      setShowSortMenu(false);
                      if (currentView === 'bundle') {
                        setCurrentView('feed');
                      }
                    }}
                  >
                    <span>Default</span>
                    {sortOption === 'default' && <Check size={14} />}
                  </div>
                  <div
                    className={`dropdown-item ${sortOption === 'views' ? 'active' : ''}`}
                    onClick={() => {
                      setSortOption('views');
                      setShowSortMenu(false);
                      if (currentView === 'bundle') {
                        setCurrentView('feed');
                      }
                    }}
                  >
                    <span>Popularity</span>
                    {sortOption === 'views' && <Check size={14} />}
                  </div>
                  <div
                    className={`dropdown-item ${sortOption === 'downloads' ? 'active' : ''}`}
                    onClick={() => {
                      setSortOption('downloads');
                      setShowSortMenu(false);
                      if (currentView === 'bundle') {
                        setCurrentView('feed');
                      }
                    }}
                  >
                    <span>Downloads</span>
                    {sortOption === 'downloads' && <Check size={14} />}
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Notification Bell */}
          <button
            className="notification-btn-header"
            title="Notifications"
            onClick={() => alert('No new notifications')}
          >
            <Bell size={18} />
          </button>

          {/* Firebase Authentication controls */}
          {user ? (
            <div className="dropdown-container" ref={profileRef}>
              <div
                className="profile-badge"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <span className="profile-name">{user.displayName.split(' ')[0]}</span>
                <img
                  src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                  alt={user.displayName}
                  className="profile-avatar"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'; }}
                />
              </div>
              {showProfileMenu && (
                <div className="dropdown-menu align-right">
                  <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.25rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Logged in as</p>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</p>
                    {!isFirebaseReal && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-google-yellow)', display: 'block', marginTop: '0.15rem' }}>
                        Simulated Sandbox Session
                      </span>
                    )}
                  </div>
                  <div className="dropdown-item" onClick={() => { logout(); setShowProfileMenu(false); }}>
                    <span>Sign Out</span>
                    <LogOut size={14} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button className="auth-btn-google" onClick={loginWithGoogle}>
              <span>Login with Google</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container Content */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {currentView === 'landing' ? (
          <HeroSection onGetStarted={handleGetStarted} />
        ) : isBundleView ? (
          <BundleDetailPage
            key={activeBundle.id}
            bundle={activeBundle}
            onBack={handleCloseBundle}
            onOpenBundle={handleOpenBundle}
            user={user}
            loginWithGoogle={loginWithGoogle}
          />
        ) : (
          <>
            <div className="genre-tabs-bar">
              <div className="genre-tabs">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    className={`genre-tab-btn ${selectedGenre === genre ? 'active' : ''}`}
                    onClick={() => setSelectedGenre(genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <WallpaperGrid
                bundles={sortedBundles}
                onSelectBundle={handleOpenBundle}
              />
            </div>
          </>
        )}
      </main>

      {/* Clean minimal footer */}
      <footer className="clean-footer">
        <div className="clean-footer-left">
          <span className="footer-badge">Cloudflare Pages & R2 Hosting</span>
          <span className="footer-badge">CC-BY 4.0 Art license</span>
        </div>
        <p style={{ opacity: 0.7 }}>(c) 2026 Slidepapers Hub. Desktop-First Viewport.</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
