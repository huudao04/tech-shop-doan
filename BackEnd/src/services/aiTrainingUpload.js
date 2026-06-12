import multer from 'multer';
import path from 'path';
import fs from 'fs';

const aiTrainingUploadDir = path.join(process.cwd(), 'uploads', 'ai-training');

if (!fs.existsSync(aiTrainingUploadDir)) {
  fs.mkdirSync(aiTrainingUploadDir, { recursive: true });
}

const aiTrainingUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, aiTrainingUploadDir),
    filename: (_req, file, callback) => {
      const safeBaseName = path.basename(file.originalname).replace(/[^\w.\-]+/g, '_');
      callback(null, `${Date.now()}-${safeBaseName}`);
    }
  })
});

export default aiTrainingUpload;
