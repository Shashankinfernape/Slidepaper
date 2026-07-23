import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Eye, Download, Users, Plus, Trash2, Edit3, ArrowLeft, Layers, TrendingUp
} from 'lucide-react';
import BundleCard from './BundleCard';

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

export default function CuratorDashboard({ user, onBack, onOpenDropStudio, onSelectBundle }) {
  const [stats, setStats] = useState({ totalDrops: 0, totalViews: 0, totalDownloads: 0, subscribers: 0 });
  const [myBundles, setMyBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('drops'); // 'drops' | 'analytics'

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
      console.error('[Curator Dashboard] Error fetching curator data:', err);
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

  return (
    <div className="curator-studio-container">
      {/* Top Header */}
      <div className="studio-top-bar">
        <button className="studio-back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>Back to Feed</span>
        </button>

        <div className="curator-profile-badge">
          <img 
            src={user?.photoURL || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'} 
            alt={user?.displayName}
            className="curator-avatar"
          />
          <div>
            <h1 className="curator-name">{user?.displayName || 'Curator Studio'}</h1>
            <span className="curator-role-badge">Verified Curator</span>
          </div>
        </div>

        <button className="new-drop-studio-btn" onClick={onOpenDropStudio}>
          <Plus size={18} />
          <span>+ Drop Bundle</span>
        </button>
      </div>

      {/* Analytics Stat Cards Grid */}
      <div className="studio-stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper purple">
            <Layers size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalDrops}</span>
            <span className="stat-label">Published Drops</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper blue">
            <Eye size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalViews.toLocaleString()}</span>
            <span className="stat-label">Total Views</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper green">
            <Download size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalDownloads.toLocaleString()}</span>
            <span className="stat-label">Total Downloads</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper gold">
            <Users size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.subscribers.toLocaleString()}</span>
            <span className="stat-label">Subscribers</span>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="studio-tabs-row">
        <button 
          className={`tab-btn ${activeTab === 'drops' ? 'active' : ''}`}
          onClick={() => setActiveTab('drops')}
        >
          My Wallpaper Drops ({myBundles.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="studio-loading">
          <Sparkles className="spin-icon" size={32} />
          <p>Loading Curator Studio...</p>
        </div>
      ) : myBundles.length === 0 ? (
        <div className="studio-empty-state">
          <div className="empty-icon-circle">
            <Plus size={36} />
          </div>
          <h3>No Wallpaper Drops Published Yet</h3>
          <p>Click "+ Drop Bundle" to release your first curated collection!</p>
          <button className="empty-action-btn" onClick={onOpenDropStudio}>
            <Plus size={18} />
            <span>Publish Your First Drop</span>
          </button>
        </div>
      ) : (
        <div className="curator-bundles-grid">
          {myBundles.map(bundle => (
            <div key={bundle.id} className="curator-bundle-card-wrapper">
              <BundleCard 
                bundle={bundle} 
                onClick={() => onSelectBundle && onSelectBundle(bundle)} 
              />
              <div className="curator-card-actions">
                <button 
                  className="delete-drop-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBundle(bundle.id);
                  }}
                  title="Delete this drop"
                >
                  <Trash2 size={15} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
