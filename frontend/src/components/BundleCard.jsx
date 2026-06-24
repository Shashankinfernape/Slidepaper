import { useState, useEffect, useRef } from 'react';

export default function BundleCard({
  bundle,
  onClick,
  showOverlay = true,
  className = '',
  autoPlay = false,
  shuffleOnClick = false,
}) {
  const { name, images, coverIndex } = bundle;
  const [activeSlideIndex, setActiveSlideIndex] = useState(coverIndex);
  const intervalRef = useRef(null);

  const len = images.length;

  useEffect(() => {
    if (autoPlay) {
      intervalRef.current = setInterval(() => {
        setActiveSlideIndex((prev) => (prev + 1) % len);
      }, 2500); // 2.5s medium pace slideshow
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoPlay, len]);

  const handleMouseEnter = () => {
    if (autoPlay) return; // Autoplay handles sliding for player card
    intervalRef.current = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % len);
    }, 1200);
  };

  const handleMouseLeave = () => {
    if (autoPlay) return; // Autoplay handles sliding for player card
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setActiveSlideIndex(coverIndex);
  };

  const handleCardClick = (e) => {
    if (shuffleOnClick) {
      // Immediate shuffle to next image
      setActiveSlideIndex((prev) => (prev + 1) % len);
      
      // Reset autoPlay interval so it starts fresh from this manual shuffle
      if (autoPlay) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          setActiveSlideIndex((prev) => (prev + 1) % len);
        }, 2500);
      }
    }
    
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <div
      className={`bundle-card ${className}`.trim()}
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 3D Stack Container (Floating Wallpapers) */}
      <div className="stack-container">
        <div className="stack-wrapper">
          {images.map((image, i) => {
            let positionClass = 'hidden';
            if (i === activeSlideIndex) {
              positionClass = 'active';
            } else if (i === (activeSlideIndex + 1) % len) {
              positionClass = 'next';
            } else if (i === (activeSlideIndex - 1 + len) % len) {
              positionClass = 'prev';
            }

            return (
              <div key={i} className={`stack-image-wrapper ${positionClass}`}>
                <img
                  src={image.previewUrl || image.url}
                  alt={image.label}
                  className="stack-image-bg"
                />
                {showOverlay && (
                  <div className="cinematic-details-overlay">
                    <h3 className="cinematic-card-title" title={name}>{name}</h3>
                    <span className="cinematic-title-line" aria-hidden="true"></span>
                    <div className="cinematic-meta-row">
                      <span className="cinematic-meta-count">{len} Wallpapers</span>
                      <span className="cinematic-meta-divider" aria-hidden="true"></span>
                      <span className="cinematic-meta-ratio">{bundle.ratio || '16:9'} Ratio</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
