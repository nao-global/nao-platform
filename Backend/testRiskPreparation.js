require("dotenv").config();

const mongoose = require("mongoose");

const { analyzeNews } = require("./services/aiService");
const Material = require("./models/Material");

const testArticle = {
  title: "Nickel Mining Disruption",
  description:
    "Mining operations in Indonesia have been disrupted, potentially affecting global nickel supply.",
  content:
    "The disruption could reduce nickel availability and increase costs for battery manufacturers and electric vehicle companies.",
};

const prepareRisk = async () => {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB");

    // 2. Send article to AI
    const aiResult = await analyzeNews(testArticle);

    console.log("\n===== AI RESULT =====");
    console.log(aiResult);

    // 3. Find the material identified by AI
    const material = await Material.findOne({
      name: aiResult.material,
    });

    if (!material) {
      console.log(
        `\nMaterial "${aiResult.material}" was not found in MongoDB.`
      );
      return;
    }

    // 4. Prepare the Risk object
    const risk = {
      materialId: material._id,
      title: aiResult.title,
      severity: aiResult.severity,
      location: aiResult.location,
      description: aiResult.description,
      operationalImpact: aiResult.operationalImpact,
      trend: aiResult.trend,
      industryImpacts: aiResult.industryImpacts,
    };

    // 5. Print the Risk object
    console.log("\n===== PREPARED RISK =====");
    console.log(risk);
    console.log("=========================\n");
  } catch (error) {
    console.error("ERROR:", error);
  } finally {
    await mongoose.disconnect();
  }
};

prepareRisk();