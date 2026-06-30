// Camera (AI) server connection config for the mobile app.
//
// The camera server runs on the same machine as the backend, on port 9000.
// We derive its host from EXPO_PUBLIC_API_URL so you only have to set the
// machine IP in one place — but you can override it explicitly with
// EXPO_PUBLIC_CAMERA_WS_URL (e.g. ws://192.168.1.50:9000).

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

function deriveCameraHost() {
  const m = API_URL.match(/^[a-z]+:\/\/([^/:]+)/i);
  return m ? m[1] : 'localhost';
}

export const CAMERA_WS_URL =
  process.env.EXPO_PUBLIC_CAMERA_WS_URL || `ws://${deriveCameraHost()}:9000`;
