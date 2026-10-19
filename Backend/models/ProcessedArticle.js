
const mongoose = require("mongoose");

const processedArticleSchema = new mongoose.Schema(
  {
    canonicalUrl: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    contentHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    source: {
      type: String,
      default: "Unknown",
      trim: true,
    },

    publishedAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["Processing", "Processed", "Skipped", "Failed"],
      default: "Processing",
      required: true,
      index: true,
    },

    attempts: {
      type: Number,
      default: 1,
      min: 0,
    },

    lastError: {
      type: String,
      default: "",
      trim: true,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    riskIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Risk",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for finding articles by processing status and publication date.
processedArticleSchema.index({
  status: 1,
  publishedAt: -1,
});

module.exports =
  mongoose.models.ProcessedArticle ||
  mongoose.model("ProcessedArticle", processedArticleSchema);
