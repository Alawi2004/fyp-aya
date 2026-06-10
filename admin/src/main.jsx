import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";

// Sentry — only active when VITE_SENTRY_DSN is set.
// In dev without a DSN the SDK is a no-op so no account is required.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn:              import.meta.env.VITE_SENTRY_DSN,
    environment:      import.meta.env.MODE,          // "development" | "production"
    tracesSampleRate: 0.2,
    replaysOnErrorSampleRate: 1.0,                   // full replay on every error
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Remove the static loading screen once React has painted
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.__hideLoader?.();
  });
});
