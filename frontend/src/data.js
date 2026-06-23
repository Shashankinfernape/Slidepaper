import peakLeft from './assets/peak_left.png';
import peakCenter from './assets/peak_center.png';
import peakRight from './assets/peak_right.png';
import driftCyan from './assets/drift_cyan.png';
import driftMagenta from './assets/drift_magenta.png';
import driftGold from './assets/drift_gold.png';

export const WALLPAPER_BUNDLES = [
  {
    id: 'aetherial-peak',
    name: 'Aetherial Peak',
    description: 'A majestic three-screen panorama featuring ethereal neon mountain trails winding through deep canyons under a starry violet sky. Perfect for side-by-side multi-monitor setups or panoramic phone locks.',
    type: 'Panoramic Landscape Split',
    orientation: 'landscape',
    ratio: '48:9',
    ratioOptions: [
      {
        id: 'triple-48-9',
        label: '48:9 Triple',
        subtitle: 'Full continuity spread',
        resolution: '11520 x 2160',
        size: '412 MB ZIP',
        formats: ['PNG', 'JPG', 'WebP'],
      },
      {
        id: 'ultrawide-21-9',
        label: '21:9 Ultrawide',
        subtitle: 'Centered cinematic crop',
        resolution: '5120 x 2160',
        size: '186 MB ZIP',
        formats: ['PNG', 'JPG'],
      },
      {
        id: 'desktop-16-9',
        label: '16:9 Desktop',
        subtitle: 'Single-screen hero crop',
        resolution: '3840 x 2160',
        size: '128 MB ZIP',
        formats: ['PNG', 'JPG'],
      }
    ],
    coverIndex: 1, // peakCenter
    images: [
      { url: peakLeft, label: 'Screen 1: Western Ridgeline' },
      { url: peakCenter, label: 'Screen 2: Lunar Ascent (Face)' },
      { url: peakRight, label: 'Screen 3: Horizon Drift' }
    ],
    tags: ['Nature', 'Space', 'Minimalist'],
    includes: [
      'Triple-monitor synchronized sequence',
      'Ultrawide and desktop crops',
      'Clean and subtle vignette variants',
      'Preview-safe compressed exports'
    ],
    stats: {
      views: 24800,
      likes: 1240,
      downloads: 892
    },
    author: {
      name: 'Google Design Lab',
      subscribers: 68400,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
    }
  },
  {
    id: 'spectral-drift',
    name: 'Spectral Drift',
    description: 'An abstract, fluid-dynamic liquid wave bundle displaying dynamic glass-like shapes that transition smoothly from cool electric cyan, through rich royal magenta, into elegant luxury gold.',
    type: 'Fluid Gradient Flow',
    orientation: 'landscape',
    ratio: '16:9 x3',
    ratioOptions: [
      {
        id: 'desktop-16-9',
        label: '16:9 Desktop',
        subtitle: 'Core wallpaper set',
        resolution: '3840 x 2160',
        size: '94 MB ZIP',
        formats: ['PNG', 'JPG', 'WebP'],
      },
      {
        id: 'mobile-9-19',
        label: '9:19.5 Mobile',
        subtitle: 'Lockscreen vertical pack',
        resolution: '1290 x 2796',
        size: '42 MB ZIP',
        formats: ['PNG', 'JPG'],
      },
      {
        id: 'ultrawide-21-9',
        label: '21:9 Ultrawide',
        subtitle: 'Panoramic flow crop',
        resolution: '5120 x 2160',
        size: '108 MB ZIP',
        formats: ['PNG', 'JPG'],
      }
    ],
    coverIndex: 0, // driftCyan
    images: [
      { url: driftCyan, label: 'Fluid Phase A: Electric Cyan (Face)' },
      { url: driftMagenta, label: 'Fluid Phase B: Royal Magenta' },
      { url: driftGold, label: 'Fluid Phase C: Luxury Gold' }
    ],
    tags: ['Gradient', 'Abstract', 'Minimalist'],
    includes: [
      'Desktop and mobile-friendly exports',
      'Ultrawide panoramic crop set',
      'Color-matched alternate brightness passes',
      'Compressed social preview assets'
    ],
    stats: {
      views: 18200,
      likes: 980,
      downloads: 624
    },
    author: {
      name: 'Ethereal Lab',
      subscribers: 41200,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80'
    }
  },
  {
    id: 'cyber-drift',
    name: 'Cyber Drift',
    description: 'A neon-drenched retro-futuristic city sequence featuring glowing grid lanes, rain-slicked asphalt reflections, and distant holographic skyscrapers.',
    type: 'Synthwave Panoramic',
    orientation: 'landscape',
    ratio: '16:9',
    ratioOptions: [
      {
        id: 'desktop-16-9',
        label: '16:9 Desktop',
        subtitle: 'Core city crop',
        resolution: '3840 x 2160',
        size: '112 MB ZIP',
        formats: ['PNG', 'JPG'],
      },
      {
        id: 'mobile-9-19',
        label: '9:19.5 Mobile',
        subtitle: 'Tall lockscreen pack',
        resolution: '1290 x 2796',
        size: '48 MB ZIP',
        formats: ['PNG', 'JPG'],
      }
    ],
    coverIndex: 1,
    images: [
      { url: driftMagenta, label: 'Neon Rain Ridgeline' },
      { url: driftGold, label: 'Holographic Horizon' },
      { url: driftCyan, label: 'Electric Grid Flow' }
    ],
    tags: ['Space', 'Minimalist', 'Gradient'],
    includes: [
      'Synchronized multi-screen sequence',
      'High-contrast lockscreen layouts',
      'Synthwave color-grading variants'
    ],
    stats: {
      views: 31200,
      likes: 1980,
      downloads: 1420
    },
    author: {
      name: 'Google Design Lab',
      subscribers: 68400,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
    }
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    description: 'A dramatic solar landscape featuring fiery corona arches, magnetic plasma loops, and cosmic dust trails in deep space gold and amber tones.',
    type: 'Cinematic Space Split',
    orientation: 'landscape',
    ratio: '16:9',
    ratioOptions: [
      {
        id: 'desktop-16-9',
        label: '16:9 Desktop',
        subtitle: 'Core solar crop',
        resolution: '3840 x 2160',
        size: '105 MB ZIP',
        formats: ['PNG', 'JPG'],
      },
      {
        id: 'mobile-9-19',
        label: '9:19.5 Mobile',
        subtitle: 'Corona vertical lockscreen',
        resolution: '1290 x 2796',
        size: '38 MB ZIP',
        formats: ['PNG', 'JPG'],
      }
    ],
    coverIndex: 0,
    images: [
      { url: driftGold, label: 'Fiery Corona Arch' },
      { url: driftMagenta, label: 'Magnetic Plasma Loop' },
      { url: peakRight, label: 'Cosmic Amber Dust' }
    ],
    tags: ['Space', 'Nature', 'Gradient'],
    includes: [
      'Cinematic solar flares flow',
      'Ultra high definition space maps',
      'Synchronized multi-monitor sequence'
    ],
    stats: {
      views: 29800,
      likes: 1840,
      downloads: 1210
    },
    author: {
      name: 'Google Design Lab',
      subscribers: 68400,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
    }
  }
];

export const CATEGORIES = ['All', 'Minimalist', 'Gradient', 'Nature', 'Space', 'Abstract'];
