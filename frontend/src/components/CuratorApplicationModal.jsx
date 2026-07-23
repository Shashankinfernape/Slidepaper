import React, { useState } from 'react';
import { X, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

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

export default function CuratorApplicationModal({ isOpen, onClose, user, onActivated }) {
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleActivateCurator = async () => {
    setLoading(true);
    try {
      // Instant Curator Activation so user doesn't get blocked
      const res = await fetch(`${API_URL}/api/curator/activate-instant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user?.uid })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          if (onActivated) onActivated(data.user);
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Error activating curator access:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drop-studio-backdrop">
      <div className="curator-app-modal">
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="curator-app-hero">
          <div className="sparkle-badge">
            <Sparkles size={24} />
          </div>
          <h2>Become a Curator & Drop Wallpapers</h2>
          <p>Curators can publish wallpaper collections, manage their channel, and grow a community of subscribers.</p>
        </div>

        {success ? (
          <div className="curator-success-state">
            <ShieldCheck size={48} className="success-icon" />
            <h3>Curator Access Unlocked! 🎉</h3>
            <p>Opening Drop Studio...</p>
          </div>
        ) : (
          <div className="curator-app-body">
            <div className="feature-perks-list">
              <div className="perk-item">
                <span className="dot">•</span>
                <span>Publish unlimited high-resolution wallpaper drops</span>
              </div>
              <div className="perk-item">
                <span className="dot">•</span>
                <span>Get your own Curator Studio with analytics</span>
              </div>
              <div className="perk-item">
                <span className="dot">•</span>
                <span>Build subscribers and link your social channels</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Portfolio / Social Link (Optional)</label>
              <input
                type="text"
                placeholder="https://instagram.com/yourhandle or Unsplash profile"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                className="studio-input"
              />
            </div>

            <button 
              className="unlock-curator-btn" 
              onClick={handleActivateCurator}
              disabled={loading}
            >
              {loading ? 'Unlocking Studio...' : '🚀 Unlock Curator Studio & Drop Now'}
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
