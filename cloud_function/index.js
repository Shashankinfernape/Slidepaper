import { Storage } from '@google-cloud/storage';
import archiver from 'archiver';
import { spawn } from 'child_process';
import { PassThrough } from 'stream';

const storage = new Storage();

/**
 * HTTP Cloud Function for processing wallpaper bundle custom ratios
 * @param {Object} req Cloud Function request context
 * @param {Object} res Cloud Function response context
 */
export async function processBundleRatio(req, res) {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(24).send('');
  }

  const { bundleId, ratioStr, sourceFiles, gcsBucket } = req.body;

  if (!bundleId || !ratioStr || !sourceFiles || !gcsBucket) {
    return res.status(400).json({ error: 'Missing required parameters: bundleId, ratioStr, sourceFiles, gcsBucket' });
  }

  const isOriginal = ratioStr === 'original';
  const ratioKey = ratioStr;
  const destGcsPath = `bundles/${bundleId}_${ratioKey.replace(':', 'x')}.zip`;
  console.log(`[Cloud Function] Processing bundle "${bundleId}" ratio "${ratioKey}" into gs://${gcsBucket}/${destGcsPath}`);

  try {
    const archive = archiver('zip', { store: true });
    const gcsPassThrough = new PassThrough();
    const gcsFile = storage.bucket(gcsBucket).file(destGcsPath);
    const gcsWriteStream = gcsFile.createWriteStream({ resumable: false, contentType: 'application/zip' });

    archive.pipe(gcsPassThrough);

    const gcsUploadPromise = new Promise((resolve, reject) => {
      gcsPassThrough.pipe(gcsWriteStream)
        .on('finish', () => resolve(`gs://${gcsBucket}/${destGcsPath}`))
        .on('error', (err) => reject(err));
    });

    for (let i = 0; i < sourceFiles.length; i++) {
      const srcObj = sourceFiles[i];
      const fileName = srcObj.name || `wallpaper_${i + 1}.png`;
      const gcsSourcePath = srcObj.gcsPath || `sources/${bundleId}/${fileName}`;

      try {
        const fileRef = storage.bucket(gcsBucket).file(gcsSourcePath);
        const [exists] = await fileRef.exists();
        
        if (exists) {
          const inputStream = fileRef.createReadStream();
          let outputStream = inputStream;

          if (!isOriginal) {
            const convertArgs = ['-', '-gravity', 'center', '-crop', ratioStr, '+repage', 'png:-'];
            const proc = spawn('convert', convertArgs);
            inputStream.pipe(proc.stdin);
            proc.stderr.on('data', d => console.warn('[IM stderr]', d.toString().trim()));
            outputStream = proc.stdout;
          }

          await new Promise((resolve) => {
            archive.append(outputStream, { name: fileName });
            outputStream.on('end', resolve);
            outputStream.on('close', resolve);
            outputStream.on('error', (e) => {
              console.warn('[Stream Error]', e.message);
              resolve();
            });
          });
        }
      } catch (fileErr) {
        console.warn(`[Cloud Function File Warning] ${fileName}:`, fileErr.message);
      }
    }

    await archive.finalize();
    const gcsUri = await gcsUploadPromise;

    console.log(`[Cloud Function SUCCESS] Created ${gcsUri}`);
    return res.status(200).json({ success: true, gcsUri });

  } catch (error) {
    console.error('[Cloud Function Error]', error);
    return res.status(500).json({ error: 'Failed to process custom ratio in Cloud Function', details: error.message });
  }
}
