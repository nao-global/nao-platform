require("dotenv").config();

const { analyzeNews } = require("./services/aiService");

const testArticle = {
  title: "China Tightens Graphite Export Controls",
  description:
    "China announced tighter export controls on graphite used in EV batteries.",
  content:
    "The new restrictions could disrupt global battery manufacturing and increase supply chain risks for companies dependent on graphite from China.",
};

const runTest = async () => {
  try {
    const result = await analyzeNews(testArticle);

    console.log("\n===== AI ANALYSIS =====\n");
    console.log(result);
    console.log("\n=======================\n");
  } catch (error) {
    console.error("AI TEST ERROR:", error);
  }
};

runTest();