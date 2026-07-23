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

  // Form states for Upload Drop tab (1:1 with Admin Dashboard Upload)
  const [bundleName, setBundleName] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [bundleOrientation, setBundleOrientation] = useState('landscape');
  const [bundleType, setBundleType] = useState('Desktop');
  const [bundleTags, setBundleTags] = useState('');
  const [bundleIncludes, setBundleIncludes] = useState('');
  const [bundleRatio, setBundleRatio] = useState('16:9');
  const [coverIndex, setCoverIndex] = useState(0);
  const [mediaItems, setMediaItems] = useState([]); // [{ type: 'file'|'url', file, url, label }]
  const [customImageUrl, setCustomImageUrl] = useState('');
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

  // Profile Edit States
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

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newItems = files.map(file => ({
      type: 'file',
      file,
      url: URL.createObjectURL(file),
      label: file.name.replace(/\.[^/.]+$/, '')
    }));

    setMediaItems(prev => [...prev, ...newItems]);
  };

  const handleAddUrlImage = () => {
    if (!customImageUrl.trim()) return;
    setMediaItems(prev => [
      ...prev,
      {
        type: 'url',
        url: customImageUrl.trim(),
        label: `Wallpaper #${prev.length + 1}`
      }
    ]);
    setCustomImageUrl('');
  };

  const handleRemoveMedia = (indexToRemove) => {
    setMediaItems(prev => prev.filter((_, i) => i !== indexToRemove));
    if (coverIndex >= mediaItems.length - 1) {
      setCoverIndex(Math.max(0, mediaItems.length - 2));
    }
  };

  const handlePublishDrop = async (e) => {
    e.preventDefault();
    if (!bundleName.trim()) {
      showToast('Please provide a drop title.', 'error');
      return;
    }
    if (mediaItems.length === 0) {
      showToast('Please add at least 1 wallpaper image.', 'error');
      return;
    }

    setUploading(true);
    setShowUploadHud(true);
    setUploadMetrics({
      progress: 0,
      speedMbps: 2.5,
      transferredMB: 0.5,
      totalMB: mediaItems.length * 3.5,
      etaSeconds: 4,
      stage: 'Preparing high-res wallpaper drop...'
    });

    try {
      // Process images for API payload
      const imagesPayload = mediaItems.map(item => ({
        url: item.url,
        previewUrl: item.url,
        label: item.label || 'Wallpaper'
      }));

      const res = await fetch(`${API_URL}/api/curator/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user?.uid,
          name: bundleName.trim(),
          description: bundleDescription.trim(),
          type: bundleType,
          orientation: bundleOrientation,
          ratioOptions: bundleOrientation === 'vertical' ? ['9:16', '3:4'] : ['16:9', '21:9', '16:10'],
          coverIndex,
          images: imagesPayload,
          author: {
            uid: user?.uid || 'anonymous',
            name: userProfile?.displayName || user?.displayName || 'Creator',
            avatar: userProfile?.photoURL || user?.photoURL || '',
            email: user?.email || ''
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit drop');
      }

      setUploadMetrics({
        progress: 100,
        speedMbps: 0,
        transferredMB: mediaItems.length * 3.5,
        totalMB: mediaItems.length * 3.5,
        etaSeconds: 0,
        stage: 'Submitted for Admin Review!'
      });

      setTimeout(() => {
        setShowUploadHud(false);
        showToast('Your bundle has been submitted and will be published after review.', 'success');
        
        // Reset Form & Navigate to My Drops tab
        setBundleName('');
        setBundleDescription('');
        setMediaItems([]);
        setCoverIndex(0);
        fetchCreatorData();
        setActiveTab('drops');
      }, 1200);
    } catch (err) {
      console.error('[Creator Studio] Drop upload failed:', err);
      setShowUploadHud(false);
      showToast(err.message || 'Failed to submit drop', 'error');
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
          showToast('Creator profile updated!', 'success');
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
      {/* Toast Banner */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(20, 20, 20, 0.95)', color: '#fff',
          padding: '12px 24px', borderRadius: '8px', zIndex: 9999,
          border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '8px',
          fontWeight: 600, fontSize: '0.85rem'
        }}>
          {toast.type === 'error' ? <AlertCircle size={16} color="#ef4444" /> : <CheckCircle2 size={16} color="#10b981" />}
          {toast.message}
        </div>
      )}

      {/* Upload Transfer Progress HUD */}
      {showUploadHud && (
        <TransferHUD 
          isOpen={showUploadHud}
          onClose={() => setShowUploadHud(false)}
          metrics={uploadMetrics}
        />
      )}

      {/* Main Creator Studio Layout — 1:1 Parity with AdminDashboard */}
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
        {/* Sidebar Navigation */}
        <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.5rem' }}>
            <div className="admin-sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} style={{ color: 'var(--color-google-yellow)', flexShrink: 0 }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Creator Studio</h2>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'none' }}
              className="admin-sidebar-close"
            >
              <X size={18} />
            </button>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, width: '100%' }}>
            <button
              onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }}
              className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            >
              <BarChart2 size={16} style={{ flexShrink: 0 }} />
              <span>Overview & Analytics</span>
            </button>

            <button
              onClick={() => { setActiveTab('upload'); setIsSidebarOpen(false); }}
              className={`admin-nav-item ${activeTab === 'upload' ? 'active' : ''}`}
            >
              <Plus size={16} style={{ flexShrink: 0 }} />
              <span>+ Drop Wallpaper Pack</span>
            </button>

            <button
              onClick={() => { setActiveTab('drops'); setIsSidebarOpen(false); fetchCreatorData(); }}
              className={`admin-nav-item ${activeTab === 'drops' ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Folder size={16} style={{ flexShrink: 0 }} />
                <span>My Wallpaper Drops</span>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '9999px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}>
                {myBundles.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}
              className={`admin-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            >
              <User size={16} style={{ flexShrink: 0 }} />
              <span>Creator Profile</span>
            </button>

            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={onBack}
                className="admin-nav-item"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ArrowLeft size={16} />
                <span>Back to Feed</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="admin-main-content" style={{ flex: 1, padding: '1.5rem 2rem', overflowY: 'auto' }}>
          {/* Top Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Creator Studio</span>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.55rem', borderRadius: '9999px', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid var(--color-google-yellow)', color: 'var(--color-google-yellow)', fontWeight: 700 }}>
                  Verified Creator
                </span>
              </h1>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {activeTab === 'overview' && 'View your wallpaper drop metrics, downloads, and subscriber stats.'}
                {activeTab === 'upload' && 'Upload and submit a new high-resolution wallpaper drop.'}
                {activeTab === 'drops' && 'Manage your wallpaper collections, track review statuses, and admin feedback.'}
                {activeTab === 'profile' && 'Update your channel display name, avatar, bio, and social media presence.'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button className="admin-btn secondary" onClick={fetchCreatorData} title="Refresh Studio">
                <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
              </button>
              {activeTab !== 'upload' && (
                <button 
                  className="admin-btn primary" 
                  onClick={() => setActiveTab('upload')}
                  style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)', fontWeight: 700 }}
                >
                  <Plus size={16} />
                  <span>+ Drop Pack</span>
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: OVERVIEW & ANALYTICS */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="admin-stat-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Drops</span>
                    <Folder size={18} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{stats.totalDrops}</div>
                </div>

                <div className="admin-stat-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Views</span>
                    <Eye size={18} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{stats.totalViews.toLocaleString()}</div>
                </div>

                <div className="admin-stat-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Downloads</span>
                    <Download size={18} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{stats.totalDownloads.toLocaleString()}</div>
                </div>

                <div className="admin-stat-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Subscribers</span>
                    <Users size={18} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{stats.subscribers.toLocaleString()}</div>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="admin-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700 }}>Ready for a new drop?</h3>
                <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Upload high-resolution 4K wallpaper collections for Desktop (16:9) or Mobile (9:16). Your drop will be published following quality review.
                </p>
                <button 
                  className="admin-btn primary" 
                  onClick={() => setActiveTab('upload')}
                  style={{ padding: '0.6rem 1.4rem', borderRadius: '9999px', background: 'var(--text-primary)', color: 'var(--bg-primary)', fontWeight: 750 }}
                >
                  <Plus size={16} />
                  <span>Create Wallpaper Drop</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: DROP WALLPAPER PACK (1:1 EMBEDDED UPLOAD PAGE) */}
          {activeTab === 'upload' && (
            <div className="admin-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.75rem' }}>
              <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1.2rem', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                Drop New Wallpaper Pack
              </h2>

              <form onSubmit={handlePublishDrop} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Drag & Drop Upload Zone */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    1. Upload Wallpaper Images *
                  </label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ border: '2px dashed var(--border-color)', background: 'var(--bg-primary)', borderRadius: '14px', padding: '2.25rem 1rem', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  >
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      ref={fileInputRef}
                      onChange={handleFileUpload} 
                      style={{ display: 'none' }}
                    />
                    <Upload size={36} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Click or Drag High-Res Images Here</p>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Supports Ultra HD JPG, PNG, WebP</p>
                  </div>

                  {/* URL Input Row */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <input
                      type="text"
                      placeholder="Or paste direct image URL (https://...)"
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrlImage(); } }}
                      className="admin-modal-input"
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="admin-btn secondary" onClick={handleAddUrlImage}>
                      <Plus size={15} />
                      <span>Add Image</span>
                    </button>
                  </div>

                  {/* Thumbnails Grid & Cover Selector */}
                  {mediaItems.length > 0 && (
                    <div style={{ marginTop: '1.25rem' }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Uploaded Images ({mediaItems.length}) • Click thumbnail to select Cover Image:
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.85rem' }}>
                        {mediaItems.map((item, index) => (
                          <div 
                            key={index} 
                            onClick={() => setCoverIndex(index)}
                            style={{ position: 'relative', height: '110px', borderRadius: '10px', overflow: 'hidden', border: coverIndex === index ? '2px solid var(--text-primary)' : '1px solid var(--border-color)', cursor: 'pointer' }}
                          >
                            <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {coverIndex === index && (
                              <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'var(--text-primary)', color: 'var(--bg-primary)', fontSize: '0.68rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Check size={10} /> Cover
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRemoveMedia(index); }}
                              style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.75)', border: 'none', color: '#ffffff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Drop Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cyberpunk Neon Tokyo 4K Pack"
                      value={bundleName}
                      onChange={(e) => setBundleName(e.target.value)}
                      className="admin-modal-input"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Category / Genre
                    </label>
                    <select 
                      value={bundleType} 
                      onChange={(e) => setBundleType(e.target.value)}
                      className="admin-modal-input"
                    >
                      <option value="Desktop">Desktop Wallpapers</option>
                      <option value="Mobile">Mobile Wallpapers</option>
                      <option value="Anime">Anime & Manga</option>
                      <option value="Aesthetic">Aesthetic & Minimalist</option>
                      <option value="Gaming">Gaming & Cyberpunk</option>
                      <option value="Nature">Nature & Scenery</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Orientation
                    </label>
                    <select 
                      value={bundleOrientation} 
                      onChange={(e) => setBundleOrientation(e.target.value)}
                      className="admin-modal-input"
                    >
                      <option value="landscape">Horizontal (16:9 / 21:9)</option>
                      <option value="vertical">Vertical (9:16 / 3:4)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Primary Aspect Ratio
                    </label>
                    <input
                      type="text"
                      value={bundleRatio}
                      onChange={(e) => setBundleRatio(e.target.value)}
                      className="admin-modal-input"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Description & Details
                  </label>
                  <textarea
                    rows="3"
                    placeholder="Describe your wallpaper collection theme..."
                    value={bundleDescription}
                    onChange={(e) => setBundleDescription(e.target.value)}
                    className="admin-modal-input"
                    style={{ height: 'auto' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <button 
                    type="submit" 
                    disabled={uploading}
                    className="admin-btn primary"
                    style={{ padding: '0.75rem 2rem', borderRadius: '9999px', background: 'var(--text-primary)', color: 'var(--bg-primary)', fontWeight: 800, fontSize: '0.9rem' }}
                  >
                    {uploading ? 'Submitting Drop...' : 'Submit Drop for Review'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: MY WALLPAPER DROPS */}
          {activeTab === 'drops' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Filter Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setFilterTab('all')}
                  style={{ padding: '0.4rem 0.9rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border-color)', background: filterTab === 'all' ? 'var(--text-primary)' : 'var(--bg-surface)', color: filterTab === 'all' ? 'var(--bg-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  All Drops ({myBundles.length})
                </button>
                <button 
                  onClick={() => setFilterTab('published')}
                  style={{ padding: '0.4rem 0.9rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border-color)', background: filterTab === 'published' ? 'var(--text-primary)' : 'var(--bg-surface)', color: filterTab === 'published' ? 'var(--bg-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Published ({myBundles.filter(b => (b.status || 'published') === 'published').length})
                </button>
                <button 
                  onClick={() => setFilterTab('pending')}
                  style={{ padding: '0.4rem 0.9rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border-color)', background: filterTab === 'pending' ? 'var(--text-primary)' : 'var(--bg-surface)', color: filterTab === 'pending' ? 'var(--bg-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Pending Review ({myBundles.filter(b => b.status === 'pending_review').length})
                </button>
                <button 
                  onClick={() => setFilterTab('rejected')}
                  style={{ padding: '0.4rem 0.9rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border-color)', background: filterTab === 'rejected' ? 'var(--text-primary)' : 'var(--bg-surface)', color: filterTab === 'rejected' ? 'var(--bg-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Rejected ({myBundles.filter(b => b.status === 'rejected').length})
                </button>
              </div>

              {filteredBundles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <Folder size={40} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                  <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>No Wallpaper Drops Found</h3>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>Click "+ Drop Pack" in the sidebar to release your collection.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
                  {filteredBundles.map((bundle) => {
                    const bStatus = bundle.status || 'published';
                    const coverImg = bundle.images && bundle.images[bundle.coverIndex || 0] ? (bundle.images[bundle.coverIndex || 0].previewUrl || bundle.images[bundle.coverIndex || 0].url) : '';

                    return (
                      <div 
                        key={bundle.id}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                      >
                        <div style={{ position: 'relative', height: '160px', background: '#000000', cursor: 'pointer' }} onClick={() => onSelectBundle && onSelectBundle(bundle)}>
                          {coverImg ? (
                            <img src={coverImg} alt={bundle.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Cover</div>
                          )}

                          <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                            {bStatus === 'published' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(16, 185, 129, 0.9)', color: '#ffffff', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '9999px' }}>
                                <CheckCircle2 size={12} /> Published
                              </span>
                            )}
                            {bStatus === 'pending_review' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(234, 179, 8, 0.95)', color: '#000000', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '9999px' }}>
                                <Clock size={12} /> Pending Review
                              </span>
                            )}
                            {bStatus === 'rejected' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(239, 68, 68, 0.9)', color: '#ffffff', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '9999px' }}>
                                <AlertCircle size={12} /> Rejected
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bundle.name}
                          </h3>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {bundle.type || 'Desktop'} • {bundle.images?.length || 0} Wallpapers
                          </div>

                          {bStatus === 'pending_review' && (
                            <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.25)', fontSize: '0.75rem', color: 'var(--color-google-yellow)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Clock size={13} style={{ flexShrink: 0 }} />
                              <span>Submitted. Will be published after review.</span>
                            </div>
                          )}

                          {bundle.adminNote && (
                            <div style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', background: bStatus === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface-elevated)', border: `1px solid ${bStatus === 'rejected' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)'}`, fontSize: '0.75rem', color: bStatus === 'rejected' ? '#ef4444' : 'var(--text-primary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, marginBottom: '0.15rem' }}>
                                <MessageSquare size={12} />
                                <span>Admin Note:</span>
                              </div>
                              <p style={{ margin: 0, opacity: 0.95, lineHeight: 1.35 }}>{bundle.adminNote}</p>
                            </div>
                          )}

                          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              <span><Eye size={12} style={{ display: 'inline', marginRight: '3px' }} />{bundle.stats?.views || 0}</span>
                              <span><Download size={12} style={{ display: 'inline', marginRight: '3px' }} />{bundle.stats?.downloads || 0}</span>
                            </div>
                            <button 
                              onClick={() => handleDeleteBundle(bundle.id)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                              title="Delete drop"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CREATOR PROFILE */}
          {activeTab === 'profile' && (
            <div className="admin-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.75rem' }}>
              <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1.2rem', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                Creator Channel Profile
              </h2>

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '600px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Channel / Display Name
                  </label>
                  <input
                    type="text"
                    value={editedDisplayName}
                    onChange={(e) => setEditedDisplayName(e.target.value)}
                    className="admin-modal-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Creator Bio / About
                  </label>
                  <textarea
                    rows="3"
                    value={editedAbout}
                    onChange={(e) => setEditedAbout(e.target.value)}
                    placeholder="Tell your subscribers about your artwork & wallpapers..."
                    className="admin-modal-input"
                    style={{ height: 'auto' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>YouTube Channel URL</label>
                    <input type="text" value={editedYoutube} onChange={(e) => setEditedYoutube(e.target.value)} className="admin-modal-input" placeholder="https://youtube.com/..." />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Instagram Handle</label>
                    <input type="text" value={editedInstagram} onChange={(e) => setEditedInstagram(e.target.value)} className="admin-modal-input" placeholder="https://instagram.com/..." />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Twitter / X Handle</label>
                    <input type="text" value={editedTwitter} onChange={(e) => setEditedTwitter(e.target.value)} className="admin-modal-input" placeholder="https://x.com/..." />
                  </div>
                </div>

                <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <button 
                    type="submit" 
                    disabled={savingProfile}
                    className="admin-btn primary"
                    style={{ padding: '0.65rem 1.75rem', borderRadius: '9999px', background: 'var(--text-primary)', color: 'var(--bg-primary)', fontWeight: 750 }}
                  >
                    {savingProfile ? 'Saving Changes...' : 'Save Creator Profile'}
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
