import * as fs from 'fs';
import * as path from 'path';
import { MongoClient, GridFSBucket, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio';
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'ocr_dataset');

async function exportDataset() {
  console.log('Conectando a MongoDB para exportar dataset OCR...');
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db();
  const bucket = new GridFSBucket(db, { bucketName: 'fs' }); // asume fs natural del files.service.ts

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const ocrLogsCollection = db.collection('ocr_logs');
  
  // Buscar pagos donde la IA se equivocó, el usuario lo arregló
  // O buscar TODOS para tener un dataset equilibrado
  const logs = await ocrLogsCollection.find({}).toArray();
  console.log(`Encontrados ${logs.length} recibos validados.`);

  const metadataStream = fs.createWriteStream(path.join(OUTPUT_DIR, 'metadata.jsonl'));

  let count = 0;
  for (const log of logs) {
    if (!log.comprobanteFileId) continue;
    
    const fileId = log.comprobanteFileId;
    const fileMetadata = await db.collection('fs.files').findOne({ _id: fileId });
    if (!fileMetadata) continue;

    const extension = fileMetadata.filename.split('.').pop() || 'jpg';
    const imageName = `receipt_${fileId.toString()}.${extension}`;
    const imagePath = path.join(OUTPUT_DIR, imageName);

    // Descargar imagen de GridFS
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.pipe(fs.createWriteStream(imagePath));

    // Esperar a que descargue (un poco tosco pero seguro para export scripts)
    await new Promise((resolve, reject) => {
      downloadStream.on('end', resolve);
      downloadStream.on('error', reject);
    });

    // Formatear el JSONL para el formato esperado por Moondream (ejemplo genérico LLM Vision)
    const qaPair = {
      image: imageName,
      text: `<image>\nExtrae la referencia, banco, monto y fecha.\nJSON: ${JSON.stringify(log.datosRealesUsuario)}`
    };

    metadataStream.write(JSON.stringify(qaPair) + '\n');
    count++;
  }

  metadataStream.end();
  console.log(`Exportación completada. ${count} recibos e items metadata guardados en ${OUTPUT_DIR}`);
  await client.close();
}

exportDataset().catch(console.error);
