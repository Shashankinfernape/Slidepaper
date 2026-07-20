const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://infernapeshashank_db_user:IVK8EIIPKEbOyj7A@cluster0.u5jyhsk.mongodb.net/slidepapers?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db('slidepapers');
    const bundles = db.collection('bundles');
    const cursor = bundles.find({ name: { $regex: 'blue lock', $options: 'i' } });
    await cursor.forEach(console.log);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
