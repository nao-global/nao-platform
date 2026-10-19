const mongoose = require("mongoose");
const Risk = require("../models/Risk");

const populateRisk = (query) =>
  query
    .populate("materialId")
    .populate("supplierExposures.supplierId");

const getRisks = async (req, res) => {
  try {
    const risks = await populateRisk(
      Risk.find({ evidenceStatus: "Verified" })
    ).sort({ updatedAt: -1, createdAt: -1 });

    return res.status(200).json(risks);
  } catch (error) {
    console.error("Failed to retrieve verified risks:", error);

    return res.status(500).json({
      message: "Failed to retrieve risks.",
      error: error.message,
    });
  }
};

const getRisk = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid risk ID.",
      });
    }

    const risk = await populateRisk(
      Risk.findOne({
        _id: id,
        evidenceStatus: "Verified",
      })
    );

    if (!risk) {
      return res.status(404).json({
        message: "Verified risk not found.",
      });
    }

    return res.status(200).json(risk);
  } catch (error) {
    console.error("Failed to retrieve risk:", error);

    return res.status(500).json({
      message: "Failed to retrieve risk.",
      error: error.message,
    });
  }
};

module.exports = {
  getRisks,
  getRisk,
};