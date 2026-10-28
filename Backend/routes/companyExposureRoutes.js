const express = require("express");

const {
  getCompanyExposures,
  getCompanyExposureByKey,
  seedAeroTechDemoExposure,
} = require("../controllers/companyExposureController");

const router = express.Router();

// ======================================================
// DEVELOPMENT SEED PROTECTION
// ======================================================

const developmentSeedGuard = (req, res, next) => {
  const isDevelopment =
    process.env.NODE_ENV === "development";

  const seedRoutesEnabled =
    process.env.ENABLE_DEVELOPMENT_SEED_ROUTES === "true";

  if (!isDevelopment || !seedRoutesEnabled) {
    return res.status(403).json({
      message:
        "AeroTech demo creation is disabled. Enable it only in local development.",
    });
  }

  return next();
};

// ======================================================
// GET ALL COMPANY EXPOSURES
// GET /api/company-exposure
// ======================================================

router.get("/", getCompanyExposures);

// ======================================================
// GET ONE COMPANY EXPOSURE
// GET /api/company-exposure/:demoKey
// ======================================================

router.get("/:demoKey", getCompanyExposureByKey);

// ======================================================
// CREATE AEROTECH DEMO EXPOSURE
// POST /api/company-exposure/seed/aerotech
//
// Restricted to explicitly enabled local development.
// ======================================================

router.post(
  "/seed/aerotech",
  developmentSeedGuard,
  seedAeroTechDemoExposure
);

module.exports = router;