import React from 'react';
import { Download, Zap, Clock, X, CheckCircle2, Minus, Maximize2 } from 'lucide-react';
import { useDownload } from '../context/DownloadContext';

// ─── Keyframe injection ───────────────────────────────────────────────────────
const STYLE_ID = 'transfer-hud-multi-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes hudSlideUp {
      from { opacity: 0; transform: translateY(24px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0)   scale(1);    }
    }
    @keyframes hudSpin {
      from { transform: rotate(0deg);   }
      to   { transform: rotate(360deg); }
    }
    @keyframes hudPulse {
      0%, 100% { opacity: 1;   transform: scale(1);    }
      50%      { opacity: 0.6; transform: scale(0.92); }
    }
    @keyframes hudFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes hudMinMorph {
      from { opacity: 0; transform: scale(0.8) translateY(-10px); }
      to   { opacity: 1; transform: scale(1)   translateY(0);     }
    }
  `;
  document.head.appendChild(s);
}

const formatEta = (sec) => {
  if (!sec || sec <= 0 || !isFinite(sec)) return null;
  if (sec < 60) return `${Math.ceil(sec)}s left`;
  const m = Math.floor(sec / 60);
  const s = Math.ceil(sec % 60);
  return `${m}m ${s}s left`;
};

const fmt = (n, d = 1) => (isFinite(n) && n > 0 ? n.toFixed(d) : '0');

function OrbitalIcon({ progress = 0, isProcessing, isDone, color }) {
  const size = 34;
  const r = 13;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;

  const pct = isDone ? 100 : Math.min(100, Math.max(0, progress));
  // If progress is 0, give it a tiny dash (like Play Store's initial state) instead of empty outline
  const activePct = pct === 0 && !isDone ? 4 : pct;
  const offset = circumference - (activePct / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={isDone ? '#81c995' : color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transformOrigin: `${cx}px ${cx}px`,
            animation: isDone ? 'none' : isProcessing ? 'hudSpin 1.4s linear infinite' : 'none',
            transition: 'stroke-dashoffset 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isDone ? <CheckCircle2 size={14} color="#81c995" /> : <Download size={13} color={color} />}
      </div>
    </div>
  );
}

export default function TransferHUD() {
  const { downloads, isMinimized, setIsMinimized, cancelDownload } = useDownload();

  if (!downloads || downloads.length === 0) return null;

  // Render minimized notification bar pill
  if (isMinimized) {
    const activeCount = downloads.filter(d => d.status === 'downloading').length;
    const topDownload = downloads[0];
    const topPct = topDownload?.metrics?.progress || 0;

    return (
      <div
        onClick={() => setIsMinimized(false)}
        title="Click to expand Download Manager"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'rgba(13, 14, 18, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '99px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          animation: 'hudMinMorph 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <OrbitalIcon 
          progress={topPct} 
          isProcessing={topDownload?.status === 'downloading'} 
          isDone={topDownload?.status === 'complete'} 
          color="#3b82f6" 
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f3f4f6', fontFamily: 'Outfit, sans-serif' }}>
            Downloading {activeCount} Pack{activeCount > 1 ? 's' : ''} ({topPct}%)
          </div>
          <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)' }}>
            Click to view queue stack
          </div>
        </div>
        <Maximize2 size={14} color="rgba(255,255,255,0.5)" style={{ marginLeft: '4px' }} />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        width: '380px',
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'hudSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* HUD Header Bar */}
      <div
        style={{
          background: 'rgba(13, 14, 18, 0.94)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px 16px 6px 6px',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={15} color="#3b82f6" />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f3f4f6', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em' }}>
            Download Manager Queue ({downloads.length})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setIsMinimized(true)}
            title="Minimize to Notification Bar"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: '6px',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              padding: '4px 6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            <Minus size={13} />
          </button>
        </div>
      </div>

      {/* Stacked Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '2px' }}>
        {downloads.map((item) => {
          const { id, bundle, ratioTag, status, metrics } = item;
          const { progress, speedMbps, transferredMB, totalMB, etaSeconds, stage, steps } = metrics;
          const isDone = status === 'complete';
          const isQueued = status === 'queued';
          const isProcessing = stage?.includes('Cropping') || stage?.includes('Building');
          const isDownloading = stage?.includes('Downloading');
          const color = isQueued ? '#eab308' : '#3b82f6';
          const eta = formatEta(etaSeconds);

          return (
            <div
              key={id}
              style={{
                background: 'rgba(13, 14, 18, 0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: isDone ? '1px solid rgba(129,201,149,0.3)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px',
                padding: '14px 16px 12px 16px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Top Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <OrbitalIcon 
                    progress={progress} 
                    isProcessing={status === 'downloading' || isProcessing} 
                    isDone={isDone} 
                    color={color} 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f3f4f6', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {bundle?.name || 'Wallpaper Pack'}{' '}
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>({ratioTag})</span>
                    </div>
                    <span style={{ fontSize: '0.69rem', color: isDone ? '#81c995' : 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isDone ? 'Download complete' : stage}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: isDone ? '#81c995' : color, fontFamily: 'Outfit, sans-serif' }}>
                    {progress}%
                  </span>
                  <button
                    onClick={() => cancelDownload(id)}
                    title="Cancel Download"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.3)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Step Pills */}
              {steps && steps.length > 0 && !isDone && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  {steps.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '99px',
                        fontSize: '0.66rem',
                        fontWeight: 600,
                        background: s.status === 'done' ? 'rgba(129,201,149,0.1)' : s.status === 'active' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                        color: s.status === 'done' ? '#81c995' : s.status === 'active' ? '#60a5fa' : 'rgba(255,255,255,0.3)',
                        border: s.status === 'done' ? '1px solid rgba(129,201,149,0.2)' : s.status === 'active' ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                      }}
                    >
                      {s.status === 'active' ? '⚡ ' : s.status === 'done' ? '✓ ' : '○ '}
                      {s.label}
                    </div>
                  ))}
                </div>
              )}

              {/* Bytes and Speed stats */}
              {(isDownloading || isDone || transferredMB > 0) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '8px', color: 'rgba(255,255,255,0.5)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f3f4f6', fontWeight: 600 }}>
                    <Zap size={11} color={color} fill={color} />
                    {fmt(speedMbps)} Mbps
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(transferredMB)} <span style={{ opacity: 0.4 }}>/ {fmt(totalMB)} MB</span>
                  </span>
                  {eta && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'rgba(255,255,255,0.45)' }}>
                      <Clock size={10} />
                      {eta}
                    </span>
                  )}
                </div>
              )}

              {/* Progress bar */}
              <div style={{ height: '4px', width: '100%', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    borderRadius: '99px',
                    background: isDone ? '#81c995' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
