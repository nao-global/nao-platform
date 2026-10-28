const CompanyExposure = require("../models/CompanyExposure");
const Material = require("../models/Material");

const DEMO_KEY = "aerotech-titanium-demo";

const REQUIRED_MATERIAL_NAMES = [
  "Titanium",
  "Nickel",
  "Iridium",
  "Ruthenium",
];

// ======================================================
// HELPER: POPULATE MATERIAL REFERENCES
// ======================================================

const populateCompanyExposure = (query) =>
  query.populate("products.materials.materialId");

// ======================================================
// HELPER: BUILD DEMO PRODUCT MAPPINGS
// ======================================================

const buildDemoProducts = (materialByName) => {
  const relationshipBasis =
    "Illustrative demo mapping only; not verified company or product data.";

  const linkMaterial = (name, dependencyLevel) => ({
    materialId: materialByName.get(name.toLowerCase())._id,
    dependencyLevel,
    relationshipBasis,
  });

  return [
    {
      productKey: "aerotech-airframe-demo",
      name: "AeroTech Aircraft Airframe (DEMO)",
      category: "Aircraft Structure",
      description:
        "Fictional aircraft airframe used to demonstrate material exposure mapping.",
      criticality: "Critical",
      materials: [
        linkMaterial("Titanium", "Primary"),
      ],
      operationalImpact:
        "Illustrative assessment: a titanium supply disruption could delay airframe assembly. Actual exposure requires verified product, sourcing, and inventory data.",
    },

    {
      productKey: "aerotech-turbine-engine-demo",
      name: "AeroTech Turbine Engine Assembly (DEMO)",
      category: "Aircraft Engine",
      description:
        "Fictional turbine engine assembly used for the NAO demonstration.",
      criticality: "Critical",
      materials: [
        linkMaterial("Titanium", "Primary"),
        linkMaterial("Nickel", "Secondary"),
      ],
      operationalImpact:
        "Illustrative assessment: disruption to a linked material could affect component availability and assembly schedules. Actual exposure has not been verified.",
    },

    {
      productKey: "aerotech-avionics-module-demo",
      name: "AeroTech Avionics Module (DEMO)",
      category: "Aircraft Electronics",
      description:
        "Fictional avionics module used to demonstrate electronic-material relationships.",
      criticality: "High",
      materials: [
        linkMaterial("Iridium", "Supporting"),
        linkMaterial("Ruthenium", "Supporting"),
      ],
      operationalImpact:
        "Illustrative assessment: a relevant material disruption could affect component availability. Specific material requirements and operational consequences are unverified demo assumptions.",
    },
  ];
};

// ======================================================
// GET ALL COMPANY EXPOSURES
// ======================================================

const getCompanyExposures = async (req, res) => {
  try {
    const exposures = await populateCompanyExposure(
      CompanyExposure.find({})
    ).sort({ updatedAt: -1 });

    return res.status(200).json(exposures);
  } catch (error) {
    console.error(
      "Failed to retrieve company exposures:",
      error
    );

    return res.status(500).json({
      message: "Failed to retrieve company exposures.",
      error: error.message,
    });
  }
};

// ======================================================
// GET ONE COMPANY EXPOSURE
// ======================================================

const getCompanyExposureByKey = async (req, res) => {
  try {
    const { demoKey } = req.params;

    if (!demoKey || typeof demoKey !== "string") {
      return res.status(400).json({
        message:
          "A valid company exposure key is required.",
      });
    }

    const exposure = await populateCompanyExposure(
      CompanyExposure.findOne({ demoKey })
    );

    if (!exposure) {
      return res.status(404).json({
        message: "Company exposure not found.",
      });
    }

    return res.status(200).json(exposure);
  } catch (error) {
    console.error(
      "Failed to retrieve company exposure:",
      error
    );

    return res.status(500).json({
      message: "Failed to retrieve company exposure.",
      error: error.message,
    });
  }
};

// ======================================================
// CREATE OR COMPLETE AEROTECH DEMO EXPOSURE
// ======================================================
//
// Safety behavior:
//
// 1. Does not delete the existing company record.
// 2. Does not replace existing evidence or recommendations.
// 3. If products already exist, leaves them unchanged.
// 4. If products are empty, adds the demo product mappings.
// 5. Creates a new record only when no matching record exists.
// 6. Does not create or require supplier records.
//
// ======================================================

const seedAeroTechDemoExposure = async (req, res) => {
  try {
    const existingExposure =
      await CompanyExposure.findOne({
        demoKey: DEMO_KEY,
      });

    // If the existing record already has products,
    // do not overwrite or duplicate them.
    if (
      existingExposure &&
      Array.isArray(existingExposure.products) &&
      existingExposure.products.length > 0
    ) {
      const populatedExposure =
        await populateCompanyExposure(
          CompanyExposure.findById(
            existingExposure._id
          )
        );

      return res.status(200).json({
        message:
          "AeroTech demo products already exist. No changes were made.",
        created: false,
        updated: false,
        companyExposure: populatedExposure,
      });
    }

    // Retrieve existing NAO materials.
    const materials = await Material.find({
      name: {
        $in: REQUIRED_MATERIAL_NAMES,
      },
    });

    const materialByName = new Map(
      materials.map((material) => [
        material.name.trim().toLowerCase(),
        material,
      ])
    );

    // Verify that all required materials exist.
    const missingMaterials =
      REQUIRED_MATERIAL_NAMES.filter(
        (name) =>
          !materialByName.has(name.toLowerCase())
      );

    if (missingMaterials.length > 0) {
      return res.status(409).json({
        message:
          "AeroTech demo products were not added because required materials are missing.",
        missingMaterials,
        hint:
          "Confirm that the materials exist in the NAO materials collection before retrying.",
      });
    }

    const products =
      buildDemoProducts(materialByName);

    // --------------------------------------------------
    // CASE 1: EXISTING RECORD WITH EMPTY PRODUCTS
    // --------------------------------------------------

    if (existingExposure) {
      // Only update the products field, and only if it is
      // still missing or empty when MongoDB performs the
      // update. Other stored fields are not set or unset.
      const updatedExposure =
        await CompanyExposure.findOneAndUpdate(
          {
            _id: existingExposure._id,
            demoKey: DEMO_KEY,
            $or: [
              {
                products: {
                  $exists: false,
                },
              },
              {
                products: {
                  $size: 0,
                },
              },
            ],
          },
          {
            $set: {
              products,
            },
          },
          {
            new: true,
            runValidators: true,
          }
        );

      if (updatedExposure) {
        const populatedExposure =
          await populateCompanyExposure(
            CompanyExposure.findById(
              updatedExposure._id
            )
          );

        return res.status(200).json({
          message:
            "Existing AeroTech exposure was updated with demo product mappings. Existing legacy fields were preserved.",
          created: false,
          updated: true,
          companyExposure: populatedExposure,
        });
      }

      // Another request may have changed the record
      // between the initial read and the update.
      const latestExposure =
        await populateCompanyExposure(
          CompanyExposure.findOne({
            demoKey: DEMO_KEY,
          })
        );

      if (
        latestExposure &&
        Array.isArray(latestExposure.products) &&
        latestExposure.products.length > 0
      ) {
        return res.status(200).json({
          message:
            "AeroTech demo products were added by another request. No further changes were made.",
          created: false,
          updated: false,
          companyExposure: latestExposure,
        });
      }

      return res.status(409).json({
        message:
          "The existing AeroTech record changed during the update. No legacy fields were deleted. Please retry the request.",
      });
    }

    // --------------------------------------------------
    // CASE 2: NO EXISTING RECORD
    // --------------------------------------------------

    const createdExposure =
      await CompanyExposure.create({
        demoKey: DEMO_KEY,
        companyName: "AeroTech Manufacturing",
        isDemo: true,
        products,
      });

    const populatedExposure =
      await populateCompanyExposure(
        CompanyExposure.findById(
          createdExposure._id
        )
      );

    return res.status(201).json({
      message:
        "AeroTech demo exposure created successfully.",
      created: true,
      updated: false,
      companyExposure: populatedExposure,
    });
  } catch (error) {
    // Handle a duplicate-key error, such as two requests
    // attempting to create the same demo record.
    if (error.code === 11000) {
      try {
        const existingExposure =
          await populateCompanyExposure(
            CompanyExposure.findOne({
              demoKey: DEMO_KEY,
            })
          );

        if (existingExposure) {
          return res.status(200).json({
            message:
              "AeroTech demo exposure already exists. No duplicate record was created.",
            created: false,
            updated: false,
            companyExposure: existingExposure,
          });
        }
      } catch (lookupError) {
        console.error(
          "Failed to retrieve existing AeroTech exposure:",
          lookupError
        );
      }
    }

    console.error(
      "Failed to create or update AeroTech demo exposure:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to create or update AeroTech demo exposure.",
      error: error.message,
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getCompanyExposures,
  getCompanyExposureByKey,
  seedAeroTechDemoExposure,
};