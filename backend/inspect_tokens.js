import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://infernapeshashank_db_user:IVK8EIIPKEbOyj7A@cluster0.u5jyhsk.mongodb.net/slidepapers?retryWrites=true&w=majority&appName=Cluster0';

const credentialSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});
const Credential = mongoose.model('Credential', credentialSchema);

async function inspect() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');
    const tokenObj = await Credential.findOne({ key: 'gdrive_tokens' });
    if (!tokenObj) {
      console.log('Credential gdrive_tokens NOT found in MongoDB.');
    } else {
      console.log('Found gdrive_tokens in MongoDB.');
      console.log('Value length:', tokenObj.value.length);
      try {
        const parsed = JSON.parse(tokenObj.value);
        console.log('Parsed token keys:', Object.keys(parsed));
        console.log('Expiry Date:', parsed.expiry_date ? new Date(parsed.expiry_date).toISOString() : 'None');
      } catch (pErr) {
        console.error('Failed to parse token value:', pErr.message);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

inspect();
