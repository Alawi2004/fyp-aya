import multer from "multer";
import path   from "path";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

// ── Azure Blob client ─────────────────────────────────────────────────────────

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const ACCOUNT_KEY  = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const CONTAINER    = process.env.AZURE_STORAGE_COMPLAINT_CONTAINER || "complaint-photos";

function getBlobClient() {
  if (!ACCOUNT_NAME || !ACCOUNT_KEY) return null;
  const credential = new StorageSharedKeyCredential(ACCOUNT_NAME, ACCOUNT_KEY);
  return new BlobServiceClient(`https://${ACCOUNT_NAME}.blob.core.windows.net`, credential);
}

// ── Multer (memory storage — buffer is uploaded to Azure, never touches disk) ─

function fileFilter(_req, file, cb) {
  const allowed = /^image\/(jpeg|png|webp|gif)$/;
  if (allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP and GIF images are allowed"), false);
  }
}

const _multer = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max
}).single("photo");

// ── Two-step middleware: parse multipart → upload buffer to Azure ─────────────

export const uploadComplaintPhoto = (req, res, next) => {
  _multer(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return next(); // photo is optional

    const blobClient = getBlobClient();
    if (!blobClient) {
      // Azure not configured — skip upload, treat as no photo
      console.warn("[blob] AZURE_STORAGE_ACCOUNT_NAME / KEY not set — photo discarded");
      req.file = null;
      return next();
    }

    try {
      const userId  = req.user?.user_id ?? "unknown";
      const ext     = path.extname(req.file.originalname).toLowerCase() || ".jpg";
      const blobName = `complaint-${userId}-${Date.now()}${ext}`;

      const containerClient = blobClient.getContainerClient(CONTAINER);
      await containerClient.createIfNotExists({ access: "blob" });

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.uploadData(req.file.buffer, {
        blobHTTPHeaders: { blobContentType: req.file.mimetype },
      });

      // Attach full public URL so the controller just reads req.file.azureUrl
      req.file.azureUrl = blockBlobClient.url;
      next();
    } catch (azureErr) {
      console.error("[blob] upload failed:", azureErr.message);
      next(azureErr);
    }
  });
};
