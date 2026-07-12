import mongoose from 'mongoose';
import { google } from 'googleapis';
import fs from 'fs';

const MONGODB_URI = 'mongodb+srv://infernapeshashank_db_user:IVK8EIIPKEbOyj7A@cluster0.u5jyhsk.mongodb.net/slidepapers?retryWrites=true&w=majority&appName=Cluster0';
const CREDENTIALS_PATH = './oauth_credentials.json';

const credentialSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});
const Credential = mongoose.model('Credential', credentialSchema);

async function testList() {
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

    // Create drive client
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    console.log('Testing drive files list with expired credentials (expecting auto-refresh)...');
    const response = await drive.files.list({
      q: "name = 'Slidpapers Cars' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    console.log('LIST SUCCESSFUL!');
    console.log('Files:', response.data.files);
  } catch (err) {
    console.error('LIST FAILED WITH ERROR:', err);
  } finally {
    await mongoose.disconnect();
  }
}

testList();
