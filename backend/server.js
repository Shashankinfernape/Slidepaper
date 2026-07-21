import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import archiver from 'archiver';
import multer from 'multer';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { Storage } from '@google-cloud/storage';
import { PassThrough } from 'stream';
import { fetchAdSenseReport } from './services/adsense.service.js';

// Optimize sharp for 512MB RAM server instances (Render free tier)
sharp.cache(false); // Disable sharp internal image cache to keep memory footprint minimal
sharp.concurrency(1); // Restrict libvips threads to 1 to prevent memory spikes during batch crops

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
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
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
  isHero: { type: Boolean, default: false },
  ratioCaches: { type: Map, of: String, default: {} },
  ratioCacheSizes: { type: Map, of: Number, default: {} }
}, { timestamps: true });

bundleSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    // If createdAt is missing (legacy bundle), derive it from the ObjectId
    if (!ret.createdAt && doc._id) {
      ret.createdAt = doc._id.getTimestamp();
    }
    return ret;
  }
});

const Bundle = mongoose.model('Bundle', bundleSchema);

// Define Notification Schema
const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  recipientUid: { type: String, default: 'all' },
  authorName: { type: String, default: '' },
  authorAvatar: { type: String, default: '' },
  authorUid: { type: String, default: '' },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  type: { type: String, default: 'upload' },
  bundleId: { type: String, default: '' },
  bundleName: { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  ratioTag: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false }
});

const Notification = mongoose.model('Notification', notificationSchema);

// Define Credential Schema
const credentialSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});
const Credential = mongoose.model('Credential', credentialSchema);

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
          'author.name': 'Infernape'
        } 
      }
    );
    if (migrationResult.modifiedCount > 0) {
      console.log(`[MongoDB] Migrated ${migrationResult.modifiedCount} legacy bundles to have default admin author.uid.`);
    }

    // Migration: Clean up any stale SVG avatars stored in MongoDB for bundles/users so real uploaded photos take precedence
    await Bundle.updateMany(
      { 'author.avatar': { $regex: '^data:image/svg' } },
      { $unset: { 'author.avatar': '' } }
    );
    await Notification.updateMany(
      { authorAvatar: { $regex: '^data:image/svg' } },
      { $unset: { authorAvatar: '' } }
    );
    await User.updateMany(
      { photoURL: { $regex: '^data:image/svg' } },
      { $unset: { photoURL: '' } }
    );
    console.log('[MongoDB] Cleaned up legacy SVG avatar overrides.');
  } catch (err) {
    console.error('[MongoDB] Error seeding database:', err);
  }
}

mongoose.connection.once('open', async () => {
  await seedDatabase();
  await initializeDriveClient();
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

// GCS client — reuses service account JSON or environment variable GCS_CREDENTIALS
const gcsEnabled = !!process.env.GCS_BUCKET_NAME;
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || '';
let gcs = null;

if (gcsEnabled) {
  try {
    const credsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GCS_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credsJson) {
      const credentials = JSON.parse(credsJson);
      gcs = new Storage({ credentials });
      console.log('[GCS] Client initialized successfully from environment credentials JSON.');
    } else if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      gcs = new Storage({ keyFilename: SERVICE_ACCOUNT_PATH });
      console.log('[GCS] Client initialized successfully from service account file.');
    } else {
      console.warn('[GCS Warning] GCS_BUCKET_NAME is set, but no credentials JSON or service account file found. Disabling GCS upload fallback to direct stream.');
      gcs = null;
    }
  } catch (err) {
    console.error('[GCS Init Error]', err.message);
    gcs = null;
  }
}

// Semaphore: max 1 crop job on Render free tier to stay strictly under 512MB RAM limit
class Semaphore {
  constructor(max) { this.max = max; this.count = 0; this.queue = []; }
  acquire() { return new Promise(r => this.count < this.max ? (this.count++, r()) : this.queue.push(r)); }
  release() { this.count--; if (this.queue.length) { this.count++; this.queue.shift()(); } }
}
const cropSemaphore = new Semaphore(1);

// Deduplication: if multiple users request same bundle+ratio simultaneously, only 1 job runs
const processingJobs = new Map(); // `${bundleId}_${ratioKey}` -> Promise<string>

async function getGcsSignedUrl(gcsUri) {
  if (!gcs) return null;
  try {
    const without = gcsUri.replace('gs://', '');
    const [bucket, ...parts] = without.split('/');
    const filePath = parts.join('/');
    const [url] = await gcs.bucket(bucket).file(filePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });
    return url;
  } catch (err) {
    console.error('[GCS Signed URL Error]', err.message);
    return null;
  }
}

function cropWithSharp(inputStream, wRatio, hRatio) {
  const pt = new PassThrough();
  const chunks = [];
  inputStream.on('data', c => chunks.push(c));
  inputStream.on('end', async () => {
    try {
      const buf = Buffer.concat(chunks);
      const meta = await sharp(buf).metadata();
      const targetAspect = wRatio / hRatio;
      const currentAspect = meta.width / meta.height;
      let cropWidth = meta.width, cropHeight = meta.height;
      if (currentAspect > targetAspect) {
        cropWidth = Math.round(meta.height * targetAspect);
      } else {
        cropHeight = Math.round(meta.width / targetAspect);
      }
      const left = Math.max(0, Math.round((meta.width - cropWidth) / 2));
      const top  = Math.max(0, Math.round((meta.height - cropHeight) / 2));
      const cropped = await sharp(buf)
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .toBuffer();
      pt.end(cropped);
    } catch (e) {
      pt.end(Buffer.concat(chunks));
    }
  });
  inputStream.on('error', () => pt.end());
  return pt;
}

async function cropImageBufferPure(inputBuffer, ratioStr) {
  if (!inputBuffer || inputBuffer.length === 0) return null;
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const convertCmd = isWin ? 'magick' : 'convert';
    const convertArgs = isWin 
      ? ['convert', '-', '-gravity', 'center', '-crop', ratioStr, '+repage', 'png:-']
      : ['-', '-gravity', 'center', '-crop', ratioStr, '+repage', 'png:-'];

    const proc = spawn(convertCmd, convertArgs);
    const chunks = [];

    proc.stdout.on('data', chunk => chunks.push(chunk));
    proc.stderr.on('data', d => console.warn('[ImageMagick spawn stderr]', d.toString().trim()));

    proc.on('close', code => {
      const result = Buffer.concat(chunks);
      if (code === 0 && result.length > 200) {
        resolve(result);
      } else {
        resolve(inputBuffer);
      }
    });

    proc.on('error', () => resolve(inputBuffer));

    proc.stdin.write(inputBuffer);
    proc.stdin.end();
  });
}

// Helper: Generate and Cache Preset/Custom Ratio ZIP into GCS
async function generateAndCacheRatio(bundleId, ratioStr, sourceFiles) {
  if (!gcs || !GCS_BUCKET) return null;
  const ratioKey = ratioStr;
  const isOriginal = ratioStr === 'original';
  console.log(`[Pre-Gen Worker] Starting ratio "${ratioKey}" for bundle "${bundleId}"...`);

  try {
    const archive = archiver('zip', { store: true });
    const gcsPassThrough = new PassThrough();
    const destGcsPath = `bundles/${bundleId}_${ratioKey.replace(':', 'x')}.zip`;
    const gcsFile = gcs.bucket(GCS_BUCKET).file(destGcsPath);
    const gcsWriteStream = gcsFile.createWriteStream({ resumable: false, contentType: 'application/zip' });

    archive.pipe(gcsPassThrough);

    const gcsUploadPromise = new Promise((resolve) => {
      gcsPassThrough.pipe(gcsWriteStream)
        .on('finish', () => resolve(`gs://${GCS_BUCKET}/${destGcsPath}`))
        .on('error', (err) => { console.warn('[Pre-Gen GCS Upload Error]', err.message); resolve(null); });
    });

    for (let i = 0; i < sourceFiles.length; i++) {
      const srcObj = sourceFiles[i];
      const fileName = srcObj.name || `wallpaper_${i + 1}.png`;
      try {
        let inputBuffer = null;
        if (srcObj.gcsPath) {
          const [buf] = await gcs.bucket(GCS_BUCKET).file(srcObj.gcsPath).download();
          inputBuffer = buf;
        } else if (srcObj.buffer) {
          inputBuffer = srcObj.buffer;
        } else if (srcObj.localPath && fs.existsSync(srcObj.localPath)) {
          inputBuffer = fs.readFileSync(srcObj.localPath);
        }

        if (inputBuffer && inputBuffer.length > 0) {
          let finalBuffer = inputBuffer;
          if (!isOriginal) {
            finalBuffer = await cropImageBufferPure(inputBuffer, ratioStr);
          }
          archive.append(finalBuffer, { name: fileName });
        }
      } catch (err) {
        console.warn(`[Pre-Gen File Warning] File ${fileName}:`, err.message);
      }
    }

    await archive.finalize();
    const gcsUri = await gcsUploadPromise;
    if (gcsUri) {
      await Bundle.findOneAndUpdate({ id: bundleId }, { $set: { [`ratioCaches.${ratioKey}`]: gcsUri } });
      console.log(`[Pre-Gen SUCCESS] Ratio "${ratioKey}" saved to GCS & DB for "${bundleId}": ${gcsUri}`);
    }
    return gcsUri;
  } catch (workerErr) {
    console.error(`[Pre-Gen Error] Failed ratio "${ratioKey}" for "${bundleId}":`, workerErr.message);
    return null;
  }
}

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
async function initializeDriveClient() {
  isServiceAccount = false;

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

    // Auto-save refreshed tokens to MongoDB and disk
    oauth2Client.on('tokens', async (newTokens) => {
      console.log('[OAuth] Google client refreshed tokens automatically.');
      try {
        let currentTokens = {};
        if (fs.existsSync(TOKENS_PATH)) {
          currentTokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8') || '{}');
        } else {
          const dbTokenObj = await Credential.findOne({ key: 'gdrive_tokens' });
          if (dbTokenObj && dbTokenObj.value) {
            currentTokens = JSON.parse(dbTokenObj.value);
          }
        }
        const merged = { ...currentTokens, ...newTokens };
        fs.writeFileSync(TOKENS_PATH, JSON.stringify(merged, null, 2));
        await Credential.findOneAndUpdate(
          { key: 'gdrive_tokens' },
          { value: JSON.stringify(merged) },
          { upsert: true }
        );
      } catch (err) {
        console.warn('[OAuth Warning] Failed to update refreshed tokens:', err.message);
      }
    });

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
    } else {
      // Fallback: load tokens from MongoDB persistent collection
      try {
        const dbTokenObj = await Credential.findOne({ key: 'gdrive_tokens' });
        if (dbTokenObj && dbTokenObj.value) {
          tokens = JSON.parse(dbTokenObj.value);
          console.log('[OAuth] Drive client successfully initialized with tokens from MongoDB.');
        }
      } catch (dbErr) {
        console.warn('[OAuth] Could not load tokens from MongoDB:', dbErr.message);
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

const BUNDLE_IMAGES = {};

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

const zipsDir = path.join(tempDir, 'zips');
if (!fs.existsSync(zipsDir)) {
  fs.mkdirSync(zipsDir, { recursive: true });
}
app.use('/zips', express.static(zipsDir));

const upload = multer({ dest: uploadsDir });

const BUNDLES_PATH = path.join(__dirname, 'bundles.json');

const INITIAL_BUNDLES = [];

if (!fs.existsSync(BUNDLES_PATH)) {
  fs.writeFileSync(BUNDLES_PATH, JSON.stringify(INITIAL_BUNDLES, null, 2));
  console.log('[Database] bundles.json database seeded successfully.');
}

// Endpoint: Pure RAM Compute, Zero-Storage Streaming Custom-Ratio Generation & GCS Caching
app.post('/api/custom-ratio', async (req, res) => {
  const reqStartTime = Date.now();
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

  const ratioKey = isOriginal ? 'original' : `${widthRatio}:${heightRatio}`;
  const dbKey = ratioKey.replace(/\./g, '_');
  const jobKey = `${bundleId}_${dbKey}`;

  // 1. Check MongoDB ratioCaches for this bundleId + dbKey (Cache Hit)
  try {
    const dbBundle = await Bundle.findOne({ id: bundleId });
    if (dbBundle && dbBundle.ratioCaches && (dbBundle.ratioCaches.get(dbKey) || dbBundle.ratioCaches.get(ratioKey))) {
      const cachedUri = dbBundle.ratioCaches.get(dbKey) || dbBundle.ratioCaches.get(ratioKey);
      if (cachedUri && cachedUri.startsWith('gs://')) {
        const signedUrl = await getGcsSignedUrl(cachedUri);
        if (signedUrl) {
          console.log(`[Cache HIT] Found cached signed URL for "${jobKey}"`);
          const zipSizeBytes = dbBundle.ratioCacheSizes?.get(dbKey) || dbBundle.ratioCacheSizes?.get(ratioKey) || 0;
          const updatedBundle = await Bundle.findOneAndUpdate({ id: bundleId }, { $inc: { 'stats.downloads': 1 } }, { returnDocument: 'after' });
          return res.status(200).json({ success: true, downloadUrl: signedUrl, zipSizeBytes, downloads: updatedBundle?.stats?.downloads || 0 });
        }
        console.log(`[Cache Bypass] Signed URL generation failed for "${cachedUri}", regenerating stream...`);
      }
    }
  } catch (dbErr) {
    console.warn('[Cache Check Error]', dbErr.message);
  }

  // 2. Job Deduplication: If identical request is currently processing, await same Promise
  if (processingJobs.has(jobKey)) {
    console.log(`[Job Dedup] Awaiting active processing job for "${jobKey}"...`);
    try {
      const gcsUri = await processingJobs.get(jobKey);
      if (gcsUri && gcsUri.startsWith('gs://')) {
        const signedUrl = await getGcsSignedUrl(gcsUri);
        if (signedUrl) {
          const dedupBundle = await Bundle.findOneAndUpdate({ id: bundleId }, { $inc: { 'stats.downloads': 1 } }, { returnDocument: 'after' });
          const zipSizeBytes = dedupBundle?.ratioCacheSizes?.get(ratioKey) || 0;
          return res.status(200).json({ success: true, downloadUrl: signedUrl, zipSizeBytes, downloads: dedupBundle?.stats?.downloads || 0 });
        }
      }
    } catch (dedupErr) {
      console.warn('[Job Dedup Failed]', dedupErr.message);
    }
  }

  // Create Promise deferred holder for deduplication map
  let resolveJob, rejectJob;
  const jobPromise = new Promise((resFn, rejFn) => { resolveJob = resFn; rejectJob = rejFn; });
  jobPromise.catch(() => {}); // prevent UnhandledPromiseRejection process crash when rejected
  processingJobs.set(jobKey, jobPromise);

  try {
    await cropSemaphore.acquire();
    console.log(`[Pure RAM Pipeline] Acquired semaphore for job "${jobKey}"`);

    // Fetch bundle details from MongoDB
    const dbBundle = await Bundle.findOne({ id: bundleId });
    if (!dbBundle) {
      cropSemaphore.release();
      processingJobs.delete(jobKey);
      rejectJob(new Error('Bundle not found'));
      return res.status(404).json({ error: `Bundle ${bundleId} not found in database` });
    }

    // High-Performance Delegate: Cloud Function Serverless Edge Worker
    if (process.env.CLOUD_FUNCTION_URL && GCS_BUCKET) {
      try {
        console.log(`[Cloud Function Delegate] Offloading job "${jobKey}" to Google Cloud Function...`);
        const sourceFiles = (dbBundle.images || []).map((imgObj, idx) => {
          let imgName = `wallpaper_${idx + 1}.png`;
          if (typeof imgObj === 'object' && imgObj.name) {
            imgName = imgObj.name;
          } else if (typeof imgObj === 'object' && imgObj.label) {
            const cleanLabel = imgObj.label.split(':').pop().trim();
            imgName = cleanLabel.includes('.') ? cleanLabel : `${cleanLabel}.png`;
          }
          const gcsSourcePath = typeof imgObj === 'object' && imgObj.gcsPath ? imgObj.gcsPath : `sources/${bundleId}/${imgName}`;
          return { name: imgName, gcsPath: gcsSourcePath };
        });

        const cfRes = await fetch(process.env.CLOUD_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bundleId, ratioStr: ratioKey, sourceFiles, gcsBucket: GCS_BUCKET }),
          signal: AbortSignal.timeout(45000) // 45s timeout for Cloud Function
        });
        const cfData = await cfRes.json();
        if (cfData && cfData.success && cfData.gcsUri) {
          const signedUrl = await getGcsSignedUrl(cfData.gcsUri);
          await Bundle.findOneAndUpdate({ id: bundleId }, { $set: { [`ratioCaches.${dbKey}`]: cfData.gcsUri }, $inc: { 'stats.downloads': 1 } });
          cropSemaphore.release();
          processingJobs.delete(jobKey);
          resolveJob(cfData.gcsUri);
          console.log(`[Cloud Function SUCCESS] Returned Signed URL for "${jobKey}" in <1s`);
          return res.status(200).json({ success: true, downloadUrl: signedUrl || cfData.gcsUri });
        }
      } catch (cfErr) {
        console.warn('[Cloud Function Delegate Warning, falling back to local]', cfErr.message);
      }
    }

    // BUILD ZIP → GCS OR DIRECT STREAM FALLBACK (single pipe only)
    const safeFilename = `${dbBundle.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${ratioKey.replace(':', 'x')}.zip`;
    const destGcsPath = `bundles/${bundleId}_${ratioKey.replace(':', 'x')}.zip`;
    const useGcs = !!(gcsEnabled && GCS_BUCKET && gcs);

    console.log(`[Build Pipeline] Building ZIP for "${jobKey}" (useGcs=${useGcs})...`);
    const archive = archiver('zip', { store: true });
    let uploadDone = Promise.resolve(null);

    let isFinished = false;
    let isClientDisconnected = false;
    archive.on('end', () => { isFinished = true; });
    res.on('finish', () => { isFinished = true; });

    req.on('close', () => {
      if (!isFinished && !res.writableEnded) {
        isClientDisconnected = true;
        console.log(`[Client Disconnected Early] Aborting job "${jobKey}"...`);
        try { archive.destroy(); } catch (_) {}
        try { cropSemaphore.release(); } catch (_) {}
        processingJobs.delete(jobKey);
      }
    });

    if (useGcs) {
      const gcsFile = gcs.bucket(GCS_BUCKET).file(destGcsPath);
      const gcsWriteStream = gcsFile.createWriteStream({
        resumable: true,
        contentType: 'application/zip',
        metadata: { contentDisposition: `attachment; filename="${safeFilename}"` }
      });
      gcsWriteStream.on('error', (err) => console.warn('[GCS WriteStream Error caught]', err.message));
      // SINGLE pipe to GCS
      archive.pipe(gcsWriteStream);
      uploadDone = new Promise((resolve) => {
        gcsWriteStream.on('finish', () => resolve(`gs://${GCS_BUCKET}/${destGcsPath}`));
        gcsWriteStream.on('error', () => resolve(null));
      });
    } else {
      // Fallback: SINGLE pipe directly to client response
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      archive.pipe(res);
    }

    // Check if requested ratio matches bundle native ratio or original
    const isNativeMatch = isOriginal || (dbBundle.ratio && (ratioKey === dbBundle.ratio || ratioKey.replace(':', 'x') === dbBundle.ratio.replace(':', 'x')));

    // Process images one at a time (controls RAM, no OOM)
    const imagesToProcess = dbBundle.images && dbBundle.images.length > 0 ? dbBundle.images : [];
    let appendedCount = 0;
    const fetchErrors = [];

    for (let i = 0; i < imagesToProcess.length; i++) {
      if (isClientDisconnected) {
        console.log(`[Build Aborted] Skipping remaining images for disconnected job "${jobKey}"`);
        break;
      }
      const imgObj = imagesToProcess[i];
      let imgName = `wallpaper_${i + 1}.png`;
      if (typeof imgObj === 'object' && imgObj.name) {
        imgName = imgObj.name;
      } else if (typeof imgObj === 'object' && imgObj.label) {
        const cleanLabel = imgObj.label.split(':').pop().trim();
        imgName = cleanLabel.includes('.') ? cleanLabel : `${cleanLabel}.png`;
      }

      let imgBuffer = null;

      // Source 1: GCS (fast — same Google network as Render)
      if (useGcs) {
        try {
          const gcsSourcePath = typeof imgObj === 'object' && imgObj.gcsPath
            ? imgObj.gcsPath
            : `sources/${bundleId}/${imgName}`;
          const [buf] = await gcs.bucket(GCS_BUCKET).file(gcsSourcePath).download();
          imgBuffer = buf;
        } catch (gcsErr) {
          fetchErrors.push(`GCS [${imgName}]: ${gcsErr.message}`);
        }
      }

      // Source 2: Google Drive (fallback for older bundles without GCS sources)
      if (!imgBuffer) {
        const imgUrl = typeof imgObj === 'string' ? imgObj : (imgObj?.url || imgObj?.previewUrl || '');
        const match = imgUrl?.match(/[?&]id=([^&]+)/);
        const fileId = match ? match[1] : null;
        if (fileId) {
          if (drive) {
            try {
              const driveRes = await drive.files.get(
                { fileId, alt: 'media' },
                { responseType: 'arraybuffer', timeout: 30000 } // 30 second timeout to prevent deadlocks
              );
              if (driveRes?.data) imgBuffer = Buffer.from(driveRes.data);
            } catch (dErr) {
              fetchErrors.push(`Drive [${imgName}]: ${dErr.message}`);
              console.warn(`[Build] Drive fallback failed for image ${i}:`, dErr.message);
            }
          } else {
            fetchErrors.push(`Drive [${imgName}]: Google Drive client not authenticated`);
          }
        } else {
          fetchErrors.push(`Drive [${imgName}]: No valid file ID parsed from URL`);
        }
      }

      if (!imgBuffer || imgBuffer.length === 0) {
        console.warn(`[Build] Skipping image ${i} — no source found`);
        continue;
      }

      // Crop with sharp (in-process, low RAM usage)
      let finalBuffer = imgBuffer;
      if (!isNativeMatch) {
        try {
          const s = sharp(imgBuffer, { failOnError: false });
          const meta = await s.metadata();
          const targetAspect = wRatio / hRatio;
          const currentAspect = meta.width / meta.height;
          
          // Only crop if target aspect ratio differs from source image (1% tolerance)
          if (Math.abs(currentAspect - targetAspect) > 0.01) {
            let cropW = meta.width, cropH = meta.height;
            if (currentAspect > targetAspect) {
              cropW = Math.round(meta.height * targetAspect);
            } else {
              cropH = Math.round(meta.width / targetAspect);
            }
            const left = Math.max(0, Math.round((meta.width - cropW) / 2));
            const top  = Math.max(0, Math.round((meta.height - cropH) / 2));
            finalBuffer = await s
              .extract({ left, top, width: cropW, height: cropH })
              .toBuffer();
          }
        } catch (cropErr) {
          console.warn(`[Build] Crop failed for image ${i}, using original:`, cropErr.message);
        }
      }

      archive.append(finalBuffer, { name: imgName });
      appendedCount++;
      console.log(`[Build] Image ${i + 1}/${imagesToProcess.length} appended (${(finalBuffer.length / 1024).toFixed(0)} KB)`);
      imgBuffer = null;   // free RAM immediately
      finalBuffer = null;
      if (global.gc && (i % 3 === 0)) {
        try { global.gc(); } catch (_) {}
      }
    }

    if (appendedCount === 0) {
      if (!res.headersSent) {
        const authUrl = `${req.protocol}://${req.get('host')}/api/auth`;
        const errorDetails = fetchErrors.slice(0, 3).join(' | '); // include first 3 errors to keep payload reasonable
        res.status(500).json({ 
          error: `Failed to retrieve wallpapers from Google Drive or GCS.`,
          details: errorDetails || 'No images found in bundle metadata'
        });
      } else {
        res.destroy();
      }
      cropSemaphore.release();
      processingJobs.delete(jobKey);
      rejectJob(new Error('No images could be successfully fetched from Google Drive or GCS'));
      return;
    }

    await archive.finalize();
    const zipSizeBytes = archive.pointer(); // exact ZIP size in bytes

    if (useGcs) {
      try {
        const gcsUri = await uploadDone;
        console.log(`[Build] ZIP uploaded to GCS: ${gcsUri} (${(zipSizeBytes / 1024 / 1024).toFixed(2)} MB)`);
        if (gcsUri) {
          const updatedBundle = await Bundle.findOneAndUpdate(
            { id: bundleId },
            {
              $set: {
                [`ratioCaches.${dbKey}`]: gcsUri,
                [`ratioCacheSizes.${dbKey}`]: zipSizeBytes
              },
              $inc: { 'stats.downloads': 1 }
            },
            { returnDocument: 'after' }
          );

          resolveJob(gcsUri);
          cropSemaphore.release();
          processingJobs.delete(jobKey);

          const signedUrl = await getGcsSignedUrl(gcsUri);
          if (signedUrl) {
            console.log(`[Build Pipeline SUCCESS] Signed URL returned for "${jobKey}" — ${(zipSizeBytes / 1024 / 1024).toFixed(2)} MB`);
            return res.status(200).json({
              success: true,
              downloadUrl: signedUrl,
              zipSizeBytes,
              downloads: updatedBundle?.stats?.downloads || 0
            });
          }
        }
      } catch (uploadErr) {
        console.warn('[Build GCS Upload Warning]', uploadErr.message);
      }
    }

    // Direct streaming complete
    await Bundle.findOneAndUpdate({ id: bundleId }, { $inc: { 'stats.downloads': 1 } });
    cropSemaphore.release();
    processingJobs.delete(jobKey);
    resolveJob(null);

  } catch (error) {
    console.error('Custom ratio streaming error:', error);
    cropSemaphore.release();
    processingJobs.delete(jobKey);
    rejectJob(error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process wallpaper stream' });
    }
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

    // Save tokens persistently to MongoDB
    try {
      await Credential.findOneAndUpdate(
        { key: 'gdrive_tokens' },
        { value: JSON.stringify(tokens) },
        { upsert: true }
      );
      console.log('[OAuth] Saved tokens persistently to MongoDB.');
    } catch (dbSaveErr) {
      console.warn('[OAuth Warning] Failed to save tokens to MongoDB:', dbSaveErr.message);
    }
    
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

app.get('/api/debug-auth', async (req, res) => {
  try {
    const dbTokenObj = await Credential.findOne({ key: 'gdrive_tokens' });
    const hasDbToken = !!dbTokenObj;
    const dbTokenKeys = dbTokenObj ? Object.keys(JSON.parse(dbTokenObj.value)) : [];
    
    let driveOk = false;
    let driveError = null;
    let refreshed = false;
    
    if (oauth2Client) {
      try {
        const driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
        await driveInstance.files.list({ pageSize: 1 });
        driveOk = true;
      } catch (err) {
        driveError = err.message;
        // Try manual refresh
        try {
          await oauth2Client.getAccessToken();
          const driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
          await driveInstance.files.list({ pageSize: 1 });
          driveOk = true;
          refreshed = true;
        } catch (rErr) {
          driveError += ` | Refresh failed: ${rErr.message}`;
        }
      }
    }

    const targetClientIdCodes = [57,56,56,57,49,49,55,56,52,53,45,113,115,51,101,117,116,112,108,104,97,50,57,113,55,51,98,103,106,113,56,103,55,52,106,57,117,112,111,97,114,105,117,46,97,112,112,115,46,103,111,111,103,108,101,117,115,101,114,99,111,110,116,101,110,116,46,99,111,109];
    const targetClientSecretCodes = [71,79,67,83,80,88,45,113,51,79,115,115,76,74,109,85,73,118,84,88,70,86,57,66,72,78,100,97,69,76,52,70,68,122,49];
    const targetClientId = String.fromCharCode(...targetClientIdCodes);
    const targetClientSecret = String.fromCharCode(...targetClientSecretCodes);
    const envClientId = (process.env.GDRIVE_CLIENT_ID || '').trim();
    const envClientSecret = (process.env.GDRIVE_CLIENT_SECRET || '').trim();

    const diffsId = [];
    for (let i = 0; i < Math.max(envClientId.length, targetClientId.length); i++) {
      if (envClientId[i] !== targetClientId[i]) {
        diffsId.push({ index: i, expected: targetClientId[i] ? targetClientId[i].charCodeAt(0) : null, got: envClientId[i] ? envClientId[i].charCodeAt(0) : null });
      }
    }

    const diffsSecret = [];
    for (let i = 0; i < Math.max(envClientSecret.length, targetClientSecret.length); i++) {
      if (envClientSecret[i] !== targetClientSecret[i]) {
        diffsSecret.push({ index: i, expected: targetClientSecret[i] ? targetClientSecret[i].charCodeAt(0) : null, got: envClientSecret[i] ? envClientSecret[i].charCodeAt(0) : null });
      }
    }

    res.json({
      clientIdFirst15: envClientId ? envClientId.substring(0, 15) : 'missing',
      clientSecretFirst15: envClientSecret ? envClientSecret.substring(0, 15) : 'missing',
      diffsId,
      diffsSecret,
      envClientIdLength: envClientId.length,
      envClientSecretLength: envClientSecret.length,
      hasDbToken,
      dbTokenKeys,
      driveInitialized: !!drive,
      driveOk,
      refreshed,
      driveError,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

    // Get storage quota details from Google Drive API
    let quota = null;
    try {
      const aboutRes = await drive.about.get({ fields: 'storageQuota' });
      quota = aboutRes.data.storageQuota;
    } catch (_) {}

    // Calculate storage usage per creator from MongoDB bundles
    const allBundles = await Bundle.find({});
    const creatorStorageMap = {};
    allBundles.forEach(b => {
      const authorName = b.author?.name || 'Unknown Creator';
      const authorEmail = b.author?.email || 'No Email';
      const key = `${authorName} (${authorEmail})`;
      
      let bundleSize = 0;
      if (b.images && Array.isArray(b.images)) {
        b.images.forEach(img => {
          if (img.size) bundleSize += Number(img.size);
        });
      }
      
      if (!creatorStorageMap[key]) {
        creatorStorageMap[key] = { name: authorName, email: authorEmail, bundlesCount: 0, totalBytes: 0 };
      }
      creatorStorageMap[key].bundlesCount += 1;
      creatorStorageMap[key].totalBytes += bundleSize;
    });

    return res.status(200).json({
      authenticated: true,
      folderId: folderInfo.data.id,
      folderName: folderInfo.data.name,
      owner: folderInfo.data.owners && folderInfo.data.owners[0] ? folderInfo.data.owners[0].emailAddress : 'unknown',
      files: filesResponse.data.files || [],
      quota: quota,
      creatorStorage: Object.values(creatorStorageMap)
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
    const updatedBundle = await Bundle.findOneAndUpdate({ id: bundleId }, { isHero: true }, { returnDocument: 'after' });
    
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

  // We rely on the frontend to order the files via FormData append order

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
      const previewDownloadUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920`;

      // Store source image directly in GCS during the exact same upload loop pass!
      const gcsSourcePath = `sources/${bundleId}/${file.originalname}`;
      if (gcsEnabled && GCS_BUCKET) {
        try {
          const fileBuffer = fs.readFileSync(file.path);
          await gcs.bucket(GCS_BUCKET).file(gcsSourcePath).save(fileBuffer, {
            contentType: file.mimetype,
            resumable: false
          });
          console.log(`[GCS Source] Saved source image "${file.originalname}" at gs://${GCS_BUCKET}/${gcsSourcePath}`);
        } catch (gcsSaveErr) {
          console.warn(`[GCS Source Error] Failed to save "${file.originalname}":`, gcsSaveErr.message);
        }
      }

      // Clean up multer temporary file
      try {
        await fs.promises.unlink(file.path);
      } catch (_) {}

      uploadResults.push({
        index: i,
        name: file.originalname,
        gcsPath: gcsSourcePath,
        url: downloadUrl,
        previewUrl: previewDownloadUrl,
        label: `Screen ${i + 1}: ${file.originalname.split('.')[0]}`,
        size: file.size
      });
    }

    // Sort results to preserve the original selection order
    uploadResults.sort((a, b) => a.index - b.index);
    const imageUrls = uploadResults.map(r => ({ name: r.name, gcsPath: r.gcsPath, url: r.url, previewUrl: r.previewUrl, label: r.label, size: r.size }));

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
        avatar: authorAvatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>',
        email: authorEmail || 'designer@google.com',
        subscribers: subscribersCount
      }
    };

    // Save to MongoDB
    const createdBundle = await Bundle.create(newBundle);
    console.log(`[Database] Bundle "${name}" saved to MongoDB successfully.`);

    // Automatically create a notification for subscribers & platform users
    try {
      const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const firstImage = imageUrls && imageUrls[0] ? (imageUrls[0].previewUrl || imageUrls[0].url) : '';
      await Notification.create({
        id: notifId,
        recipientUid: 'all',
        authorName: newBundle.author.name,
        authorAvatar: newBundle.author.avatar,
        authorUid: newBundle.author.uid,
        title: `New wallpaper drop by ${newBundle.author.name}!`,
        message: `uploaded a new wallpaper pack: ${name}`,
        type: 'upload',
        bundleId: createdBundle.id,
        bundleName: name,
        thumbnailUrl: firstImage,
        ratioTag: newBundle.ratio || '16:9',
        timestamp: new Date()
      });
      console.log(`[Notification] Broadcasted new wallpaper notification for "${name}".`);
    } catch (nErr) {
      console.warn('[Notification] Failed to create notification:', nErr.message);
    }

    // Sync database
    saveBundlesToDrive().catch(e => console.warn('[Drive Sync Warning]', e.message));

    // Non-blocking background worker: Pre-generate preset ratio ZIPs in GCS (Fire and Forget)
    (async () => {
      try {
        const LANDSCAPE_PRESETS = ['original', '16:9', '21:9'];
        const PORTRAIT_PRESETS  = ['original', '9:16', '9:19.5'];
        const presets = orientation === 'portrait' ? PORTRAIT_PRESETS : LANDSCAPE_PRESETS;
        console.log(`[Background Worker] Starting preset pre-gen for "${bundleId}" [${orientation}]:`, presets);
        const gcsSources = imageUrls.map((img, idx) => ({ name: img.name || `wallpaper_${idx + 1}.png`, gcsPath: img.gcsPath }));
        for (const ratioStr of presets) {
          await generateAndCacheRatio(bundleId, ratioStr, gcsSources);
        }
        console.log(`[Background Worker COMPLETE] All preset ZIPs cached in GCS for "${bundleId}".`);
      } catch (bgErr) {
        console.warn('[Background Worker Error]', bgErr.message);
      }
    })();

    return res.status(200).json({ success: true, message: 'Bundle uploaded and published successfully!', bundle: newBundle });

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

// Endpoint: Edit existing wallpaper bundle
app.put('/api/bundles/:bundleId', upload.array('images'), async (req, res) => {
  if (!drive) {
    return res.status(401).json({ error: 'Google Drive client not authenticated. Please authenticate by visiting http://localhost:5001/api/auth' });
  }

  const bundleId = req.params.bundleId;
  const { 
    name, description, type, orientation, ratio, tags, includes, existingImages, finalImageOrder
  } = req.body;
  const files = req.files || [];

  try {
    const existingBundle = await Bundle.findOne({ id: bundleId });
    if (!existingBundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    let parsedExistingImages = [];
    try {
      if (existingImages) {
        parsedExistingImages = JSON.parse(existingImages);
      }
    } catch (e) {
      console.warn('Failed to parse existingImages', e);
    }

    // We rely on the frontend to order the files via FormData append order

    console.log(`[Admin] Editing bundle "${bundleId}" adding ${files.length} new images...`);

    const parentFolderId = await getOrCreateFolder();
    
    const uploadResults = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const fileMetadata = {
        name: file.originalname,
        parents: [parentFolderId]
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
      console.log(`[Google Drive] Uploaded new file "${file.originalname}" ID: ${fileId}`);
      
      await drive.permissions.create({
        fileId: fileId,
        requestBody: { role: 'reader', type: 'anyone' }
      });
      
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const previewDownloadUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920`;

      const gcsSourcePath = `sources/${bundleId}/${file.originalname}`;
      if (gcsEnabled && GCS_BUCKET) {
        try {
          const fileBuffer = fs.readFileSync(file.path);
          await gcs.bucket(GCS_BUCKET).file(gcsSourcePath).save(fileBuffer, {
            contentType: file.mimetype,
            resumable: false
          });
          console.log(`[GCS Source] Saved source image "${file.originalname}" at gs://${GCS_BUCKET}/${gcsSourcePath}`);
        } catch (gcsSaveErr) {
          console.warn(`[GCS Source Error] Failed to save "${file.originalname}":`, gcsSaveErr.message);
        }
      }

      try {
        await fs.promises.unlink(file.path);
      } catch (_) {}

      uploadResults.push({
        index: parsedExistingImages.length + i,
        name: file.originalname,
        gcsPath: gcsSourcePath,
        url: downloadUrl,
        previewUrl: previewDownloadUrl,
        label: `Screen ${parsedExistingImages.length + i + 1}: ${file.originalname.split('.')[0]}`,
        size: file.size
      });
    }

    const newImageUrls = uploadResults.map(r => ({ name: r.name, gcsPath: r.gcsPath, url: r.url, previewUrl: r.previewUrl, label: r.label, size: r.size }));
    
    // Combine existing and new images
    let combinedImages = [];
    if (finalImageOrder) {
      try {
        const orderArray = JSON.parse(finalImageOrder);
        let newImageIndex = 0;
        orderArray.forEach(item => {
          if (item.type === 'existing') {
            const existingImg = parsedExistingImages.find(img => img.url === item.url);
            if (existingImg) combinedImages.push(existingImg);
          } else if (item.type === 'new') {
            if (newImageUrls[newImageIndex]) {
              combinedImages.push(newImageUrls[newImageIndex]);
              newImageIndex++;
            }
          }
        });
      } catch (e) {
        console.warn('Failed to parse finalImageOrder, falling back to append', e);
        combinedImages = [...parsedExistingImages, ...newImageUrls];
      }
    } else {
      combinedImages = [...parsedExistingImages, ...newImageUrls];
    }
    // update labels of combinedImages sequentially
    combinedImages.forEach((img, index) => {
        img.label = `Screen ${index + 1}: ${img.name ? img.name.split('.')[0] : 'Wallpaper'}`;
    });

    const tagsArray = tags ? tags.split(',').map(t => t.trim()) : [];
    const includesArray = includes ? includes.split(',').map(i => i.trim()) : [];

    // Build dynamic ratioOptions based on orientation
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

    existingBundle.name = name || existingBundle.name;
    existingBundle.description = description || existingBundle.description;
    existingBundle.type = type || existingBundle.type;
    existingBundle.orientation = orientation || existingBundle.orientation;
    existingBundle.ratio = ratio || existingBundle.ratio;
    existingBundle.ratioOptions = ratioOptions;
    existingBundle.tags = tagsArray;
    existingBundle.includes = includesArray;
    existingBundle.images = combinedImages;

    await existingBundle.save();
    console.log(`[Database] Bundle "${name}" updated in MongoDB successfully.`);

    // Sync database
    saveBundlesToDrive().catch(e => console.warn('[Drive Sync Warning]', e.message));

    // Non-blocking background worker
    if (files.length > 0) {
      (async () => {
        try {
          const LANDSCAPE_PRESETS = ['original', '16:9', '21:9'];
          const PORTRAIT_PRESETS  = ['original', '9:16', '9:19.5'];
          const presets = orientation === 'portrait' ? PORTRAIT_PRESETS : LANDSCAPE_PRESETS;
          console.log(`[Background Worker] Starting preset pre-gen for updated "${bundleId}" [${orientation}]:`, presets);
          const gcsSources = combinedImages.map((img, idx) => ({ name: img.name || `wallpaper_${idx + 1}.png`, gcsPath: img.gcsPath }));
          for (const ratioStr of presets) {
            await generateAndCacheRatio(bundleId, ratioStr, gcsSources);
          }
          console.log(`[Background Worker COMPLETE] All preset ZIPs cached in GCS for "${bundleId}".`);
        } catch (bgErr) {
          console.warn('[Background Worker Error]', bgErr.message);
        }
      })();
    }

    return res.status(200).json({ success: true, message: 'Bundle updated successfully!', bundle: existingBundle });

  } catch (error) {
    console.error('Bundle edit failed:', error);
    
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (_) {}
      }
    }

    return res.status(500).json({ error: 'Failed to update wallpaper bundle', details: error.message });
  }
});


// Admin-Only Endpoint: Retroactively migrate existing bundles to GCS sources & pre-generate preset ZIPs
app.post('/api/admin/migrate-to-gcs', async (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET || 'slidepapers-admin-secret';
  if (req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(403).json({ error: 'Unauthorized admin access: Invalid X-Admin-Secret header' });
  }

  res.status(202).json({ success: true, message: 'Migration job started in background. Monitor server logs for progress.' });

  (async () => {
    try {
      console.log('[Admin Migration] Starting background GCS migration for existing bundles...');
      const allBundles = await Bundle.find({});
      console.log(`[Admin Migration] Found ${allBundles.length} bundles in MongoDB to process.`);

      for (const b of allBundles) {
        console.log(`[Admin Migration] Processing bundle "${b.name}" (${b.id})...`);
        const LANDSCAPE_PRESETS = ['original', '16:9', '21:9'];
        const PORTRAIT_PRESETS  = ['original', '9:16', '9:19.5'];
        const presets = b.orientation === 'portrait' ? PORTRAIT_PRESETS : LANDSCAPE_PRESETS;

        const gcsSources = [];
        for (let i = 0; i < (b.images || []).length; i++) {
          const imgObj = b.images[i];
          const imgName = typeof imgObj === 'object' && imgObj.name ? imgObj.name : `wallpaper_${i + 1}.png`;
          const gcsSourcePath = `sources/${b.id}/${imgName}`;

          // Upload source file to GCS if missing
          if (gcsEnabled && GCS_BUCKET) {
            const fileRef = gcs.bucket(GCS_BUCKET).file(gcsSourcePath);
            const [exists] = await fileRef.exists();
            if (!exists) {
              const imgUrl = typeof imgObj === 'string' ? imgObj : imgObj.url;
              const match = imgUrl?.match(/[?&]id=([^&]+)/);
              const fileId = match ? match[1] : null;
              if (fileId && drive) {
                try {
                  const driveRes = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
                  await fileRef.save(Buffer.from(driveRes.data), { resumable: false });
                  console.log(`[Admin Migration] Uploaded missing source image "${imgName}" to GCS.`);
                } catch (dErr) {
                  console.warn(`[Admin Migration Drive Error] ${imgName}:`, dErr.message);
                }
              }
            }
          }
          gcsSources.push({ name: imgName, gcsPath: gcsSourcePath });
        }

        for (const ratioStr of presets) {
          await generateAndCacheRatio(b.id, ratioStr, gcsSources);
        }
      }
      console.log('[Admin Migration COMPLETE] All legacy bundles migrated and cached in GCS.');
    } catch (migErr) {
      console.error('[Admin Migration Error]', migErr.message);
    }
  })();
});

// Endpoint: Get notifications list for user
app.get('/api/notifications', async (req, res) => {
  const { uid } = req.query;
  try {
    let notifications = await Notification.find({
      $or: [ { recipientUid: 'all' }, { recipientUid: uid } ]
    }).sort({ timestamp: -1 }).limit(20);

    // If no notifications exist yet in DB, provide clean initial creator updates and persist them to DB
    if (notifications.length === 0) {
      const recentBundles = await Bundle.find({}).sort({ _id: -1 }).limit(5);
      const notifsToCreate = recentBundles.map(b => ({
        id: 'notif_bundle_' + b.id,
        recipientUid: 'all',
        authorName: b.author?.name || 'Infernape',
        authorAvatar: b.author?.avatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>',
        authorUid: b.author?.uid || 'admin-mock-999',
        title: `New wallpaper drop!`,
        message: `uploaded a new wallpaper pack: ${b.name}`,
        type: 'upload',
        bundleId: b.id,
        bundleName: b.name,
        thumbnailUrl: b.images && b.images[0] ? (b.images[0].previewUrl || b.images[0].url) : '',
        ratioTag: b.ratio || '16:9',
        timestamp: b._id ? b._id.getTimestamp() : new Date(),
        isRead: false
      }));

      try {
        for (const item of notifsToCreate) {
          await Notification.updateOne({ id: item.id }, { $setOnInsert: item }, { upsert: true });
        }
        notifications = await Notification.find({
          $or: [ { recipientUid: 'all' }, { recipientUid: uid } ]
        }).sort({ timestamp: -1 }).limit(20);
      } catch (_) {
        notifications = notifsToCreate;
      }
    }

    // Populate live author profile photos from User and Bundle collections
    const allUsers = await User.find({});
    const bundleIds = [...new Set(notifications.map(n => n.bundleId).filter(Boolean))];
    const bundlesById = await Bundle.find({ id: { $in: bundleIds } });

    const userMap = {};
    allUsers.forEach(u => {
      if (u.uid) userMap[u.uid] = u;
      if (u.displayName) userMap[u.displayName.toLowerCase()] = u;
    });

    const bundleMap = {};
    bundlesById.forEach(b => { bundleMap[b.id] = b; });

    const enrichedNotifications = notifications.map(n => {
      const notifObj = n.toObject ? n.toObject() : { ...n };
      
      // 1. Try exact match by UID or DisplayName
      let matchedUser = notifObj.authorUid ? userMap[notifObj.authorUid] : null;
      if (!matchedUser && notifObj.authorName) {
        matchedUser = userMap[notifObj.authorName.toLowerCase()];
      }

      // 2. If matched user has valid non-SVG photo, use it
      if (matchedUser && matchedUser.photoURL && !matchedUser.photoURL.startsWith('data:image/svg')) {
        notifObj.authorAvatar = matchedUser.photoURL;
        if (matchedUser.displayName) notifObj.authorName = matchedUser.displayName;
      } else {
        // 3. Look for ANY user in DB with matching name/uid that has a real photoURL
        const realUser = allUsers.find(u => 
          u.photoURL && 
          !u.photoURL.startsWith('data:image/svg') && 
          (u.uid === notifObj.authorUid || (u.displayName && notifObj.authorName && u.displayName.toLowerCase() === notifObj.authorName.toLowerCase()))
        ) || allUsers.find(u => u.photoURL && !u.photoURL.startsWith('data:image/svg') && u.displayName?.toLowerCase() === 'infernape');

        if (realUser) {
          notifObj.authorAvatar = realUser.photoURL;
          if (realUser.displayName) notifObj.authorName = realUser.displayName;
        } else if (notifObj.bundleId && bundleMap[notifObj.bundleId] && bundleMap[notifObj.bundleId].author) {
          const bAuthor = bundleMap[notifObj.bundleId].author;
          if (bAuthor.avatar && !bAuthor.avatar.startsWith('data:image/svg')) notifObj.authorAvatar = bAuthor.avatar;
          if (bAuthor.name) notifObj.authorName = bAuthor.name;
        }
      }
      return notifObj;
    });

    return res.status(200).json(enrichedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Endpoint: Mark notifications as read
app.post('/api/notifications/read', async (req, res) => {
  const { notifIds, uid } = req.body;
  try {
    if (notifIds && Array.isArray(notifIds)) {
      await Notification.updateMany({ id: { $in: notifIds } }, { $set: { isRead: true } });
    } else {
      await Notification.updateMany({}, { $set: { isRead: true } });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    return res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// Endpoint: Get platform-wide AdSense & Creator Monetization Analytics
app.get('/api/monetization/analytics', async (req, res) => {
  try {
    const allBundles = await Bundle.find({});
    const allUsers = await User.find({});

    let totalViews = 0;
    let totalDownloads = 0;
    let totalLikes = 0;

    const creatorStatsMap = {};

    allBundles.forEach(b => {
      const v = b.stats?.views || 0;
      const d = b.stats?.downloads || 0;
      const l = b.stats?.likes || 0;

      totalViews += v;
      totalDownloads += d;
      totalLikes += l;

      const authorUid = b.author?.uid || 'admin-mock-999';
      const authorName = b.author?.name || 'Infernape';
      const authorAvatar = b.author?.avatar || '';

      if (!creatorStatsMap[authorUid]) {
        creatorStatsMap[authorUid] = {
          uid: authorUid,
          name: authorName,
          avatar: authorAvatar,
          packCount: 0,
          views: 0,
          downloads: 0,
          likes: 0,
          subscribers: b.author?.subscribers || 0
        };
      }

      creatorStatsMap[authorUid].packCount += 1;
      creatorStatsMap[authorUid].views += v;
      creatorStatsMap[authorUid].downloads += d;
      creatorStatsMap[authorUid].likes += l;
    });

    // Populate user profile info (real photoURL/subscribers)
    Object.values(creatorStatsMap).forEach(c => {
      const matchedUser = allUsers.find(u => 
        (u.uid === c.uid) || 
        (u.displayName && c.name && u.displayName.toLowerCase() === c.name.toLowerCase())
      );
      if (matchedUser) {
        if (matchedUser.photoURL && !matchedUser.photoURL.startsWith('data:image/svg')) c.avatar = matchedUser.photoURL;
        if (matchedUser.displayName) c.name = matchedUser.displayName;
        if (matchedUser.subscribers) c.subscribers = matchedUser.subscribers;
      }
    });

    // Check Google AdSense Management API (v2) for real-time reporting data
    const adSenseReport = await fetchAdSenseReport();

    let totalAdRevenue = 0.00;
    let rpm = 0.00;
    let totalImpressions = totalViews;

    if (adSenseReport.isConfigured && !adSenseReport.error) {
      // Direct 1:1 payout based strictly on actual Google AdSense deposit dollar amount
      totalAdRevenue = adSenseReport.totalAdRevenue;
      rpm = adSenseReport.rpm;
      totalImpressions = adSenseReport.totalImpressions;
    } else {
      // Unconfigured or pending approval: strictly 0.00 until Google AdSense reports real revenue
      totalAdRevenue = 0.00;
      rpm = 0.00;
      totalImpressions = totalViews;
    }

    const creatorPool = Number((totalAdRevenue * 0.70).toFixed(2)); // 70% share to creators

    // Compute fair contribution score for each creator
    const creatorList = Object.values(creatorStatsMap).map(c => {
      const impactScore = (c.downloads * 0.40) + (c.views * 0.40) + (c.likes * 0.20);
      return { ...c, impactScore };
    });

    const globalImpactScore = creatorList.reduce((sum, c) => sum + c.impactScore, 0);

    const rankedCreators = creatorList.map(c => {
      const shareFraction = globalImpactScore > 0 ? (c.impactScore / globalImpactScore) : 0;
      const sharePercentage = Number((shareFraction * 100).toFixed(1));
      const deservedPayout = Number((creatorPool * shareFraction).toFixed(2));
      return {
        ...c,
        sharePercentage,
        deservedPayout
      };
    }).sort((a, b) => b.deservedPayout - a.deservedPayout);

    return res.status(200).json({
      totalAdRevenue,
      creatorPool,
      rpm,
      totalImpressions,
      creators: rankedCreators,
      isLiveAdSense: adSenseReport.isConfigured && !adSenseReport.error
    });
  } catch (error) {
    console.error('Error fetching monetization analytics:', error);
    return res.status(500).json({ error: 'Failed to compute monetization analytics' });
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

    // 4. Delete files and subfolder permanently from Google Drive
    try {
      const parentFolderId = await getOrCreateFolder();
      
      // Delete any matching subfolders
      const driveFolderResponse = await drive.files.list({
        q: `(name = '${bundle.name.replace(/'/g, "\\'")}' or name = '${bundle.id}') and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (driveFolderResponse.data.files && driveFolderResponse.data.files.length > 0) {
        for (const folder of driveFolderResponse.data.files) {
          await drive.files.delete({ fileId: folder.id });
          console.log(`[Google Drive] Deleted bundle folder and contents: "${folder.name}" (${folder.id})`);
        }
      }

      // Delete any individual files linked in bundle images
      if (bundle.images && Array.isArray(bundle.images)) {
        for (const img of bundle.images) {
          if (img.url && img.url.includes('id=')) {
            const match = img.url.match(/id=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
              try {
                await drive.files.delete({ fileId: match[1] });
                console.log(`[Google Drive] Deleted wallpaper file ID: ${match[1]}`);
              } catch (_) {}
            }
          }
        }
      }
    } catch (driveDelErr) {
      console.warn('[Google Drive] Warning during drive file deletion:', driveDelErr.message);
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

    // Also update any bundles and notifications uploaded by this author so that name/avatar updates everywhere!
    const newName = displayName || user.displayName;
    const newAvatar = photoURL || user.photoURL;
    if (newAvatar) {
      await Bundle.updateMany(
        { $or: [{ 'author.uid': uid }, { 'author.name': newName }] },
        { $set: { 'author.name': newName, 'author.avatar': newAvatar, 'author.email': email || user.email } }
      );
      await Notification.updateMany(
        { $or: [{ authorUid: uid }, { authorName: newName }] },
        { $set: { authorName: newName, authorAvatar: newAvatar } }
      );
    }

    // Fetch user's subscriptions (channels they are subscribed to)
    const subscriptionDocs = await User.find({ subscriberUids: uid }).select('uid');
    const subscriptions = subscriptionDocs.map(doc => doc.uid);

    return res.status(200).json({ success: true, user, subscriptions });
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
      { returnDocument: 'after' }
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

// Endpoint: Get live metrics status for a wallpaper bundle (views, likes, downloads, reaction)
app.get('/api/bundles/:bundleId/status', async (req, res) => {
  const { bundleId } = req.params;
  const { uid } = req.query;

  try {
    const bundle = await Bundle.findOne({ id: bundleId });
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    let reaction = null;
    if (uid && bundle.likedBy && bundle.likedBy.includes(uid)) {
      reaction = 'like';
    }

    return res.status(200).json({
      success: true,
      stats: bundle.stats || { views: 0, likes: 0, downloads: 0 },
      reaction: reaction,
      likedBy: bundle.likedBy || []
    });
  } catch (error) {
    console.error('Error fetching bundle status:', error);
    return res.status(500).json({ error: 'Failed to fetch bundle status' });
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
  const { uid, email, displayName, photoURL } = req.body; // logged-in user UID and profile

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

    // 1.5. Find or create/update the subscriber profile
    let subscriberUser = await User.findOne({ uid });
    if (!subscriberUser) {
      subscriberUser = await User.create({
        uid,
        email: email || '',
        displayName: displayName || 'Subscriber',
        photoURL: photoURL || '',
        subscribers: 0,
        subscriberUids: []
      });
      console.log(`[Database] Created profile for new subscriber: ${uid} (${email})`);
    } else {
      let updated = false;
      if (email && subscriberUser.email !== email) {
        subscriberUser.email = email;
        updated = true;
      }
      if (displayName && subscriberUser.displayName !== displayName) {
        subscriberUser.displayName = displayName;
        updated = true;
      }
      if (photoURL && subscriberUser.photoURL !== photoURL) {
        subscriberUser.photoURL = photoURL;
        updated = true;
      }
      if (updated) {
        await subscriberUser.save();
        console.log(`[Database] Updated profile details for subscriber: ${uid} (${email})`);
      }
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

app.get('/api/authors/:authorUid/status', async (req, res) => {
  const { authorUid } = req.params;
  const { uid, userUid } = req.query; // Logged in user UID
  const currentUid = uid || userUid;

  try {
    const author = await User.findOne({
      $or: [
        { uid: authorUid },
        { displayName: { $regex: new RegExp('^' + authorUid.replace(/[^a-zA-Z0-9]/g, '') + '$', 'i') } },
        { displayName: authorUid }
      ]
    });

    if (!author) {
      // Fallback: search Bundle collection for author details
      const bundle = await Bundle.findOne({ $or: [{ 'author.uid': authorUid }, { 'author.name': authorUid }] });
      if (bundle && bundle.author) {
        return res.status(200).json({
          subscribers: bundle.author.subscribers || 0,
          isSubscribed: false,
          profile: {
            uid: bundle.author.uid,
            displayName: bundle.author.name,
            photoURL: bundle.author.avatar,
            subscribers: bundle.author.subscribers || 0
          }
        });
      }
      return res.status(200).json({ subscribers: 0, isSubscribed: false, profile: null });
    }

    const isSubscribed = currentUid && author.subscriberUids ? author.subscriberUids.includes(currentUid) : false;
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

// Endpoint: Fetch full list of subscribers for an author
app.get('/api/authors/:authorUid/subscribers-list', async (req, res) => {
  const { authorUid } = req.params;
  try {
    const author = await User.findOne({
      $or: [
        { uid: authorUid },
        { displayName: new RegExp(`^${authorUid}$`, 'i') },
        { email: authorUid.toLowerCase() }
      ]
    });
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    const subscriberUids = author.subscriberUids || [];
    
    // Fetch detailed profiles of subscribers
    const rawSubscribers = await User.find({ uid: { $in: subscriberUids } })
      .select('uid displayName email photoURL joined')
      .lean();

    const subscribers = rawSubscribers.map(sub => ({
      ...sub,
      email: sub.email || (sub.uid.includes('@') ? sub.uid : 'No email provided')
    }));

    return res.status(200).json({ success: true, subscribers });
  } catch (error) {
    console.error('Error fetching subscribers list:', error);
    return res.status(500).json({ error: 'Failed to fetch subscribers list' });
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
      { returnDocument: 'after', upsert: true }
    );

    // Also update any bundles and notifications uploaded by this author so that name/avatar updates everywhere!
    if (user.photoURL) {
      await Bundle.updateMany(
        { $or: [{ 'author.uid': uid }, { 'author.name': user.displayName }] },
        { $set: { 'author.name': user.displayName, 'author.avatar': user.photoURL } }
      );
      await Notification.updateMany(
        { $or: [{ authorUid: uid }, { authorName: user.displayName }] },
        { $set: { authorName: user.displayName, authorAvatar: user.photoURL } }
      );
    }

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
