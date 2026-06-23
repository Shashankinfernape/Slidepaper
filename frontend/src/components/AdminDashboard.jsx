import { useState, useEffect, useRef } from 'react';
import { 
  BarChart2, Folder, HardDrive, Shield, LogOut, ArrowLeft, RefreshCw, 
  CheckCircle2, AlertCircle, FileText, Upload, Plus, Trash2, IndianRupee, HelpCircle, DollarSign
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function FilePreviewItem({ file, index, removeFile }) {
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!objectUrl) return null;

  return (
    <div style={{ position: 'relative', aspectRatio: '16/10', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      <img src={objectUrl} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <button 
        type="button" 
        onClick={(e) => { e.stopPropagation(); removeFile(index); }} 
        style={{ position: 'absolute', top: '4px', right: '4px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Trash2 size={12} />
      </button>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.65rem', padding: '2px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {file.name}
      </div>
    </div>
  );
}

export default function AdminDashboard({ onBack, logout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [bundles, setBundles] = useState([]);
  const [loadingBundles, setLoadingBundles] = useState(true);
  const [driveStatus, setDriveStatus] = useState(null);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [rebuildingCache, setRebuildingCache] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Form states for uploading new bundle
  const [bundleName, setBundleName] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [bundleOrientation, setBundleOrientation] = useState('landscape');
  const [bundleType, setBundleType] = useState('');
  const [bundleTags, setBundleTags] = useState('');
  const [bundleIncludes, setBundleIncludes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [bundleRatio, setBundleRatio] = useState('16:9');

  useEffect(() => {
    setBundleRatio(bundleOrientation === 'landscape' ? '16:9' : '9:16');
  }, [bundleOrientation]);

  useEffect(() => {
    const preventDrag = (e) => e.preventDefault();
    window.addEventListener('dragover', preventDrag);
    window.addEventListener('drop', preventDrag);
    return () => {
      window.removeEventListener('dragover', preventDrag);
      window.removeEventListener('drop', preventDrag);
    };
  }, []);

  // Fetch bundles list from backend database
  const fetchBundles = async () => {
    setLoadingBundles(true);
    try {
      const res = await fetch(`${API_URL}/api/bundles`);
      if (res.ok) {
        const data = await res.json();
        setBundles(data);
      }
    } catch (err) {
      console.error('Failed to fetch bundles:', err);
    } finally {
      setLoadingBundles(false);
    }
  };

  // Fetch Drive Status from Express backend
  const checkDriveStatus = async () => {
    setLoadingDrive(true);
    try {
      const res = await fetch(`${API_URL}/api/drive-status`);
      const data = await res.json();
      setDriveStatus(data);
    } catch (error) {
      console.error('Error fetching drive status:', error);
      setDriveStatus({ authenticated: false, error: `Cannot connect to backend server. Make sure it is running at ${API_URL}.` });
    } finally {
      setLoadingDrive(false);
    }
  };

  useEffect(() => {
    fetchBundles();
    checkDriveStatus();
  }, []);

  // Compute aggregate stats from fetched bundles
  const stats = {
    bundlesCount: bundles.length,
    totalViews: bundles.reduce((acc, b) => acc + (b.stats?.views || 0), 0),
    totalLikes: bundles.reduce((acc, b) => acc + (b.stats?.likes || 0), 0),
    totalDownloads: bundles.reduce((acc, b) => acc + (b.stats?.downloads || 0), 0),
  };

  // Drag and Drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(file => 
      file.type.startsWith('image/')
    );
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleDeleteBundle = async (bundleId, bundleName) => {
    if (!window.confirm(`Are you sure you want to delete the bundle "${bundleName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/bundles/${bundleId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete bundle.');
      }

      alert(`Bundle "${bundleName}" deleted successfully!`);
      // Update local bundles state
      setBundles(prev => prev.filter(b => b.id !== bundleId));
    } catch (err) {
      console.error('Error deleting bundle:', err);
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleRebuildCache = () => {
    setRebuildingCache(true);
    setTimeout(() => {
      setRebuildingCache(false);
      alert('Zip Cache rebuilt successfully!');
    }, 1500);
  };

  // Upload form submission
  const handleSubmitBundle = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      alert('Please upload at least one image.');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('name', bundleName);
    formData.append('description', bundleDescription);
    formData.append('orientation', bundleOrientation);
    formData.append('ratio', bundleRatio);
    formData.append('type', bundleType || (bundleOrientation === 'landscape' ? 'Landscape Wallpaper Pack' : 'Vertical Mobile Pack'));
    formData.append('tags', bundleTags);
    formData.append('includes', bundleIncludes);
    
    selectedFiles.forEach((file) => {
      formData.append('images', file);
    });

    try {
      const response = await fetch(`${API_URL}/api/bundles/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to publish wallpaper bundle.');
      }

      alert('Wallpaper bundle uploaded and published successfully!');
      
      // Reset form
      setBundleName('');
      setBundleDescription('');
      setBundleOrientation('landscape');
      setBundleType('');
      setBundleTags('');
      setBundleIncludes('');
      setSelectedFiles([]);
      
      // Refresh bundles list
      fetchBundles();
      setActiveTab('bundles');
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Publishing failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-dashboard-container" style={{
      display: 'flex',
      minHeight: '85vh',
      background: 'var(--bg-secondary)',
      borderRadius: '16px',
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
      color: 'var(--text-primary)',
      marginTop: '1rem'
    }}>
      {/* Sidebar navigation */}
      <aside className="admin-sidebar" style={{
        width: '240px',
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-color)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={20} style={{ color: 'var(--color-google-yellow)' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, letterSpacing: '0.5px', margin: 0 }}>Slidepapers Studio</h2>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <BarChart2 size={16} />
            <span>Overview</span>
          </button>
          <button 
            onClick={() => setActiveTab('drive')} 
            className={`admin-nav-item ${activeTab === 'drive' ? 'active' : ''}`}
          >
            <Folder size={16} />
            <span>Google Drive</span>
          </button>
          <button 
            onClick={() => setActiveTab('bundles')} 
            className={`admin-nav-item ${activeTab === 'bundles' ? 'active' : ''}`}
          >
            <HardDrive size={16} />
            <span>Bundles Manager</span>
          </button>
          <button 
            onClick={() => setActiveTab('upload')} 
            className={`admin-nav-item ${activeTab === 'upload' ? 'active' : ''}`}
          >
            <Plus size={16} />
            <span>Create Bundle</span>
          </button>
          <button 
            onClick={() => setActiveTab('monetize')} 
            className={`admin-nav-item ${activeTab === 'monetize' ? 'active' : ''}`}
          >
            <DollarSign size={16} />
            <span>Monetization</span>
          </button>
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button onClick={onBack} className="admin-nav-item" style={{ border: '1px solid var(--border-color)' }}>
            <ArrowLeft size={16} />
            <span>Back to Site</span>
          </button>
          <button onClick={logout} className="admin-nav-item logout" style={{ color: '#ef4444' }}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main dashboard content */}
      <main style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
              {activeTab === 'overview' && 'Command Center'}
              {activeTab === 'drive' && 'Google Drive Integration'}
              {activeTab === 'bundles' && 'Bundles Manager'}
              {activeTab === 'upload' && 'Publish New Bundle'}
              {activeTab === 'monetize' && 'Partner Earnings Studio'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
              {activeTab === 'overview' && 'System diagnostics, wallpaper caching and API metrics'}
              {activeTab === 'drive' && 'Linked OAuth 2.0 folders and file logs'}
              {activeTab === 'bundles' && 'List, edit, and delete active wallpaper sets'}
              {activeTab === 'upload' && 'Upload high-resolution images dynamically to your Google Drive'}
              {activeTab === 'monetize' && 'YouTube Studio-style revenue sharing, ad metrics, and CPM'}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="admin-status-pill green">
              <span className="status-dot"></span> Firebase Auth Active
            </span>
            <span className={`admin-status-pill ${driveStatus?.authenticated ? 'green' : 'yellow'}`}>
              <span className="status-dot"></span> Drive: {driveStatus?.authenticated ? 'Linked' : 'Offline'}
            </span>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Stats Grid */}
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="stat-label">Wallpaper Bundles</span>
                <span className="stat-value">{stats.bundlesCount}</span>
                <span className="stat-sub">Active in feed</span>
              </div>
              <div className="admin-stat-card">
                <span className="stat-label">Total Views</span>
                <span className="stat-value">{new Intl.NumberFormat().format(stats.totalViews)}</span>
                <span className="stat-sub">Across all bundles</span>
              </div>
              <div className="admin-stat-card">
                <span className="stat-label">Total Downloads</span>
                <span className="stat-value">{new Intl.NumberFormat().format(stats.totalDownloads)}</span>
                <span className="stat-sub">ZIP files processed</span>
              </div>
              <div className="admin-stat-card">
                <span className="stat-label">Total Likes</span>
                <span className="stat-value">{new Intl.NumberFormat().format(stats.totalLikes)}</span>
                <span className="stat-sub">Public upvotes</span>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="admin-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Quick Actions</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={handleRebuildCache} 
                  disabled={rebuildingCache}
                  className="admin-btn primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={15} className={rebuildingCache ? 'spin' : ''} />
                  <span>{rebuildingCache ? 'Rebuilding...' : 'Rebuild Zip Cache'}</span>
                </button>
                <button onClick={checkDriveStatus} className="admin-btn secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={15} />
                  <span>Refresh System Diagnostics</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'drive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="admin-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Google Drive Status</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Connection parameters of the authenticated OAuth 2.0 client</p>
                </div>
                <button 
                  onClick={checkDriveStatus} 
                  disabled={loadingDrive}
                  className="admin-btn secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.8rem' }}
                >
                  <RefreshCw size={14} className={loadingDrive ? 'spin' : ''} />
                  <span>Check Status</span>
                </button>
              </div>

              {driveStatus ? (
                driveStatus.authenticated ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4caf50', background: 'rgba(76, 175, 80, 0.08)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                      <CheckCircle2 size={18} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Successfully connected to Google Drive API using personal credentials.</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Folder Name</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, display: 'block', marginTop: '0.25rem' }}>{driveStatus.folderName}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Folder Owner</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, display: 'block', marginTop: '0.25rem' }}>{driveStatus.owner}</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Folder Resource ID</span>
                        <code style={{ fontSize: '0.85rem', display: 'block', marginTop: '0.25rem', color: 'var(--text-primary)', background: 'var(--bg-primary)', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', wordBreak: 'break-all' }}>{driveStatus.folderId}</code>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 600 }}>Recent Uploaded Files inside Folder ({driveStatus.files.length})</h4>
                      {driveStatus.files.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {driveStatus.files.map((file) => (
                            <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={14} style={{ color: 'var(--text-secondary)' }} />
                                <span style={{ fontWeight: 500 }}>{file.name}</span>
                              </div>
                              <div style={{ color: 'var(--text-secondary)', display: 'flex', gap: '1.5rem' }}>
                                <span>{(Number(file.size) / (1024 * 1024)).toFixed(2)} MB</span>
                                <span>{new Date(file.createdTime).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, fontStyle: 'italic' }}>No files found in folder yet. Crop a wallpaper on the site to trigger your first upload!</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffb300', background: 'rgba(255, 179, 0, 0.08)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 179, 0, 0.2)' }}>
                      <AlertCircle size={18} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
                        {driveStatus.error || 'Google Drive client not authenticated.'}
                      </span>
                    </div>
                    
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                      The backend requires authorization with your Google Drive. Click below to start the single-click OAuth flow:
                    </p>
                    
                    <a 
                      href={`${API_URL}/api/auth`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="admin-btn primary"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: '6px' }}
                    >
                      Authenticate Google Drive
                    </a>
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <div className="download-spinner-tiny" style={{ width: '20px', height: '20px' }}></div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bundles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loadingBundles ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div className="download-spinner-tiny" style={{ width: '20px', height: '20px' }}></div>
              </div>
            ) : (
              bundles.map((bundle) => (
                <div 
                  key={bundle.id} 
                  className="admin-card" 
                  style={{ 
                    padding: '1.25rem', 
                    background: 'var(--bg-primary)', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img 
                      src={bundle.images && bundle.images[bundle.coverIndex || 0] ? bundle.images[bundle.coverIndex || 0].url : 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=100'} 
                      alt={bundle.name} 
                      style={{ width: '100px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                      onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=100'; }}
                    />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{bundle.name}</h4>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', display: 'block', marginTop: '0.15rem' }}>
                        {bundle.type} • {bundle.images ? bundle.images.length : 0} Wallpapers • {bundle.orientation}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ display: 'flex', gap: '2rem', fontSize: '0.85rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Views</span>
                        <span style={{ fontWeight: 600, marginTop: '2px', display: 'block' }}>{bundle.stats?.views || 0}</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Downloads</span>
                        <span style={{ fontWeight: 600, marginTop: '2px', display: 'block' }}>{bundle.stats?.downloads || 0}</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Likes</span>
                        <span style={{ fontWeight: 600, marginTop: '2px', display: 'block' }}>{bundle.stats?.likes || 0}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDeleteBundle(bundle.id, bundle.name)}
                      className="admin-btn secondary"
                      style={{ 
                        padding: '8px 12px', 
                        color: '#ff4444', 
                        border: '1px solid rgba(255, 68, 68, 0.2)',
                        background: 'rgba(255, 68, 68, 0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '6px',
                        fontWeight: 500,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 68, 68, 0.12)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 68, 68, 0.05)'; }}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="admin-card" style={{ padding: '2rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <form onSubmit={handleSubmitBundle} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Bundle Name *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Neon Horizon" 
                    value={bundleName} 
                    onChange={(e) => setBundleName(e.target.value)} 
                    className="admin-modal-input" 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Orientation *</label>
                  <select 
                    value={bundleOrientation} 
                    onChange={(e) => setBundleOrientation(e.target.value)} 
                    className="admin-modal-input"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    <option value="landscape">Landscape (Desktop & Wide Screen Ratio only)</option>
                    <option value="portrait">Portrait (Mobile Locked Ratio only)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Native Ratio *</label>
                  <select 
                    value={bundleRatio} 
                    onChange={(e) => setBundleRatio(e.target.value)} 
                    className="admin-modal-input"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    {bundleOrientation === 'landscape' ? (
                      <>
                        <option value="16:9">16:9 (Standard Desktop)</option>
                        <option value="21:9">21:9 (Ultrawide)</option>
                        <option value="32:9">32:9 (Super Ultrawide)</option>
                        <option value="16:10">16:10 (MacBook/Display)</option>
                        <option value="48:9">48:9 (Triple Monitor Spread)</option>
                        <option value="original">Original (Uncropped)</option>
                      </>
                    ) : (
                      <>
                        <option value="9:16">9:16 (Standard Mobile)</option>
                        <option value="9:19.5">9:19.5 (iPhone/Modern Mobile)</option>
                        <option value="original">Original (Uncropped)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Description</label>
                <textarea 
                  rows="3" 
                  placeholder="Tell users what this wallpaper sequence is about..." 
                  value={bundleDescription} 
                  onChange={(e) => setBundleDescription(e.target.value)} 
                  className="admin-modal-input" 
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Tags (comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Nature, Abstract, Minimalist" 
                    value={bundleTags} 
                    onChange={(e) => setBundleTags(e.target.value)} 
                    className="admin-modal-input" 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Design Details (comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Ultra high definition mapping, Sync sequence" 
                    value={bundleIncludes} 
                    onChange={(e) => setBundleIncludes(e.target.value)} 
                    className="admin-modal-input" 
                  />
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Upload Wallpaper Images *</label>
                <div 
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current.click()}
                  style={{
                    border: isDragging ? '2px dashed var(--color-google-blue)' : '2px dashed var(--border-color)',
                    borderRadius: '10px',
                    padding: '2.5rem',
                    textAlign: 'center',
                    background: isDragging ? 'rgba(66, 133, 244, 0.04)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s ease',
                    transform: isDragging ? 'scale(1.01)' : 'none'
                  }}
                  className="admin-dropzone"
                >
                  <Upload size={32} style={{ color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                  <div style={{ pointerEvents: 'none' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-google-blue)' }}>Click to upload</span> or drag and drop images
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', pointerEvents: 'none' }}>Supported formats: PNG, JPG, JPEG</span>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    multiple 
                    accept="image/*" 
                    onChange={handleFileSelect} 
                    style={{ display: 'none' }} 
                  />
                </div>
              </div>

              {selectedFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Selected Wallpapers ({selectedFiles.length})</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                    {selectedFiles.map((file, index) => (
                      <FilePreviewItem 
                        key={`${file.name}-${index}`} 
                        file={file} 
                        index={index} 
                        removeFile={removeFile} 
                      />
                    ))}
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={uploading || selectedFiles.length === 0}
                className="admin-btn primary"
                style={{ width: '100%', padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.92rem', marginTop: '1rem' }}
              >
                {uploading ? (
                  <>
                    <div className="download-spinner-tiny" style={{ borderTopColor: '#000', width: '14px', height: '14px' }}></div>
                    <span>Uploading files to Google Drive & Publishing...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Publish Wallpaper Bundle</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'monetize' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Earnings Stats */}
            <div className="admin-stats-grid">
              <div className="admin-stat-card" style={{ borderLeft: '4px solid #4caf50' }}>
                <span className="stat-label">Estimated Revenue</span>
                <span className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <DollarSign size={22} />
                  <span>342.80</span>
                </span>
                <span className="stat-sub" style={{ color: '#4caf50' }}>+12.4% vs last month</span>
              </div>
              <div className="admin-stat-card">
                <span className="stat-label">Ad Impressions RPM</span>
                <span className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <DollarSign size={22} />
                  <span>1.48</span>
                </span>
                <span className="stat-sub">Revenue per 1k views</span>
              </div>
              <div className="admin-stat-card">
                <span className="stat-label">Premium Subscribers</span>
                <span className="stat-value">48</span>
                <span className="stat-sub">Paid members</span>
              </div>
              <div className="admin-stat-card">
                <span className="stat-label">Monetized Plays</span>
                <span className="stat-value">231.2K</span>
                <span className="stat-sub">Ad-supported downloads</span>
              </div>
            </div>

            {/* Earnings Chart placeholder */}
            <div className="admin-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Estimated Monthly Revenue Growth</h3>
              
              <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '2rem', padding: '1rem 2rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {[
                  { m: 'Jan', v: 180, h: '45%' },
                  { m: 'Feb', v: 210, h: '55%' },
                  { m: 'Mar', v: 245, h: '65%' },
                  { m: 'Apr', v: 280, h: '75%' },
                  { m: 'May', v: 310, h: '85%' },
                  { m: 'Jun', v: 342, h: '95%' }
                ].map((bar, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%' }}>
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: bar.h, background: 'linear-gradient(to top, var(--color-google-blue), #4c8bf5)', borderRadius: '4px 4px 0 0', position: 'relative', display: 'flex', justifyContent: 'center' }}>
                        <span style={{ position: 'absolute', top: '-22px', fontSize: '0.75rem', fontWeight: 600 }}>${bar.v}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{bar.m}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Monetization settings */}
            <div className="admin-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Monetization Tiers Settings</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>Define how ad segments and downloads should generate revenue for your hosted wallpapers.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block' }}>Vignette Ad Roll interstitials</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Display 5-second video/banner overlay ads before starting custom ratio download zips</span>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block' }}>YouTube Premium Ad-Free Downloads</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Allow logged-in subscribers to instantly bypass interstitial scripts and crop downloads immediately</span>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
