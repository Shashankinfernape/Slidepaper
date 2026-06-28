import { useState, useEffect, useRef } from 'react';
import { Settings, Check, Sparkles, Heart, Trophy, Layers } from 'lucide-react';

const getProxiedImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.includes('drive.google.com')) {
    const match = url.match(/[?&]id=([^&]+)/);
    if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
};

export default function NotificationDropdown({
  notifications = [],
  unreadCount = 0,
  onClose,
  onSelectNotification,
  onMarkAllAsRead,
  onDeleteNotification
}) {
  const dropdownRef = useRef(null);
  const [activeTab, setActiveTab] = useState('All'); // 'All' | 'Drops' | 'Activity'

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'Drops') return item.type === 'upload';
    if (activeTab === 'Activity') return item.type === 'like' || item.type === 'milestone';
    return true;
  });

  return (
    <div className="yt-notification-dropdown" ref={dropdownRef}>
      {/* YouTube Notification Header */}
      <div className="yt-notification-header">
        <span className="yt-notification-title">Notifications</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {unreadCount > 0 && (
            <button
              className="yt-notification-icon-btn"
              title="Mark all as read"
              onClick={onMarkAllAsRead}
            >
              <Check size={18} />
            </button>
          )}
          <button className="yt-notification-icon-btn" title="Notification settings">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Slidepapers Tailored Filter Tabs */}
      <div className="yt-notif-tabs-container">
        {['All', 'Drops', 'Activity'].map((tab) => (
          <button
            key={tab}
            className={`yt-notif-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'Drops' && <Sparkles size={13} style={{ marginRight: 4 }} />}
            {tab === 'Activity' && <Heart size={13} style={{ marginRight: 4 }} />}
            {tab}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="yt-notification-list">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((item) => (
            <div
              key={item.id}
              className={`yt-notification-item ${!item.isRead ? 'unread' : ''}`}
              onClick={() => onSelectNotification(item)}
            >
              {/* Unread dot indicator */}
              {!item.isRead && <span className="yt-notification-unread-dot"></span>}

              {/* Channel / Author Avatar or Icon */}
              {item.type === 'like' ? (
                <div className="yt-notification-icon-badge like">
                  <Heart size={18} />
                </div>
              ) : item.type === 'milestone' ? (
                <div className="yt-notification-icon-badge milestone">
                  <Trophy size={18} />
                </div>
              ) : (
                <img
                  src={getProxiedImageUrl(item.authorAvatar) || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'}
                  alt={item.authorName}
                  className="yt-notification-avatar"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
                  }}
                />
              )}

              {/* Text Copy */}
              <div className="yt-notification-content">
                <p className="yt-notification-text">
                  {item.authorName && (
                    <strong style={{ color: 'var(--text-primary)' }}>{item.authorName}</strong>
                  )}{' '}
                  {item.message || `uploaded a new wallpaper pack: ${item.bundleName}`}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span className="yt-notification-time">{formatTimeAgo(item.timestamp)}</span>
                  {/* Setup-Specific Ratio Badge */}
                  {item.ratioTag && (
                    <span className="yt-notif-ratio-badge">
                      <Layers size={10} style={{ marginRight: 3 }} />
                      {item.ratioTag}
                    </span>
                  )}
                </div>
              </div>

              {/* Wallpaper Thumbnail Preview */}
              {item.thumbnailUrl && (
                <img
                  src={getProxiedImageUrl(item.thumbnailUrl)}
                  alt="Wallpaper Preview"
                  className="yt-notification-thumb"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
            </div>
          ))
        ) : (
          <div className="yt-notification-empty">
            <div className="yt-notification-empty-bell">🔔</div>
            <p className="yt-notification-empty-title">No notifications in {activeTab}</p>
            <p className="yt-notification-empty-sub">Stay tuned for new wallpaper drops and creator activity!</p>
          </div>
        )}
      </div>
    </div>
  );
}
