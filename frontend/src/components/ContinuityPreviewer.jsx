import { useState, useEffect, useRef } from 'react';
import { X, Download, Check, ShieldAlert, Monitor } from 'lucide-react';
import confetti from 'canvas-confetti';
import GoogleAd from './GoogleAd';

// Secure Canvas Component that draws the image dynamically and blocks actions
function SecureCanvas({ imageUrl }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      // Set canvas aspect ratio matching the image
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      
      // Add a subtle Google-style watermark to discourage camera photos
      ctx.font = 'bold 36px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SLIDEPAPERS PREVIEW', canvas.width / 2, canvas.height / 2);
      
      setLoading(false);
    };
  }, [imageUrl]);

  return (
    <div className="secure-canvas-container">
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0c',
          color: 'var(--text-secondary)'
        }}>
          <div className="downloading-spinner" style={{ borderTopColor: 'var(--color-google-blue)' }}></div>
        </div>
      )}
      <canvas 
        ref={canvasRef} 
        className="secure-canvas"
      />
      {/* The invisible layer blocking clicks, context menu, and drags */}
      <div 
        className="canvas-lock-overlay"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        title="Previews are protected. Download the bundle ZIP for full-resolution files."
      />
    </div>
  );
}

export default function ContinuityPreviewer({ bundle, onClose }) {
  const { name, type, images, description, author } = bundle;
  const [downloadState, setDownloadState] = useState('idle'); // idle -> downloading -> completed

  // Handle mock ZIP download
  const handleDownload = () => {
    if (downloadState !== 'idle') return;
    
    setDownloadState('downloading');
    
    // Simulate server zipping latency
    setTimeout(() => {
      setDownloadState('completed');
      
      // Trigger canvas-confetti celebration
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#8ab4f8', '#f28b82', '#fdd663', '#81c995'] // Google logo colors
      });

      // Programmatically trigger mock ZIP download
      const content = `This is a high-resolution wallpaper bundle for: ${name}\nContinuity Type: ${type}\n\nIn a production environment, this ZIP file would contain the full 4K resolution PNGs stored on Cloudflare R2:`;
      const blob = new Blob([content], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name.toLowerCase().replace(/\s+/g, '_')}_bundle.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Reset back to idle after a delay
      setTimeout(() => {
        setDownloadState('idle');
      }, 3000);

    }, 2000);
  };

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-desc">
            <span className="modal-type-badge">{type}</span>
            <h2 className="modal-title">{name}</h2>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close Preview">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Side-by-Side Screen Mockups */}
          <div className="continuity-mockup-wrapper">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <Monitor size={16} />
              <span>Multi-Screen Continuity Flow (PC Landscape View)</span>
            </div>
            
            <div className="continuity-screens">
              {images.map((img, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  {/* Monitor Body */}
                  <div className="monitor-frame">
                    <SecureCanvas key={img.url} imageUrl={img.url} />
                  </div>
                  {/* Monitor Stand */}
                  <div className="monitor-stand"></div>
                  <div className="monitor-base"></div>
                  {/* Monitor Label */}
                  <span className="screen-label">{img.label}</span>
                </div>
              ))}
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              backgroundColor: 'rgba(242, 139, 130, 0.08)', 
              color: 'var(--color-google-red)', 
              padding: '0.5rem 1rem', 
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              border: '1px solid rgba(242, 139, 130, 0.2)',
              marginTop: '0.5rem'
            }}>
              <ShieldAlert size={15} />
              <span>Right-click & dragging disabled. Individual saving is restricted.</span>
            </div>
          </div>

          {/* AdSense Top/Middle Ad in Modal */}
          <GoogleAd type="leaderboard" />

          {/* Preview Controls Row */}
          <div className="preview-controls-row">
            <div className="bundle-info-summary">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <img src={author.avatar} alt={author.name} className="author-avatar" style={{ width: '32px', height: '32px' }} />
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', display: 'block' }}>{author.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Verified Artist</span>
                </div>
              </div>
              <p className="bundle-summary-desc">{description}</p>
            </div>

            <div className="download-action-card">
              <button 
                className="download-btn"
                onClick={handleDownload}
                disabled={downloadState === 'downloading'}
                style={{
                  backgroundColor: downloadState === 'completed' ? 'var(--color-google-green)' : 'var(--color-google-blue)',
                  cursor: downloadState === 'downloading' ? 'not-allowed' : 'pointer'
                }}
              >
                {downloadState === 'idle' && (
                  <>
                    <Download size={18} />
                    <span>Download Bundle</span>
                  </>
                )}
                {downloadState === 'downloading' && (
                  <>
                    <div className="downloading-spinner"></div>
                    <span>Zipping Files...</span>
                  </>
                )}
                {downloadState === 'completed' && (
                  <>
                    <Check size={18} />
                    <span>Downloaded!</span>
                  </>
                )}
              </button>
              <span className="download-info-text">
                ZIP Package includes {images.length} High-Res 4K Wallpapers (15.4 MB)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
