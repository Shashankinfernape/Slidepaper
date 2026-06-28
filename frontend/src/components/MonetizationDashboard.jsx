import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, Download, Eye, Award, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

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

export default function MonetizationDashboard({ isInline = false, creatorUid = null }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = creatorUid 
        ? `${API_URL}/api/monetization/creator/${creatorUid}`
        : `${API_URL}/api/monetization/analytics`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch monetization analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [creatorUid]);

  if (loading) {
    return (
      <div className="admin-loading-container" style={{ padding: '3rem', textAlign: 'center' }}>
        <RefreshCw size={28} className="spinner-icon" style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
        <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>Calculating AdSense analytics and creator earnings...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="admin-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Monetization analytics unavailable.</p>
      </div>
    );
  }

  const { totalAdRevenue = 0, creatorPool = 0, rpm = 2.40, totalImpressions = 0, creators = [], isLiveAdSense = false } = data;

  return (
    <div className="monetization-dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Status Banner */}
      <div style={{
        background: isLiveAdSense ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
        border: `1px solid ${isLiveAdSense ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isLiveAdSense ? (
            <CheckCircle size={22} style={{ color: '#22c55e' }} />
          ) : (
            <AlertCircle size={22} style={{ color: '#3b82f6' }} />
          )}
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {isLiveAdSense ? 'Google AdSense API Live Reporting Active' : 'AdSense Integration Mode: Pre-Approval Engine'}
            </h4>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {isLiveAdSense 
                ? 'Syncing real-time RPM, ad impressions, and earnings directly from Google servers.'
                : 'Tracking real-time MongoDB traffic. Ready to plug into Google AdSense v2 API upon site approval.'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="admin-card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            <span>Platform Ad Revenue</span>
            <DollarSign size={18} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
            ${totalAdRevenue.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.76rem', color: '#22c55e', fontWeight: 500 }}>Global Monthly Pool</span>
        </div>

        <div className="admin-card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            <span>Creator Revenue Share (70%)</span>
            <Award size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
            ${creatorPool.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.76rem', color: '#3b82f6', fontWeight: 500 }}>Deserved Creator Pool</span>
        </div>

        <div className="admin-card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            <span>Average Page RPM</span>
            <TrendingUp size={18} style={{ color: '#a855f7' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
            ${rpm.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Per 1,000 Impressions</span>
        </div>

        <div className="admin-card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            <span>Total Ad Impressions</span>
            <Eye size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
            {totalImpressions.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Verified Pageviews</span>
        </div>
      </div>

      {/* Creator Revenue Table */}
      <div className="admin-card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Creator Performance & Deserved Earnings
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Formula: 40% Downloads + 40% Views + 20% Likes</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Creator</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Packs</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Total Views</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Downloads</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Impact Share</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Deserved Payout</th>
              </tr>
            </thead>
            <tbody>
              {creators.length > 0 ? (
                creators.map((c, i) => (
                  <tr key={c.uid || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem 0.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img 
                        src={c.avatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'} 
                        alt={c.name}
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{c.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.subscribers?.toLocaleString()} subs</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem', color: 'var(--text-primary)' }}>{c.packCount}</td>
                    <td style={{ padding: '0.85rem 0.5rem', color: 'var(--text-primary)' }}>{c.views?.toLocaleString()}</td>
                    <td style={{ padding: '0.85rem 0.5rem', color: 'var(--text-primary)' }}>{c.downloads?.toLocaleString()}</td>
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${c.sharePercentage}%`, height: '100%', background: '#3b82f6' }}></div>
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6' }}>{c.sharePercentage}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#22c55e', fontSize: '1rem' }}>
                      ${c.deservedPayout?.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No creator records found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
