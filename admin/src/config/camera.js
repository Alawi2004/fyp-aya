// Camera server connection config — all URLs read from env vars.
// Override in .env.local or .env.production without touching source code.
export const CAMERA_WS_URL   = import.meta.env.VITE_CAMERA_WS_URL   || 'ws://localhost:9000';
export const CAMERA_REST_URL = import.meta.env.VITE_CAMERA_REST_URL  || 'http://localhost:9000';
