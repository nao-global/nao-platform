const assert = require("node:assert/strict");

const {
  calculateRiskScore,
  getRiskScoreLevel,
} = require("../services/riskScoringService");

// Test a complete score.
const completeScore = calculateRiskScore({
  severity: "High",
  trend: "Worsening",
  materialDependencyScore: 80,
  operationalImpactScore: 75,
});

assert.equal(
  completeScore.riskScoreCompleteness,
  "Complete"
);

assert.equal(completeScore.riskScore, 76);
assert.equal(completeScore.riskScoreLevel, "High");

assert.deepEqual(
  completeScore.riskScoreBreakdown.missingFactors,
  []
);

assert.equal(
  Object.values(
    completeScore.riskScoreBreakdown.weightsUsed
  ).reduce((sum, value) => sum + value, 0),
  100
);

// Test a partial score when operational-impact
// evidence is not yet available.
const partialScore = calculateRiskScore({
  severity: "Medium",
  trend: "Stable",
  materialDependencyScore: 81,
});

assert.equal(
  partialScore.riskScoreCompleteness,
  "Partial"
);

assert.equal(partialScore.riskScore, 58);

assert.deepEqual(
  partialScore.riskScoreBreakdown.missingFactors,
  ["operationalImpactScore"]
);

// Test a score with no available factors.
const unavailableScore = calculateRiskScore({
  severity: "Unknown",
  trend: "Unknown",
});

assert.equal(unavailableScore.riskScore, null);

assert.equal(
  unavailableScore.riskScoreLevel,
  "Unknown"
);

assert.equal(
  unavailableScore.riskScoreCompleteness,
  "Unavailable"
);

// Test score-band boundaries.
assert.equal(getRiskScoreLevel(80), "Critical");
assert.equal(getRiskScoreLevel(39), "Low");

console.log("Risk scoring tests passed.");