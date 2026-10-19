const mongoose = require("mongoose");
const Supplier = require("../models/Supplier");
const Material = require("../models/Material");

const SUPPLIER_TYPES = [
  "Miner",
  "Refiner",
  "Processor",
  "Manufacturer",
  "Distributor",
  "Recycler",
  "LogisticsProvider",
  "EquipmentProvider",
  "TradingCompany",
  "Other",
  "Unknown",
];

const isHttpUrl = (value) => {
  try {
    const url = new URL(String(value));

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
};

const validateMaterialIds = async (materialIds) => {
  if (materialIds === undefined) {
    return { ids: undefined };
  }

  if (!Array.isArray(materialIds)) {
    return {
      error:
        "materialIds must be an array of Material IDs.",
    };
  }

  const uniqueIds = [
    ...new Set(materialIds.map(String)),
  ];

  if (
    uniqueIds.some(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    )
  ) {
    return {
      error: "One or more materialIds are invalid.",
    };
  }

  const foundCount = await Material.countDocuments({
    _id: { $in: uniqueIds },
  });

  if (foundCount !== uniqueIds.length) {
    return {
      error:
        "One or more materialIds do not match a material in NAO.",
    };
  }

  return { ids: uniqueIds };
};

const handleValidationError = (res, error) => {
  if (error?.code === 11000) {
    return res.status(409).json({
      message:
        "A supplier with this name already exists.",
    });
  }

  if (
    error?.name === "ValidationError" ||
    error?.name === "CastError"
  ) {
    return res.status(400).json({
      message: "Supplier data is invalid.",
      error: error.message,
    });
  }

  return res.status(500).json({
    message: "Supplier operation failed.",
    error: error.message,
  });
};

// ======================================================
// CREATE SUPPLIER
// ======================================================

const createSupplier = async (req, res) => {
  try {
    const {
      name,
      country,
      website,
      description,
      supplierType,
      materialIds,
      industries,
      notes,
    } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        message: "Supplier name is required.",
      });
    }

    if (
      supplierType &&
      !SUPPLIER_TYPES.includes(supplierType)
    ) {
      return res.status(400).json({
        message: "supplierType is not supported.",
      });
    }

    if (website && !isHttpUrl(website)) {
      return res.status(400).json({
        message:
          "website must be a valid HTTP or HTTPS URL.",
      });
    }

    const materialValidation =
      await validateMaterialIds(materialIds);

    if (materialValidation.error) {
      return res.status(400).json({
        message: materialValidation.error,
      });
    }

    const supplier = await Supplier.create({
      name: name.trim(),
      normalizedName: name.trim().toLowerCase(),

      country:
        typeof country === "string" &&
        country.trim()
          ? country.trim()
          : "Unknown",

      website: website || undefined,

      description:
        typeof description === "string"
          ? description.trim()
          : "",

      supplierType: supplierType || "Unknown",

      materialIds: materialValidation.ids || [],

      industries: Array.isArray(industries)
        ? industries
            .map(String)
            .map((item) => item.trim())
            .filter(Boolean)
        : [],

      notes:
        typeof notes === "string"
          ? notes.trim()
          : "",

      // Creating a record does not establish that
      // the supplier has been independently verified.
      verificationStatus: "Unverified",
      evidence: [],
    });

    const created = await Supplier.findById(
      supplier._id
    ).populate("materialIds");

    return res.status(201).json({
      message:
        "Supplier created as unverified. Add evidence before verifying it.",
      supplier: created,
    });
  } catch (error) {
    return handleValidationError(res, error);
  }
};

// ======================================================
// GET SUPPLIERS
// ======================================================

const getSuppliers = async (req, res) => {
  try {
    const filter = {};

    if (
      typeof req.query.country === "string" &&
      req.query.country.trim()
    ) {
      const escapedCountry = req.query.country
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.country = new RegExp(
        `^${escapedCountry}$`,
        "i"
      );
    }

    if (
      [
        "Unverified",
        "Potential",
        "Verified",
        "Inactive",
      ].includes(req.query.verificationStatus)
    ) {
      filter.verificationStatus =
        req.query.verificationStatus;
    }

    if (req.query.materialId) {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.query.materialId
        )
      ) {
        return res.status(400).json({
          message: "Invalid materialId.",
        });
      }

      filter.materialIds = req.query.materialId;
    }

    const suppliers = await Supplier.find(filter)
      .populate("materialIds")
      .sort({ name: 1 });

    return res.status(200).json({
      count: suppliers.length,
      suppliers,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve suppliers.",
      error: error.message,
    });
  }
};

// ======================================================
// GET ONE SUPPLIER
// ======================================================

const getSupplierById = async (req, res) => {
  try {
    const { supplierId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(supplierId)
    ) {
      return res.status(400).json({
        message: "Invalid supplier ID.",
      });
    }

    const supplier = await Supplier.findById(
      supplierId
    ).populate("materialIds");

    if (!supplier) {
      return res.status(404).json({
        message: "Supplier not found.",
      });
    }

    return res.status(200).json(supplier);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve supplier.",
      error: error.message,
    });
  }
};

// ======================================================
// UPDATE SUPPLIER
// ======================================================

const updateSupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(supplierId)
    ) {
      return res.status(400).json({
        message: "Invalid supplier ID.",
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

    // Verification status and evidence are deliberately
    // excluded here. Use the verification endpoint for that.
    const allowedFields = [
      "name",
      "country",
      "website",
      "description",
      "supplierType",
      "industries",
      "notes",
    ];

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body || {},
          field
        )
      ) {
        supplier[field] = req.body[field];
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "materialIds"
      )
    ) {
      const materialValidation =
        await validateMaterialIds(
          req.body.materialIds
        );

      if (materialValidation.error) {
        return res.status(400).json({
          message: materialValidation.error,
        });
      }

      supplier.materialIds =
        materialValidation.ids;
    }

    if (
      supplier.website &&
      !isHttpUrl(supplier.website)
    ) {
      return res.status(400).json({
        message:
          "website must be a valid HTTP or HTTPS URL.",
      });
    }

    if (
      supplier.supplierType &&
      !SUPPLIER_TYPES.includes(
        supplier.supplierType
      )
    ) {
      return res.status(400).json({
        message: "supplierType is not supported.",
      });
    }

    await supplier.save();

    const updated = await Supplier.findById(
      supplier._id
    ).populate("materialIds");

    return res.status(200).json({
      message: "Supplier updated.",
      supplier: updated,
    });
  } catch (error) {
    return handleValidationError(res, error);
  }
};

// ======================================================
// VERIFY SUPPLIER WITH EVIDENCE
// ======================================================

const verifySupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { evidenceUrl, evidenceSummary } =
      req.body || {};

    if (
      !mongoose.Types.ObjectId.isValid(supplierId)
    ) {
      return res.status(400).json({
        message: "Invalid supplier ID.",
      });
    }

    if (
      !isHttpUrl(evidenceUrl) ||
      typeof evidenceSummary !== "string" ||
      !evidenceSummary.trim()
    ) {
      return res.status(400).json({
        message:
          "Verification requires a valid evidenceUrl and a non-empty evidenceSummary.",
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

    supplier.evidence.push({
      sourceUrl: evidenceUrl,
      summary: evidenceSummary.trim(),
      recordedAt: new Date(),
    });

    supplier.verificationStatus = "Verified";

    await supplier.save();

    const updated = await Supplier.findById(
      supplier._id
    ).populate("materialIds");

    return res.status(200).json({
      message:
        "Supplier marked verified with supplied evidence.",
      supplier: updated,
    });
  } catch (error) {
    return handleValidationError(res, error);
  }
};

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  verifySupplier,
};