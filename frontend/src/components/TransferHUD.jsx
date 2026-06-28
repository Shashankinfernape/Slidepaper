import { Download, Upload, Zap, Clock, CheckCircle2, X } from 'lucide-react';

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
      width: 'min(calc(100vw - 32px), 340px)',
      background: 'rgba(24, 24, 27, 0.95)',
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

        {onClose && (
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #a1a1aa)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
          >
            <X size={15} />
          </button>
        )}
      </div>

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
