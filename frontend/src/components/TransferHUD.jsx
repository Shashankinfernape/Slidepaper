import { Download, Upload, Zap, Clock, CheckCircle2, X, ChevronDown, ChevronUp, Cpu } from 'lucide-react';
import { useState } from 'react';

export default function TransferHUD({
  type = 'download', // 'download' | 'upload'
  title,
  fileName,
  progress = 0, // 0 - 100
  speedMbps = 0,
  transferredMB = 0,
  totalMB = 0,
  etaSeconds = 0,
  stage = '',
  steps = [],
  onClose
}) {
  const [showDetails, setShowDetails] = useState(false);
  const isUpload = type === 'upload';
  const brandColor = isUpload ? '#3b82f6' : '#22c55e';

  const formatEta = (sec) => {
    if (!sec || sec <= 0 || !isFinite(sec)) return 'Fast stream...';
    if (sec < 60) return `${Math.ceil(sec)}s left`;
    const mins = Math.floor(sec / 60);
    const remSec = Math.ceil(sec % 60);
    return `${mins}m ${remSec}s left`;
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '28px',
      right: '28px',
      zIndex: 999999,
      width: 'min(calc(100vw - 32px), 350px)',
      background: 'rgba(24, 24, 27, 0.96)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
      borderRadius: '14px',
      padding: '0.9rem 1.1rem',
      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      animation: 'hudSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Top Bar: Title & Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: isUpload ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: brandColor,
            flexShrink: 0
          }}>
            {isUpload ? <Upload size={14} /> : <Download size={14} />}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {fileName || (isUpload ? 'Publishing Bundle' : 'Downloading Pack')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {steps && steps.length > 0 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #a1a1aa)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
              title="Toggle Step Durations"
            >
              {showDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
          {onClose && (
            <button 
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #a1a1aa)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Stage Banner */}
      <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.85)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cpu size={12} style={{ color: brandColor }} />
          <strong>{stage || (progress >= 100 ? 'Download Complete' : 'Processing stream')}</strong>
        </span>
        <span style={{ fontSize: '0.72rem', color: brandColor, fontWeight: 700 }}>{Math.round(progress)}%</span>
      </div>

      {/* Expandable Step Durations Box */}
      {showDetails && steps && steps.length > 0 && (
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '8px 10px',
          marginBottom: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontSize: '0.72rem'
        }}>
          {steps.map((s, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: s.status === 'done' ? '#22c55e' : (s.status === 'active' ? '#3b82f6' : 'rgba(255,255,255,0.4)') }}>
              <span>{s.status === 'done' ? '✓' : (s.status === 'active' ? '⚡' : '○')} {s.label}</span>
              <strong style={{ fontFamily: 'monospace' }}>{s.duration || (s.status === 'active' ? 'calculating...' : '--')}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-secondary, #a1a1aa)', marginBottom: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ffffff', fontWeight: 600 }}>
          <Zap size={12} style={{ color: brandColor }} />
          {speedMbps > 0 ? `${speedMbps.toFixed(1)} Mbps` : 'Calculating...'}
        </span>

        <span>
          {transferredMB > 0 ? `${transferredMB.toFixed(1)} MB` : '0 MB'} {totalMB > 0 ? `/ ${totalMB.toFixed(1)} MB` : ''}
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Clock size={11} />
          {formatEta(etaSeconds)}
        </span>
      </div>

      {/* Slim Progress Bar */}
      <div style={{
        height: '5px',
        width: '100%',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '3px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, progress))}%`,
          background: brandColor,
          borderRadius: '3px',
          transition: 'width 0.15s ease-out'
        }} />
      </div>
    </div>
  );
}
