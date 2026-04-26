import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Routes
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import driversRoutes from "./routes/drivers.routes.js";
import vehiclesRoutes from "./routes/vehicles.routes.js";
import tripsRoutes from "./routes/trips.routes.js";
import gpsRoutes from "./routes/gps.routes.js";
import ticketsRoutes from "./routes/tickets.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import routesRoutes from "./routes/routes.routes.js";
import stopsRoutes from "./routes/stops.routes.js";
import passengerCountRoutes from "./routes/passengerCount.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import ratingsRoutes from "./routes/ratings.routes.js";
import busesRoutes from "./routes/buses.routes.js";
import driverAppRoutes from "./routes/driverApp.routes.js";
import walletRoutes     from "./routes/wallet.routes.js";
import staffWalletRoutes from "./routes/staffWallet.routes.js";
import bookingsRoutes   from "./routes/bookings.routes.js";
import cameraRoutes     from "./routes/camera.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/drivers", driversRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/trips", tripsRoutes);
app.use("/api/gps", gpsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/routes", routesRoutes);
app.use("/api/stops", stopsRoutes);
app.use("/api/passenger-count", passengerCountRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/ratings", ratingsRoutes);
app.use("/api/buses", busesRoutes);
app.use("/api/driver", driverAppRoutes);
app.use("/api/wallet",        walletRoutes);
app.use("/api/staff/wallet",  staffWalletRoutes);
app.use("/api/bookings",      bookingsRoutes);
app.use("/api/camera",        cameraRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("🚍 Smart Transportation API running...");
});

export default app;
