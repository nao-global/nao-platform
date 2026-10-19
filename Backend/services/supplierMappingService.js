const Supplier = require("../models/Supplier");

const normalizeForMatch = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const TRACKED_MATERIALS = [
  "Nickel",
  "Titanium",
  "Iridium",
  "Ruthenium",
];

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

const RELATIONSHIP_TYPES = [
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

const uniqueStrings = (values) => [
  ...new Set(
    values
      .filter(
        (value) => typeof value === "string"
      )
      .map((value) => value.trim())
      .filter(Boolean)
  ),
];

const normalizeConfidence = (value) =>
  ["Low", "Medium", "High"].includes(value)
    ? value
    : "Low";

const normalizeSupplierType = (value) =>
  SUPPLIER_TYPES.includes(value)
    ? value
    : "Unknown";

const isNamePresentInArticle = (
  name,
  articleText
) => {
  const normalizedName =
    normalizeForMatch(name);

  const normalizedArticle =
    normalizeForMatch(articleText);

  return (
    normalizedName.length > 0 &&
    normalizedArticle.includes(normalizedName)
  );
};

const normalizeOrganization = (
  organization,
  articleText,
  articleUrl
) => {
  if (
    !organization ||
    typeof organization.name !== "string"
  ) {
    return null;
  }

  const name = organization.name.trim();

  if (
    !name ||
    name.length > 150 ||
    !isNamePresentInArticle(name, articleText)
  ) {
    return null;
  }

  const relatedMaterials = uniqueStrings(
    Array.isArray(organization.relatedMaterials)
      ? organization.relatedMaterials
      : []
  ).filter((material) =>
    TRACKED_MATERIALS.includes(material)
  );

  const materialRelationships = (
    Array.isArray(
      organization.materialRelationships
    )
      ? organization.materialRelationships
      : []
  )
    .filter(
      (item) =>
        item &&
        TRACKED_MATERIALS.includes(item.material) &&
        RELATIONSHIP_TYPES.includes(
          item.relationshipType
        ) &&
        item.relationshipType !== "Unknown"
    )
    .map((item) => ({
      materialName: item.material,

      relationshipType:
        item.relationshipType,

      evidenceSummary:
        String(item.summary ?? "").trim() ||
        String(
          organization.evidenceSummary ?? ""
        ).trim() ||
        `Reported relationship extracted from ${articleUrl}.`,
    }));

  const combinedMaterials = uniqueStrings([
    ...relatedMaterials,
    ...materialRelationships.map(
      (item) => item.materialName
    ),
  ]).filter((material) =>
    TRACKED_MATERIALS.includes(material)
  );

  const country =
    typeof organization.country === "string" &&
    organization.country.trim()
      ? organization.country.trim()
      : "Unknown";

  const website =
    isHttpUrl(organization.website) &&
    articleText.includes(organization.website)
      ? organization.website
      : undefined;

  return {
    name,

    normalizedName:
      normalizeForMatch(name),

    country,

    website,

    supplierType:
      normalizeSupplierType(
        organization.supplierType
      ),

    description:
      String(
        organization.roleDescription ?? ""
      ).trim() ||
      "Organization mentioned in a relevant article; its exact role requires review.",

    relatedMaterials: combinedMaterials,

    materialRelationships,

    industries: [],

    confidence: normalizeConfidence(
      organization.confidence
    ),

    evidenceSummary:
      String(
        organization.evidenceSummary ?? ""
      ).trim() ||
      "The organization was named in the article. Its supply-chain relationship has not been independently verified.",
  };
};

const createSupplierEvidence = (
  sourceUrl,
  summary
) => ({
  sourceUrl,
  summary,
  recordedAt: new Date(),
});

const findOrCreateSupplier = async (
  organization,
  sourceUrl
) => {
  let supplier = await Supplier.findOne({
    normalizedName:
      organization.normalizedName,
  });

  let created = false;

  if (!supplier) {
    const website = organization.website;

    const supplierData = {
      name: organization.name,

      normalizedName:
        organization.normalizedName,

      country: organization.country,

      website,

      description:
        organization.description,

      supplierType:
        organization.supplierType,

      // This discovery service never makes an
      // organization a confirmed material supplier.
      materialIds: [],

      candidateMaterials:
        organization.relatedMaterials,

      potentialMaterialRelationships:
        organization.materialRelationships.map(
          (item) => ({
            materialName: item.materialName,

            relationshipType:
              item.relationshipType,

            verificationStatus: "Unverified",

            confidence:
              organization.confidence,

            evidenceUrl: sourceUrl,

            evidenceSummary:
              item.evidenceSummary,

            lastSeenAt: new Date(),
          })
        ),

      industries: organization.industries,

      verificationStatus: "Unverified",

      evidence: [
        createSupplierEvidence(
          sourceUrl,
          organization.evidenceSummary
        ),
      ],

      lastSeenAt: new Date(),
    };

    try {
      supplier = await Supplier.create(
        supplierData
      );

      created = true;
    } catch (error) {
      // Handle two articles attempting to create
      // the same normalized company name at once.
      if (error.code !== 11000) {
        throw error;
      }

      supplier = await Supplier.findOne({
        normalizedName:
          organization.normalizedName,
      });

      if (!supplier) {
        throw error;
      }
    }
  }

  let changed = created;

  if (!created) {
    supplier.lastSeenAt = new Date();
    changed = true;

    if (
      (!supplier.country ||
        supplier.country === "Unknown") &&
      organization.country !== "Unknown"
    ) {
      supplier.country = organization.country;
    }

    if (
      (!supplier.website ||
        !supplier.website.trim()) &&
      organization.website
    ) {
      supplier.website =
        organization.website;
    }

    if (
      (!supplier.description ||
        !supplier.description.trim()) &&
      organization.description
    ) {
      supplier.description =
        organization.description;
    }

    if (
      ["Unknown", "Other"].includes(
        supplier.supplierType
      ) &&
      !["Unknown", "Other"].includes(
        organization.supplierType
      )
    ) {
      supplier.supplierType =
        organization.supplierType;
    }

    // Keep candidate materials separate from confirmed
    // Material ObjectId relationships.
    supplier.candidateMaterials =
      uniqueStrings([
        ...(supplier.candidateMaterials || []),
        ...organization.relatedMaterials,
      ]).filter((material) =>
        TRACKED_MATERIALS.includes(material)
      );

    supplier.industries = uniqueStrings([
      ...(supplier.industries || []),
      ...organization.industries,
    ]);

    // Save evidence once per article URL.
    const hasEvidence =
      (supplier.evidence || []).some(
        (item) =>
          item.sourceUrl === sourceUrl
      );

    if (!hasEvidence) {
      supplier.evidence.push(
        createSupplierEvidence(
          sourceUrl,
          organization.evidenceSummary
        )
      );
    }

    // Keep article-based material relationships
    // idempotent. Do not downgrade a relationship
    // that has already been verified by a separate process.
    for (const relationship of
      organization.materialRelationships) {
      const existing =
        supplier.potentialMaterialRelationships
          .find(
            (item) =>
              item.materialName ===
                relationship.materialName &&
              item.relationshipType ===
                relationship.relationshipType &&
              item.evidenceUrl === sourceUrl
          );

      if (!existing) {
        supplier.potentialMaterialRelationships.push({
          materialName:
            relationship.materialName,

          relationshipType:
            relationship.relationshipType,

          verificationStatus: "Unverified",

          confidence: organization.confidence,

          evidenceUrl: sourceUrl,

          evidenceSummary:
            relationship.evidenceSummary,

          lastSeenAt: new Date(),
        });
      } else {
        existing.lastSeenAt = new Date();

        if (
          existing.verificationStatus !==
          "Verified"
        ) {
          existing.confidence =
            organization.confidence;

          existing.evidenceSummary =
            relationship.evidenceSummary;
        }
      }
    }

    await supplier.save();
  }

  return {
    supplier,
    created,
    changed,
  };
};

const linkSupplierToRisk = async ({
  supplier,
  risk,
  organization,
  sourceUrl,
}) => {
  if (!Array.isArray(risk.supplierExposures)) {
    risk.supplierExposures = [];
  }

  const existingExposure =
    risk.supplierExposures.find(
      (item) =>
        String(item.supplierId) ===
        String(supplier._id)
    );

  const evidenceSummary = [
    organization.roleDescription,
    organization.evidenceSummary,
  ]
    .filter(Boolean)
    .join(" ");

  if (existingExposure) {
    // Do not downgrade a manually verified supplier
    // relationship just because another article mentions it.
    const isAlreadyVerified =
      existingExposure.verificationStatus ===
        "Verified" ||
      existingExposure.relationship ===
        "VerifiedSupplier";

    if (!isAlreadyVerified) {
      existingExposure.relationship =
        "MentionedInArticle";

      existingExposure.verificationStatus =
        "Unverified";

      existingExposure.confidence =
        organization.confidence;

      existingExposure.evidenceUrl =
        sourceUrl;

      existingExposure.evidenceSummary =
        evidenceSummary;
    }

    await risk.save();

    return {
      created: false,
    };
  }

  risk.supplierExposures.push({
    supplierId: supplier._id,

    relationship: "MentionedInArticle",

    verificationStatus: "Unverified",

    confidence: organization.confidence,

    evidenceUrl: sourceUrl,

    evidenceSummary,
  });

  await risk.save();

  return {
    created: true,
  };
};

// ======================================================
// EXTRACTED ORGANIZATIONS -> SUPPLIERS -> RISKS
// No new OpenAI calls are made by this service.
// ======================================================

const mapOrganizationsToRisks = async ({
  organizations,
  article,
  riskLinks,
  industryImpacts = [],
}) => {
  const result = {
    organizationsReceived: Array.isArray(
      organizations
    )
      ? organizations.length
      : 0,

    suppliersCreated: 0,
    suppliersUpdated: 0,

    riskLinksCreated: 0,
    riskLinksAlreadyPresent: 0,

    skipped: [],
    failed: [],
  };

  if (
    !Array.isArray(organizations) ||
    organizations.length === 0
  ) {
    return result;
  }

  const sourceUrl = article?.url;

  if (!isHttpUrl(sourceUrl)) {
    result.skipped.push({
      reason:
        "Article has no valid HTTP or HTTPS URL, so supplier evidence cannot be recorded.",
    });

    return result;
  }

  const articleText = [
    article?.title,
    article?.description,
    article?.content,
  ]
    .filter(Boolean)
    .join("\n");

  const normalizedIndustryImpacts = (
    Array.isArray(industryImpacts)
      ? industryImpacts
      : []
  )
    .filter((item) => item?.industry)
    .map((item) => String(item.industry).trim())
    .filter(Boolean);

  const riskEntries = (
    Array.isArray(riskLinks)
      ? riskLinks
      : []
  );

  const seenOrganizations = new Set();

  for (const rawOrganization of organizations) {
    try {
      const organization = normalizeOrganization(
        rawOrganization,
        articleText,
        sourceUrl
      );

      if (!organization) {
        result.skipped.push({
          name: rawOrganization?.name || "Unknown",
          reason:
            "The organization name was missing or not found in the source article.",
        });

        continue;
      }

      if (
        seenOrganizations.has(
          organization.normalizedName
        )
      ) {
        continue;
      }

      seenOrganizations.add(
        organization.normalizedName
      );

      // Link only to risks whose material is explicitly
      // associated with this organization by the analysis.
      const matchingRiskEntries =
        riskEntries.filter((entry) => {
          const materialName =
            String(entry.materialName ?? "");

          return (
            organization.relatedMaterials.some(
              (material) =>
                material.toLowerCase() ===
                materialName.toLowerCase()
            )
          );
        });

      if (matchingRiskEntries.length === 0) {
        result.skipped.push({
          name: organization.name,
          reason:
            "No risk for an article-related material matched this organization.",
        });

        continue;
      }

      organization.industries =
        normalizedIndustryImpacts;

      const upsert = await findOrCreateSupplier(
        organization,
        sourceUrl
      );

      const supplier = upsert.supplier;

      if (upsert.created) {
        result.suppliersCreated++;
      } else {
        result.suppliersUpdated++;
      }

      // Add this article as evidence without turning
      // the company into a verified raw-material supplier.
      for (const entry of matchingRiskEntries) {
        const linkResult =
          await linkSupplierToRisk({
            supplier,
            risk: entry.risk,
            organization,
            sourceUrl,
          });

        if (linkResult.created) {
          result.riskLinksCreated++;
        } else {
          result.riskLinksAlreadyPresent++;
        }
      }
    } catch (error) {
      result.failed.push({
        name:
          rawOrganization?.name || "Unknown",
        error: error.message,
      });
    }
  }

  return result;
};

module.exports = {
  mapOrganizationsToRisks,
};