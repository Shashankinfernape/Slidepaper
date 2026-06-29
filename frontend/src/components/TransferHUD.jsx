import { Download, Zap, Clock, X, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

// ─── Keyframe injection (once) ───────────────────────────────────────────────
const STYLE_ID = 'transfer-hud-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes hudSlideUp {
      from { opacity: 0; transform: translateY(18px) scale(0.97); }
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
    @keyframes hudShimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }
    @keyframes hudGlow {
      0%, 100% { box-shadow: 0 0 0px 0px rgba(129,201,149,0); }
      50%      { box-shadow: 0 0 18px 4px rgba(129,201,149,0.18); }
    }
    @keyframes hudBarPop {
      0%   { transform: scaleY(0.4); opacity: 0; }
      100% { transform: scaleY(1);   opacity: 1; }
    }
    @keyframes hudFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `;
  document.head.appendChild(s);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatEta = (sec) => {
  if (!sec || sec <= 0 || !isFinite(sec)) return null;
  if (sec < 60) return `${Math.ceil(sec)}s left`;
  const m = Math.floor(sec / 60);
  const s = Math.ceil(sec % 60);
  return `${m}m ${s}s left`;
};

const fmt = (n, d = 1) => (isFinite(n) && n > 0 ? n.toFixed(d) : '0');

// ─── Orbital ring SVG ────────────────────────────────────────────────────────
function OrbitalIcon({ isProcessing, isDone, color }) {
  const size = 38;
  const r = 15;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* SVG ring */}
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Track */}
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="2"
        />
        {/* Progress arc or spinning arc */}
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={isDone ? '#81c995' : color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={isDone ? 0 : isProcessing ? circumference * 0.72 : circumference * 0.3}
          style={{
            transformOrigin: `${cx}px ${cx}px`,
            animation: isDone ? 'none' : isProcessing
              ? 'hudSpin 1.1s linear infinite'
              : 'hudSpin 2s linear infinite',
            transition: 'stroke-dashoffset 0.5s ease',
          }}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </svg>
      {/* Center icon */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: isDone ? 'none' : isProcessing ? 'hudPulse 1.8s ease-in-out infinite' : 'none'
      }}>
        {isDone
          ? <CheckCircle2 size={15} color="#81c995" />
          : <Download size={14} color={color} />
        }
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ progress, isProcessing, isDone, color }) {
  const shimmerBg = `linear-gradient(90deg,
    transparent 0%,
    rgba(255,255,255,0.08) 40%,
    rgba(255,255,255,0.15) 50%,
    rgba(255,255,255,0.08) 60%,
    transparent 100%
  )`;

  return (
    <div style={{
      height: '4px',
      width: '100%',
      background: 'rgba(255,255,255,0.07)',
      borderRadius: '99px',
      overflow: 'hidden',
      position: 'relative',
      animation: 'hudBarPop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      {/* Fill */}
      <div style={{
        position: 'absolute', inset: 0,
        width: `${Math.min(100, Math.max(isDone ? 100 : 0, progress))}%`,
        background: isDone ? '#81c995' : `linear-gradient(90deg, ${color}aa, ${color})`,
        borderRadius: '99px',
        transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
      }} />
      {/* Shimmer overlay when processing */}
      {isProcessing && !isDone && (
        <div style={{
          position: 'absolute', inset: 0,
          background: shimmerBg,
          backgroundSize: '400px 100%',
          animation: 'hudShimmer 1.6s linear infinite',
        }} />
      )}
    </div>
  );
}

// ─── Main HUD ────────────────────────────────────────────────────────────────
export default function TransferHUD({
  type = 'download',
  fileName,
  progress = 0,
  speedMbps = 0,
  transferredMB = 0,
  totalMB = 0,
  etaSeconds = 0,
  stage = '',
  steps = [],
  onClose,
}) {
  const isDone = progress >= 100;
  const isProcessing = !isDone && (stage.toLowerCase().includes('build') || stage.toLowerCase().includes('processing') || stage.toLowerCase().includes('preparing'));
  const isDownloading = !isDone && !isProcessing;

  // Subtle entrance
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Phase color
  const color = isDone ? '#81c995' : isProcessing ? '#8ab4f8' : '#81c995';

  // Active step
  const activeStep = steps.find(s => s.status === 'active');
  const doneSteps = steps.filter(s => s.status === 'done');

  const eta = formatEta(etaSeconds);
  const pct = Math.round(Math.min(100, Math.max(0, progress)));

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 999999,
      width: 'min(calc(100vw - 32px), 348px)',

      // Card
      background: 'rgba(10, 10, 12, 0.97)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '16px',
      padding: '14px 16px 14px',
      boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04), ${isProcessing ? '0 0 30px rgba(138,180,248,0.08)' : isDone ? '0 0 30px rgba(129,201,149,0.12)' : '0 0 24px rgba(129,201,149,0.08)'}`,
      color: 'var(--text-primary, #f3f4f6)',
      fontFamily: 'var(--font-body, Inter, sans-serif)',

      // Entrance
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
      transition: 'opacity 0.28s cubic-bezier(0.16,1,0.3,1), transform 0.28s cubic-bezier(0.16,1,0.3,1), box-shadow 0.6s ease',
    }}>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '11px' }}>
        {/* Orbital ring icon */}
        <OrbitalIcon isProcessing={isProcessing} isDone={isDone} color={color} />

        {/* Title + stage */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.83rem',
            fontWeight: 700,
            fontFamily: 'var(--font-heading, Outfit, sans-serif)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.01em',
            marginBottom: '2px',
          }}>
            {fileName || 'Downloading Pack'}
          </div>
          <div style={{
            fontSize: '0.71rem',
            color: isDone ? '#81c995' : color,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            transition: 'color 0.4s ease',
          }}>
            {/* Phase indicator dot */}
            <span style={{
              width: '5px', height: '5px',
              borderRadius: '50%',
              background: isDone ? '#81c995' : color,
              display: 'inline-block',
              animation: isDone ? 'none' : 'hudPulse 1.4s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isDone
                ? 'Download complete'
                : stage || (isProcessing ? 'Building ZIP...' : 'Downloading from GCS...')}
            </span>
          </div>
        </div>

        {/* Right: pct + close */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
          <div style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: isDone ? '#81c995' : color,
            fontFamily: 'var(--font-heading, Outfit, sans-serif)',
            letterSpacing: '-0.01em',
            transition: 'color 0.4s ease',
          }}>
            {pct}%
          </div>
          {onClose && (
            <button onClick={onClose} style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer', padding: '0',
              display: 'flex', alignItems: 'center',
              lineHeight: 1,
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Step pills (only when steps exist and not done) ── */}
      {steps.length > 0 && !isDone && (
        <div style={{
          display: 'flex',
          gap: '5px',
          marginBottom: '10px',
          flexWrap: 'wrap',
          animation: 'hudFadeIn 0.3s ease',
        }}>
          {steps.map((s, i) => {
            const isActive = s.status === 'active';
            const isDoneStep = s.status === 'done';
            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '99px',
                fontSize: '0.67rem',
                fontWeight: 600,
                letterSpacing: '0.01em',
                background: isDoneStep
                  ? 'rgba(129,201,149,0.1)'
                  : isActive
                    ? `rgba(138,180,248,0.12)`
                    : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isDoneStep
                  ? 'rgba(129,201,149,0.25)'
                  : isActive
                    ? 'rgba(138,180,248,0.25)'
                    : 'rgba(255,255,255,0.06)'}`,
                color: isDoneStep ? '#81c995' : isActive ? '#8ab4f8' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
              }}>
                <span style={{ fontSize: '0.6rem' }}>
                  {isDoneStep ? '✓' : isActive ? '⚡' : '○'}
                </span>
                {s.label}
                {s.duration && isActive && (
                  <span style={{ opacity: 0.7, fontFamily: 'monospace', fontSize: '0.63rem' }}>
                    {s.duration}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Stats row ── */}
      {(isDownloading || isDone || transferredMB > 0) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          marginBottom: '9px',
          animation: 'hudFadeIn 0.4s ease',
        }}>
          {/* Speed */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            color: '#f3f4f6', fontWeight: 600,
          }}>
            <Zap size={11} color={color} fill={color} />
            {fmt(speedMbps)} Mbps
          </span>

          {/* Bytes */}
          <span style={{ color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(transferredMB)} <span style={{ opacity: 0.4 }}>/ {fmt(totalMB)} MB</span>
          </span>

          {/* ETA */}
          {eta && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              color: 'rgba(255,255,255,0.45)',
            }}>
              <Clock size={10} />
              {eta}
            </span>
          )}
        </div>
      )}

      {/* ── Processing stats (no speed yet) ── */}
      {isProcessing && (
        <div style={{
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.6)',
          marginBottom: '9px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: color, animation: 'hudPulse 1.2s infinite' }}></span>
          {activeStep?.label || stage || 'Render is cropping wallpapers...'}
        </div>
      )}

      {/* ── Progress bar ── */}
      <ProgressBar
        progress={progress}
        isProcessing={isProcessing}
        isDone={isDone}
        color={color}
      />

    </div>
  );
}
