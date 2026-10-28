require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const materialRoutes = require("./routes/materials");
const riskRoutes = require("./routes/risks");
const newsRoutes = require("./routes/newsRoutes");
const companyExposureRoutes = require("./routes/companyExposureRoutes");

const {
  startNewsScheduler,
} = require("./services/newsScheduler");

const app = express();

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());

// ======================================================
// EXISTING NAO API ROUTES
// ======================================================

app.use("/api/news", newsRoutes);
app.use("/api/risks", riskRoutes);
app.use("/api/materials", materialRoutes);

// ======================================================
// COMPANY EXPOSURE API ROUTES
// ======================================================

app.use("/api/company-exposure", companyExposureRoutes);

// ======================================================
// ROOT ROUTE
// ======================================================

app.get("/", (req, res) => {
  res.send("NAO Backend Running");
});

// ======================================================
// SERVER STARTUP
// ======================================================

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing from the environment variables."
      );
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB");

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);

      // Start the optional news scheduler only after
      // the API is listening for requests.
      startNewsScheduler({
        port: PORT,
      });
    });

    server.on("error", (error) => {
      console.error("NAO server error:", error);
    });
  } catch (error) {
    console.error("Failed to start NAO backend:");
    console.error(error);

    process.exit(1);
  }
}

startServer();