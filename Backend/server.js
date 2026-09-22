require("dotenv").config();
const materialRoutes = require("./routes/materials");
const riskRoutes = require("./routes/risks");
const cors = require("cors");
const newsRoutes = require("./routes/newsRoutes");

const express = require("express");
const mongoose = require("mongoose")

const app = express();
app.use(cors());

app.use(express.json());

app.use("/api/news", newsRoutes);
app.use("/api/risks", riskRoutes);
app.use("/api/materials", materialRoutes);

app.get("/", (req, res) => {
  res.send("NAO Backend Running");
});

mongoose 
  .connect(process.env.MONGO_URI)
  .then (() => {
    app.listen(process.env.PORT, () => {
        console.log("Connected to MongoDB")
        console.log(`Server running on port ${process.env.PORT}`)
    })
  })

  .catch((error) => {
    console.log(error)
  })