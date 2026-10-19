
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// ======================================================
// RISK SCORE BREAKDOWN
// ======================================================

const riskScoreBreakdownSchema = new Schema(
  {
    severityScore: { type: Number, min: 0, max: 100 },
    materialDependencyScore: { type: Number, min: 0, max: 100 },
    operationalImpactScore: { type: Number, min: 0, max: 100 },
    trendScore: { type: Number, min: 0, max: 100 },

    weightsUsed: {
      severity: { type: Number, min: 0, max: 100, default: 0 },
      materialDependency: { type: Number, min: 0, max: 100, default: 0 },
      operationalImpact: { type: Number, min: 0, max: 100, default: 0 },
      trend: { type: Number, min: 0, max: 100, default: 0 },
    },

    availableFactors: [{ type: String }],
    missingFactors: [{ type: String }],

    availableWeight: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    formulaVersion: {
      type: String,
      default: "nao-risk-v1",
    },

    calculatedAt: { type: Date },
  },
  { _id: false }
);

// ======================================================
// SUPPLIER EXPOSURE
// ======================================================

const supplierExposureSchema = new Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    relationship: {
      type: String,
      enum: [
        "MentionedInArticle",
        "PotentialSupplier",
        "VerifiedSupplier",
        "AffectedSupplier",
        "AlternativeSupplier",
        "Other",
      ],
      default: "MentionedInArticle",
      required: true,
    },

    verificationStatus: {
      type: String,
      enum: ["Unverified", "Potential", "Verified"],
      default: "Unverified",
      required: true,
    },

    confidence: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
      required: true,
    },

    evidenceUrl: {
      type: String,
      trim: true,
    },

    evidenceSummary: {
      type: String,
      trim: true,
    },

    linkedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// ======================================================
// RISK SCHEMA
// ======================================================

const riskSchema = new Schema(
  {
    // Material associated with this risk
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: true,
    },

    // Basic risk information
    title: {
      type: String,
      required: true,
      trim: true,
    },

    severity: {
      type: String,
      required: true,
      enum: ["Low", "Medium", "High", "Critical", "Unknown"],
    },

    location: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    operationalImpact: {
      type: String,
      required: true,
    },

    operationalImpactScore: {
      type: Number,
      min: 0,
      max: 100,
    },

    operationalImpactAssessment: {
      rationale: { type: String, trim: true },
      confidence: {
        type: String,
        enum: ["Low", "Medium", "High"],
      },
      model: { type: String, trim: true },
      assessedAt: { type: Date },
    },

    trend: {
      type: String,
      required: true,
      enum: ["Improving", "Stable", "Worsening", "Unknown"],
    },

    // ==================================================
    // RISK SCORING
    // ==================================================

    riskScore: {
      type: Number,
      min: 0,
      max: 100,
    },

    riskScoreLevel: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical", "Unknown"],
      default: "Unknown",
    },

    riskScoreCompleteness: {
      type: String,
      enum: ["Complete", "Partial", "Unavailable"],
      default: "Unavailable",
    },

    riskScoreBreakdown: {
      type: riskScoreBreakdownSchema,
      default: undefined,
    },

    // ==================================================
    // INDUSTRY IMPACTS
    // ==================================================

    industryImpacts: [
      {
        industry: {
          type: String,
          required: true,
        },

        impact: {
          type: String,
          required: true,
        },
      },
    ],

    // ==================================================
    // RECOMMENDATIONS
    // ==================================================

    recommendations: [
      {
        title: {
          type: String,
          required: true,
        },

        description: {
          type: String,
          required: true,
        },

        priority: {
          type: String,
          enum: ["High", "Medium", "Low"],
          required: true,
        },
      },
    ],

    // ==================================================
    // SUPPLIER EXPOSURES
    // ==================================================

    supplierExposures: {
      type: [supplierExposureSchema],
      default: [],
    },

    // ==================================================
    // SOURCE AND NEWS EVIDENCE
    // ==================================================

    sourceUrl: {
      type: String,
      trim: true,
    },

    source: {
      type: String,
      trim: true,
    },

    publishedAt: {
      type: Date,
    },

    // Indicates whether this risk has passed the application's
    // evidence-verification process.
    //
    // Existing records default to Unverified so that adding
    // this field does not automatically classify historical
    // or seeded risks as verified live evidence.
    evidenceStatus: {
      type: String,
      enum: ["Unverified", "Verified"],
      default: "Unverified",
      index: true,
    },

    // Set only when the application's verification workflow
    // confirms the evidence and successfully persists the risk.
    evidenceVerifiedAt: {
      type: Date,
      default: null,
    },

    // Fingerprint of the evidence used to create or update
    // this risk. The news-processing service will manage it.
    evidenceHash: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// DUPLICATE PROTECTION
// ======================================================

// Preserve the existing unique sparse index.
// Do not remove or replace this index.
riskSchema.index(
  { materialId: 1, sourceUrl: 1 },
  { unique: true, sparse: true }
);

// ======================================================
// EXPORT MODEL
// ======================================================

module.exports = mongoose.model("Risk", riskSchema);
