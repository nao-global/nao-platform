require("dotenv").config();

const mongoose = require("mongoose");
const Material = require("./models/Material");

const findMaterial = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB");

    const materialName = "Nickel";

    const material = await Material.findOne({
      name: materialName,
    });

    if (!material) {
      console.log("Material not found");
      return;
    }

    console.log("\n===== MATERIAL FOUND =====");
    console.log("Name:", material.name);
    console.log("ID:", material._id);
    console.log("==========================\n");
  } catch (error) {
    console.error("ERROR:", error);
  } finally {
    await mongoose.disconnect();
  }
};

findMaterial();