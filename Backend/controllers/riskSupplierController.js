const mongoose = require("mongoose");
const Risk = require("../models/Risk");
const Supplier = require("../models/Supplier");

const RELATIONSHIPS = [
  "MentionedInArticle",
  "PotentialSupplier",
  "VerifiedSupplier",
  "AffectedSupplier",
  "AlternativeSupplier",
  "Other",
];

const STATUSES = [
  "Unverified",
  "Potential",
  "Verified",
];

const CONFIDENCE_LEVELS = [
  "Low",
  "Medium",
  "High",
];

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(String(value));

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
};

// ======================================================
// LINK SUPPLIER TO RISK
// ======================================================

const linkSupplierToRisk = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      supplierId,
      relationship = "MentionedInArticle",
      verificationStatus,
      confidence = "Low",
      evidenceUrl,
      evidenceSummary,
    } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid risk ID.",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(supplierId)
    ) {
      return res.status(400).json({
        message:
          "A valid supplierId is required.",
      });
    }

    if (!RELATIONSHIPS.includes(relationship)) {
      return res.status(400).json({
        message:
          "Unsupported supplier relationship.",
      });
    }

    if (
      !CONFIDENCE_LEVELS.includes(confidence)
    ) {
      return res.status(400).json({
        message:
          "confidence must be Low, Medium, or High.",
      });
    }

    const supplier = await Supplier.findById(
      supplierId
    );

    if (!supplier) {
      return res.status(404).json({
        message: "Supplier not found.",
      });
    }

    const risk = await Risk.findById(id);

    if (!risk) {
      return res.status(404).json({
        message: "Risk not found.",
      });
    }

    const effectiveStatus =
      verificationStatus ||
      (
        relationship === "VerifiedSupplier"
          ? "Verified"
          : relationship === "PotentialSupplier"
            ? "Potential"
            : "Unverified"
      );

    if (!STATUSES.includes(effectiveStatus)) {
      return res.status(400).json({
        message:
          "Invalid verificationStatus.",
      });
    }

    if (
      relationship === "VerifiedSupplier" &&
      effectiveStatus !== "Verified"
    ) {
      return res.status(400).json({
        message:
          "VerifiedSupplier relationships must use verificationStatus=Verified.",
      });
    }

    if (
      relationship === "VerifiedSupplier" ||
      effectiveStatus === "Verified"
    ) {
      if (
        supplier.verificationStatus !== "Verified"
      ) {
        return res.status(422).json({
          message:
            "Verify the supplier record first, using the supplier verification endpoint.",
        });
      }

      if (
        !isHttpUrl(evidenceUrl) ||
        typeof evidenceSummary !== "string" ||
        !evidenceSummary.trim()
      ) {
        return res.status(422).json({
          message:
            "A verified risk-to-supplier link requires its own evidenceUrl and evidenceSummary.",
        });
      }
    }

    const cleanEvidenceUrl =
      evidenceUrl && isHttpUrl(evidenceUrl)
        ? evidenceUrl
        : undefined;

    const cleanSummary =
      typeof evidenceSummary === "string" &&
      evidenceSummary.trim()
        ? evidenceSummary.trim()
        : undefined;

    let exposure = risk.supplierExposures.find(
      (item) =>
        String(item.supplierId) ===
        String(supplier._id)
    );

    const exposureData = {
      supplierId: supplier._id,
      relationship,
      verificationStatus: effectiveStatus,
      confidence,
      evidenceUrl: cleanEvidenceUrl,
      evidenceSummary: cleanSummary,
      linkedAt: new Date(),
    };

    if (exposure) {
      Object.assign(exposure, exposureData);
    } else {
      risk.supplierExposures.push(exposureData);
    }

    await risk.save();

    const updated = await Risk.findById(risk._id)
      .populate("materialId")
      .populate("supplierExposures.supplierId");

    return res.status(200).json({
      message: "Supplier exposure linked to risk.",
      risk: updated,
    });
  } catch (error) {
    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message:
          "Supplier exposure data is invalid.",
        error: error.message,
      });
    }

    console.error(
      "Link supplier to risk error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to link supplier to risk.",
      error: error.message,
    });
  }
};

// ======================================================
// UNLINK SUPPLIER FROM RISK
// ======================================================

const unlinkSupplierFromRisk = async (
  req,
  res
) => {
  try {
    const { id, supplierId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid risk ID.",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(supplierId)
    ) {
      return res.status(400).json({
        message: "Invalid supplier ID.",
      });
    }

    const risk = await Risk.findById(id);

    if (!risk) {
      return res.status(404).json({
        message: "Risk not found.",
      });
    }

    const priorCount =
      risk.supplierExposures.length;

    risk.supplierExposures =
      risk.supplierExposures.filter(
        (item) =>
          String(item.supplierId) !==
          String(supplierId)
      );

    if (
      risk.supplierExposures.length ===
      priorCount
    ) {
      return res.status(404).json({
        message:
          "This supplier is not linked to the risk.",
      });
    }

    await risk.save();

    const updated = await Risk.findById(risk._id)
      .populate("materialId")
      .populate("supplierExposures.supplierId");

    return res.status(200).json({
      message:
        "Supplier exposure unlinked from risk.",
      risk: updated,
    });
  } catch (error) {
    console.error(
      "Unlink supplier from risk error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to unlink supplier from risk.",
      error: error.message,
    });
  }
};

module.exports = {
  linkSupplierToRisk,
  unlinkSupplierFromRisk,
};