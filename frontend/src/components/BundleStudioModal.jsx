import React, { useState } from 'react';
import { X, Upload, Plus, Check, AlertCircle, Clock } from 'lucide-react';
import TransferHUD from './TransferHUD';

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

export default function BundleStudioModal({ isOpen, onClose, onDropPublished, user }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Desktop');
  const [orientation, setOrientation] = useState('Horizontal');
  const [coverIndex, setCoverIndex] = useState(0);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successBanner, setSuccessBanner] = useState(false);
  const [uploadMetrics, setUploadMetrics] = useState(null);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages(prev => [
          ...prev,
          {
            file: file,
            previewUrl: event.target.result,
            url: event.target.result,
            label: file.name.replace(/\.[^/.]+$/, '')
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };



  const handleRemoveImage = (indexToRemove) => {
    setImages(prev => prev.filter((_, i) => i !== indexToRemove));
    if (coverIndex >= images.length - 1) {
      setCoverIndex(Math.max(0, images.length - 2));
    }
  };

  const handlePublishDrop = async () => {
    if (!title.trim()) {
      setError('Please provide a title for your drop.');
      setStep(1);
      return;
    }
    if (images.length === 0) {
      setError('Please add at least 1 wallpaper image.');
      setStep(1);
      return;
    }

    setLoading(true);
    setError('');
    
    setUploadMetrics({
      progress: 5,
      speedMbps: 0,
      transferredMB: 0,
      totalMB: 0,
      etaSeconds: 0,
      stage: 'Preparing payload...'
    });

    try {
      const formData = new FormData();
      formData.append('uid', user?.uid || '');
      formData.append('name', title.trim());
      formData.append('description', description.trim());
      formData.append('type', category);
      formData.append('orientation', orientation);
      formData.append('ratioOptions', JSON.stringify(orientation === 'Vertical' ? ['9:16', '3:4'] : ['16:9', '21:9', '16:10']));
      formData.append('coverIndex', coverIndex.toString());
      
      const authorObj = {
        uid: user?.uid || 'anonymous',
        name: user?.displayName || 'Curator',
        avatar: user?.photoURL || '',
        email: user?.email || ''
      };
      formData.append('author', JSON.stringify(authorObj));

      images.forEach((img) => {
        if (img.file) {
          formData.append('images', img.file);
        }
      });

      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/curator/bundles`, true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable || e.total > 0) {
          const totalBytes = e.total;
          const loadedBytes = e.loaded;
          const pct = Math.min(99, Math.max(5, (loadedBytes / totalBytes) * 100));
          const currentTime = Date.now();
          const timeDelta = (currentTime - lastTime) / 1000;

          if (timeDelta >= 0.15) {
            const bytesDelta = loadedBytes - lastLoaded;
            const speedBps = bytesDelta / timeDelta;
            const speedMbps = (speedBps * 8) / (1024 * 1024);
            const remainingBytes = Math.max(0, totalBytes - loadedBytes);
            const eta = speedBps > 0 ? (remainingBytes / speedBps) : 0;

            setUploadMetrics({
              progress: pct,
              speedMbps: Math.max(0.2, speedMbps),
              transferredMB: loadedBytes / (1024 * 1024),
              totalMB: totalBytes / (1024 * 1024),
              etaSeconds: Math.max(0, eta),
              stage: 'Uploading images to Google Drive...'
            });
            lastLoaded = loadedBytes;
            lastTime = currentTime;
          }
        }
      };

      const responseData = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadMetrics(prev => ({ ...prev, progress: 100, stage: 'Upload complete! Processing database...' }));
            let resData;
            try { resData = JSON.parse(xhr.responseText); } catch(e) {}
            setTimeout(() => resolve(resData), 1500);
          } else {
            let errorMessage = 'Failed to publish drop.';
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = errorData.error || errorMessage;
            } catch (_) {}
            reject(new Error(errorMessage));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(formData);
      });

      setSuccessBanner(true);
      setTimeout(() => {
        if (onDropPublished) onDropPublished(responseData?.bundle);
        onClose();
        setSuccessBanner(false);
        setStep(1);
        setTitle('');
        setDescription('');
        setImages([]);
        setUploadMetrics(null);
      }, 2000);
    } catch (err) {
      console.error('[Drop Studio] Publish failed:', err);
      setError(err.message || 'Failed to submit drop');
      setUploadMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drop-studio-backdrop">
      <div className="drop-studio-modal" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
        {/* Header */}
        <div className="drop-studio-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '1.2rem 1.5rem' }}>
          <div className="header-title-badge">
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Submit Wallpaper Drop
            </h2>
          </div>
          <button className="close-btn" onClick={onClose} title="Close Studio">
            <X size={20} />
          </button>
        </div>

        {/* Success Banner */}
        {successBanner ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid var(--color-google-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-google-yellow)' }}>
              <Clock size={28} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Drop Submitted!</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-google-yellow)', fontWeight: 600, maxWidth: '320px', lineHeight: 1.4 }}>
              Your bundle has been submitted and will be published after review.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="drop-studio-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Step Indicator */}
            <div className="drop-studio-steps" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className={`step-pill ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}>
                <span>1. Media ({images.length})</span>
              </div>
              <div className={`step-pill ${step === 2 ? 'active' : ''}`} onClick={() => images.length > 0 && setStep(2)}>
                <span>2. Category & Details</span>
              </div>
              <div className={`step-pill ${step === 3 ? 'active' : ''}`} onClick={() => title.trim() && images.length > 0 && setStep(3)}>
                <span>3. Cover & Submit</span>
              </div>
            </div>

            {/* Step 1: Upload Images */}
            {step === 1 && (
              <div className="studio-step-content">
                <div className="upload-dropzone" style={{ border: '2px dashed var(--border-color)', background: 'var(--bg-surface)' }}>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                    className="file-input-hidden" 
                    id="wallpaper-file-input"
                  />
                  <label htmlFor="wallpaper-file-input" className="upload-label">
                    <Upload size={32} style={{ color: 'var(--text-secondary)' }} />
                    <span className="primary-text" style={{ color: 'var(--text-primary)' }}>Click or drag images to upload</span>
                    <span className="secondary-text" style={{ color: 'var(--text-secondary)' }}>Supports JPG, PNG, WebP (Ultra HD)</span>
                  </label>
                </div>



                {/* Thumbnails */}
                <div className="preview-thumbnails-grid">
                  {images.map((img, index) => (
                    <div key={index} className="thumbnail-card" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                      <img src={img.previewUrl} alt={img.label} className="thumb-img" />
                      <button 
                        className="remove-thumb-btn"
                        onClick={() => handleRemoveImage(index)}
                        title="Remove image"
                      >
                        <X size={14} />
                      </button>
                      <input
                        type="text"
                        value={img.label}
                        onChange={(e) => {
                          const newLabel = e.target.value;
                          setImages(prev => prev.map((item, idx) => idx === index ? { ...item, label: newLabel } : item));
                        }}
                        className="thumb-label-input"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Metadata Details */}
            {step === 2 && (
              <div className="studio-step-content form-layout">
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Drop Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Minimalist Tokyo 4K Collection"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="studio-input"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Description</label>
                  <textarea
                    rows="3"
                    placeholder="Describe your wallpaper collection, theme, or aesthetics..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="studio-textarea"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group half">
                    <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Category / Genre</label>
                    <select 
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)}
                      className="studio-select"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <option value="Desktop">Desktop Wallpapers</option>
                      <option value="Mobile">Mobile Wallpapers</option>
                      <option value="Anime">Anime & Manga</option>
                      <option value="Aesthetic">Aesthetic & Minimalist</option>
                      <option value="Gaming">Gaming & Cyberpunk</option>
                      <option value="Nature">Nature & Scenery</option>
                    </select>
                  </div>

                  <div className="form-group half">
                    <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Orientation</label>
                    <select 
                      value={orientation} 
                      onChange={(e) => setOrientation(e.target.value)}
                      className="studio-select"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <option value="Horizontal">Horizontal (16:9 / 21:9)</option>
                      <option value="Vertical">Vertical (9:16 / 3:4)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Cover Selection & Submit */}
            {step === 3 && (
              <div className="studio-step-content">
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Select primary cover image:</p>

                <div className="cover-selector-grid">
                  {images.map((img, index) => (
                    <div 
                      key={index} 
                      className={`cover-option-card ${coverIndex === index ? 'selected' : ''}`}
                      onClick={() => setCoverIndex(index)}
                      style={{ border: coverIndex === index ? '2px solid var(--text-primary)' : '2px solid transparent' }}
                    >
                      <img src={img.previewUrl} alt={img.label} />
                      {coverIndex === index && (
                        <div className="selected-badge" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
                          <Check size={14} />
                          <span>Cover</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</p>
                  <p style={{ margin: '0.2rem 0 0 0' }}>{images.length} Wallpapers • {category} ({orientation})</p>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="drop-studio-footer" style={{ borderTop: '1px solid var(--border-color)' }}>
              {step > 1 && (
                <button className="back-btn" onClick={() => setStep(step - 1)} disabled={loading}>
                  Back
                </button>
              )}

              {step < 3 ? (
                <button 
                  className="next-btn" 
                  onClick={() => {
                    if (images.length === 0) {
                      setError('Please add at least 1 image.');
                      return;
                    }
                    if (step === 2 && !title.trim()) {
                      setError('Drop title is required.');
                      return;
                    }
                    setError('');
                    setStep(step + 1);
                  }}
                  style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
                >
                  Continue
                </button>
              ) : (
                <button 
                  className="publish-drop-btn" 
                  onClick={handlePublishDrop}
                  disabled={loading}
                  style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
                >
                  {loading ? 'Submitting Drop...' : 'Submit for Review'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {uploadMetrics && (
        <TransferHUD
          type="upload"
          title="Publishing Wallpaper Drop"
          fileName={`${title} (${images.length} files)`}
          progress={uploadMetrics.progress}
          speedMbps={uploadMetrics.speedMbps}
          transferredMB={uploadMetrics.transferredMB}
          totalMB={uploadMetrics.totalMB}
          etaSeconds={uploadMetrics.etaSeconds}
          stage={uploadMetrics.stage}
          onClose={() => setUploadMetrics(null)}
        />
      )}
    </div>
  );
}
