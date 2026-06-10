import multer from "multer";
import path   from "path";
import fs     from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve to <project-root>/uploads/complaint-photos/
const UPLOAD_DIR = path.join(__dirname, "../../../uploads/complaint-photos");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const userId = req.user?.user_id ?? "unknown";
    const ext    = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `complaint-${userId}-${Date.now()}${ext}`);
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

export const uploadComplaintPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max
}).single("photo");

export const COMPLAINT_UPLOAD_BASE_URL = "/uploads/complaint-photos";
