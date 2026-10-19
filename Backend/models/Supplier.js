const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const supplierEvidenceSchema = new Schema(
  {
    sourceUrl: {
      type: String,
      required: true,
      trim: true,
    },

    summary: {
      type: String,
      required: true,
      trim: true,
    },

    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const potentialMaterialRelationshipSchema =
  new Schema(
    {
      materialName: {
        type: String,
        required: true,
        trim: true,
      },

      relationshipType: {
        type: String,
        enum: [
          "Mines",
          "Produces",
          "Refines",
          "Processes",
          "Recycles",
          "Distributes",
          "Supplies",
          "EquipmentProviderFor",
          "Purchases",
          "Uses",
          "Develops",
          "Researches",
          "Other",
          "Unknown",
        ],
        required: true,
      },

      verificationStatus: {
        type: String,
        enum: [
          "Unverified",
          "Potential",
          "Verified",
        ],
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
        required: true,
        trim: true,
      },

      evidenceSummary: {
        type: String,
        required: true,
        trim: true,
      },

      lastSeenAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: true,
    }
  );

const supplierSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    normalizedName: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      trim: true,
      default: "Unknown",
    },

    website: {
      type: String,
      trim: true,
    },

    // Description of the organization's reported role.
    description: {
      type: String,
      trim: true,
      default: "",
    },

    supplierType: {
      type: String,
      enum: [
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
      ],
      default: "Unknown",
    },

    // Confirmed/maintained material references.
    // Automatically discovered article mentions do not
    // populate this field.
    materialIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Material",
      },
    ],

    // Materials mentioned in supporting articles.
    // These are candidates, not proof of supply.
    candidateMaterials: [
      {
        type: String,
        trim: true,
        enum: [
          "Nickel",
          "Titanium",
          "Iridium",
          "Ruthenium",
        ],
      },
    ],

    // Article-supported roles connecting an organization
    // to a material. These remain unverified initially.
    potentialMaterialRelationships: {
      type: [
        potentialMaterialRelationshipSchema,
      ],
      default: [],
    },

    industries: [
      {
        type: String,
        trim: true,
      },
    ],

    verificationStatus: {
      type: String,
      enum: [
        "Unverified",
        "Potential",
        "Verified",
        "Inactive",
      ],
      default: "Unverified",
      required: true,
    },

    evidence: {
      type: [supplierEvidenceSchema],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Normalize the name consistently so repeated article
// mentions can update the same supplier record.
supplierSchema.pre("validate", function () {
  if (this.name) {
    this.normalizedName = this.name
      .trim()
      .toLocaleLowerCase("en");
  }
});

supplierSchema.index(
  {
    normalizedName: 1,
  },
  {
    unique: true,
  }
);

supplierSchema.index({
  country: 1,
  verificationStatus: 1,
});

supplierSchema.index({
  materialIds: 1,
});

supplierSchema.index({
  candidateMaterials: 1,
});

module.exports = mongoose.model(
  "Supplier",
  supplierSchema
);