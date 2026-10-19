
const Risk = require("../models/Risk");
const Material = require("../models/Material");

const {
  calculateRiskScore,
} = require("./riskScoringService");

const {
  mapOrganizationsToRisks,
} = require("./supplierMappingService");

// ======================================================
// HELPERS
// ======================================================

const normalizeMaterialName = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const escapeRegex = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSeverity = (value) => {
  const values = {
    low: "Low",
    medium: "Medium",
    moderate: "Medium",
    high: "High",
    critical: "Critical",
    unknown: "Unknown",
  };

  return (
    values[String(value ?? "").trim().toLowerCase()] ||
    "Unknown"
  );
};

const normalizeTrend = (value) => {
  const values = {
    improving: "Improving",
    stable: "Stable",
    worsening: "Worsening",
    deteriorating: "Worsening",
    unknown: "Unknown",
  };

  return (
    values[String(value ?? "").trim().toLowerCase()] ||
    "Unknown"
  );
};

const normalizeScore = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  const score = Number(value);

  return Number.isFinite(score) && score >= 0 && score <= 100
    ? score
    : undefined;
};

const getAffectedMaterials = (analysis) => {
  const values = [];

  if (Array.isArray(analysis?.affectedMaterials)) {
    values.push(...analysis.affectedMaterials);
  }

  if (Array.isArray(analysis?.materials)) {
    values.push(...analysis.materials);
  }

  if (analysis?.material) {
    values.push(analysis.material);
  }

  return [
    ...new Set(
      values
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }

          return String(
            item?.name || item?.material || ""
          ).trim();
        })
        .filter(Boolean)
    ),
  ];
};

const getArticleUrl = (article) =>
  String(article?.url || article?.sourceUrl || "").trim();

const getArticleSource = (article) => {
  if (typeof article?.source === "string") {
    return article.source.trim() || "Unknown";
  }

  return String(article?.source?.name || "Unknown").trim();
};

const getPublishedAt = (article) => {
  if (!article?.publishedAt) {
    return undefined;
  }

  const date = new Date(article.publishedAt);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const cleanIndustryImpacts = (impacts) => {
  if (!Array.isArray(impacts)) {
    return [];
  }

  const seen = new Set();

  return impacts
    .filter(
      (item) =>
        item &&
        typeof item.industry === "string" &&
        typeof item.impact === "string" &&
        item.industry.trim() &&
        item.impact.trim()
    )
    .filter((item) => {
      const key =
        `${item.industry.trim().toLowerCase()}|` +
        item.impact.trim().toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .map((item) => ({
      industry: item.industry.trim(),
      impact: item.impact.trim(),
    }));
};

const cleanRecommendations = (recommendations) => {
  if (!Array.isArray(recommendations)) {
    return [];
  }

  return recommendations
    .filter(
      (item) =>
        item &&
        typeof item.title === "string" &&
        typeof item.description === "string" &&
        item.title.trim() &&
        item.description.trim()
    )
    .map((item) => ({
      title: item.title.trim(),
      description: item.description.trim(),
      priority: ["High", "Medium", "Low"].includes(
        item.priority
      )
        ? item.priority
        : "Medium",
    }));
};

const getEvidenceHash = (analysis, article) => {
  const value =
    article?.contentHash ||
    article?.evidenceHash ||
    analysis?.evidenceHash;

  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
};

// ======================================================
// MATERIAL LOOKUP
// ======================================================

const findMaterial = async (name) => {
  const normalized = normalizeMaterialName(name);

  if (!normalized) {
    return null;
  }

  const escapedName = escapeRegex(String(name).trim());

  // Prefer a database lookup, then compare normalized names
  // to handle differences in capitalization and punctuation.
  const exact = await Material.findOne({
    name: {
      $regex: `^${escapedName}$`,
      $options: "i",
    },
  });

  if (exact) {
    return exact;
  }

  const materials = await Material.find({});

  return (
    materials.find(
      (item) =>
        normalizeMaterialName(item.name) === normalized
    ) || null
  );
};

// ======================================================
// RISK SCORING
// Compatible with riskScoringService.js
// ======================================================

const calculateRiskFields = (riskData, material) => {
  const calculated = calculateRiskScore({
    severity: riskData.severity,
    trend: riskData.trend,
    materialDependencyScore: normalizeScore(
      material?.dependencyScore
    ),
    operationalImpactScore: normalizeScore(
      riskData.operationalImpactScore
    ),
  });

  return {
    riskScore: calculated.riskScore,
    riskScoreLevel: calculated.riskScoreLevel,
    riskScoreCompleteness:
      calculated.riskScoreCompleteness,
    riskScoreBreakdown: calculated.riskScoreBreakdown,
  };
};

// ======================================================
// EXISTING RISK LOOKUP
// ======================================================

const findExistingRisk = async ({
  materialId,
  sourceUrl,
  title,
}) => {
  if (sourceUrl) {
    const existingByUrl = await Risk.findOne({
      materialId,
      sourceUrl,
    });

    if (existingByUrl) {
      return existingByUrl;
    }
  }

  if (title) {
    return Risk.findOne({
      materialId,
      title: {
        $regex: `^${escapeRegex(title)}$`,
        $options: "i",
      },
    });
  }

  return null;
};

// ======================================================
// SAVE OR UPDATE RISKS FROM NEWS ANALYSIS
// ======================================================

const saveRisksFromAnalysis = async ({
  aiAnalysis,
  article,
}) => {
  const result = {
    saved: [],
    existing: [],
    updated: [],
    skipped: [],
    riskLinks: [],
    supplierMapping: null,
  };

  if (!aiAnalysis || typeof aiAnalysis !== "object") {
    throw new Error("A valid AI analysis is required.");
  }

  if (!article || typeof article !== "object") {
    throw new Error("Article data is required.");
  }

  if (aiAnalysis.isRelevant !== true) {
    result.skipped.push({
      reason: "Article is not relevant to NAO risk intelligence.",
    });

    return result;
  }

  const materialNames = getAffectedMaterials(aiAnalysis);

  if (materialNames.length === 0) {
    result.skipped.push({
      reason: "No affected materials were identified.",
    });

    return result;
  }

  const sourceUrl = getArticleUrl(article);
  const source = getArticleSource(article);
  const publishedAt = getPublishedAt(article);
  const evidenceHash = getEvidenceHash(aiAnalysis, article);

  const title =
    String(aiAnalysis.title || article.title || "").trim();

  const description =
    typeof aiAnalysis.description === "string"
      ? aiAnalysis.description.trim()
      : "";

  const operationalImpact =
    typeof aiAnalysis.operationalImpact === "string"
      ? aiAnalysis.operationalImpact.trim()
      : "";

  if (!title || !description || !operationalImpact) {
    result.skipped.push({
      reason:
        "The analysis is missing a title, description, or operational impact.",
    });

    return result;
  }

  const severity = normalizeSeverity(aiAnalysis.severity);
  const trend = normalizeTrend(aiAnalysis.trend);

  const operationalImpactScore = normalizeScore(
    aiAnalysis.operationalImpactScore
  );

  const location =
    typeof aiAnalysis.location === "string" &&
    aiAnalysis.location.trim()
      ? aiAnalysis.location.trim()
      : "Unknown";

  const industryImpacts = cleanIndustryImpacts(
    aiAnalysis.industryImpacts
  );

  const recommendations = cleanRecommendations(
    aiAnalysis.recommendations
  );

  const assessment =
    aiAnalysis.operationalImpactAssessment;

  const operationalImpactAssessment =
    assessment && typeof assessment === "object"
      ? {
          ...(typeof assessment.rationale === "string"
            ? { rationale: assessment.rationale.trim() }
            : {}),
          ...( ["Low", "Medium", "High"].includes(
            assessment.confidence
          )
            ? { confidence: assessment.confidence }
            : {}),
          ...(typeof assessment.model === "string"
            ? { model: assessment.model }
            : {}),
          assessedAt: new Date(),
        }
      : undefined;

  const riskLinks = [];

  for (const materialName of materialNames) {
    const material = await findMaterial(materialName);

    if (!material) {
      result.skipped.push({
        material: materialName,
        reason: "Material not found in the NAO database.",
      });

      continue;
    }

    const riskData = {
      materialId: material._id,
      title,
      severity,
      location,
      description,
      operationalImpact,
      trend,
      industryImpacts,
      sourceUrl: sourceUrl || undefined,
      source,
      publishedAt,
    };

    if (operationalImpactScore !== undefined) {
      riskData.operationalImpactScore =
        operationalImpactScore;
    }

    if (operationalImpactAssessment) {
      riskData.operationalImpactAssessment =
        operationalImpactAssessment;
    }

    const scoreFields = calculateRiskFields(
      riskData,
      material
    );

    Object.assign(riskData, scoreFields);

    let risk = await findExistingRisk({
      materialId: material._id,
      sourceUrl,
      title,
    });

    if (risk) {
      // Preserve existing recommendations and supplier exposures.
      // New recommendations are added only when they are not
      // already present; existing manually curated items remain.
      const existingRecommendations = cleanRecommendations(
        risk.recommendations
      );

      const recommendationKeys = new Set(
        existingRecommendations.map(
          (item) =>
            `${item.title.toLowerCase()}|${item.description.toLowerCase()}`
        )
      );

      const mergedRecommendations = [
        ...existingRecommendations,
      ];

      for (const recommendation of recommendations) {
        const key =
          `${recommendation.title.toLowerCase()}|` +
          recommendation.description.toLowerCase();

        if (!recommendationKeys.has(key)) {
          recommendationKeys.add(key);
          mergedRecommendations.push(recommendation);
        }
      }

      risk.title = riskData.title;
      risk.severity = riskData.severity;
      risk.location = riskData.location;
      risk.description = riskData.description;
      risk.operationalImpact = riskData.operationalImpact;
      risk.trend = riskData.trend;

      if (riskData.sourceUrl) {
        risk.sourceUrl = riskData.sourceUrl;
      }

      if (riskData.source) {
        risk.source = riskData.source;
      }

      if (riskData.publishedAt) {
        risk.publishedAt = riskData.publishedAt;
      }

      if (riskData.operationalImpactScore !== undefined) {
        risk.operationalImpactScore =
          riskData.operationalImpactScore;
      }

      if (riskData.operationalImpactAssessment) {
        risk.operationalImpactAssessment =
          riskData.operationalImpactAssessment;
      }

      if (industryImpacts.length > 0) {
        risk.industryImpacts = cleanIndustryImpacts([
          ...(risk.industryImpacts || []),
          ...industryImpacts,
        ]);
      }

      risk.recommendations = mergedRecommendations;

      risk.riskScore = scoreFields.riskScore;
      risk.riskScoreLevel = scoreFields.riskScoreLevel;
      risk.riskScoreCompleteness =
        scoreFields.riskScoreCompleteness;
      risk.riskScoreBreakdown =
        scoreFields.riskScoreBreakdown;

      if (evidenceHash) {
        risk.evidenceHash = evidenceHash;
      }

      // AI analysis alone does not verify a supplier relationship.
      // This status means the risk has passed the application's
      // news-analysis and database-persistence workflow.
      risk.evidenceStatus = "Verified";
      risk.evidenceVerifiedAt = new Date();

      await risk.save();

      result.updated.push(risk);
      result.existing.push(risk);

      riskLinks.push({
        risk,
        riskId: risk._id,
        materialId: material._id,
        materialName: material.name,
      });

      continue;
    }

    // Do not mark evidence verified until the initial database
    // write succeeds.
    risk = new Risk({
      ...riskData,
      recommendations,
      supplierExposures: [],
      evidenceStatus: "Unverified",
      evidenceVerifiedAt: null,
      evidenceHash,
    });

    try {
      await risk.save();
    } catch (error) {
      // Handle a concurrent request that inserted the same risk.
      if (error.code !== 11000) {
        throw error;
      }

      risk = await findExistingRisk({
        materialId: material._id,
        sourceUrl,
        title,
      });

      if (!risk) {
        throw error;
      }

      result.existing.push(risk);
    }

    // Only newly created risks and existing risks that successfully
    // passed the update path are marked verified.
    if (!result.existing.includes(risk)) {
      risk.evidenceStatus = "Verified";
      risk.evidenceVerifiedAt = new Date();

      if (evidenceHash) {
        risk.evidenceHash = evidenceHash;
      }

      await risk.save();
      result.saved.push(risk);
    }

    riskLinks.push({
      risk,
      riskId: risk._id,
      materialId: material._id,
      materialName: material.name,
    });
  }

  result.riskLinks = riskLinks;

  // Supplier mapping expects each riskLinks entry to contain
  // the actual risk document and materialName.
  if (riskLinks.length > 0) {
    try {
      result.supplierMapping = await mapOrganizationsToRisks({
        organizations: Array.isArray(aiAnalysis.organizations)
          ? aiAnalysis.organizations
          : [],
        article,
        riskLinks,
        industryImpacts,
      });
    } catch (error) {
      // Supplier mapping failures must not delete persisted risks.
      console.error(
        "NAO supplier mapping failed:",
        error.message
      );

      result.supplierMapping = {
        error: error.message,
      };
    }
  }

  return result;
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  saveRisksFromAnalysis,
};
