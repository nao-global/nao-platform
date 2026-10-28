const mongoose = require("mongoose");

const newsProcessingStateSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: "external-news-processing",
    },

    lastScheduledRunAt: {
      type: Date,
      default: null,
    },

    lastStartedAt: {
      type: Date,
      default: null,
    },

    lastFinishedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Idle", "Running", "Succeeded", "Partial", "Failed"],
      default: "Idle",
    },

    lockToken: {
      type: String,
      default: null,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "newsprocessingstates",
  }
);

module.exports =
  mongoose.models.NewsProcessingState ||
  mongoose.model(
    "NewsProcessingState",
    newsProcessingStateSchema
  );