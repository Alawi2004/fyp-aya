import swaggerJsdoc from "swagger-jsdoc";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Yalla Transit API",
      version: "1.0.0",
      description:
        "REST API for Yalla Transit with auth, wallet, trips, bookings, reports, complaints, camera integration, and passenger QR boarding flows.",
    },
    servers: [
      { url: "http://localhost:5000", description: "Local dev" },
      { url: "/api", description: "Relative API base when reverse proxied" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Validation failed" },
          },
        },
        AccessRefreshTokens: {
          type: "object",
          properties: {
            access_token: { type: "string" },
            refresh_token: { type: "string" },
          },
        },
      },
    },
  },
  apis: [join(__dirname, "../routes/*.routes.js")],
};

export const swaggerSpec = swaggerJsdoc(options);
