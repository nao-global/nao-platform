const Material = require("../models/Material");
const mongoose = require("mongoose");

// ======================================================
// DEFAULT SEED MATERIALS
// ======================================================

// These records are inserted only when a material with the
// same name does not already exist.
//
// IMPORTANT:
// Existing materials are never deleted or overwritten by
// the seed operation.

const seedMaterialData = [
  {
    name: "Titanium",
    category: "Strategic Metal",
    description:
      "High-strength lightweight metal used in aerospace and defense.",
    strategicImportance: "Critical for aircraft manufacturing.",
    dependencyScore: 92,
    riskScore: 95,
    affectedIndustries: [
      "Aerospace",
      "Defense",
      "Medical",
    ],
  },
  {
    name: "Nickel",
    category: "Battery Metal",
    description:
      "Essential for EV batteries and stainless steel.",
    strategicImportance:
      "Critical for electric vehicle production.",
    dependencyScore: 81,
    riskScore: 28,
    affectedIndustries: [
      "Automotive",
      "Energy",
      "Manufacturing",
    ],
  },
  {
    name: "Iridium",
    category: "Precious Metal",
    description:
      "Used in semiconductors and electronics.",
    strategicImportance:
      "Critical for advanced electronics.",
    dependencyScore: 89,
    riskScore: 90,
    affectedIndustries: [
      "Electronics",
      "Telecommunications",
    ],
  },
  {
    name: "Ruthenium",
    category: "Precious Metal",
    description:
      "Used in chip manufacturing and data storage.",
    strategicImportance:
      "Important for semiconductor production.",
    dependencyScore: 85,
    riskScore: 82,
    affectedIndustries: [
      "Semiconductors",
      "Technology",
    ],
  },
];

// ======================================================
// GET ALL MATERIALS
// ======================================================

const getMaterials = async (req, res) => {
  try {
    const materials = await Material.find({});

    return res.status(200).json(materials);
  } catch (error) {
    console.error("Error retrieving materials:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
};

// ======================================================
// CREATE MATERIAL
// ======================================================

const createMaterial = async (req, res) => {
  try {
    const material = await Material.create(req.body);

    return res.status(201).json(material);
  } catch (error) {
    console.error("Error creating material:", error);

    return res.status(400).json({
      error: error.message,
    });
  }
};

// ======================================================
// GET ONE MATERIAL
// ======================================================

const getMaterial = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({
      error: "Material not found",
    });
  }

  try {
    const material = await Material.findById(id);

    if (!material) {
      return res.status(404).json({
        error: "Material not found",
      });
    }

    return res.status(200).json(material);
  } catch (error) {
    console.error("Error retrieving material:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
};

// ======================================================
// UPDATE MATERIAL
// ======================================================

const updateMaterial = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({
      error: "Material not found",
    });
  }

  try {
    const material = await Material.findByIdAndUpdate(
      id,
      {
        $set: req.body,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!material) {
      return res.status(404).json({
        error: "Material not found",
      });
    }

    return res.status(200).json(material);
  } catch (error) {
    console.error("Error updating material:", error);

    const statusCode =
      error.name === "ValidationError" ||
      error.name === "CastError" ||
      error.code === 11000
        ? 400
        : 500;

    return res.status(statusCode).json({
      error: error.message,
    });
  }
};

// ======================================================
// DELETE MATERIAL
// ======================================================

const deleteMaterial = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({
      error: "Material not found",
    });
  }

  try {
    const material = await Material.findByIdAndDelete(id);

    if (!material) {
      return res.status(404).json({
        error: "Material not found",
      });
    }

    return res.status(200).json(material);
  } catch (error) {
    console.error("Error deleting material:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
};

// ======================================================
// SEED MATERIALS SAFELY
// ======================================================

// This operation is safe to run repeatedly.
//
// It creates a seed material only if a material with the
// same name does not already exist.
//
// It does NOT:
// - Delete existing materials.
// - Overwrite existing material information.
// - Replace the entire materials collection.

const seedMaterials = async (req, res) => {
  try {
    const materials = await Promise.all(
      seedMaterialData.map((seedMaterial) =>
        Material.findOneAndUpdate(
          {
            name: seedMaterial.name,
          },
          {
            $setOnInsert: seedMaterial,
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          }
        )
      )
    );

    return res.status(200).json(materials);
  } catch (error) {
    console.error("Error seeding materials:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
};

// ======================================================
// EXPORT CONTROLLER FUNCTIONS
// ======================================================

module.exports = {
  getMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  seedMaterials,
};