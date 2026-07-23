import React, { useState } from 'react';
import { X, Upload, Plus, Check, Image as ImageIcon, Sparkles, AlertCircle } from 'lucide-react';

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
  const [images, setImages] = useState([]); // Array of { previewUrl, url, label }
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
            previewUrl: event.target.result,
            url: event.target.result,
            label: file.name.replace(/\.[^/.]+$/, '')
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddUrlImage = () => {
    if (!customImageUrl.trim()) return;
    setImages(prev => [
      ...prev,
      {
        previewUrl: customImageUrl.trim(),
        url: customImageUrl.trim(),
        label: `Wallpaper #${prev.length + 1}`
      }
    ]);
    setCustomImageUrl('');
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
      setError('Please add at least 1 wallpaper image to your drop.');
      setStep(1);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/curator/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user?.uid,
          name: title.trim(),
          description: description.trim(),
          type: category,
          orientation,
          ratioOptions: orientation === 'Vertical' ? ['9:16', '3:4'] : ['16:9', '21:9', '16:10'],
          coverIndex,
          images,
          author: {
            uid: user?.uid || 'anonymous',
            name: user?.displayName || 'Curator',
            avatar: user?.photoURL || '',
            email: user?.email || ''
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish drop');
      }

      console.log('[Drop Studio] Drop published successfully:', data.bundle);
      if (onDropPublished) {
        onDropPublished(data.bundle);
      }
      onClose();
    } catch (err) {
      console.error('[Drop Studio] Publish failed:', err);
      setError(err.message || 'Failed to publish drop');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drop-studio-backdrop">
      <div className="drop-studio-modal">
        {/* Header */}
        <div className="drop-studio-header">
          <div className="header-title-badge">
            <Sparkles size={18} className="sparkle-icon" />
            <h2>Publish New Drop</h2>
          </div>
          <button className="close-btn" onClick={onClose} title="Close Studio">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="drop-studio-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Step Indicator */}
        <div className="drop-studio-steps">
          <div className={`step-pill ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}>
            <span>1. Media Upload ({images.length})</span>
          </div>
          <div className={`step-pill ${step === 2 ? 'active' : ''}`} onClick={() => images.length > 0 && setStep(2)}>
            <span>2. Details & Category</span>
          </div>
          <div className={`step-pill ${step === 3 ? 'active' : ''}`} onClick={() => title.trim() && images.length > 0 && setStep(3)}>
            <span>3. Cover & Publish</span>
          </div>
        </div>

        {/* Step 1: Upload Images */}
        {step === 1 && (
          <div className="studio-step-content">
            <div className="upload-dropzone">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleFileUpload} 
                className="file-input-hidden" 
                id="wallpaper-file-input"
              />
              <label htmlFor="wallpaper-file-input" className="upload-label">
                <Upload size={32} className="upload-icon" />
                <span className="primary-text">Click or drag images to upload</span>
                <span className="secondary-text">Supports JPG, PNG, WebP (High Resolution)</span>
              </label>
            </div>

            <div className="url-input-row">
              <input
                type="text"
                placeholder="Or paste image URL (https://...)"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddUrlImage()}
                className="url-input"
              />
              <button className="add-url-btn" onClick={handleAddUrlImage}>
                <Plus size={16} />
                <span>Add Image</span>
              </button>
            </div>

            {/* Thumbnail Preview Grid */}
            <div className="preview-thumbnails-grid">
              {images.map((img, index) => (
                <div key={index} className="thumbnail-card">
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
              <label className="form-label">Drop Title *</label>
              <input
                type="text"
                placeholder="e.g. Cyberpunk Tokyo 4K Collection"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="studio-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                rows="3"
                placeholder="Describe your wallpaper collection, theme, or aesthetics..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="studio-textarea"
              />
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label className="form-label">Category / Genre</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="studio-select"
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
                <label className="form-label">Default Orientation</label>
                <select 
                  value={orientation} 
                  onChange={(e) => setOrientation(e.target.value)}
                  className="studio-select"
                >
                  <option value="Horizontal">Horizontal (16:9 / 21:9)</option>
                  <option value="Vertical">Vertical (9:16 / 3:4)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Select Cover & Publish */}
        {step === 3 && (
          <div className="studio-step-content">
            <p className="step-description">Select which wallpaper image to display as the primary cover card:</p>

            <div className="cover-selector-grid">
              {images.map((img, index) => (
                <div 
                  key={index} 
                  className={`cover-option-card ${coverIndex === index ? 'selected' : ''}`}
                  onClick={() => setCoverIndex(index)}
                >
                  <img src={img.previewUrl} alt={img.label} />
                  {coverIndex === index && (
                    <div className="selected-badge">
                      <Check size={16} />
                      <span>Cover Image</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="drop-summary-box">
              <h3>Drop Summary</h3>
              <p><strong>Title:</strong> {title}</p>
              <p><strong>Wallpapers Count:</strong> {images.length} High-Res Items</p>
              <p><strong>Category:</strong> {category} ({orientation})</p>
              <p><strong>Curator:</strong> {user?.displayName || 'Curator'}</p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="drop-studio-footer">
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
            >
              Continue
            </button>
          ) : (
            <button 
              className="publish-drop-btn" 
              onClick={handlePublishDrop}
              disabled={loading}
            >
              {loading ? 'Publishing Drop...' : '🚀 Publish Drop Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
