import "./Risks.css";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://nao-ysu5.onrender.com/api";

const API_URL = `${API_BASE}/risks`;
const COMPANY_EXPOSURE_URL =
  `${API_BASE}/company-exposure/aerotech-titanium-demo`;

const FILTERS = [
  "All",
  "Critical",
  "High",
  "Medium",
  "Low",
];

const severityOrder = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
};

// ======================================================
// HELPERS
// ======================================================

function normalizeId(value) {
  if (!value) return null;

  if (typeof value === "string") {
    return value;
  }

  if (value?._id) {
    return String(value._id);
  }

  return String(value);
}

function getSeverityClass(severity) {
  return String(severity || "Unknown").toLowerCase();
}

function getTrendClass(trend) {
  const value = String(trend || "").toLowerCase();

  if (value === "increasing" || value === "worsening") {
    return "increasing";
  }

  if (value === "decreasing" || value === "improving") {
    return "decreasing";
  }

  return "stable";
}

function getTrendSymbol(trend) {
  const value = String(trend || "").toLowerCase();

  if (value === "increasing" || value === "worsening") {
    return "↑";
  }

  if (value === "decreasing" || value === "improving") {
    return "↓";
  }

  if (value === "stable") {
    return "→";
  }

  return "";
}

// ======================================================
// RISKS PAGE
// ======================================================

function Risks() {
  const [risks, setRisks] = useState([]);
  const [companyExposure, setCompanyExposure] = useState(null);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedRisk, setExpandedRisk] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [companyExposureWarning, setCompanyExposureWarning] =
    useState("");

  // ====================================================
  // FETCH RISKS AND COMPANY EXPOSURE
  // ====================================================

  const fetchRisks = useCallback(async () => {
    setLoading(true);
    setError("");
    setCompanyExposureWarning("");

    try {
      // Load the global risk feed and company exposure
      // independently. Failure to load company exposure
      // must not prevent global risks from being displayed.
      const [riskResult, exposureResult] =
        await Promise.allSettled([
          axios.get(API_URL),
          axios.get(COMPANY_EXPOSURE_URL),
        ]);

      if (riskResult.status === "fulfilled") {
        const data = riskResult.value.data;

        const riskList = Array.isArray(data)
          ? data
          : Array.isArray(data?.risks)
            ? data.risks
            : [];

        setRisks(riskList);
      } else {
        console.error(
          "Failed to load risks:",
          riskResult.reason
        );

        setRisks([]);

        setError(
          "We couldn't load supply chain risks. Please check your connection and try again."
        );
      }

      if (exposureResult.status === "fulfilled") {
        const data = exposureResult.value.data;

        setCompanyExposure(
          data?.companyExposure || data || null
        );
      } else {
        console.error(
          "Failed to load AeroTech exposure:",
          exposureResult.reason
        );

        setCompanyExposure(null);

        setCompanyExposureWarning(
          "AeroTech's linked risk could not be identified. The list below shows global NAO risks only."
        );
      }
    } catch (err) {
      console.error("Unexpected error loading risks:", err);

      setError(
        "An unexpected error occurred while loading risks."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  // ====================================================
  // FILTER AND SORT GLOBAL RISKS
  // ====================================================

  const filteredRisks = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return risks
      .filter((risk) => {
        const matchesSeverity =
          activeFilter === "All" ||
          String(risk.severity || "").toLowerCase() ===
            activeFilter.toLowerCase();

        const searchableText = [
          risk.title,
          risk.location,
          risk.description,
          risk.severity,
          risk.trend,
          risk.operationalImpact,
          risk.materialId?.name,
          ...(Array.isArray(risk.industryImpacts)
            ? risk.industryImpacts.map(
                (item) =>
                  `${item.industry || ""} ${item.impact || ""}`
              )
            : []),
          ...(Array.isArray(risk.recommendations)
            ? risk.recommendations.map(
                (item) =>
                  `${item.title || ""} ${item.description || ""}`
              )
            : []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          matchesSeverity &&
          searchableText.includes(searchTerm)
        );
      })
      .sort((a, b) => {
        const severityA =
          severityOrder[
            String(a.severity || "unknown").toLowerCase()
          ] ?? 99;

        const severityB =
          severityOrder[
            String(b.severity || "unknown").toLowerCase()
          ] ?? 99;

        if (severityA !== severityB) {
          return severityA - severityB;
        }

        const trendA =
          getTrendClass(a.trend) === "increasing" ? 0 : 1;

        const trendB =
          getTrendClass(b.trend) === "increasing" ? 0 : 1;

        return trendA - trendB;
      });
  }, [risks, search, activeFilter]);

  // ====================================================
  // COMPANY-LINKED RISK FIRST
  // ====================================================

  // Only the risk explicitly referenced by the AeroTech
  // exposure record receives company-linked treatment.
  // Matching material names alone do not prove exposure.

  const companyRiskId = normalizeId(
    companyExposure?.riskId
  );

  const companyRisk = companyRiskId
    ? filteredRisks.find(
        (risk) =>
          normalizeId(risk._id) === companyRiskId
      ) || null
    : null;

  const globalRisks = companyRisk
    ? filteredRisks.filter(
        (risk) =>
          normalizeId(risk._id) !== companyRiskId
      )
    : filteredRisks;

  // ====================================================
  // SUMMARY METRICS
  // ====================================================

  const highRiskCount = risks.filter((risk) =>
    ["high", "critical"].includes(
      String(risk.severity || "").toLowerCase()
    )
  ).length;

  const increasingRiskCount = risks.filter(
    (risk) => getTrendClass(risk.trend) === "increasing"
  ).length;

  // ====================================================
  // RENDER ONE RISK CARD
  // ====================================================

  const renderRiskCard = (
    risk,
    isCompanyLinked = false
  ) => {
    const isExpanded = expandedRisk === risk._id;
    const severity = risk.severity || "Unknown";
    const trend = risk.trend || "Unknown";

    const industryImpacts = Array.isArray(
      risk.industryImpacts
    )
      ? risk.industryImpacts
      : [];

    const recommendations = Array.isArray(
      risk.recommendations
    )
      ? risk.recommendations
      : [];

    return (
      <article
        className={`risk-item ${
          isCompanyLinked ? "risk-item-company-linked" : ""
        }`}
        key={risk._id}
      >
        <div className="risk-top">
          <div className="risk-heading-copy">
            <h2>{risk.title || "Untitled risk"}</h2>

            {isCompanyLinked && (
              <span className="company-risk-badge">
                AeroTech-linked demo risk
              </span>
            )}

            <p className="risk-location">
              <span aria-hidden="true">⌖</span>{" "}
              {risk.location || "Location unknown"}
            </p>
          </div>

          <span
            className={`badge ${getSeverityClass(severity)}`}
          >
            {severity}
          </span>
        </div>

        {risk.description && (
          <p className="risk-description">
            {risk.description}
          </p>
        )}

        <div className="risk-details">
          <div className="risk-detail">
            <strong>Material</strong>
            <p>{risk.materialId?.name || "Not linked"}</p>
          </div>

          <div className="risk-detail">
            <strong>Trend</strong>
            <p className={`risk-trend ${getTrendClass(trend)}`}>
              {getTrendSymbol(trend)} {trend}
            </p>
          </div>

          <div className="risk-detail">
            <strong>Operational Impact</strong>
            <p>
              {risk.operationalImpact || "Not assessed"}
            </p>
          </div>
        </div>

        {isCompanyLinked && (
          <p className="company-risk-disclaimer">
            This verified NAO risk is explicitly linked to
            AeroTech's demo exposure record. The company
            product mapping remains illustrative and does
            not establish verified operational exposure.
          </p>
        )}

        <button
          type="button"
          className="view-btn"
          onClick={() =>
            setExpandedRisk(
              isExpanded ? null : risk._id
            )
          }
          aria-expanded={isExpanded}
        >
          {isExpanded
            ? "Hide Analysis ↑"
            : "View Analysis →"}
        </button>

        {isExpanded && (
          <div className="risk-analysis">
            <section className="analysis-section">
              <h3>Industry Impact</h3>

              {industryImpacts.length > 0 ? (
                <div className="analysis-list">
                  {industryImpacts.map((item, index) => (
                    <div
                      className="analysis-item"
                      key={
                        item._id ||
                        `${item.industry}-${index}`
                      }
                    >
                      <strong>
                        {item.industry ||
                          "Industry unspecified"}
                      </strong>

                      <p>
                        {item.impact ||
                          "Impact not specified."}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-text">
                  No industry impacts recorded.
                </p>
              )}
            </section>

            <section className="analysis-section">
              <h3>Recommended Actions</h3>

              {recommendations.length > 0 ? (
                <div className="analysis-list">
                  {recommendations.map((item, index) => (
                    <div
                      className="analysis-item recommendation-item"
                      key={
                        item._id ||
                        `${item.title}-${index}`
                      }
                    >
                      <div className="recommendation-heading">
                        <strong>
                          {item.title ||
                            "Recommended action"}
                        </strong>

                        {item.priority && (
                          <span
                            className={`priority-badge ${getSeverityClass(
                              item.priority
                            )}`}
                          >
                            {item.priority} priority
                          </span>
                        )}
                      </div>

                      <p>
                        {item.description ||
                          "No further details provided."}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-text">
                  No recommendations recorded.
                </p>
              )}
            </section>
          </div>
        )}
      </article>
    );
  };

  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="risks-page">
      <div className="risks-header">
        <div>
          <h1>Supply Chain Risks</h1>

          <p>
            Monitor verified risks across strategic materials.
          </p>
        </div>

        <button
          type="button"
          className="risk-refresh-btn"
          onClick={fetchRisks}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      <div className="risk-summary">
        <div className="risk-summary-card">
          <span>Total Verified Risks</span>
          <strong>{risks.length}</strong>
        </div>

        <div className="risk-summary-card">
          <span>High / Critical</span>
          <strong>{highRiskCount}</strong>
        </div>

        <div className="risk-summary-card">
          <span>Increasing Trend</span>
          <strong>{increasingRiskCount}</strong>
        </div>
      </div>

      <div className="risks-controls">
        <input
          type="search"
          placeholder="Search risks, materials, locations..."
          className="risk-search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          aria-label="Search supply chain risks"
        />

        <div
          className="filter-bar"
          aria-label="Filter risks by severity"
        >
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={
                activeFilter === filter ? "active" : ""
              }
              onClick={() => setActiveFilter(filter)}
              aria-pressed={activeFilter === filter}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="risk-order-note">
        <strong>AeroTech first, global risks next.</strong>
        <span>
          The explicitly linked AeroTech demo risk appears
          first when it matches your current search and filters.
          Remaining risks are general NAO intelligence signals,
          not automatically confirmed AeroTech exposure.
        </span>
      </div>

      {companyExposureWarning && (
        <div className="risks-notice" role="status">
          {companyExposureWarning}
        </div>
      )}

      {loading && risks.length === 0 && (
        <div className="risks-message">
          <div className="risks-spinner" />
          <p>Loading supply chain risks...</p>
        </div>
      )}

      {!loading && error && (
        <div className="risks-message risks-error">
          <p>{error}</p>

          <button
            type="button"
            onClick={fetchRisks}
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && filteredRisks.length === 0 && (
        <div className="risks-message">
          <h3>No risks found</h3>

          <p>
            {risks.length === 0
              ? "There are no verified risk records to display yet."
              : "Try another search term or severity filter."}
          </p>

          {(search || activeFilter !== "All") && (
            <button
              type="button"
              className="clear-filters-btn"
              onClick={() => {
                setSearch("");
                setActiveFilter("All");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {!loading && !error && filteredRisks.length > 0 && (
        <div className="risk-results">
          {companyRisk && (
            <section className="risk-group">
              <div className="risk-group-header">
                <div>
                  <h2>AeroTech-related risk</h2>

                  <p>
                    This risk is explicitly linked to the
                    existing AeroTech demo exposure record.
                    The product-level relationship remains
                    illustrative.
                  </p>
                </div>

                <span className="risk-group-badge">
                  Demo-linked
                </span>
              </div>

              {renderRiskCard(companyRisk, true)}
            </section>
          )}

          {globalRisks.length > 0 && (
            <section className="risk-group">
              <div className="risk-group-header">
                <div>
                  <h2>Global supply chain risks</h2>

                  <p>
                    Verified NAO signals across tracked
                    materials and regions. These risks are
                    not automatically confirmed company exposure.
                  </p>
                </div>
              </div>

              <div className="risk-group-list">
                {globalRisks.map((risk) =>
                  renderRiskCard(risk)
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default Risks;