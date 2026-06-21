import multer from "multer";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import dotenv from "dotenv";
dotenv.config();

const account             = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey          = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName       = process.env.AZURE_STORAGE_VEHICLE_CONTAINER || "vehicle-photos";
const profileContainerName = process.env.AZURE_STORAGE_PROFILE_CONTAINER || "profile-photos";

let blobServiceClientInstance  = null;
let vehicleContainerInstance   = null;
let profileContainerInstance   = null;

function getBlobClient() {
  if (!blobServiceClientInstance) {
    if (!account || !accountKey) throw new Error("Azure Storage env vars not set");
    const cred = new StorageSharedKeyCredential(account, accountKey);
    blobServiceClientInstance = new BlobServiceClient(`https://${account}.blob.core.windows.net`, cred);
    vehicleContainerInstance  = blobServiceClientInstance.getContainerClient(containerName);
    vehicleContainerInstance.createIfNotExists({ access: "blob" }).catch(() => {});
    profileContainerInstance  = blobServiceClientInstance.getContainerClient(profileContainerName);
    profileContainerInstance.createIfNotExists({ access: "blob" }).catch(() => {});
  }
  return { blobServiceClient: blobServiceClientInstance, vehicleContainer: vehicleContainerInstance, profileContainer: profileContainerInstance };
}

export const blobServiceClient = new Proxy({}, { get: (_, p) => getBlobClient().blobServiceClient[p] });
export const vehicleContainer  = new Proxy({}, { get: (_, p) => getBlobClient().vehicleContainer[p] });
export const profileContainer  = new Proxy({}, { get: (_, p) => getBlobClient().profileContainer[p] });

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
