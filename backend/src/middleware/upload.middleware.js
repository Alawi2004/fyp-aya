import multer from "multer";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import dotenv from "dotenv";
dotenv.config();

const account   = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_VEHICLE_CONTAINER || "vehicle-photos";

const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);
export const blobServiceClient = new BlobServiceClient(
  `https://${account}.blob.core.windows.net`,
  sharedKeyCredential
);
export const vehicleContainer = blobServiceClient.getContainerClient(containerName);

// Ensure container exists (public read access for images)
vehicleContainer.createIfNotExists({ access: "blob" }).catch(() => {});

// Use memory storage — we stream the buffer to Azure ourselves
export const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  fileFilter(_req, file, cb) {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP and GIF images are allowed"), false);
  },
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
}).single("photo");

// Public URL base (kept for backward compat — not used for new uploads)
export const UPLOAD_BASE_URL = `https://${account}.blob.core.windows.net/${containerName}`;
// UPLOAD_ABS_DIR kept as empty string so old imports don't crash
export const UPLOAD_ABS_DIR  = "";
