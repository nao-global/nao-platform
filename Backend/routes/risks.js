const express = require("express");

const {
  seedRisks,
  createRiskFromNews,
  generateRecommendationsForRisk,
  generateRecommendationsForPendingRisks,
} = require("../controllers/riskController");

const {
  getRisks,
  getRisk,
} = require("../controllers/riskReadController");

const {
  recalculateRiskScores,
  assessMissingOperationalImpactScores,
} = require("../controllers/riskScoringController");

const {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  verifySupplier,
} = require("../controllers/supplierController");

const {
  linkSupplierToRisk,
  unlinkSupplierFromRisk,
} = require("../controllers/riskSupplierController");

const router = express.Router();

// ======================================================
// DEVELOPMENT SEED ROUTE
// ======================================================
//
// Seeding is allowed only when BOTH conditions are true:
// 1. NODE_ENV is explicitly set to "development".
// 2. ENABLE_DEVELOPMENT_SEED_ROUTES is set to "true".
//
// The seed controller must also remain non-destructive.
// Never enable this route in production.
//
// ======================================================

const developmentSeedGuard = (req, res, next) => {
  const isDevelopment =
    process.env.NODE_ENV === "development";

  const seedRoutesEnabled =
    process.env.ENABLE_DEVELOPMENT_SEED_ROUTES === "true";

  if (!isDevelopment || !seedRoutesEnabled) {
    return res.status(403).json({
      message:
        "Risk seeding is disabled. Enable it only in local development.",
    });
  }

  return next();
};

router.post(
  "/seed",
  developmentSeedGuard,
  seedRisks
);

// ======================================================
// RISK SCORING
// ======================================================

// Recalculate existing scores locally without OpenAI.
router.post(
  "/recalculate-scores",
  recalculateRiskScores
);

// Assess missing operational-impact scores using AI.
router.post(
  "/assess-operational-impact",
  assessMissingOperationalImpactScores
);

// ======================================================
// SUPPLIER MANAGEMENT
// ======================================================

// List suppliers.
router.get(
  "/suppliers",
  getSuppliers
);

// Create a supplier.
router.post(
  "/suppliers",
  createSupplier
);

// Retrieve one supplier.
router.get(
  "/suppliers/:supplierId",
  getSupplierById
);

// Update supplier information.
router.patch(
  "/suppliers/:supplierId",
  updateSupplier
);

// Verify a supplier using supplied evidence.
router.post(
  "/suppliers/:supplierId/verify",
  verifySupplier
);

// ======================================================
// RECOMMENDATIONS
// ======================================================

// Generate recommendations for risks whose
// recommendations arrays are empty.
router.post(
  "/recommendations/generate",
  generateRecommendationsForPendingRisks
);

// ======================================================
// RISK RETRIEVAL AND CREATION
// ======================================================

router.get(
  "/",
  getRisks
);

router.post(
  "/from-news",
  createRiskFromNews
);

// ======================================================
// LINK SUPPLIERS TO RISKS
// ======================================================

// Link or update a supplier exposure.
router.post(
  "/:id/suppliers",
  linkSupplierToRisk
);

// Remove a supplier exposure.
router.delete(
  "/:id/suppliers/:supplierId",
  unlinkSupplierFromRisk
);

// ======================================================
// INDIVIDUAL RISK RECOMMENDATIONS
// ======================================================

router.post(
  "/:id/recommendations",
  generateRecommendationsForRisk
);

// ======================================================
// GET ONE RISK
// Keep this parameter-based route last.
// ======================================================

router.get(
  "/:id",
  getRisk
);

module.exports = router;