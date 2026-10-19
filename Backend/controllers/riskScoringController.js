const Risk = require("../models/Risk");

const {
  calculateRiskScore,
} = require("../services/riskScoringService");

const {
  assessOperationalImpact,
} = require("../services/operationalImpactAssessmentService");

// ======================================================
// NORMALIZE LEGACY VALUES
// ======================================================

const normalizeLegacyTrend = (value) => {
  const trend = String(value ?? "Unknown")
    .trim()
    .toLowerCase();

  const trendMap = {
    improving: "Improving",
    decreasing: "Improving",
    stable: "Stable",
    worsening: "Worsening",
    increasing: "Worsening",
    unknown: "Unknown",
  };

  return trendMap[trend] || "Unknown";
};

const normalizeLegacySeverity = (value) => {
  const allowed = [
    "Low",
    "Medium",
    "High",
    "Critical",
    "Unknown",
  ];

  return allowed.includes(value)
    ? value
    : "Unknown";
};

const getRequestedLimit = (req, defaultValue = 5) => {
  const value = Number(
    req.body?.limit ??
    req.query.limit ??
    defaultValue
  );

  if (!Number.isInteger(value) || value < 1) {
    return null;
  }

  return Math.min(value, 10);
};

// ======================================================
// RECALCULATE EXISTING RISK SCORES
// No OpenAI calls are made by this endpoint.
// ======================================================

const recalculateRiskScores = async (req, res) => {
  try {
    const requestedLimit = Number(
      req.body?.limit ??
      req.query.limit ??
      500
    );

    const requestedSkip = Number(
      req.body?.skip ??
      req.query.skip ??
      0
    );

    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1
    ) {
      return res.status(400).json({
        message:
          "Limit must be a positive whole number.",
      });
    }

    if (
      !Number.isInteger(requestedSkip) ||
      requestedSkip < 0
    ) {
      return res.status(400).json({
        message:
          "Skip must be a non-negative whole number.",
      });
    }

    const limit = Math.min(requestedLimit, 1000);
    const total = await Risk.countDocuments();

    const risks = await Risk.find({})
      .populate("materialId")
      .sort({ createdAt: 1, _id: 1 })
      .skip(requestedSkip)
      .limit(limit);

    const updated = [];
    const failed = [];

    for (const risk of risks) {
      try {
        risk.trend = normalizeLegacyTrend(
          risk.trend
        );

        risk.severity = normalizeLegacySeverity(
          risk.severity
        );

        const score = calculateRiskScore({
          severity: risk.severity,
          trend: risk.trend,

          materialDependencyScore:
            risk.materialId?.dependencyScore,

          operationalImpactScore:
            risk.operationalImpactScore,
        });

        risk.riskScore =
          score.riskScore === null
            ? undefined
            : score.riskScore;

        risk.riskScoreLevel =
          score.riskScoreLevel;

        risk.riskScoreCompleteness =
          score.riskScoreCompleteness;

        risk.riskScoreBreakdown =
          score.riskScoreBreakdown;

        await risk.save();

        updated.push({
          riskId: risk._id,
          title: risk.title,
          material:
            risk.materialId?.name ||
            "Unlinked material",

          severity: risk.severity,
          trend: risk.trend,

          riskScore: score.riskScore,
          riskScoreLevel: score.riskScoreLevel,

          riskScoreCompleteness:
            score.riskScoreCompleteness,

          missingFactors:
            score.riskScoreBreakdown.missingFactors,
        });
      } catch (error) {
        failed.push({
          riskId: risk._id,
          title: risk.title,
          error: error.message,
        });
      }
    }

    const nextSkip =
      requestedSkip + risks.length < total
        ? requestedSkip + risks.length
        : null;

    return res.status(200).json({
      message:
        "Risk score recalculation finished.",

      totalRisks: total,
      found: risks.length,
      updatedCount: updated.length,
      failedCount: failed.length,

      completeCount: updated.filter(
        (item) =>
          item.riskScoreCompleteness === "Complete"
      ).length,

      partialCount: updated.filter(
        (item) =>
          item.riskScoreCompleteness === "Partial"
      ).length,

      unavailableCount: updated.filter(
        (item) =>
          item.riskScoreCompleteness === "Unavailable"
      ).length,

      nextSkip,
      updated,
      failed,
    });
  } catch (error) {
    console.error(
      "Risk score recalculation error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to recalculate risk scores.",
      error: error.message,
    });
  }
};

// ======================================================
// ASSESS MISSING OPERATIONAL-IMPACT SCORES
// This endpoint calls OpenAI.
// ======================================================

const assessMissingOperationalImpactScores =
  async (req, res) => {
    try {
      const limit = getRequestedLimit(req, 5);

      if (limit === null) {
        return res.status(400).json({
          message:
            "Limit must be a positive whole number.",
        });
      }

      const missingScoreFilter = {
        $or: [
          {
            operationalImpactScore: {
              $exists: false,
            },
          },
          {
            operationalImpactScore: null,
          },
        ],
      };

      const risks = await Risk.find(
        missingScoreFilter
      )
        .populate("materialId")
        .sort({ createdAt: 1, _id: 1 })
        .limit(limit);

      if (risks.length === 0) {
        return res.status(200).json({
          message:
            "No risks are missing operational-impact scores.",
          found: 0,
          assessedCount: 0,
          failedCount: 0,
          remaining: 0,
          assessed: [],
          failed: [],
        });
      }

      const assessed = [];
      const failed = [];

      // Sequential processing limits the number of
      // concurrent OpenAI requests.
      for (const risk of risks) {
        try {
          if (!risk.materialId) {
            throw new Error(
              "Risk is not linked to a valid material."
            );
          }

          const assessment =
            await assessOperationalImpact({
              risk,
              material: risk.materialId,
            });

          const normalizedSeverity =
            normalizeLegacySeverity(risk.severity);

          const normalizedTrend =
            normalizeLegacyTrend(risk.trend);

          risk.severity = normalizedSeverity;
          risk.trend = normalizedTrend;

          risk.operationalImpactScore =
            assessment.score;

          risk.operationalImpactAssessment = {
            rationale: assessment.rationale,
            confidence: assessment.confidence,
            model: assessment.model,
            assessedAt: assessment.assessedAt,
          };

          // Immediately recalculate the overall risk score
          // with the newly assessed operational-impact score.
          const score = calculateRiskScore({
            severity: normalizedSeverity,
            trend: normalizedTrend,

            materialDependencyScore:
              risk.materialId.dependencyScore,

            operationalImpactScore:
              assessment.score,
          });

          risk.riskScore =
            score.riskScore === null
              ? undefined
              : score.riskScore;

          risk.riskScoreLevel =
            score.riskScoreLevel;

          risk.riskScoreCompleteness =
            score.riskScoreCompleteness;

          risk.riskScoreBreakdown =
            score.riskScoreBreakdown;

          await risk.save();

          assessed.push({
            riskId: risk._id,
            title: risk.title,
            material: risk.materialId.name,

            operationalImpactScore:
              assessment.score,

            impactConfidence:
              assessment.confidence,

            impactRationale:
              assessment.rationale,

            riskScore: score.riskScore,
            riskScoreLevel: score.riskScoreLevel,

            riskScoreCompleteness:
              score.riskScoreCompleteness,

            missingFactors:
              score.riskScoreBreakdown.missingFactors,
          });
        } catch (error) {
          console.error(
            `Impact assessment failed for risk ${risk._id}:`,
            error.message
          );

          failed.push({
            riskId: risk._id,
            title: risk.title,
            error: error.message,
          });
        }
      }

      const remaining =
        await Risk.countDocuments(
          missingScoreFilter
        );

      return res.status(200).json({
        message:
          "Operational-impact assessment finished.",

        found: risks.length,
        assessedCount: assessed.length,
        failedCount: failed.length,
        remaining,

        assessed,
        failed,
      });
    } catch (error) {
      console.error(
        "Operational-impact assessment error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to assess operational-impact scores.",
        error: error.message,
      });
    }
  };

module.exports = {
  recalculateRiskScores,
  assessMissingOperationalImpactScores,
};