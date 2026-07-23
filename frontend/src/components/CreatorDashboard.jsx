import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart2, Folder, HardDrive, Shield, LogOut, ArrowLeft, RefreshCw, 
  CheckCircle2, AlertCircle, FileText, Upload, Plus, Trash2, Check, User, X, Users, Eye, Download, Clock, MessageSquare, Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import TransferHUD from './TransferHUD';

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

export default function CreatorDashboard({ user, onBack, onSelectBundle }) {
  const { userProfile, updateUserProfileState, logout } = useAuth();
  
  // Navigation & Tab State inside Creator Studio
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Stats & Drops state
  const [stats, setStats] = useState({ totalDrops: 0, totalViews: 0, totalDownloads: 0, subscribers: 0 });
  const [myBundles, setMyBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all');

  // Form states for Upload Drop tab (1:1 literal match with AdminDashboard upload)
  const [bundleName, setBundleName] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [bundleOrientation, setBundleOrientation] = useState('landscape');
  const [bundleType, setBundleType] = useState('');
  const [bundleTags, setBundleTags] = useState('');
  const [bundleIncludes, setBundleIncludes] = useState('');
  const [bundleRatio, setBundleRatio] = useState('16:9');
  const [customRatioW, setCustomRatioW] = useState('16');
  const [customRatioH, setCustomRatioH] = useState('9');
  const [mediaItems, setMediaItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showUploadHud, setShowUploadHud] = useState(false);
  const [uploadMetrics, setUploadMetrics] = useState({
    progress: 0,
    speedMbps: 0,
    transferredMB: 0,
    totalMB: 0,
    etaSeconds: 0,
    stage: ''
  });
  const fileInputRef = useRef(null);

  // Form states for Profile
  const [editedDisplayName, setEditedDisplayName] = useState(userProfile?.displayName || user?.displayName || '');
  const [editedAbout, setEditedAbout] = useState(userProfile?.about || '');
  const [editedYoutube, setEditedYoutube] = useState(userProfile?.youtubeUrl || '');
  const [editedInstagram, setEditedInstagram] = useState(userProfile?.instagramUrl || '');
  const [editedTwitter, setEditedTwitter] = useState(userProfile?.twitterUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    fetchCreatorData();
  }, [user]);

  useEffect(() => {
    setBundleRatio(bundleOrientation === 'landscape' ? '16:9' : '9:16');
  }, [bundleOrientation]);

  const fetchCreatorData = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/curator/dashboard/${user.uid}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.stats || { totalDrops: 0, totalViews: 0, totalDownloads: 0, subscribers: 0 });
        setMyBundles(data.bundles || []);
      }
    } catch (err) {
      console.error('[Creator Studio] Error fetching creator data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBundle = async (bundleId) => {
    if (!window.confirm('Are you sure you want to delete this wallpaper drop?')) return;
    try {
      const res = await fetch(`${API_URL}/api/bundles/${bundleId}`, { method: 'DELETE' });
      if (res.ok) {
        setMyBundles(prev => prev.filter(b => b.id !== bundleId));
        setStats(prev => ({ ...prev, totalDrops: Math.max(0, prev.totalDrops - 1) }));
        showToast('Wallpaper drop deleted.', 'success');
      }
    } catch (err) {
      console.error('Error deleting bundle:', err);
      showToast('Failed to delete drop.', 'error');
    }
  };

  // Upload File handler (1:1 with AdminDashboard)
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newItems = files.map(file => ({
      type: 'new',
      id: Math.random().toString(36).substring(7),
      data: file,
      name: file.name,
      size: file.size,
      preview: URL.createObjectURL(file)
    }));
    setMediaItems(prev => [...prev, ...newItems]);
  };

  const removeMediaItem = (id) => {
    setMediaItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmitBundle = async (e) => {
    e.preventDefault();
    const submitter = e.nativeEvent?.submitter;
    const rect = submitter ? submitter.getBoundingClientRect() : null;

    if (mediaItems.length === 0) {
      showToast('Please upload at least one wallpaper image.', 'error');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('name', bundleName);
    formData.append('description', bundleDescription);
    formData.append('orientation', bundleOrientation);
    const finalRatio = bundleRatio === 'custom' ? `${customRatioW}:${customRatioH}` : bundleRatio;
    formData.append('ratio', finalRatio);
    formData.append('type', bundleType || (bundleOrientation === 'landscape' ? 'Landscape Wallpaper Pack' : 'Vertical Mobile Pack'));
    formData.append('tags', bundleTags);
    formData.append('includes', bundleIncludes);
    
    mediaItems.forEach((m) => {
      if (m.data) formData.append('images', m.data);
    });

    if (user) {
      formData.append('authorId', user.uid);
      formData.append('authorName', userProfile?.displayName || user.displayName || user.email);
      if (userProfile?.photoURL || user.photoURL) {
        formData.append('authorAvatar', userProfile?.photoURL || user.photoURL);
      }
      if (user.email) {
        formData.append('authorEmail', user.email);
      }
    }

    setShowUploadHud(true);
    setUploadMetrics({
      progress: 0,
      speedMbps: 0,
      transferredMB: 0,
      totalMB: 0,
      etaSeconds: 0,
      stage: 'Initiating transfer to backend...'
    });

    let startTime = Date.now();

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/curator/bundles`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const currentTime = Date.now();
          const elapsedTimeInSeconds = (currentTime - startTime) / 1000;
          const transferredMB = event.loaded / (1024 * 1024);
          const totalMB = event.total / (1024 * 1024);
          const progress = Math.round((event.loaded / event.total) * 100);
          const speedMbps = elapsedTimeInSeconds > 0 ? ((event.loaded * 8) / (1024 * 1024 * elapsedTimeInSeconds)).toFixed(1) : 0;
          const remainingBytes = event.total - event.loaded;
          const bytesPerSecond = elapsedTimeInSeconds > 0 ? event.loaded / elapsedTimeInSeconds : 0;
          const etaSeconds = bytesPerSecond > 0 ? Math.round(remainingBytes / bytesPerSecond) : 0;

          setUploadMetrics({
            progress,
            speedMbps,
            transferredMB: transferredMB.toFixed(1),
            totalMB: totalMB.toFixed(1),
            etaSeconds,
            stage: progress < 100 ? 'Uploading wallpapers to server...' : 'Processing and generating ZIP archives...'
          });
        }
      };

      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadMetrics(prev => ({
              ...prev,
              progress: 100,
              stage: 'Upload complete! Submitted for review.'
            }));
            setTimeout(() => {
              setShowUploadHud(false);
              resolve();
            }, 1500);
          } else {
            let errorMessage = 'Failed to publish wallpaper bundle.';
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = errorData.error || errorMessage;
            } catch (_) {}
            setShowUploadHud(false);
            reject(new Error(errorMessage));
          }
        };

        xhr.onerror = () => {
          setShowUploadHud(false);
          reject(new Error('Network error during bundle upload.'));
        };

        xhr.send(formData);
      });

      if (rect) {
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { x, y },
          startVelocity: 35,
          colors: ['#ffffff', '#888888', '#aaaaaa']
        });
      } else {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }

      showToast('Your bundle has been submitted and will be published after review.', 'success');
      
      // Reset form & Navigate to My Bundles
      setBundleName('');
      setBundleDescription('');
      setBundleOrientation('landscape');
      setBundleRatio('16:9');
      setBundleType('');
      setBundleTags('');
      setBundleIncludes('');
      setMediaItems([]);

      fetchCreatorData();
      setActiveTab('bundles');
    } catch (error) {
      console.error('Upload failed:', error);
      showToast(`Publishing failed: ${error.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const res = await fetch(`${API_URL}/api/users/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          displayName: editedDisplayName,
          about: editedAbout,
          youtubeUrl: editedYoutube,
          instagramUrl: editedInstagram,
          twitterUrl: editedTwitter
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          updateUserProfileState(data.user);
          showToast('Creator profile updated successfully!', 'success');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const filteredBundles = myBundles.filter(b => {
    const bStatus = b.status || 'published';
    if (filterTab === 'published') return bStatus === 'published';
    if (filterTab === 'pending') return bStatus === 'pending_review';
    if (filterTab === 'rejected') return bStatus === 'rejected';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Toast Notification Element (1:1 with AdminDashboard) */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(20, 20, 20, 0.95)',
          color: '#fff',
          padding: '12px 24px', 
          borderRadius: '8px', 
          zIndex: 9999,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', 
          animation: 'toast-pop-fade 3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 500,
          fontSize: '0.85rem'
        }}>
          {toast.type === 'error' ? <AlertCircle size={16} color="#ef4444" /> : <CheckCircle2 size={16} color="#10b981" />}
          {toast.message}
        </div>
      )}

      {/* Transfer HUD for Uploads */}
      {showUploadHud && (
        <TransferHUD 
          isOpen={showUploadHud}
          onClose={() => setShowUploadHud(false)}
          metrics={uploadMetrics}
        />
      )}

      {/* Sidebar backdrop overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="admin-sidebar-backdrop"
        />
      )}

      {/* EXACT SAME CONTAINER AS ADMIN DASHBOARD */}
      <div className="admin-dashboard-container" style={{
        display: 'flex',
        minHeight: '85vh',
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        color: 'var(--text-primary)',
        marginTop: '1rem',
        position: 'relative'
      }}>
        {/* Sidebar navigation — 1:1 match with AdminDashboard */}
        <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div className="admin-sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} style={{ color: 'var(--color-google-yellow)', flexShrink: 0 }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.5px', margin: 0, whiteSpace: 'nowrap' }}>Studio</h2>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', lineHeight: 1 }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, width: '100%' }}>
            <button
              onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }}
              className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            >
              <BarChart2 size={16} style={{ flexShrink: 0 }} />
              <span>Overview</span>
            </button>
            <button
              onClick={() => { setActiveTab('bundles'); setIsSidebarOpen(false); fetchCreatorData(); }}
              className={`admin-nav-item ${activeTab === 'bundles' ? 'active' : ''}`}
            >
              <HardDrive size={16} style={{ flexShrink: 0 }} />
              <span>Bundles Manager</span>
            </button>
            <button
              onClick={() => { 
                setActiveTab('upload'); 
                setIsSidebarOpen(false); 
                setBundleName('');
                setBundleDescription('');
                setBundleOrientation('landscape');
                setBundleRatio('16:9');
                setBundleType('');
                setBundleTags('');
                setBundleIncludes('');
                setMediaItems([]);
              }}
              className={`admin-nav-item ${activeTab === 'upload' ? 'active' : ''}`}
            >
              <Plus size={16} style={{ flexShrink: 0 }} />
              <span>Create Bundle</span>
            </button>
            <button
              onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}
              className={`admin-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            >
              <User size={16} style={{ flexShrink: 0 }} />
              <span>Profile Settings</span>
            </button>
          </nav>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
            <button onClick={onBack} className="admin-nav-item" style={{ border: '1px solid var(--border-color)' }}>
              <ArrowLeft size={16} style={{ flexShrink: 0 }} />
              <span>Back to Site</span>
            </button>
            <button onClick={logout} className="admin-nav-item logout" style={{ color: '#ef4444' }}>
              <LogOut size={16} style={{ flexShrink: 0 }} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Dashboard Content — 1:1 match with AdminDashboard layout */}
        <main style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', minWidth: 0 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
                {activeTab === 'overview' && 'Creator Studio'}
                {activeTab === 'bundles' && 'Bundles Manager'}
                {activeTab === 'upload' && 'Publish New Bundle'}
                {activeTab === 'profile' && 'Creator Profile Settings'}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
                {activeTab === 'overview' && 'Metrics, views, downloads, and subscriber stats'}
                {activeTab === 'bundles' && 'List, edit, and manage your published wallpaper sets'}
                {activeTab === 'upload' && 'Upload high-resolution wallpaper sets for review'}
                {activeTab === 'profile' && 'Customize display name, channel about details, and socials'}
              </p>
            </div>

            {/* Right-side hamburger */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="admin-hamburger"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </header>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <span className="stat-label">Total Drops</span>
                  <span className="stat-value">{stats.totalDrops}</span>
                  <span className="stat-sub">Active bundles</span>
                </div>
                <div className="admin-stat-card">
                  <span className="stat-label">Total Views</span>
                  <span className="stat-value">{new Intl.NumberFormat().format(stats.totalViews)}</span>
                  <span className="stat-sub">Across all packs</span>
                </div>
                <div className="admin-stat-card">
                  <span className="stat-label">Total Downloads</span>
                  <span className="stat-value">{new Intl.NumberFormat().format(stats.totalDownloads)}</span>
                  <span className="stat-sub">ZIP files requested</span>
                </div>
                <div className="admin-stat-card">
                  <span className="stat-label">Subscribers</span>
                  <span className="stat-value">{new Intl.NumberFormat().format(stats.subscribers)}</span>
                  <span className="stat-sub">Channel members</span>
                </div>
              </div>

              <div className="admin-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Quick Actions</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => setActiveTab('upload')} 
                    className="admin-btn primary"
                  >
                    <Plus size={16} /> Create Bundle
                  </button>
                  <button 
                    onClick={() => setActiveTab('bundles')} 
                    className="admin-btn secondary"
                  >
                    <HardDrive size={16} /> View My Bundles
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BUNDLES MANAGER (1:1 with AdminDashboard) */}
          {activeTab === 'bundles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Manage Wallpapers</h3>
                <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => setFilterTab('all')}
                    style={{
                      padding: '0.35rem 0.8rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: filterTab === 'all' ? 'var(--bg-primary)' : 'transparent',
                      color: filterTab === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    All ({myBundles.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('published')}
                    style={{
                      padding: '0.35rem 0.8rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: filterTab === 'published' ? 'var(--bg-primary)' : 'transparent',
                      color: filterTab === 'published' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Published ({myBundles.filter(b => (b.status || 'published') === 'published').length})
                  </button>
                  <button
                    onClick={() => setFilterTab('pending')}
                    style={{
                      padding: '0.35rem 0.8rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: filterTab === 'pending' ? 'var(--bg-primary)' : 'transparent',
                      color: filterTab === 'pending' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Pending ({myBundles.filter(b => b.status === 'pending_review').length})
                  </button>
                </div>
              </div>

              {filteredBundles.length === 0 ? (
                <div className="admin-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Folder size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                  <p>No wallpaper bundles found in this category.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {filteredBundles.map(bundle => (
                    <div key={bundle.id} className="admin-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ position: 'relative', height: '150px', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                        {bundle.images && bundle.images[0] ? (
                          <img src={bundle.images[0].previewUrl || bundle.images[0].url} alt={bundle.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>No Image</div>
                        )}
                        <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.75)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', color: '#fff' }}>
                          {bundle.orientation === 'landscape' ? 'Horizontal' : 'Vertical'}
                        </span>
                      </div>

                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 600 }}>{bundle.name}</h4>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {bundle.description || 'No description'}
                        </p>
                      </div>

                      {bundle.adminNote && (
                        <div style={{ padding: '0.5rem', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '6px', border: '1px solid rgba(234, 179, 8, 0.25)', fontSize: '0.75rem', color: 'var(--color-google-yellow)' }}>
                          <strong>Admin Note:</strong> {bundle.adminNote}
                        </div>
                      )}

                      <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{bundle.images?.length || 0} Wallpapers</span>
                        <button onClick={() => handleDeleteBundle(bundle.id)} className="admin-btn secondary" style={{ color: '#ef4444', padding: '4px 8px' }}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CREATE BUNDLE (1:1 LITERAL MATCH WITH ADMIN DASHBOARD UPLOAD FORM) */}
          {activeTab === 'upload' && (
            <div className="admin-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <form onSubmit={handleSubmitBundle} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Bundle Name *</label>
                  <input
                    type="text"
                    required
                    value={bundleName}
                    onChange={(e) => setBundleName(e.target.value)}
                    placeholder="e.g. Cyberpunk 2077 Night City Pack"
                    className="admin-modal-input"
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Description</label>
                  <textarea
                    rows="3"
                    value={bundleDescription}
                    onChange={(e) => setBundleDescription(e.target.value)}
                    placeholder="Brief overview of this wallpaper set..."
                    className="admin-modal-input"
                    style={{ height: 'auto' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Orientation</label>
                    <select
                      value={bundleOrientation}
                      onChange={(e) => setBundleOrientation(e.target.value)}
                      className="admin-modal-input"
                    >
                      <option value="landscape">Landscape / Desktop (16:9)</option>
                      <option value="portrait">Portrait / Mobile (9:16)</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Aspect Ratio</label>
                    <select
                      value={bundleRatio}
                      onChange={(e) => setBundleRatio(e.target.value)}
                      className="admin-modal-input"
                    >
                      {bundleOrientation === 'landscape' ? (
                        <>
                          <option value="16:9">16:9 Standard Widescreen</option>
                          <option value="21:9">21:9 Ultrawide</option>
                          <option value="16:10">16:10 Display</option>
                          <option value="32:9">32:9 Super Ultrawide</option>
                        </>
                      ) : (
                        <>
                          <option value="9:16">9:16 Mobile Vertical</option>
                          <option value="9:19.5">9:19.5 Modern Phone</option>
                          <option value="3:4">3:4 Tablet / iPad</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Category Tag</label>
                    <input
                      type="text"
                      value={bundleType}
                      onChange={(e) => setBundleType(e.target.value)}
                      placeholder="e.g. Gaming, Anime, Minimalist"
                      className="admin-modal-input"
                    />
                  </div>
                </div>

                {/* Upload Drag & Drop Zone (1:1 with Admin Dashboard) */}
                <div className="admin-form-group">
                  <label className="admin-form-label">Wallpaper Images *</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: '8px',
                      padding: '2rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'var(--bg-primary)'
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept="image/*"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <Upload size={32} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Click to browse or drag wallpaper files here</p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>JPG, PNG, WebP ultra-high resolution</p>
                  </div>

                  {mediaItems.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                      {mediaItems.map(item => (
                        <div key={item.id} style={{ position: 'relative', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                          <img src={item.preview} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => removeMediaItem(item.id)}
                            style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.75)', border: 'none', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="admin-btn primary"
                    style={{ padding: '0.65rem 1.75rem' }}
                  >
                    {uploading ? 'Publishing...' : 'Publish Bundle'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: PROFILE SETTINGS */}
          {activeTab === 'profile' && (
            <div className="admin-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)', maxWidth: '600px' }}>
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Display / Creator Name</label>
                  <input
                    type="text"
                    value={editedDisplayName}
                    onChange={(e) => setEditedDisplayName(e.target.value)}
                    className="admin-modal-input"
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Channel About Bio</label>
                  <textarea
                    rows="3"
                    value={editedAbout}
                    onChange={(e) => setEditedAbout(e.target.value)}
                    placeholder="Bio details for your channel..."
                    className="admin-modal-input"
                    style={{ height: 'auto' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">YouTube URL</label>
                    <input type="text" value={editedYoutube} onChange={(e) => setEditedYoutube(e.target.value)} className="admin-modal-input" />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Instagram Handle</label>
                    <input type="text" value={editedInstagram} onChange={(e) => setEditedInstagram(e.target.value)} className="admin-modal-input" />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Twitter / X Handle</label>
                    <input type="text" value={editedTwitter} onChange={(e) => setEditedTwitter(e.target.value)} className="admin-modal-input" />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="submit" disabled={savingProfile} className="admin-btn primary">
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
