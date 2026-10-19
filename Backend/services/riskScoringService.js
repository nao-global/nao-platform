const SCORE_WEIGHTS = Object.freeze({
  severity: 40,
  materialDependency: 25,
  operationalImpact: 25,
  trend: 10,
});

const SEVERITY_SCORES = Object.freeze({
  Low: 20,
  Medium: 45,
  High: 70,
  Critical: 95,
});

const TREND_SCORES = Object.freeze({
  Improving: 25,
  Stable: 50,
  Worsening: 90,
});

const FORMULA_VERSION = "nao-risk-v1";

const isValidScore = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100;

const getRiskScoreLevel = (score) => {
  if (!isValidScore(score)) return "Unknown";
  if (score < 40) return "Low";
  if (score < 60) return "Medium";
  if (score < 80) return "High";
  return "Critical";
};

/**
 * Calculates a 0–100 score for an individual risk.
 *
 * Unknown or missing factors are excluded.
 * Remaining weights are normalized so missing data
 * is not automatically treated as zero risk.
 */
const calculateRiskScore = ({
  severity,
  trend,
  materialDependencyScore,
  operationalImpactScore,
  calculatedAt = new Date(),
} = {}) => {
  const factors = [
    {
      key: "severity",
      label: "severity",
      score: Object.prototype.hasOwnProperty.call(
        SEVERITY_SCORES,
        severity
      )
        ? SEVERITY_SCORES[severity]
        : null,
      weight: SCORE_WEIGHTS.severity,
    },
    {
      key: "materialDependency",
      label: "materialDependencyScore",
      score: isValidScore(materialDependencyScore)
        ? materialDependencyScore
        : null,
      weight: SCORE_WEIGHTS.materialDependency,
    },
    {
      key: "operationalImpact",
      label: "operationalImpactScore",
      score: isValidScore(operationalImpactScore)
        ? operationalImpactScore
        : null,
      weight: SCORE_WEIGHTS.operationalImpact,
    },
    {
      key: "trend",
      label: "trend",
      score: Object.prototype.hasOwnProperty.call(
        TREND_SCORES,
        trend
      )
        ? TREND_SCORES[trend]
        : null,
      weight: SCORE_WEIGHTS.trend,
    },
  ];

  const availableFactors = factors.filter(
    (factor) => factor.score !== null
  );

  const missingFactors = factors
    .filter((factor) => factor.score === null)
    .map((factor) => factor.label);

  const availableWeight = availableFactors.reduce(
    (sum, factor) => sum + factor.weight,
    0
  );

  if (availableWeight === 0) {
    return {
      riskScore: null,
      riskScoreLevel: "Unknown",
      riskScoreCompleteness: "Unavailable",
      riskScoreBreakdown: {
        severityScore: undefined,
        materialDependencyScore: undefined,
        operationalImpactScore: undefined,
        trendScore: undefined,
        weightsUsed: {
          severity: 0,
          materialDependency: 0,
          operationalImpact: 0,
          trend: 0,
        },
        availableFactors: [],
        missingFactors,
        availableWeight: 0,
        formulaVersion: FORMULA_VERSION,
        calculatedAt,
      },
    };
  }

  const weightedTotal = availableFactors.reduce(
    (sum, factor) =>
      sum + factor.score * factor.weight,
    0
  );

  const riskScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(weightedTotal / availableWeight)
    )
  );

  const weightsUsed = {
    severity: 0,
    materialDependency: 0,
    operationalImpact: 0,
    trend: 0,
  };

  availableFactors.forEach((factor) => {
    weightsUsed[factor.key] = Number(
      (
        (factor.weight / availableWeight) *
        100
      ).toFixed(2)
    );
  });

  const scoreByKey = Object.fromEntries(
    factors.map((factor) => [
      factor.key,
      factor.score ?? undefined,
    ])
  );

  return {
    riskScore,
    riskScoreLevel: getRiskScoreLevel(riskScore),
    riskScoreCompleteness:
      missingFactors.length === 0
        ? "Complete"
        : "Partial",
    riskScoreBreakdown: {
      severityScore: scoreByKey.severity,
      materialDependencyScore:
        scoreByKey.materialDependency,
      operationalImpactScore:
        scoreByKey.operationalImpact,
      trendScore: scoreByKey.trend,
      weightsUsed,
      availableFactors: availableFactors.map(
        (factor) => factor.label
      ),
      missingFactors,
      availableWeight,
      formulaVersion: FORMULA_VERSION,
      calculatedAt,
    },
  };
};

module.exports = {
  calculateRiskScore,
  getRiskScoreLevel,
  SCORE_WEIGHTS,
  SEVERITY_SCORES,
  TREND_SCORES,
  FORMULA_VERSION,
};