const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const materialSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    strategicImportance: {
      type: String,
      required: true,
    },

    dependencyScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // This remains the material-level score.
    // Individual risk-event scores are stored on Risk.riskScore.
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    affectedIndustries: {
      type: [String],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Material", materialSchema);