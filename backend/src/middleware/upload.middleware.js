import multer from "multer";
import path   from "path";
import fs     from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve to <project-root>/uploads/vehicle-photos/
const UPLOAD_DIR = path.join(__dirname, "../../../uploads/vehicle-photos");

// Create directory if it doesn't exist at startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const vehicleId = req.params.id ?? "unknown";
    const slot      = req.body.slot  ?? "photo";
    const ext       = path.extname(file.originalname).toLowerCase() || ".jpg";
    const name      = `vehicle-${vehicleId}-${slot}-${Date.now()}${ext}`;
    cb(null, name);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = /^image\/(jpeg|png|webp|gif)$/;
  if (allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP and GIF images are allowed"), false);
  }
}

export const uploadPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max
}).single("photo");

// The public base URL for uploaded photos (adjust for production CDN/Azure Blob)
export const UPLOAD_BASE_URL = "/uploads/vehicle-photos";
export const UPLOAD_ABS_DIR  = UPLOAD_DIR;
