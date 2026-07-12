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

async function testRefresh() {
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

    console.log('Attempting to force token refresh...');
    const refreshResponse = await oauth2Client.getAccessToken();
    console.log('Refresh successful! New access token retrieved.');
    console.log('New token keys:', Object.keys(oauth2Client.credentials));
    if (oauth2Client.credentials.expiry_date) {
      console.log('New Expiry:', new Date(oauth2Client.credentials.expiry_date).toISOString());
    }
  } catch (err) {
    console.error('REFRESH FAILED:', err);
  } finally {
    await mongoose.disconnect();
  }
}

testRefresh();
