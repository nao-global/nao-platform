
const Risk = require("../models/Risk");
const Material = require("../models/Material");
const mongoose = require("mongoose");

const { analyzeNews } = require("../services/aiService");

const {
  saveRisksFromAnalysis,
} = require("../services/riskService");

const {
  generateRiskRecommendations,
} = require("../services/recommendationService");


// ======================================================
// GET ALL RISKS
// ======================================================

const getRisks = async (req, res) => {
  try {
    const risks = await Risk.find({})
      .populate("materialId")
      .sort({ createdAt: -1 });

    res.status(200).json(risks);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};


// ======================================================
// GET ONE RISK
// ======================================================

const getRisk = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: "Risk not found",
      });
    }

    const risk = await Risk.findById(id)
      .populate("materialId");

    if (!risk) {
      return res.status(404).json({
        error: "Risk not found",
      });
    }

    res.status(200).json(risk);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};


// ======================================================
// SEED RISKS
// ======================================================

// WARNING:
// This development endpoint replaces all existing risks.
// Do not call it on a database containing risks you need
// to keep.

const seedRisks = async (req, res) => {
  try {
    const titanium = await Material.findOne({
      name: "Titanium",
    });

    const nickel = await Material.findOne({
      name: "Nickel",
    });

    const iridium = await Material.findOne({
      name: "Iridium",
    });

    const ruthenium = await Material.findOne({
      name: "Ruthenium",
    });

    if (!titanium || !nickel || !iridium || !ruthenium) {
      return res.status(404).json({
        error: "Please seed materials first.",
      });
    }

    // This deletion is retained from your existing
    // development seed behavior.
    await Risk.deleteMany({});

    const risks = await Risk.insertMany([
      // TITANIUM: Export restrictions
      {
        materialId: titanium._id,
        title: "Export Restrictions",
        severity: "High",
        location: "China",
        description:
          "Potential export restrictions on titanium exports.",
        operationalImpact:
          "Disruptions to aircraft manufacturing and increased procurement costs.",
        trend: "Worsening",
        industryImpacts: [
          {
            industry: "Aerospace",
            impact:
              "Aircraft production delays due to titanium shortages.",
          },
          {
            industry: "Defense",
            impact:
              "Reduced availability of military aircraft components.",
          },
          {
            industry: "Medical",
            impact:
              "Potential shortages of titanium implants.",
          },
        ],
        recommendations: [
          {
            title: "Diversify Suppliers",
            description:
              "Reduce dependence on a single supplier or country.",
            priority: "High",
          },
          {
            title: "Increase Buffer Inventory",
            description:
              "Maintain additional titanium inventory for critical operations.",
            priority: "High",
          },
          {
            title: "Alternative Sourcing",
            description:
              "Identify suppliers from countries with lower geopolitical risk.",
            priority: "Medium",
          },
        ],
      },

      // TITANIUM: Supplier concentration
      {
        materialId: titanium._id,
        title: "Supplier Concentration",
        severity: "Medium",
        location: "Global",
        description:
          "Heavy dependence on a few global suppliers.",
        operationalImpact:
          "Reduced resilience against supply chain disruptions.",
        trend: "Stable",
        industryImpacts: [
          {
            industry: "Aerospace",
            impact: "Limited sourcing flexibility.",
          },
          {
            industry: "Defense",
            impact: "Longer procurement lead times.",
          },
        ],
        recommendations: [
          {
            title: "Develop Secondary Suppliers",
            description:
              "Qualify additional suppliers to reduce dependency.",
            priority: "High",
          },
          {
            title: "Long-Term Contracts",
            description:
              "Secure stable supply agreements with key partners.",
            priority: "Medium",
          },
        ],
      },

      // NICKEL: Mining disruptions
      {
        materialId: nickel._id,
        title: "Mining Disruptions",
        severity: "High",
        location: "Indonesia",
        description:
          "Mining disruptions reducing nickel supply.",
        operationalImpact:
          "Battery manufacturing delays and increased production costs.",
        trend: "Worsening",
        industryImpacts: [
          {
            industry: "Automotive",
            impact: "Electric vehicle battery shortages.",
          },
          {
            industry: "Energy",
            impact: "Delayed energy storage projects.",
          },
        ],
        recommendations: [
          {
            title: "Increase Strategic Stock",
            description:
              "Maintain additional nickel inventory for critical production.",
            priority: "High",
          },
          {
            title: "Supplier Diversification",
            description:
              "Source nickel from multiple mining regions.",
            priority: "High",
          },
        ],
      },

      // NICKEL: Price volatility
      {
        materialId: nickel._id,
        title: "Price Volatility",
        severity: "Medium",
        location: "Global",
        description:
          "Rapid fluctuations in nickel prices.",
        operationalImpact:
          "Higher manufacturing and procurement costs.",
        trend: "Stable",
        industryImpacts: [
          {
            industry: "Automotive",
            impact: "Increased EV production costs.",
          },
          {
            industry: "Manufacturing",
            impact: "Reduced profit margins.",
          },
        ],
        recommendations: [
          {
            title: "Long-Term Purchase Agreements",
            description:
              "Lock in pricing with strategic suppliers.",
            priority: "Medium",
          },
        ],
      },

      // IRIDIUM: Supply shortage
      {
        materialId: iridium._id,
        title: "Supply Shortage",
        severity: "High",
        location: "South Africa",
        description:
          "Limited iridium production worldwide.",
        operationalImpact:
          "Semiconductor manufacturing delays.",
        trend: "Worsening",
        industryImpacts: [
          {
            industry: "Semiconductors",
            impact: "Chip production delays.",
          },
          {
            industry: "Electronics",
            impact: "Component shortages.",
          },
        ],
        recommendations: [
          {
            title: "Prioritize Critical Production",
            description:
              "Allocate iridium to high-value products first.",
            priority: "High",
          },
          {
            title: "Material Substitution",
            description:
              "Evaluate suitable substitute materials where possible.",
            priority: "Medium",
          },
        ],
      },

      // IRIDIUM: Geopolitical instability
      {
        materialId: iridium._id,
        title: "Geopolitical Instability",
        severity: "Medium",
        location: "Africa",
        description:
          "Political instability affecting mining operations.",
        operationalImpact:
          "Supply uncertainty and delayed deliveries.",
        trend: "Worsening",
        industryImpacts: [
          {
            industry: "Electronics",
            impact: "Supply chain instability.",
          },
          {
            industry: "Telecommunications",
            impact: "Equipment production delays.",
          },
        ],
        recommendations: [
          {
            title: "Monitor Geopolitical Events",
            description:
              "Track developments affecting supplier regions.",
            priority: "High",
          },
        ],
      },

      // RUTHENIUM: Price volatility
      {
        materialId: ruthenium._id,
        title: "Price Volatility",
        severity: "Medium",
        location: "Global",
        description:
          "Market volatility affecting ruthenium prices.",
        operationalImpact:
          "Higher semiconductor production costs.",
        trend: "Stable",
        industryImpacts: [
          {
            industry: "Semiconductors",
            impact: "Higher chip production costs.",
          },
          {
            industry: "Technology",
            impact: "Reduced manufacturing margins.",
          },
        ],
        recommendations: [
          {
            title: "Hedge Commodity Prices",
            description:
              "Reduce exposure through financial hedging strategies.",
            priority: "Medium",
          },
        ],
      },

      // RUTHENIUM: Supply constraints
      {
        materialId: ruthenium._id,
        title: "Supply Constraints",
        severity: "High",
        location: "Global",
        description:
          "Limited global production capacity.",
        operationalImpact:
          "Reduced semiconductor manufacturing output.",
        trend: "Worsening",
        industryImpacts: [
          {
            industry: "Semiconductors",
            impact: "Production delays.",
          },
          {
            industry: "Technology",
            impact: "Delayed hardware launches.",
          },
        ],
        recommendations: [
          {
            title: "Increase Inventory Levels",
            description:
              "Maintain additional ruthenium stock for critical operations.",
            priority: "High",
          },
          {
            title: "Expand Supplier Network",
            description:
              "Develop relationships with additional global suppliers.",
            priority: "Medium",
          },
        ],
      },
    ]);

    res.status(200).json({
      message: "Seed risks created successfully.",
      count: risks.length,
      risks,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};


// ======================================================
// CREATE RISK FROM NEWS
// ======================================================

const createRiskFromNews = async (req, res) => {
  try {
    const { article, aiAnalysis } = req.body;

    if (!article) {
      return res.status(400).json({
        message: "Article data is required.",
      });
    }

    let analysis = aiAnalysis;

    // Backward compatibility: analyze the article if
    // the caller did not provide an existing AI result.
    if (!analysis) {
      analysis = await analyzeNews({
        title: article.title,
        description: article.description,
        content: article.content,
        source:
          article.source?.name ||
          article.source,
        url: article.url,
        publishedAt: article.publishedAt,
      });
    }

    if (!analysis?.isRelevant) {
      return res.status(200).json({
        message:
          "Article is not relevant to NAO risk intelligence.",
        saved: [],
        existing: [],
        skipped: [],
        aiAnalysis: analysis,
      });
    }

    const result = await saveRisksFromAnalysis({
      aiAnalysis: analysis,
      article,
    });

    if (
      result.saved.length === 0 &&
      result.existing.length === 0 &&
      result.skipped.length > 0
    ) {
      return res.status(422).json({
        message: "No risk was saved.",
        ...result,
        aiAnalysis: analysis,
      });
    }

    res.status(
      result.saved.length > 0 ? 201 : 200
    ).json({
      message:
        result.saved.length > 0
          ? "Risk(s) saved successfully."
          : "Risk(s) already exist.",
      saved: result.saved,
      existing: result.existing,
      skipped: result.skipped,
      aiAnalysis: analysis,
    });
  } catch (error) {
    console.error(
      "Create risk from news error:",
      error
    );

    res.status(500).json({
      message: "Failed to create risk from news article.",
      error: error.message,
    });
  }
};


// ======================================================
// GENERATE RECOMMENDATIONS FOR ONE RISK
// ======================================================

const generateRecommendationsForRisk = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid risk ID.",
      });
    }

    const risk = await Risk.findById(id)
      .populate("materialId");

    if (!risk) {
      return res.status(404).json({
        message: "Risk not found.",
      });
    }

    if (!risk.materialId || !risk.materialId.name) {
      return res.status(422).json({
        message:
          "This risk is not linked to a valid material.",
      });
    }

    const force =
      req.query.force === "true" ||
      req.body?.force === true;

    // Protect existing recommendations from being replaced
    // accidentally. Use ?force=true to regenerate them.
    if (
      risk.recommendations?.length > 0 &&
      !force
    ) {
      return res.status(200).json({
        message:
          "This risk already has recommendations. Use ?force=true to regenerate them.",
        generated: false,
        risk,
      });
    }

    const recommendations =
      await generateRiskRecommendations({
        risk,
        material: risk.materialId,
      });

    // Save the AI-generated recommendations into
    // the existing recommendations array.
    risk.recommendations = recommendations;

    await risk.save();

    const updatedRisk = await Risk.findById(
      risk._id
    ).populate("materialId");

    res.status(200).json({
      message:
        "Recommendations generated and saved successfully.",
      generated: true,
      count: recommendations.length,
      risk: updatedRisk,
    });
  } catch (error) {
    console.error(
      "Generate recommendations error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to generate recommendations.",
      error: error.message,
    });
  }
};


// ======================================================
// GENERATE RECOMMENDATIONS FOR RISKS WITHOUT ANY
// ======================================================

const generateRecommendationsForPendingRisks =
  async (req, res) => {
    try {
      const requestedLimit = Number(
        req.body?.limit ??
        req.query.limit ??
        5
      );

      if (
        !Number.isInteger(requestedLimit) ||
        requestedLimit < 1
      ) {
        return res.status(400).json({
          message:
            "Limit must be a positive whole number.",
        });
      }

      // Limit one request to a maximum of 20 risks
      // to control API cost and execution time.
      const limit = Math.min(
        requestedLimit,
        20
      );

      const risks = await Risk.find({
        $or: [
          {
            recommendations: {
              $exists: false,
            },
          },
          {
            recommendations: {
              $size: 0,
            },
          },
        ],
      })
        .populate("materialId")
        .sort({ createdAt: -1 })
        .limit(limit);

      if (risks.length === 0) {
        return res.status(200).json({
          message:
            "No risks need recommendations.",
          found: 0,
          generated: [],
          failed: [],
        });
      }

      const generated = [];
      const failed = [];

      // Process sequentially to avoid sending a large
      // burst of OpenAI requests.
      for (const risk of risks) {
        try {
          if (
            !risk.materialId ||
            !risk.materialId.name
          ) {
            throw new Error(
              "Risk is not linked to a valid material."
            );
          }

          const recommendations =
            await generateRiskRecommendations({
              risk,
              material: risk.materialId,
            });

          risk.recommendations =
            recommendations;

          await risk.save();

          generated.push({
            riskId: risk._id,
            title: risk.title,
            material: risk.materialId.name,
            recommendations,
          });
        } catch (error) {
          failed.push({
            riskId: risk._id,
            title: risk.title,
            error: error.message,
          });
        }
      }

      res.status(200).json({
        message:
          "Pending-risk recommendation generation finished.",
        found: risks.length,
        generatedCount: generated.length,
        failedCount: failed.length,
        generated,
        failed,
      });
    } catch (error) {
      console.error(
        "Bulk recommendation generation error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to generate recommendations for pending risks.",
        error: error.message,
      });
    }
  };


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getRisks,
  getRisk,
  seedRisks,
  createRiskFromNews,
  generateRecommendationsForRisk,
  generateRecommendationsForPendingRisks,
};
