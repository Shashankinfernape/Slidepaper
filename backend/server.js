import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import archiver from 'archiver';
import multer from 'multer';
import mongoose from 'mongoose';

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/slidepapers';
console.log('[MongoDB] Connecting to:', MONGODB_URI);
mongoose.connect(MONGODB_URI)
  .then(() => console.log('[MongoDB] Connected successfully to MongoDB.'))
  .catch(err => console.error('[MongoDB] Connection error:', err));

// Define User/Author Schema
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  displayName: String,
  email: String,
  photoURL: String,
  subscribers: { type: Number, default: 0 },
  subscriberUids: { type: [String], default: [] },
  about: { type: String, default: '' },
  joined: { type: Date, default: Date.now },
  youtubeUrl: { type: String, default: '' },
  instagramUrl: { type: String, default: '' },
  twitterUrl: { type: String, default: '' },
  accentGradient: { type: String, default: 'midnight' },
  bannerURL: { type: String, default: '' }
});

const User = mongoose.model('User', userSchema);

// Define Bundle Schema
const bundleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  type: String,
  orientation: String,
  ratio: String,
  ratioOptions: Array,
  coverIndex: { type: Number, default: 0 },
  images: Array,
  tags: [String],
  includes: [String],
  stats: {
    views: { type: Number, default: 100 },
    likes: { type: Number, default: 5 },
    downloads: { type: Number, default: 0 }
  },
  likedBy: { type: [String], default: [] },
  author: {
    uid: String,
    name: String,
    avatar: String,
    email: String,
    subscribers: { type: Number, default: 0 }
  },
  isHero: { type: Boolean, default: false }
});

const Bundle = mongoose.model('Bundle', bundleSchema);

// Seeding logic for first run
async function seedDatabase() {
  try {
    const count = await Bundle.countDocuments();
    if (count === 0) {
      console.log('[MongoDB] Database is empty. Seeding initial bundles...');
      let seedBundles = [];
      if (fs.existsSync(BUNDLES_PATH)) {
        try {
          seedBundles = JSON.parse(fs.readFileSync(BUNDLES_PATH, 'utf-8'));
          console.log('[MongoDB] Loaded seed data from bundles.json');
        } catch (e) {
          console.error('[MongoDB] Failed to parse bundles.json, falling back to INITIAL_BUNDLES:', e.message);
          seedBundles = INITIAL_BUNDLES;
        }
      } else {
        seedBundles = INITIAL_BUNDLES;
      }
      
      await Bundle.insertMany(seedBundles);
      console.log(`[MongoDB] Successfully seeded ${seedBundles.length} bundles.`);
    }

    // Migration: Update any legacy bundles in MongoDB to belong to the default admin (admin-mock-999)
    const migrationResult = await Bundle.updateMany(
      { $or: [ 
        { 'author.uid': { $exists: false } }, 
        { 'author.uid': null }, 
        { 'author.uid': 'google-mock-101' } 
      ] },
      { 
        $set: { 
          'author.uid': 'admin-mock-999', 
          'author.email': 'admin@slidepapers.com',
          'author.name': 'Admin (Local Bypass)',
          'author.avatar': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'
        } 
      }
    );
    if (migrationResult.modifiedCount > 0) {
      console.log(`[MongoDB] Migrated ${migrationResult.modifiedCount} legacy bundles to have default admin author.uid.`);
    }

    // Seed/Update default Admin profile in MongoDB
    let defaultAdmin = await User.findOne({ uid: 'admin-mock-999' });
    if (!defaultAdmin) {
      await User.create({
        uid: 'admin-mock-999',
        displayName: 'Infernape',
        email: 'admin@slidepapers.com',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
        subscribers: 68400,
        subscriberUids: [],
        about: 'Digital artist & wallpaper curator.',
        accentGradient: 'midnight'
      });
      console.log('[MongoDB] Seeded default Admin author profile (Infernape) with 68,400 subscribers.');
    } else if (defaultAdmin.displayName === 'Admin (Local Bypass)') {
      defaultAdmin.displayName = 'Infernape';
      await defaultAdmin.save();
      console.log('[MongoDB] Updated default Admin author profile display name to Infernape.');
    }
  } catch (err) {
    console.error('[MongoDB] Error seeding database:', err);
  }
}

mongoose.connection.once('open', () => {
  seedDatabase();
});

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, '../frontend/src/assets')));

// Path to Google Cloud Service Account and OAuth Credentials
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'slidepapers-backend-edb81d50023e.json');
const CREDENTIALS_PATH = path.join(__dirname, 'oauth_credentials.json');
const TOKENS_PATH = path.join(__dirname, 'tokens.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

let oauth2Client = null;
let drive = null;
let isServiceAccount = false;

// Helper: Find bundles.json on Google Drive
async function getBundlesFileId(folderId) {
  try {
    const response = await drive.files.list({
      q: `name = 'bundles.json' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }
  } catch (e) {
    console.error('[Google Drive] Error listing bundles.json:', e.message);
  }
  return null;
}

// Helper: Sync bundles database with Google Drive
async function syncBundlesWithDrive() {
  if (!drive) return;
  try {
    const parentFolderId = await getOrCreateFolder();
    const fileId = await getBundlesFileId(parentFolderId);

    if (fileId) {
      console.log('[Google Drive] Syncing: Found bundles.json on Drive. Downloading...');
      const response = await drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      const writer = fs.createWriteStream(BUNDLES_PATH);
      await new Promise((resolve, reject) => {
        response.data
          .pipe(writer)
          .on('finish', resolve)
          .on('error', reject);
      });
      console.log('[Google Drive] Database synced successfully.');
    } else {
      console.log('[Google Drive] Syncing: bundles.json not found on Drive. Uploading local seed database...');
      const media = {
        mimeType: 'application/json',
        body: fs.createReadStream(BUNDLES_PATH),
      };
      await drive.files.create({
        requestBody: {
          name: 'bundles.json',
          parents: [parentFolderId],
        },
        media: media,
        fields: 'id',
      });
      console.log('[Google Drive] Seed database uploaded successfully.');
    }
  } catch (error) {
    console.error('[Google Drive] Database sync failed:', error);
  }
}

// Helper: Save bundles.json back to Google Drive
async function saveBundlesToDrive() {
  if (!drive) return;
  try {
    // Write MongoDB database data into the local JSON file first as a backup
    const bundles = await Bundle.find({});
    fs.writeFileSync(BUNDLES_PATH, JSON.stringify(bundles, null, 2));

    const parentFolderId = await getOrCreateFolder();
    const fileId = await getBundlesFileId(parentFolderId);
    const media = {
      mimeType: 'application/json',
      body: fs.createReadStream(BUNDLES_PATH),
    };

    if (fileId) {
      await drive.files.update({
        fileId: fileId,
        media: media,
      });
      console.log('[Google Drive] Saved updated bundles.json backup to Google Drive.');
    } else {
      await drive.files.create({
        requestBody: {
          name: 'bundles.json',
          parents: [parentFolderId],
        },
        media: media,
        fields: 'id',
      });
      console.log('[Google Drive] Created and saved bundles.json backup to Google Drive.');
    }
  } catch (error) {
    console.error('[Google Drive] Failed to save database backup to Drive:', error);
  }
}

// Initialize Google OAuth2 client and Drive client
function initializeDriveClient() {
  let client_id = process.env.GDRIVE_CLIENT_ID;
  let client_secret = process.env.GDRIVE_CLIENT_SECRET;

  // Fallback to oauth_credentials.json if environment variables are not set
  if (!client_id || !client_secret) {
    if (fs.existsSync(CREDENTIALS_PATH)) {
      try {
        let creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
        if (creds.web) {
          creds = creds.web;
        } else if (creds.installed) {
          creds = creds.installed;
        }
        client_id = creds.client_id;
        client_secret = creds.client_secret;
      } catch (err) {
        console.error('[OAuth] Failed to parse oauth_credentials.json:', err.message);
      }
    }
  }

  if (!client_id || !client_secret) {
    console.error('[OAuth] Missing Client ID or Client Secret. Please configure environment variables GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET or set up oauth_credentials.json.');
    return;
  }

  try {
    oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      process.env.GDRIVE_REDIRECT_URI || 'http://localhost:5001/oauth2callback'
    );

    // If we have saved tokens, load them
    let tokens = null;
    if (fs.existsSync(TOKENS_PATH)) {
      tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
      console.log('[OAuth] Drive client successfully initialized with saved tokens.');
    } else if (process.env.GDRIVE_TOKENS_JSON) {
      try {
        tokens = JSON.parse(process.env.GDRIVE_TOKENS_JSON);
        console.log('[OAuth] Drive client successfully initialized with tokens from Environment Variable.');
      } catch (err) {
        console.error('[OAuth] Failed to parse GDRIVE_TOKENS_JSON env variable:', err.message);
      }
    }

    if (tokens) {
      oauth2Client.setCredentials(tokens);
      drive = google.drive({ version: 'v3', auth: oauth2Client });
      syncBundlesWithDrive();
    } else {
      console.log('[OAuth] No saved tokens found. Please authenticate by visiting http://localhost:5001/api/auth');
    }
  } catch (error) {
    console.error('[OAuth] Failed to initialize OAuth Drive client:', error);
  }
}

initializeDriveClient();

// Map of bundle IDs to source image filenames in src/assets
const BUNDLE_IMAGES = {
  'aetherial-peak': ['peak_left.png', 'peak_center.png', 'peak_right.png'],
  'spectral-drift': ['drift_cyan.png', 'drift_magenta.png', 'drift_gold.png'],
  'cyber-drift': ['drift_magenta.png', 'drift_gold.png', 'drift_cyan.png'],
  'solar-flare': ['drift_gold.png', 'drift_magenta.png', 'peak_right.png'],
};

// Helper: Ensure a target folder exists on the user's Drive, otherwise create it
async function getOrCreateFolder() {
  try {
    // 1. Try to find 'Slidpapers Cars'
    let response = await drive.files.list({
      q: "name = 'Slidpapers Cars' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    // 2. Try to find 'Slidepapers Bundles'
    response = await drive.files.list({
      q: "name = 'Slidepapers Bundles' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    // 3. Create it if neither exists
    console.log('[Google Drive] Target folder not found. Creating "Slidepapers Bundles"...');
    const fileMetadata = {
      name: 'Slidepapers Bundles',
      mimeType: 'application/vnd.google-apps.folder',
    };

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    return folder.data.id;
  } catch (error) {
    console.error('Google Drive Folder lookup/create error:', error);
    throw error;
  }
}

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Cache directory is no longer needed since we redirect directly to Google Drive

const uploadsDir = path.join(tempDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const upload = multer({ dest: uploadsDir });

const BUNDLES_PATH = path.join(__dirname, 'bundles.json');

const INITIAL_BUNDLES = [
  {
    id: 'aetherial-peak',
    name: 'Aetherial Peak',
    description: 'A majestic three-screen panorama featuring ethereal neon mountain trails winding through deep canyons under a starry violet sky. Perfect for side-by-side multi-monitor setups or panoramic phone locks.',
    type: 'Panoramic Landscape Split',
    orientation: 'landscape',
    ratio: '16:9',
    ratioOptions: [
      { id: 'original', label: 'Original', subtitle: 'Uncropped high-res wallpapers', resolution: 'Original', size: '1.95 MB ZIP', formats: ['PNG', 'JPG'] },
      { id: 'ultrawide-21-9', label: '21:9 Ultrawide', subtitle: 'Centered cinematic crop', resolution: '5120 x 2160', size: '1.29 MB ZIP', formats: ['PNG', 'JPG'] },
      { id: 'desktop-16-9', label: '16:9 Desktop', subtitle: 'Single-screen hero crop', resolution: '3840 x 2160', size: '1.61 MB ZIP', formats: ['PNG', 'JPG'] }
    ],
    coverIndex: 1,
    images: [
      { url: 'http://localhost:5001/assets/peak_left.png', label: 'Screen 1: Western Ridgeline' },
      { url: 'http://localhost:5001/assets/peak_center.png', label: 'Screen 2: Lunar Ascent (Face)' },
      { url: 'http://localhost:5001/assets/peak_right.png', label: 'Screen 3: Horizon Drift' }
    ],
    tags: ['Nature', 'Space', 'Minimalist'],
    includes: ['Triple-monitor synchronized sequence', 'Ultrawide and desktop crops', 'Clean and subtle vignette variants'],
    stats: { views: 24800, likes: 1240, downloads: 892 },
    author: { name: 'Google Design Lab', subscribers: 68400, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80' }
  },
  {
    id: 'spectral-drift',
    name: 'Spectral Drift',
    description: 'An abstract, fluid-dynamic liquid wave bundle displaying dynamic glass-like shapes that transition smoothly from cool electric cyan, through royal magenta, into elegant luxury gold.',
    type: 'Fluid Gradient Flow',
    orientation: 'landscape',
    ratio: '16:9',
    ratioOptions: [
      { id: 'original', label: 'Original', subtitle: 'Uncropped high-res wallpapers', resolution: 'Original', size: '2.40 MB ZIP', formats: ['PNG', 'JPG'] },
      { id: 'desktop-16-9', label: '16:9 Desktop', subtitle: 'Core wallpaper set', resolution: '3840 x 2160', size: '1.97 MB ZIP', formats: ['PNG', 'JPG'] },
      { id: 'mobile-9-19', label: '9:19.5 Mobile', subtitle: 'Lockscreen vertical pack', resolution: '1290 x 2796', size: '511 KB ZIP', formats: ['PNG', 'JPG'] },
      { id: 'ultrawide-21-9', label: '21:9 Ultrawide', subtitle: 'Panoramic flow crop', resolution: '5120 x 2160', size: '1.50 MB ZIP', formats: ['PNG', 'JPG'] }
    ],
    coverIndex: 0,
    images: [
      { url: 'http://localhost:5001/assets/drift_cyan.png', label: 'Fluid Phase A: Electric Cyan (Face)' },
      { url: 'http://localhost:5001/assets/drift_magenta.png', label: 'Fluid Phase B: Royal Magenta' },
      { url: 'http://localhost:5001/assets/drift_gold.png', label: 'Fluid Phase C: Luxury Gold' }
    ],
    tags: ['Gradient', 'Abstract', 'Minimalist'],
    includes: ['Desktop and mobile-friendly exports', 'Ultrawide panoramic crop set', 'Color-matched alternate brightness passes'],
    stats: { views: 18200, likes: 980, downloads: 624 },
    author: { name: 'Ethereal Lab', subscribers: 41200, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80' }
  },
  {
    id: 'cyber-drift',
    name: 'Cyber Drift',
    description: 'A neon-drenched retro-futuristic city sequence featuring glowing grid lanes, rain-slicked asphalt reflections, and distant holographic skyscrapers.',
    type: 'Synthwave Panoramic',
    orientation: 'landscape',
    ratio: '16:9',
    ratioOptions: [
      { id: 'original', label: 'Original', subtitle: 'Uncropped high-res wallpapers', resolution: 'Original', size: '2.20 MB ZIP', formats: ['PNG', 'JPG'] },
      { id: 'desktop-16-9', label: '16:9 Desktop', subtitle: 'Core city crop', resolution: '3840 x 2160', size: '1.97 MB ZIP', formats: ['PNG', 'JPG'] },
      { id: 'mobile-9-19', label: '9:19.5 Mobile', subtitle: 'Tall lockscreen pack', resolution: '1290 x 2796', size: '511 KB ZIP', formats: ['PNG', 'JPG'] }
    ],
    coverIndex: 1,
    images: [
      { url: 'http://localhost:5001/assets/drift_magenta.png', label: 'Neon Rain Ridgeline' },
      { url: 'http://localhost:5001/assets/drift_gold.png', label: 'Holographic Horizon' },
      { url: 'http://localhost:5001/assets/drift_cyan.png', label: 'Electric Grid Flow' }
    ],
    tags: ['Space', 'Minimalist', 'Gradient'],
    includes: ['Synchronized multi-screen sequence', 'High-contrast lockscreen layouts', 'Synthwave color-grading variants'],
    stats: { views: 31200, likes: 1980, downloads: 1420 },
    author: { name: 'Google Design Lab', subscribers: 68400, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80' }
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    description: 'A dramatic solar landscape featuring fiery corona arches, magnetic plasma loops, and cosmic dust trails in deep space gold and amber tones.',
    type: 'Cinematic Space Split',
    orientation: 'landscape',
    ratio: '16:9',
    ratioOptions: [
      { id: 'original', label: 'Original', subtitle: 'Uncropped high-res wallpapers', resolution: 'Original', size: '2.10 MB ZIP', formats: ['PNG', 'JPG'] },
      { id: 'desktop-16-9', label: '16:9 Desktop', subtitle: 'Core solar crop', resolution: '3840 x 2160', size: '1.80 MB ZIP', formats: ['PNG', 'JPG'] },
      { id: 'mobile-9-19', label: '9:19.5 Mobile', subtitle: 'Corona vertical lockscreen', resolution: '1290 x 2796', size: '466 KB ZIP', formats: ['PNG', 'JPG'] }
    ],
    coverIndex: 0,
    images: [
      { url: 'http://localhost:5001/assets/drift_gold.png', label: 'Fiery Corona Arch' },
      { url: 'http://localhost:5001/assets/drift_magenta.png', label: 'Magnetic Plasma Loop' },
      { url: 'http://localhost:5001/assets/peak_right.png', label: 'Cosmic Amber Dust' }
    ],
    tags: ['Space', 'Nature', 'Gradient'],
    includes: ['Cinematic solar flares flow', 'Ultra high definition space maps', 'Synchronized multi-monitor sequence'],
    stats: { views: 29800, likes: 1840, downloads: 1210 },
    author: { name: 'Google Design Lab', subscribers: 68400, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80' }
  }
];

if (!fs.existsSync(BUNDLES_PATH)) {
  fs.writeFileSync(BUNDLES_PATH, JSON.stringify(INITIAL_BUNDLES, null, 2));
  console.log('[Database] bundles.json database seeded successfully.');
}

// Endpoint: Crop wallpapers using ImageMagick and upload ZIP bundle to Google Drive
app.post('/api/custom-ratio', async (req, res) => {
  if (!drive) {
    return res.status(401).json({ error: 'Google Drive client not authenticated. Please authenticate by visiting http://localhost:5001/api/auth' });
  }

  const { bundleId, widthRatio, heightRatio } = req.body;

  if (!bundleId || !widthRatio || !heightRatio) {
    return res.status(400).json({ error: 'Missing required parameters: bundleId, widthRatio, heightRatio' });
  }

  const isOriginal = widthRatio === 'original' && heightRatio === 'original';
  const wRatio = isOriginal ? 1 : parseFloat(widthRatio);
  const hRatio = isOriginal ? 1 : parseFloat(heightRatio);

  if (!isOriginal && (isNaN(wRatio) || isNaN(hRatio) || wRatio <= 0 || hRatio <= 0)) {
    return res.status(400).json({ error: 'Aspect ratios must be valid numbers greater than zero' });
  }

  let srcFolder = path.join(__dirname, '../frontend/src/assets');
  let imageFilenames = BUNDLE_IMAGES[bundleId];

  const isDynamic = !BUNDLE_IMAGES[bundleId];
  const dynamicAssetsDir = path.join(tempDir, 'bundle_assets', bundleId);

  if (isDynamic) {
    // If local directory doesn't exist, we must restore files from Google Drive
    if (!fs.existsSync(dynamicAssetsDir)) {
      try {
        console.log(`[Custom Ratio] Local assets missing for dynamic bundle "${bundleId}". Attempting restoration from Google Drive...`);
        const bundlesData = JSON.parse(fs.readFileSync(BUNDLES_PATH, 'utf-8'));
        const dbBundle = bundlesData.find(b => b.id === bundleId);
        
        if (dbBundle && dbBundle.images && dbBundle.images.length > 0) {
          fs.mkdirSync(dynamicAssetsDir, { recursive: true });
          
          for (let i = 0; i < dbBundle.images.length; i++) {
            const img = dbBundle.images[i];
            const url = img.url;
            let fileId = null;
            if (url.includes('drive.google.com')) {
              const match = url.match(/[?&]id=([^&]+)/);
              if (match) fileId = match[1];
            }
            
            if (fileId) {
              // Get original filename via Google Drive API
              const fileMeta = await drive.files.get({ fileId: fileId, fields: 'name' });
              const filename = fileMeta.data.name || `${i}_image.png`;
              
              // We want to prefix the filename with index to match Multer's naming convention in upload
              const destFilename = `${i}_${filename}`;
              const destPath = path.join(dynamicAssetsDir, destFilename);
              
              console.log(`[Restore] Downloading file ID: ${fileId} -> ${destPath}`);
              const destStream = fs.createWriteStream(destPath);
              const driveResponse = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
              );
              
              await new Promise((resolve, reject) => {
                driveResponse.data
                  .pipe(destStream)
                  .on('finish', resolve)
                  .on('error', reject);
              });
            } else {
              throw new Error(`Google Drive File ID not found for image URL: ${url}`);
            }
          }
          console.log(`[Restore] Successfully restored all ${dbBundle.images.length} images for bundle "${bundleId}".`);
        } else {
          return res.status(404).json({ error: `Bundle ${bundleId} not found in database` });
        }
      } catch (restoreError) {
        console.error(`[Restore] Failed to restore bundle "${bundleId}" from Google Drive:`, restoreError);
        return res.status(500).json({ error: `Failed to restore bundle assets from Google Drive: ${restoreError.message}` });
      }
    }
    
    // Retrieve restored local filenames
    srcFolder = dynamicAssetsDir;
    imageFilenames = fs.readdirSync(dynamicAssetsDir).filter(f => !f.endsWith('.tmp') && !f.endsWith('.mime'));
  }

  if (!imageFilenames || imageFilenames.length === 0) {
    return res.status(404).json({ error: `Bundle ${bundleId} not found` });
  }

  const jobDirName = `${bundleId}_custom_${Date.now()}`;
  const jobDirPath = path.join(tempDir, jobDirName);
  const outputDirPath = path.join(jobDirPath, 'output');
  let zipPath = null;

  try {
    // Create temporary job and output folders
    fs.mkdirSync(jobDirPath, { recursive: true });
    fs.mkdirSync(outputDirPath, { recursive: true });

    if (isOriginal) {
      console.log(`[ZIP] Copying original uncropped files for bundle ${bundleId}`);
      for (const filename of imageFilenames) {
        const srcPath = path.join(srcFolder, filename);
        const destPath = path.join(outputDirPath, filename);
        
        if (!fs.existsSync(srcPath)) {
          throw new Error(`Source image asset not found at: ${srcPath}`);
        }
        fs.copyFileSync(srcPath, destPath);
      }
    } else {
      // 1. Copy source files to the temporary job directory
      for (const filename of imageFilenames) {
        const srcPath = path.join(srcFolder, filename);
        const destPath = path.join(jobDirPath, filename);
        
        if (!fs.existsSync(srcPath)) {
          throw new Error(`Source image asset not found at: ${srcPath}`);
        }
        fs.copyFileSync(srcPath, destPath);
      }

      // 2. Execute ImageMagick crop command (mogrify outputs to output folder)
      const ratioValue = (wRatio / hRatio).toFixed(2);
      const cropParam = `${ratioValue}:1`;
      
      // Cross-platform command support (Windows uses 'magick mogrify' and backslashes; Linux uses 'mogrify' and forward slashes)
      const isWin = process.platform === 'win32';
      const cmdPrefix = isWin ? 'magick mogrify' : 'mogrify';
      const wildcard = isWin ? '.\\*' : './*';

      // Get unique extensions of source images to run the mogrify command on them
      const extensions = [...new Set(imageFilenames.map(f => path.extname(f).toLowerCase()))];
      for (const ext of extensions) {
        const cmd = `${cmdPrefix} -path output -gravity center -crop ${cropParam} +repage ${wildcard}${ext}`;
        console.log(`[ImageMagick] Executing: "${cmd}" in ${jobDirPath}`);
        await execPromise(cmd, { cwd: jobDirPath });
      }
    }

    // 3. Package all cropped images into a ZIP archive
    const zipFilename = isOriginal ? `${bundleId}_original.zip` : `${bundleId}_${wRatio}x${hRatio}.zip`;
    zipPath = path.join(tempDir, zipFilename);
    const outputStream = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const archivePromise = new Promise((resolve, reject) => {
      outputStream.on('close', resolve);
      archive.on('error', reject);
    });

    archive.pipe(outputStream);
    archive.directory(outputDirPath, false);
    await archive.finalize();
    await archivePromise;

    console.log(`[ZIP] Created: ${zipFilename}. Uploading to Google Drive...`);

    // 4. Upload the ZIP to Google Drive
    const parentFolderId = await getOrCreateFolder();

    const fileMetadata = {
      name: zipFilename,
      parents: [parentFolderId],
    };

    const media = {
      mimeType: 'application/zip',
      body: fs.createReadStream(zipPath),
    };

    const driveResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name',
    });

    const fileId = driveResponse.data.id;
    console.log(`[Google Drive] File uploaded. ID: ${fileId}`);

    // 5. Update file permissions to make it publicly readable
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // 6. Generate the direct download URL
    const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    // 7. Cleanup temporary folder and files
    fs.rmSync(jobDirPath, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

    return res.status(200).json({
      success: true,
      message: 'Bundle customized and stored successfully',
      fileId: fileId,
      downloadUrl: directDownloadUrl,
    });

  } catch (error) {
    console.error('Custom ratio processing/upload error:', error);

    // Attempt cleanups
    try {
      if (fs.existsSync(jobDirPath)) {
        fs.rmSync(jobDirPath, { recursive: true, force: true });
      }
    } catch (_) {}

    try {
      if (zipPath && fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    } catch (_) {}

    return res.status(500).json({ error: 'Failed to process and upload custom wallpaper bundle', details: error.message });
  }
});

// Endpoint: Redirect user to Google OAuth consent screen
app.get('/api/auth', (req, res) => {
  if (isServiceAccount) {
    return res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f0f10; color: #fff;">
          <div style="text-align: center; background: #1a1a1c; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 400px;">
            <h1 style="color: #2196f3; margin-bottom: 1rem;">Service Account Active</h1>
            <p style="color: #aaa; margin-bottom: 2rem; line-height: 1.6;">Your Slidepapers server is successfully connected to Google Cloud using a Service Account. No manual OAuth login consent is required!</p>
            <div style="font-size: 2.5rem;">☁️</div>
          </div>
        </body>
      </html>
    `);
  }

  if (!oauth2Client) {
    // Attempt initialization dynamically in case oauth_credentials.json was updated
    initializeDriveClient();
  }

  if (!oauth2Client) {
    return res.status(500).send('OAuth client not initialized. Please ensure oauth_credentials.json is configured with client_id and client_secret.');
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Forces a new refresh token to be returned
  });

  res.redirect(authUrl);
});

// Endpoint: OAuth2 callback to receive authorization code
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Save tokens locally (contains refresh_token)
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
    
    // Re-initialize Drive client
    drive = google.drive({ version: 'v3', auth: oauth2Client });

    console.log('[OAuth] Authorization successful. Tokens saved.');

    // Trigger sync in background
    syncBundlesWithDrive();

    const tokenString = JSON.stringify(tokens);

    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f0f10; color: #fff; padding: 1rem;">
          <div style="text-align: center; background: #1a1a1c; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 600px; width: 100%; box-sizing: border-box;">
            <h1 style="color: #4caf50; margin-top: 0; margin-bottom: 1rem;">Authentication Successful!</h1>
            <p style="color: #aaa; margin-bottom: 1.5rem; line-height: 1.5;">The credentials have been saved locally. For production deployment on Render, copy the JSON token string below and add it to your Environment Variables as <code>GDRIVE_TOKENS_JSON</code>:</p>
            
            <textarea readonly style="width: 100%; height: 140px; background: #2a2a2c; color: #4caf50; border: 1px solid #3a3a3c; border-radius: 6px; padding: 0.75rem; font-family: monospace; font-size: 0.85rem; resize: none; margin-bottom: 1.5rem; box-sizing: border-box;" onclick="this.select()">${tokenString}</textarea>
            
            <div style="font-size: 2rem;">🎉</div>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('[OAuth] Token exchange failed:', error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// Endpoint: Proxy Google Drive images to allow CORS and avoid size limits
app.get('/api/proxy-image', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing file id' });
  }

  // Redirect the client directly to the Google UserContent CDN domain which allows hotlinking and instant loading
  const redirectUrl = `https://lh3.googleusercontent.com/d/${id}`;
  return res.redirect(redirectUrl);
});

// Endpoint: Check Google Drive status and list files in target folder
app.get('/api/drive-status', async (req, res) => {
  if (!drive) {
    return res.status(201).json({ authenticated: false, error: 'Google Drive client not authenticated. Visit http://localhost:5001/api/auth' });
  }

  try {
    const parentFolderId = await getOrCreateFolder();
    
    // Get folder details
    const folderInfo = await drive.files.get({
      fileId: parentFolderId,
      fields: 'id, name, owners',
    });

    // List recent files in this folder
    const filesResponse = await drive.files.list({
      q: `'${parentFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, createdTime, size)',
      orderBy: 'createdTime desc',
      pageSize: 10,
    });

    return res.status(200).json({
      authenticated: true,
      folderId: folderInfo.data.id,
      folderName: folderInfo.data.name,
      owner: folderInfo.data.owners && folderInfo.data.owners[0] ? folderInfo.data.owners[0].emailAddress : 'unknown',
      files: filesResponse.data.files || [],
    });
  } catch (error) {
    console.error('[Admin] Drive status check error:', error);
    return res.status(500).json({ authenticated: true, error: error.message });
  }
});

// Endpoint: Fetch all wallpaper bundles (sorted alphabetically)
app.get('/api/bundles', async (req, res) => {
  try {
    const bundles = await Bundle.find({});
    // Alphanumeric name sort (natural sort)
    bundles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    return res.status(200).json(bundles);
  } catch (error) {
    console.error('Error fetching bundles database:', error);
    return res.status(500).json({ error: 'Failed to retrieve wallpaper bundles list' });
  }
});

// Endpoint: Pin a wallpaper bundle to the Home Page Hero Animation
app.post('/api/set-hero-bundle', async (req, res) => {
  const { bundleId } = req.body;
  if (!bundleId) {
    return res.status(400).json({ error: 'Missing bundleId parameter' });
  }

  try {
    await Bundle.updateMany({}, { isHero: false });
    const updatedBundle = await Bundle.findOneAndUpdate({ id: bundleId }, { isHero: true }, { new: true });
    
    if (!updatedBundle) {
      return res.status(404).json({ error: `Bundle ${bundleId} not found` });
    }

    console.log(`[Database] Set bundle "${bundleId}" as home hero.`);
    
    // Sync update to Google Drive
    await saveBundlesToDrive();

    return res.status(200).json({ success: true, message: `Successfully pinned bundle "${bundleId}" as home hero.` });
  } catch (error) {
    console.error('Failed to set hero bundle:', error);
    return res.status(500).json({ error: 'Failed to update hero bundle setting', details: error.message });
  }
});

// Endpoint: Upload new wallpaper bundle
app.post('/api/bundles/upload', upload.array('images'), async (req, res) => {
  if (!drive) {
    return res.status(401).json({ error: 'Google Drive client not authenticated. Please authenticate by visiting http://localhost:5001/api/auth' });
  }

  const { 
    name, description, type, orientation, ratio, tags, includes,
    authorId, authorName, authorAvatar, authorEmail
  } = req.body;
  const files = req.files;

  if (!name || !files || files.length === 0) {
    return res.status(400).json({ error: 'Missing required fields: name and image files' });
  }

  // Sort files by original filename in natural ascending order (e.g. Screenshot1 before Screenshot2)
  files.sort((a, b) => {
    return a.originalname.localeCompare(b.originalname, undefined, { numeric: true, sensitivity: 'base' });
  });

  const bundleId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const bundleAssetsDir = path.join(tempDir, 'bundle_assets', bundleId);

  try {
    console.log(`[Admin] Uploading new bundle "${name}" containing ${files.length} images...`);

    // 1. Create a parent folder for this bundle inside Google Drive (under the main Slidepapers folder)
    const parentFolderId = await getOrCreateFolder();
    
    const folderMetadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId]
    };
    
    const folderResponse = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id'
    });
    const bundleFolderId = folderResponse.data.id;
    console.log(`[Google Drive] Created bundle subfolder. ID: ${bundleFolderId}`);

    // 2. Upload each image to Google Drive sequentially (no ImageMagick, saves RAM, bandwidth & CPU)
    console.log(`[Google Drive] Starting direct sequential upload of ${files.length} images...`);
    const uploadResults = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Upload original file to Google Drive
      const fileMetadata = {
        name: file.originalname,
        parents: [bundleFolderId]
      };
      const media = {
        mimeType: file.mimetype,
        body: fs.createReadStream(file.path)
      };
      const driveFile = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name'
      });
      const fileId = driveFile.data.id;
      console.log(`[Google Drive] Uploaded file "${file.originalname}" ID: ${fileId}`);
      
      await drive.permissions.create({
        fileId: fileId,
        requestBody: { role: 'reader', type: 'anyone' }
      });
      
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      // Use Google Drive's built-in thumbnail generator for previewing (sz=w1920 for high-resolution)
      const previewDownloadUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920`;

      // Clean up multer temporary file
      try {
        await fs.promises.unlink(file.path);
      } catch (_) {}

      uploadResults.push({
        index: i,
        url: downloadUrl,
        previewUrl: previewDownloadUrl,
        label: `Screen ${i + 1}: ${file.originalname.split('.')[0]}`,
        size: file.size
      });
    }

    // Sort results to preserve the original selection order
    uploadResults.sort((a, b) => a.index - b.index);
    const imageUrls = uploadResults.map(r => ({ url: r.url, previewUrl: r.previewUrl, label: r.label, size: r.size }));

    const tagsArray = tags ? tags.split(',').map(t => t.trim()) : [];
    const includesArray = includes ? includes.split(',').map(i => i.trim()) : [];

    // Build dynamic ratioOptions based on orientation (includes "Original" by default)
    const ratioOptions = [
      { id: 'original', label: 'Original', subtitle: 'Uncropped high-res wallpapers', resolution: 'Original', size: 'Full Size ZIP', formats: ['PNG', 'JPG'] }
    ];
    if (orientation === 'landscape') {
      ratioOptions.push(
        { id: 'desktop-16-9', label: '16:9 Desktop', subtitle: 'Core wallpaper set', resolution: '3840 x 2160', size: '1.80 MB ZIP', formats: ['PNG', 'JPG'] },
        { id: 'ultrawide-21-9', label: '21:9 Ultrawide', subtitle: 'Panoramic flow crop', resolution: '5120 x 2160', size: '1.50 MB ZIP', formats: ['PNG', 'JPG'] }
      );
    } else {
      ratioOptions.push(
        { id: 'mobile-9-19', label: '9:19.5 Mobile', subtitle: 'Vertical lockscreen pack', resolution: '1290 x 2796', size: '511 KB ZIP', formats: ['PNG', 'JPG'] },
        { id: 'mobile-9-16', label: '9:16 Mobile', subtitle: 'Standard vertical screen', resolution: '1080 x 1920', size: '420 KB ZIP', formats: ['PNG', 'JPG'] }
      );
    }

    let subscribersCount = 0;
    if (authorId) {
      const authorUser = await User.findOne({ uid: authorId });
      if (authorUser) {
        subscribersCount = authorUser.subscribers || 0;
      }
    }

    const newBundle = {
      id: bundleId,
      name: name,
      description: description || 'No description provided.',
      type: type || (orientation === 'landscape' ? 'Landscape Wallpaper Pack' : 'Vertical Mobile Pack'),
      orientation: orientation || 'landscape',
      ratio: ratio || (orientation === 'landscape' ? '16:9' : '9:16'),
      ratioOptions: ratioOptions,
      coverIndex: 0,
      images: imageUrls,
      tags: tagsArray,
      includes: includesArray,
      stats: { views: 0, likes: 0, downloads: 0 },
      author: {
        uid: authorId || 'google-mock-101',
        name: authorName || 'Google Design Lab',
        avatar: authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
        email: authorEmail || 'designer@google.com',
        subscribers: subscribersCount
      }
    };

    // Save to MongoDB
    const createdBundle = await Bundle.create(newBundle);
    console.log(`[Database] Bundle "${name}" saved to MongoDB successfully.`);

    // Sync the updated database to Google Drive for persistence across server restarts
    await saveBundlesToDrive();

    return res.status(200).json({ success: true, message: 'Bundle uploaded and published successfully!', bundle: createdBundle });

  } catch (error) {
    console.error('Bundle upload failed:', error);
    try {
      if (fs.existsSync(bundleAssetsDir)) {
        fs.rmSync(bundleAssetsDir, { recursive: true, force: true });
      }
    } catch (_) {}
    
    // Clean up any remaining multer temporary files
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (_) {}
      }
    }

    return res.status(500).json({ error: 'Failed to process and upload new wallpaper bundle', details: error.message });
  }
});

// Endpoint: Delete a wallpaper bundle
app.delete('/api/bundles/:bundleId', async (req, res) => {
  if (!drive) {
    return res.status(401).json({ error: 'Google Drive client not authenticated.' });
  }

  const { bundleId } = req.params;

  try {
    // 1. Find the bundle in MongoDB
    const bundle = await Bundle.findOne({ id: bundleId });
    if (!bundle) {
      return res.status(404).json({ error: `Bundle ${bundleId} not found` });
    }

    // 2. Delete the bundle from MongoDB
    await Bundle.deleteOne({ id: bundleId });
    console.log(`[Database] Deleted bundle "${bundle.name}" from MongoDB.`);

    // 3. Delete local assets backup folder (if exists)
    const bundleAssetsDir = path.join(tempDir, 'bundle_assets', bundleId);
    if (fs.existsSync(bundleAssetsDir)) {
      fs.rmSync(bundleAssetsDir, { recursive: true, force: true });
      console.log(`[Cleanup] Deleted local backup assets at ${bundleAssetsDir}`);
    }

    // 4. Delete files and subfolder from Google Drive
    const parentFolderId = await getOrCreateFolder();
    const driveFolderResponse = await drive.files.list({
      q: `name = '${bundle.name}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });

    if (driveFolderResponse.data.files && driveFolderResponse.data.files.length > 0) {
      const driveFolderId = driveFolderResponse.data.files[0].id;
      await drive.files.delete({ fileId: driveFolderId });
      console.log(`[Google Drive] Deleted bundle folder: "${bundle.name}" (${driveFolderId})`);
    }

    // 5. Save updated bundles database back to Google Drive (backup)
    await saveBundlesToDrive();

    return res.status(200).json({ success: true, message: `Bundle "${bundle.name}" deleted successfully` });

  } catch (error) {
    console.error('Error deleting bundle:', error);
    return res.status(500).json({ error: 'Failed to delete wallpaper bundle', details: error.message });
  }
});

// Endpoint: Sync user profile when they login/authenticate
app.post('/api/users/sync-profile', async (req, res) => {
  const { uid, displayName, email, photoURL } = req.body;
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid' });
  }

  try {
    let user = await User.findOne({ uid });
    if (user) {
      user.displayName = displayName || user.displayName;
      user.email = email || user.email;
      user.photoURL = photoURL || user.photoURL;
      await user.save();
    } else {
      user = await User.create({
        uid,
        displayName,
        email,
        photoURL,
        subscribers: 0,
        subscriberUids: []
      });
      console.log(`[Database] Created new user profile for UID: ${uid}`);
    }

    // Also update any bundles uploaded by this author so that name/avatar updates everywhere!
    await Bundle.updateMany(
      { 'author.uid': uid },
      { 
        $set: { 
          'author.name': displayName || user.displayName, 
          'author.avatar': photoURL || user.photoURL,
          'author.email': email || user.email 
        } 
      }
    );

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Error syncing user profile:', error);
    return res.status(500).json({ error: 'Failed to sync user profile' });
  }
});

// Endpoint: Increment views on a wallpaper bundle
app.post('/api/bundles/:bundleId/view', async (req, res) => {
  const { bundleId } = req.params;
  try {
    const bundle = await Bundle.findOneAndUpdate(
      { id: bundleId },
      { $inc: { 'stats.views': 1 } },
      { new: true }
    );
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    return res.status(200).json({ success: true, views: bundle.stats.views });
  } catch (error) {
    console.error('Error incrementing views:', error);
    return res.status(500).json({ error: 'Failed to increment views' });
  }
});

// Endpoint: Toggle like/unlike on a wallpaper bundle
app.post('/api/bundles/:bundleId/like', async (req, res) => {
  const { bundleId } = req.params;
  const { uid } = req.body; // user UID

  if (!uid) {
    return res.status(400).json({ error: 'Authentication required to like' });
  }

  try {
    const bundle = await Bundle.findOne({ id: bundleId });
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    const likedIndex = bundle.likedBy.indexOf(uid);
    let liked = false;

    if (likedIndex > -1) {
      // Unlike
      bundle.likedBy.splice(likedIndex, 1);
      bundle.stats.likes = Math.max(0, bundle.stats.likes - 1);
    } else {
      // Like
      bundle.likedBy.push(uid);
      bundle.stats.likes += 1;
      liked = true;
    }

    await bundle.save();
    console.log(`[Database] User ${uid} ${liked ? 'liked' : 'unliked'} bundle "${bundle.name}". Total likes: ${bundle.stats.likes}`);

    // Trigger Drive sync backup in background
    saveBundlesToDrive().catch(err => console.error('[Sync] Background sync error:', err));

    return res.status(200).json({ success: true, liked, likes: bundle.stats.likes, likedBy: bundle.likedBy });
  } catch (error) {
    console.error('Error toggling like:', error);
    return res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Endpoint: Toggle subscribe/unsubscribe to an author
app.post('/api/authors/:authorUid/subscribe', async (req, res) => {
  const { authorUid } = req.params;
  const { uid } = req.body; // logged-in user UID

  if (!uid) {
    return res.status(400).json({ error: 'Authentication required to subscribe' });
  }

  if (uid === authorUid) {
    return res.status(400).json({ error: 'You cannot subscribe to yourself' });
  }

  try {
    // 1. Find or create the author profile
    let author = await User.findOne({ uid: authorUid });
    if (!author) {
      author = await User.create({
        uid: authorUid,
        displayName: 'Author',
        email: '',
        photoURL: '',
        subscribers: 0,
        subscriberUids: []
      });
    }

    const subIndex = author.subscriberUids.indexOf(uid);
    let subscribed = false;

    if (subIndex > -1) {
      // Unsubscribe
      author.subscriberUids.splice(subIndex, 1);
      author.subscribers = Math.max(0, author.subscribers - 1);
    } else {
      // Subscribe
      author.subscriberUids.push(uid);
      author.subscribers += 1;
      subscribed = true;
    }

    await author.save();
    console.log(`[Database] User ${uid} ${subscribed ? 'subscribed to' : 'unsubscribed from'} author ${authorUid}. Total subscribers: ${author.subscribers}`);

    // 2. Keep the cached subscriber count inside all bundles uploaded by this author updated!
    await Bundle.updateMany(
      { 'author.uid': authorUid },
      { $set: { 'author.subscribers': author.subscribers } }
    );

    // Trigger Drive sync backup in background
    saveBundlesToDrive().catch(err => console.error('[Sync] Background sync error:', err));

    return res.status(200).json({ 
      success: true, 
      subscribed, 
      subscribers: author.subscribers,
      subscriberUids: author.subscriberUids
    });
  } catch (error) {
    console.error('Error toggling subscription:', error);
    return res.status(500).json({ error: 'Failed to toggle subscription' });
  }
});

// Endpoint: Get author status and subscription state for a user
app.get('/api/authors/:authorUid/status', async (req, res) => {
  const { authorUid } = req.params;
  const { uid } = req.query; // Logged in user UID

  try {
    const author = await User.findOne({ uid: authorUid });
    if (!author) {
      return res.status(200).json({ subscribers: 0, isSubscribed: false, profile: null });
    }

    const isSubscribed = uid ? author.subscriberUids.includes(uid) : false;
    return res.status(200).json({ 
      subscribers: author.subscribers, 
      isSubscribed,
      profile: author
    });
  } catch (error) {
    console.error('Error fetching author status:', error);
    return res.status(500).json({ error: 'Failed to fetch author status' });
  }
});

// Endpoint: Update user profile
app.post('/api/users/update-profile', async (req, res) => {
  const { uid, displayName, photoURL, about, youtubeUrl, instagramUrl, twitterUrl, accentGradient, bannerURL } = req.body;
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid' });
  }

  try {
    const user = await User.findOneAndUpdate(
      { uid },
      { 
        displayName, 
        photoURL, 
        about, 
        youtubeUrl, 
        instagramUrl, 
        twitterUrl,
        accentGradient,
        bannerURL
      },
      { new: true, upsert: true }
    );

    // Also update any bundles uploaded by this author so that name/avatar updates everywhere!
    await Bundle.updateMany(
      { 'author.uid': uid },
      { 
        $set: { 
          'author.name': user.displayName, 
          'author.avatar': user.photoURL
        } 
      }
    );

    // Trigger Drive sync backup in background
    saveBundlesToDrive().catch(err => console.error('[Sync] Background sync error:', err));

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Endpoint: Upload avatar image to Google Drive or local storage
app.post('/api/users/upload-avatar', upload.single('avatar'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    if (drive) {
      try {
        const parentFolderId = await getOrCreateFolder();
        const fileMetadata = {
          name: `avatar-${Date.now()}-${file.originalname || 'avatar.png'}`,
          parents: [parentFolderId]
        };
        const media = {
          mimeType: file.mimetype || 'image/png',
          body: fs.createReadStream(file.path)
        };
        const driveFile = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id'
        });
        const fileId = driveFile.data.id;

        await drive.permissions.create({
          fileId: fileId,
          requestBody: { role: 'reader', type: 'anyone' }
        });

        try {
          await fs.promises.unlink(file.path);
        } catch (_) {}

        const photoURL = `https://drive.google.com/uc?export=download&id=${fileId}`;
        return res.status(200).json({ success: true, photoURL });
      } catch (driveErr) {
        console.warn('[Avatar Upload] Drive upload failed, saving to local static storage:', driveErr.message);
      }
    }

    // Local static fallback
    const ext = path.extname(file.originalname || 'avatar.png') || '.png';
    const newFilename = `avatar-${Date.now()}${ext}`;
    const targetPath = path.join(uploadsDir, newFilename);
    await fs.promises.rename(file.path, targetPath);
    const photoURL = `/uploads/${newFilename}`;
    return res.status(200).json({ success: true, photoURL });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});


app.listen(PORT, () => {
  console.log(`Slidepapers backend server running at http://localhost:${PORT}`);
});
