
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const materialRoutes = require("./routes/materials");
const riskRoutes = require("./routes/risks");
const newsRoutes = require("./routes/newsRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/news", newsRoutes);
app.use("/api/risks", riskRoutes);
app.use("/api/materials", materialRoutes);

app.get("/", (req, res) => {
  res.send("NAO Backend Running");
});

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from the environment variables.");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start NAO backend:");
    console.error(error);
    process.exit(1);
  }
}

startServer();
