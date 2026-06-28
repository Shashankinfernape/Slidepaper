import { Download, Upload, Zap, Clock, HardDrive, CheckCircle2, X } from 'lucide-react';

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
  onClose
}) {
  const isUpload = type === 'upload';
  const accentColor = isUpload ? '#3b82f6' : '#22c55e';
  const glowShadow = isUpload 
    ? '0 12px 32px rgba(59, 130, 246, 0.25)' 
    : '0 12px 32px rgba(34, 197, 94, 0.25)';

  const formatEta = (sec) => {
    if (!sec || sec <= 0 || !isFinite(sec)) return 'Calculating...';
    if (sec < 60) return `~${Math.ceil(sec)}s remaining`;
    const mins = Math.floor(sec / 60);
    const remSec = Math.ceil(sec % 60);
    return `~${mins}m ${remSec}s remaining`;
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 999999,
      width: 'min(calc(100vw - 32px), 380px)',
      background: 'rgba(18, 18, 20, 0.92)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '16px',
      padding: '1.25rem',
      boxShadow: glowShadow,
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      animation: 'hudSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: isUpload ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor
          }}>
            {isUpload ? <Upload size={18} /> : <Download size={18} />}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, letterSpacing: '-0.2px' }}>
              {title || (isUpload ? 'Publishing Bundle' : 'Downloading Pack')}
            </h4>
            <span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.6)', display: 'block', maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName || 'High-Resolution Wallpapers'}
            </span>
          </div>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Speed & Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        background: 'rgba(255,255,255,0.04)',
        padding: '0.6rem 0.8rem',
        borderRadius: '10px',
        marginBottom: '0.85rem',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={14} style={{ color: accentColor }} />
          <div>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Transfer Speed</span>
            <strong style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff' }}>
              {speedMbps > 0 ? `${speedMbps.toFixed(1)} Mbps` : 'Connecting...'}
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={14} style={{ color: 'rgba(255,255,255,0.7)' }} />
          <div>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Time Remaining</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              {formatEta(etaSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.78rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
            {stage || (progress >= 100 ? 'Finalizing...' : 'Transferring payload')}
          </span>
          <strong style={{ color: accentColor, fontWeight: 700 }}>{Math.round(progress)}%</strong>
        </div>

        <div style={{
          height: '8px',
          width: '100%',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '4px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: `linear-gradient(90deg, ${accentColor}, #60a5fa)`,
            borderRadius: '4px',
            transition: 'width 0.2s ease-out',
            boxShadow: `0 0 12px ${accentColor}`
          }} />
        </div>
      </div>

      {/* Transferred Bytes Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <HardDrive size={12} />
          <span>
            {transferredMB > 0 ? `${transferredMB.toFixed(1)} MB` : '0 MB'} 
            {totalMB > 0 ? ` / ${totalMB.toFixed(1)} MB` : ''}
          </span>
        </div>
        {progress >= 100 && (
          <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <CheckCircle2 size={12} /> Complete
          </span>
        )}
      </div>
    </div>
  );
}
