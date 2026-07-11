import mongoose from 'mongoose';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SERVICE_ACCOUNT_PATH = './slidepapers-backend-edb81d50023e.json';
const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function testUploadFlow() {
  try {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      console.error('Service Account file missing!');
      return;
    }

    // Initialize Auth
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_PATH,
      scopes: SCOPES,
    });

    const drive = google.drive({ version: 'v3', auth });
    console.log('Successfully initialized Drive Client with Service Account key.');

    // 1. Run getOrCreateFolder code
    console.log('Step 1: Listing files to find "Slidpapers Cars"...');
    let response = await drive.files.list({
      q: "name = 'Slidpapers Cars' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    let parentFolderId = null;
    if (response.data.files && response.data.files.length > 0) {
      parentFolderId = response.data.files[0].id;
      console.log(`Found "Slidpapers Cars". ID: ${parentFolderId}`);
    } else {
      console.log('"Slidpapers Cars" folder not found, checking "Slidepapers Bundles"...');
      response = await drive.files.list({
        q: "name = 'Slidepapers Bundles' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id, name)',
        spaces: 'drive',
      });
      if (response.data.files && response.data.files.length > 0) {
        parentFolderId = response.data.files[0].id;
        console.log(`Found "Slidepapers Bundles". ID: ${parentFolderId}`);
      } else {
        console.log('Neither folder found. Attempting to create "Slidepapers Bundles"...');
        const fileMetadata = {
          name: 'Slidepapers Bundles',
          mimeType: 'application/vnd.google-apps.folder',
        };
        const folder = await drive.files.create({
          requestBody: fileMetadata,
          fields: 'id',
        });
        parentFolderId = folder.data.id;
        console.log(`Created new "Slidepapers Bundles" root folder. ID: ${parentFolderId}`);
      }
    }

    // 2. Try creating a subfolder inside it (like the upload route does)
    console.log(`Step 2: Creating a test subfolder inside parent folder (${parentFolderId})...`);
    const subfolderMetadata = {
      name: 'Test Bundle ' + Date.now(),
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId]
    };

    const subfolderResponse = await drive.files.create({
      requestBody: subfolderMetadata,
      fields: 'id'
    });
    console.log(`Successfully created subfolder inside parent folder! Subfolder ID: ${subfolderResponse.data.id}`);

    // Cleanup test subfolder
    console.log('Step 3: Cleaning up test subfolder...');
    await drive.files.delete({
      fileId: subfolderResponse.data.id
    });
    console.log('Cleaned up successfully! The service account has full read/write/delete permissions.');

  } catch (err) {
    console.error('TEST FAILED WITH ERROR:', err);
  }
}

testUploadFlow();
