import "./Dashboard.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  FaExclamationCircle,
  FaBox,
  FaProjectDiagram,
  FaClipboardList,
  FaGlobe,
  FaBroadcastTower,
  FaArrowRight,
  FaShieldAlt,
  FaDollarSign,
  FaChartLine,
  FaIndustry,
  FaSyncAlt,
  FaExclamationTriangle,
  FaCube,
  FaCheckCircle,
} from "react-icons/fa";

const API_BASE = "https://nao-ysu5.onrender.com/api";
const REFRESH_INTERVAL = 60000;

const severityOrder = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
};

function getSeverity(risk) {
  return String(risk?.severity || "Unknown").toLowerCase();
}

function getTrend(risk) {
  return String(risk?.trend || "Unknown").toLowerCase();
}

function titleCase(value) {
  if (!value) return "Not available";

  const text = String(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getMaterialId(risk) {
  const material = risk?.materialId;

  if (typeof material === "string") return material;
  if (material?._id) return String(material._id);

  return null;
}

function getMaterialName(risk) {
  const material = risk?.materialId;

  if (material && typeof material === "object" && material.name) {
    return material.name;
  }

  return "Material not linked";
}

function getRecommendations(risks) {
  return risks.flatMap((risk) => {
    const items = Array.isArray(risk.recommendations)
      ? risk.recommendations
      : [];

    return items.map((item) => ({
      ...(typeof item === "object" && item !== null
        ? item
        : { description: String(item) }),
      riskTitle: risk.title || "Supply chain risk",
      riskSeverity: risk.severity || "Unknown",
    }));
  });
}

function Dashboard() {
  const [risks, setRisks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboard = useCallback(async (automatic = false) => {
    if (automatic) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [riskResponse, materialResponse] = await Promise.all([
        axios.get(`${API_BASE}/risks`),
        axios.get(`${API_BASE}/materials`),
      ]);

      const riskData = riskResponse.data;
      const materialData = materialResponse.data;

      setRisks(
        Array.isArray(riskData)
          ? riskData
          : Array.isArray(riskData?.risks)
            ? riskData.risks
            : []
      );

      setMaterials(
        Array.isArray(materialData)
          ? materialData
          : Array.isArray(materialData?.materials)
            ? materialData.materials
            : []
      );

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Unable to load NAO dashboard:", err);

      setError(
        "Unable to load live NAO data. Check your connection and try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();

    const interval = setInterval(() => {
      fetchDashboard(true);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const prioritizedRisks = useMemo(
    () =>
      [...risks].sort(
        (a, b) =>
          (severityOrder[getSeverity(a)] ?? 4) -
          (severityOrder[getSeverity(b)] ?? 4)
      ),
    [risks]
  );

  const primaryRisk = prioritizedRisks[0] || null;

  const highCriticalCount = risks.filter((risk) =>
    ["high", "critical"].includes(getSeverity(risk))
  ).length;

  const overallExposure = highCriticalCount
    ? "HIGH"
    : risks.some((risk) => getSeverity(risk) === "medium")
      ? "ELEVATED"
      : risks.length
        ? "LOW"
        : "UNKNOWN";

  const recommendations = useMemo(
    () => getRecommendations(prioritizedRisks),
    [prioritizedRisks]
  );

  const supplierDependencyCount = useMemo(() => {
    const supplierIds = new Set();

    risks.forEach((risk) => {
      const exposures = Array.isArray(risk.supplierExposures)
        ? risk.supplierExposures
        : [];

      exposures.forEach((exposure) => {
        const supplier =
          exposure?.supplierId ||
          exposure?.supplier ||
          exposure?.supplierRecord;

        if (typeof supplier === "string") {
          supplierIds.add(supplier);
        } else if (supplier?._id) {
          supplierIds.add(String(supplier._id));
        }
      });
    });

    return supplierIds.size;
  }, [risks]);

  const primaryMaterial = materials.find(
    (material) =>
      String(material._id) === String(getMaterialId(primaryRisk))
  );

  const supplierExposures = Array.isArray(primaryRisk?.supplierExposures)
    ? primaryRisk.supplierExposures
    : [];

  const industryImpacts = Array.isArray(primaryRisk?.industryImpacts)
    ? primaryRisk.industryImpacts
    : [];

  const primaryRecommendations = Array.isArray(primaryRisk?.recommendations)
    ? primaryRisk.recommendations
    : [];

  const regions = [
    ...new Set(
      risks
        .map((risk) => risk.location)
        .filter(
          (location) =>
            location && String(location).toLowerCase() !== "unknown"
        )
    ),
  ];

  const updatedAt = lastUpdated
    ? lastUpdated.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Waiting for data";

  const trend = getTrend(primaryRisk);

  const trendSymbol = ["increasing", "worsening"].includes(trend)
    ? "↗"
    : ["decreasing", "improving"].includes(trend)
      ? "↘"
      : trend === "stable"
        ? "→"
        : "—";

  // Navigate directly to the selected risk's details.
  const openRiskDetails = (risk) => {
    if (!risk?._id) {
      console.error("Cannot open risk details: risk ID is missing.");
      return;
    }

    window.location.href = `/risks/${encodeURIComponent(risk._id)}`;
  };

  const handleRiskKeyDown = (event, risk) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRiskDetails(risk);
    }
  };

  return (
    <div className="nao-dashboard">
      <header className="dashboard-topbar">
        <div>
          <h1>NAO Risk View</h1>
          <p>Strategic Materials Intelligence</p>
        </div>

        <div className="dashboard-topbar-right">
          <span className="dashboard-updated">
            <FaSyncAlt />
            Last updated: {updatedAt}
          </span>

          <span className="business-unit-chip">
            <FaIndustry />
            All Business Units
          </span>

          <button
            type="button"
            className="dashboard-refresh"
            onClick={() => fetchDashboard(true)}
            disabled={loading || refreshing}
          >
            <FaSyncAlt
              className={refreshing ? "refresh-spinning" : ""}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="dashboard-error" role="alert">
          <FaExclamationTriangle />
          <span>{error}</span>
          <button type="button" onClick={() => fetchDashboard()}>
            Try again
          </button>
        </div>
      )}

      <main className="dashboard-content">
        <section className="dashboard-overview">
          <article className="overview-card">
            <div>
              <span className="overview-label">Overall Risk Exposure</span>
              <strong
                className={`overview-exposure ${overallExposure.toLowerCase()}`}
              >
                {loading && !risks.length ? "..." : overallExposure}
              </strong>
              <span className="overview-footnote">
                {highCriticalCount} high / critical risks
              </span>
            </div>

            <div className="overview-icon exposure-icon">
              <FaExclamationCircle />
            </div>
          </article>

          <article className="overview-card">
            <div>
              <span className="overview-label">Affected Products</span>
              <strong className="overview-number">
                {loading ? "..." : materials.length}
              </strong>
              <span className="overview-footnote">Tracked materials</span>
            </div>

            <div className="overview-icon neutral-icon">
              <FaCube />
            </div>
          </article>

          <article className="overview-card">
            <div>
              <span className="overview-label">Critical Dependencies</span>
              <strong className="overview-number">—</strong>
              <span className="overview-footnote">
                Supplier dependency tracking coming soon
              </span>
            </div>

            <div className="overview-icon neutral-icon">
              <FaProjectDiagram />
            </div>
          </article>

          <article className="overview-card">
            <div>
              <span className="overview-label">Recommended Actions</span>
              <strong className="overview-number">
                {loading ? "..." : recommendations.length}
              </strong>
              <span className="overview-footnote">
                Recorded recommendations
              </span>
            </div>

            <div className="overview-icon action-icon">
              <FaClipboardList />
            </div>
          </article>
        </section>

        <div className="dashboard-live-note">
          <span className="live-indicator" />
          Live backend data · Refreshes every 60 seconds
          <span>
            {lastUpdated
              ? `Last checked ${lastUpdated.toLocaleString()}`
              : "Waiting for data"}
          </span>
        </div>

        
<section
  className="primary-disruption primary-disruption-clickable"
  role="link"
  tabIndex={0}
  aria-label={`View details for ${primaryRisk?.title || "primary disruption"}`}
  onClick={() => {
    if (primaryRisk?._id) {
      window.location.href = `/risks/${encodeURIComponent(primaryRisk._id)}`;
    }
  }}
  onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      if (primaryRisk?._id) {
        window.location.href = `/risks/${encodeURIComponent(primaryRisk._id)}`;
      }
    }
  }}
>
  <div className="primary-disruption-icon">
    <FaGlobe />
  </div>

  <div className="primary-disruption-main">
    <span className="section-eyebrow">PRIMARY DISRUPTION</span>

    <h2>
      {primaryRisk?.title ||
        (loading ? "Loading risk information..." : "No risks available")}
    </h2>

    <p>
      {primaryRisk?.description ||
        "The leading recorded risk will appear here when available."}
    </p>
  </div>


          <div className="disruption-meta">
            <span className="section-eyebrow">Risk Type</span>
            <strong>{primaryRisk?.riskType || "Not classified"}</strong>
          </div>

          <div className="disruption-meta">
            <span className="section-eyebrow">Affected Region</span>
            <strong>{primaryRisk?.location || "Not specified"}</strong>
          </div>

          <div className="disruption-meta">
            <span className="section-eyebrow">Severity</span>
            <span className={`severity-pill ${getSeverity(primaryRisk)}`}>
              {primaryRisk ? titleCase(getSeverity(primaryRisk)) : "Unknown"}
            </span>
          </div>
        </section>

        <div className="dashboard-main-grid">
          <section className="dashboard-panel exposure-panel">
            <div className="panel-heading">
              <div>
                <span className="section-eyebrow">EXPOSURE MAPPING</span>
                <h2>How a disruption affects materials</h2>
              </div>
            </div>

            <div className="exposure-flow">
              <article className="exposure-step">
                <span className="step-title">Disruption Signal</span>
                <div className="step-icon signal-icon">
                  <FaBroadcastTower />
                </div>
                <strong>{primaryRisk?.title || "No risk selected"}</strong>
                <span>{primaryRisk?.location || "Location unavailable"}</span>
              </article>

              <FaArrowRight className="flow-arrow" />

              <article className="exposure-step">
                <span className="step-title">Strategic Material</span>
                <div className="step-icon material-icon">
                  <FaCube />
                </div>
                <strong>
                  {primaryMaterial?.name || getMaterialName(primaryRisk)}
                </strong>
                <span>
                  {primaryMaterial?.category || "Category unavailable"}
                </span>
              </article>

              <FaArrowRight className="flow-arrow" />

              <article className="exposure-step">
                <span className="step-title">Critical Dependency</span>
                <div className="step-icon dependency-icon">
                  <FaProjectDiagram />
                </div>
                <strong>
                  {supplierExposures.length
                    ? `${supplierExposures.length} supplier links`
                    : "Not linked"}
                </strong>
                <span>Supplier records associated with this risk</span>
              </article>

              <FaArrowRight className="flow-arrow" />

              <article className="exposure-step">
                <span className="step-title">Exposed Products</span>
                <div className="step-icon product-icon">
                  <FaBox />
                </div>
                <strong>Not mapped</strong>
                <span>Product-level links unavailable</span>
              </article>
            </div>

            <p className="exposure-disclaimer">
              <FaExclamationTriangle />
              Supplier links do not confirm product exposure. Product-level
              relationships are not currently available from this data.
            </p>
          </section>

          <section className="dashboard-panel global-signals-panel">
            <div className="panel-heading">
              <div>
                <span className="section-eyebrow">GLOBAL SIGNALS</span>
                <h2>Priority risks</h2>
              </div>

              <button
                type="button"
                className="text-link"
                onClick={() => {
                  window.location.href = "/risks";
                }}
              >
                View all
              </button>
            </div>

            {prioritizedRisks.length ? (
              <div className="global-signals-list">
                {prioritizedRisks.slice(0, 5).map((risk) => {
                  const riskTrend = getTrend(risk);

                  const symbol = [
                    "increasing",
                    "worsening",
                  ].includes(riskTrend)
                    ? "↗"
                    : ["decreasing", "improving"].includes(riskTrend)
                      ? "↘"
                      : riskTrend === "stable"
                        ? "→"
                        : "—";

                  return (
                    <article
                      className="global-signal global-signal-clickable"
                      key={risk._id}
                      role="link"
                      tabIndex={0}
                      aria-label={`View details for ${risk.title || "Untitled risk"}`}
                      onClick={() => openRiskDetails(risk)}
                      onKeyDown={(event) =>
                        handleRiskKeyDown(event, risk)
                      }
                    >
                      <div className="global-signal-icon">
                        <FaGlobe />
                      </div>

                      <div className="global-signal-copy">
                        <strong>
                          {risk.title || "Untitled risk"}
                        </strong>
                        <span>
                          {risk.location || "Location unknown"} ·{" "}
                          {getMaterialName(risk)}
                        </span>
                      </div>

                      <span
                        className={`signal-severity ${getSeverity(risk)}`}
                      >
                        {titleCase(getSeverity(risk))}
                      </span>

                      <span className={`signal-trend ${riskTrend}`}>
                        {symbol}
                      </span>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">
                {loading ? "Loading risks..." : "No recorded risks."}
              </p>
            )}

            <div className="signal-footer">
              {risks.length} risks · {regions.length} recorded regions
            </div>
          </section>
        </div>

        <div className="dashboard-main-grid impact-grid">
          <section className="dashboard-panel potential-impact-panel">
            <div className="panel-heading">
              <div>
                <span className="section-eyebrow">POTENTIAL IMPACT</span>
                <h2>Business exposure</h2>
              </div>
            </div>

            <div className="impact-metrics">
              <article className="impact-metric">
                <div className="impact-icon">
                  <FaShieldAlt />
                </div>
                <div>
                  <span>Supply continuity risk</span>
                  <strong>
                    {primaryRisk
                      ? titleCase(getSeverity(primaryRisk))
                      : "Unknown"}
                  </strong>
                  <p>
                    {primaryRisk?.operationalImpact ||
                      "Operational impact has not been recorded."}
                  </p>
                </div>
              </article>

              <article className="impact-metric">
                <div className="impact-icon">
                  <FaDollarSign />
                </div>
                <div>
                  <span>Cost impact</span>
                  <strong>
                    {primaryRisk?.operationalImpact
                      ? "Potential impact"
                      : "Not assessed"}
                  </strong>
                  <p>
                    {primaryRisk?.operationalImpact ||
                      "Cost impact has not been recorded."}
                  </p>
                </div>
              </article>

              <article className="impact-metric">
                <div className="impact-icon">
                  <FaBox />
                </div>
                <div>
                  <span>Product availability</span>
                  <strong>
                    {primaryMaterial ? "Material linked" : "Not mapped"}
                  </strong>
                  <p>
                    {primaryMaterial?.description ||
                      "Product availability data is not connected."}
                  </p>
                </div>
              </article>

              <article className="impact-metric">
                <div className="impact-icon">
                  <FaChartLine />
                </div>
                <div>
                  <span>Exposure level</span>
                  <strong>
                    {primaryRisk
                      ? titleCase(getSeverity(primaryRisk))
                      : "Unknown"}
                  </strong>
                  <p>
                    {primaryRisk?.riskScore != null
                      ? `Recorded risk score: ${primaryRisk.riskScore}`
                      : "No numerical risk score recorded."}
                  </p>
                </div>
              </article>
            </div>

            {industryImpacts.length > 0 && (
              <div className="industry-impacts">
                <span className="section-eyebrow">INDUSTRIES AFFECTED</span>
                {industryImpacts.slice(0, 4).map((item, index) => (
                  <div
                    className="industry-impact-row"
                    key={item._id || `${item.industry}-${index}`}
                  >
                    <strong>{item.industry || "Industry"}</strong>
                    <span>{item.impact || "Impact not specified"}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-panel trend-panel">
            <div className="panel-heading">
              <div>
                <span className="section-eyebrow">EXPOSURE TREND</span>
                <h2>Risk direction</h2>
              </div>
            </div>

            <div className="trend-summary">
              <span className={`trend-arrow ${trend}`}>
                {trendSymbol}
              </span>
              <div>
                <span>Recorded trend</span>
                <strong>
                  {primaryRisk ? titleCase(trend) : "Unknown"}
                </strong>
              </div>
            </div>

            <div className="trend-chart-placeholder">
              <div className="trend-axis-labels">
                <span>High</span>
                <span>Medium</span>
                <span>Low</span>
              </div>
              <div className="trend-chart-message">
                Historical risk scores are not available to produce a reliable
                time-series chart yet.
              </div>
            </div>

            <div className="trend-legend">
              <span />
              Current recorded direction
            </div>
          </section>
        </div>

        <section className="dashboard-panel recommendations-panel">
          <div className="panel-heading">
            <div>
              <span className="section-eyebrow">RECOMMENDED ACTIONS</span>
              <h2>Next steps</h2>
            </div>
          </div>

          {recommendations.length ? (
            <div className="recommendations-grid">
              {recommendations.slice(0, 3).map((item, index) => (
                <article
                  className="recommendation-card"
                  key={item._id || index}
                >
                  <div className="recommendation-icon">
                    {index === 0 ? (
                      <FaCheckCircle />
                    ) : index === 1 ? (
                      <FaProjectDiagram />
                    ) : (
                      <FaShieldAlt />
                    )}
                  </div>

                  <div>
                    <strong>
                      {item.title ||
                        item.action ||
                        item.name ||
                        `Recommended action ${index + 1}`}
                    </strong>
                    <p>
                      {item.description ||
                        item.recommendation ||
                        item.details ||
                        "Review the associated risk and determine the appropriate response."}
                    </p>
                    <span className="recommendation-risk">
                      {item.riskTitle} · {titleCase(item.riskSeverity)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              {loading
                ? "Loading recommendations..."
                : "No recommendations are recorded in the current risk data."}
            </p>
          )}

          {primaryRecommendations.length > 0 && (
            <p className="actions-context">
              The leading risk has {primaryRecommendations.length} recorded
              recommendation(s).
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;