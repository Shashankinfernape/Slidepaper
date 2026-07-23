import React, { useState, useEffect } from 'react';
import { 
  Folder, Eye, Download, Users, Plus, Trash2, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Clock, MessageSquare, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

export default function CreatorDashboard({ user, onBack, onOpenDropStudio, onSelectBundle }) {
  const [stats, setStats] = useState({ totalDrops: 0, totalViews: 0, totalDownloads: 0, subscribers: 0 });
  const [myBundles, setMyBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'published' | 'pending' | 'rejected'

  useEffect(() => {
    fetchCuratorData();
  }, [user]);

  const fetchCuratorData = async () => {
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
      console.error('[Creator Dashboard] Error fetching curator data:', err);
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
      }
    } catch (err) {
      console.error('Error deleting bundle:', err);
    }
  };

  const filteredBundles = myBundles.filter(bundle => {
    const bStatus = bundle.status || 'published';
    if (filterTab === 'published') return bStatus === 'published';
    if (filterTab === 'pending') return bStatus === 'pending_review';
    if (filterTab === 'rejected') return bStatus === 'rejected';
    return true;
  });

  return (
    <div className="admin-dashboard-container" style={{ minHeight: '80vh', padding: '1.5rem 0' }}>
      {/* Top Header Bar matching AdminDashboard */}
      <div className="admin-header-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button 
            className="admin-btn secondary" 
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '9999px', padding: '0.4rem 0.9rem' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Feed</span>
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Creator Studio</span>
              <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.6rem', borderRadius: '9999px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--color-google-yellow)', fontWeight: 600 }}>
                Verified Creator
              </span>
            </h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Manage your wallpaper drops, view analytics, and track review statuses</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            className="admin-btn secondary" 
            onClick={fetchCuratorData}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
          </button>
          <button 
            className="admin-btn primary" 
            onClick={onOpenDropStudio}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--text-primary)', color: 'var(--bg-primary)', fontWeight: 700 }}
          >
            <Plus size={16} />
            <span>+ Drop Bundle</span>
          </button>
        </div>
      </div>

      {/* Analytics Stat Grid matching AdminDashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        <div className="admin-stat-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Drops</span>
            <Folder size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalDrops}</div>
        </div>

        <div className="admin-stat-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Views</span>
            <Eye size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalViews.toLocaleString()}</div>
        </div>

        <div className="admin-stat-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Downloads</span>
            <Download size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalDownloads.toLocaleString()}</div>
        </div>

        <div className="admin-stat-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Subscribers</span>
            <Users size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.subscribers.toLocaleString()}</div>
        </div>
      </div>

      {/* Tabs Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
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

      {/* Drops Grid View */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          <RefreshCw className="spin-icon" size={28} style={{ marginBottom: '0.5rem' }} />
          <p style={{ fontSize: '0.9rem' }}>Loading Creator Studio...</p>
        </div>
      ) : filteredBundles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <Folder size={40} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>No Wallpaper Drops Found</h3>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>Click "+ Drop Bundle" to release your wallpaper collection.</p>
          <button 
            onClick={onOpenDropStudio}
            style={{ marginTop: '1rem', padding: '0.5rem 1.2rem', borderRadius: '9999px', border: 'none', background: 'var(--text-primary)', color: 'var(--bg-primary)', fontWeight: 700, cursor: 'pointer' }}
          >
            + Drop Bundle Now
          </button>
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
                {/* Cover Thumbnail & Status Badge Overlay */}
                <div style={{ position: 'relative', height: '160px', background: '#000000', cursor: 'pointer' }} onClick={() => onSelectBundle && onSelectBundle(bundle)}>
                  {coverImg ? (
                    <img src={coverImg} alt={bundle.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-disabled)' }}>No Image</div>
                  )}

                  {/* Status Badge */}
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

                {/* Card Content */}
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bundle.name}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}>
                    <span>{bundle.type || 'Desktop'}</span>
                    <span>•</span>
                    <span>{bundle.images?.length || 0} Wallpapers</span>
                  </div>

                  {/* Pending Banner */}
                  {bStatus === 'pending_review' && (
                    <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.25)', fontSize: '0.75rem', color: 'var(--color-google-yellow)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                      <Clock size={13} style={{ flexShrink: 0 }} />
                      <span>Submitted. Will be published after review.</span>
                    </div>
                  )}

                  {/* Admin Note Box if Present */}
                  {bundle.adminNote && (
                    <div style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', background: bStatus === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface-elevated)', border: `1px solid ${bStatus === 'rejected' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)'}`, fontSize: '0.75rem', color: bStatus === 'rejected' ? '#ef4444' : 'var(--text-primary)', marginTop: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, marginBottom: '0.15rem' }}>
                        <MessageSquare size={12} />
                        <span>Admin Message:</span>
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
  );
}
