import mongoose from 'mongoose';
import { google } from 'googleapis';
import fs from 'fs';

const MONGODB_URI = 'mongodb+srv://infernapeshashank_db_user:IVK8EIIPKEbOyj7A@cluster0.u5jyhsk.mongodb.net/slidepapers?retryWrites=true&w=majority&appName=Cluster0';
const CREDENTIALS_PATH = './oauth_credentials.json';

const bundleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  images: Array,
});
const Bundle = mongoose.model('Bundle', bundleSchema);

const credentialSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});
const Credential = mongoose.model('Credential', credentialSchema);

async function testDownload() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    const tokenObj = await Credential.findOne({ key: 'gdrive_tokens' });
    if (!tokenObj) {
      console.log('No tokens in MongoDB.');
      return;
    }

    const tokens = JSON.parse(tokenObj.value);
    console.log('Loaded tokens from DB. Expiry:', new Date(tokens.expiry_date).toISOString());

    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.log('oauth_credentials.json missing.');
      return;
    }

    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const { client_id, client_secret, redirect_uris } = creds.web;

    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Fetch Boxer bundle to get image list
    const bundle = await Bundle.findOne({ id: 'boxer' });
    if (!bundle) {
      console.log('Boxer bundle not found in database.');
      return;
    }

    const imagesToProcess = bundle.images || [];
    console.log(`Loaded Boxer bundle. Total images: ${imagesToProcess.length}`);

    for (let i = 0; i < Math.min(2, imagesToProcess.length); i++) {
      const imgObj = imagesToProcess[i];
      const imgUrl = typeof imgObj === 'string' ? imgObj : (imgObj?.url || imgObj?.previewUrl || '');
      const match = imgUrl?.match(/[?&]id=([^&]+)/);
      const fileId = match ? match[1] : null;

      console.log(`Image ${i + 1}: fileId = ${fileId}`);
      if (fileId) {
        try {
          const driveRes = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
          );
          if (driveRes?.data) {
            const buf = Buffer.from(driveRes.data);
            console.log(`Successfully downloaded. Buffer length: ${buf.length} bytes`);
          } else {
            console.log('Download succeeded but response has no data.');
          }
        } catch (dErr) {
          console.error(`Download failed for file ${fileId}:`, dErr.message);
        }
      }
    }
  } catch (err) {
    console.error('DOWNLOAD TEST CRITICAL FAILURE:', err);
  } finally {
    await mongoose.disconnect();
  }
}

testDownload();
