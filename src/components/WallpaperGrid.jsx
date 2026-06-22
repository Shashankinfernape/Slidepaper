import React from 'react';
import BundleCard from './BundleCard';
import GoogleAd from './GoogleAd';

export default function WallpaperGrid({ bundles, onSelectBundle }) {
  if (bundles.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-secondary)' }}>
        <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>No wallpaper bundles found matching your query.</p>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.8 }}>Try searching for a different keyword or category.</p>
      </div>
    );
  }

  return (
    <div className="wallpaper-grid">
      {bundles.map((bundle, index) => {
        const cardElement = (
          <BundleCard 
            key={bundle.id} 
            bundle={bundle} 
            onClick={() => onSelectBundle(bundle)} 
          />
        );

        // Inject a Google native in-feed grid ad as the 3rd item (index 2)
        if (index === 2) {
          return (
            <React.Fragment key={`group-${bundle.id}`}>
              <GoogleAd type="in-grid" />
              {cardElement}
            </React.Fragment>
          );
        }

        // If the list is short (less than 3 items), append the ad at the end to demonstrate placement
        if (bundles.length < 3 && index === bundles.length - 1) {
          return (
            <React.Fragment key={`group-${bundle.id}`}>
              {cardElement}
              <GoogleAd type="in-grid" />
            </React.Fragment>
          );
        }

        return cardElement;
      })}
    </div>
  );
}
