const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// ======================================================
// PRODUCT-MATERIAL RELATIONSHIP
// ======================================================

const productMaterialSchema = new Schema(
  {
    materialId: {
      type: Schema.Types.ObjectId,
      ref: "Material",
      required: true,
    },

    dependencyLevel: {
      type: String,
      enum: ["Primary", "Secondary", "Supporting"],
      default: "Primary",
      required: true,
    },

    relationshipBasis: {
      type: String,
      trim: true,
      default: "Demo relationship - not independently verified",
    },
  },
  { _id: false }
);

// ======================================================
// COMPANY PRODUCT
// ======================================================

const companyProductSchema = new Schema(
  {
    productKey: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      trim: true,
      default: "Not specified",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    criticality: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical", "Unknown"],
      default: "Medium",
    },

    materials: {
      type: [productMaterialSchema],
      default: [],
    },

    operationalImpact: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

// ======================================================
// COMPANY EXPOSURE
// ======================================================

const companyExposureSchema = new Schema(
  {
    demoKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: "aerotech-titanium-demo",
    },

    companyName: {
      type: String,
      required: true,
      trim: true,
      default: "AeroTech Manufacturing",
    },

    isDemo: {
      type: Boolean,
      required: true,
      default: true,
    },

    products: {
      type: [companyProductSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// EXPORT MODEL
// ======================================================

module.exports = mongoose.model(
  "CompanyExposure",
  companyExposureSchema
);