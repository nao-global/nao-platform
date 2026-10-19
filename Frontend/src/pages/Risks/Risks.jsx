
import "./Risks.css";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = "https://nao-ysu5.onrender.com/api/risks";

const FILTERS = ["All", "Critical", "High", "Medium", "Low"];

const severityOrder = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

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

function Risks() {
  const [risks, setRisks] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedRisk, setExpandedRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRisks = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get(API_URL);
      const data = response.data;

      const riskList = Array.isArray(data)
        ? data
        : Array.isArray(data?.risks)
        ? data.risks
        : [];

      setRisks(riskList);
    } catch (err) {
      console.error("Failed to load risks:", err);
      setError(
        "We couldn't load supply chain risks. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisks();
  }, []);

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
          ...(risk.industryImpacts || []).map(
            (item) => `${item.industry || ""} ${item.impact || ""}`
          ),
          ...(risk.recommendations || []).map(
            (item) => `${item.title || ""} ${item.description || ""}`
          ),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return matchesSeverity && searchableText.includes(searchTerm);
      })
      .sort((a, b) => {
        const severityA = severityOrder[a.severity] ?? 99;
        const severityB = severityOrder[b.severity] ?? 99;

        if (severityA !== severityB) {
          return severityA - severityB;
        }

        const trendA = getTrendClass(a.trend) === "increasing" ? 0 : 1;
        const trendB = getTrendClass(b.trend) === "increasing" ? 0 : 1;

        return trendA - trendB;
      });
  }, [risks, search, activeFilter]);

  const highRiskCount = risks.filter((risk) =>
    ["high", "critical"].includes(
      String(risk.severity || "").toLowerCase()
    )
  ).length;

  return (
    <div className="risks-page">
      <div className="risks-header">
        <div>
          <h1>Supply Chain Risks</h1>
          <p>Monitor active risks affecting strategic materials.</p>
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
          <span>Total Risks</span>
          <strong>{risks.length}</strong>
        </div>

        <div className="risk-summary-card">
          <span>High / Critical</span>
          <strong>{highRiskCount}</strong>
        </div>

        <div className="risk-summary-card">
          <span>Increasing Trend</span>
          <strong>
            {
              risks.filter(
                (risk) => getTrendClass(risk.trend) === "increasing"
              ).length
            }
          </strong>
        </div>
      </div>

      <div className="risks-controls">
        <input
          type="search"
          placeholder="Search risks, materials, locations..."
          className="risk-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search supply chain risks"
        />

        <div className="filter-bar" aria-label="Filter risks by severity">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={activeFilter === filter ? "active" : ""}
              onClick={() => setActiveFilter(filter)}
              aria-pressed={activeFilter === filter}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {loading && risks.length === 0 && (
        <div className="risks-message">
          <div className="risks-spinner" />
          <p>Loading supply chain risks...</p>
        </div>
      )}

      {!loading && error && (
        <div className="risks-message risks-error">
          <p>{error}</p>
          <button type="button" onClick={fetchRisks}>
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && filteredRisks.length === 0 && (
        <div className="risks-message">
          <h3>No risks found</h3>
          <p>
            {risks.length === 0
              ? "There are no risk records to display yet."
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

      <div className="risk-list">
        {filteredRisks.map((risk) => {
          const isExpanded = expandedRisk === risk._id;
          const severity = risk.severity || "Unknown";
          const trend = risk.trend || "Unknown";
          const industryImpacts = Array.isArray(risk.industryImpacts)
            ? risk.industryImpacts
            : [];
          const recommendations = Array.isArray(risk.recommendations)
            ? risk.recommendations
            : [];

          return (
            <article className="risk-item" key={risk._id}>
              <div className="risk-top">
                <div>
                  <h2>{risk.title || "Untitled risk"}</h2>
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
                <p className="risk-description">{risk.description}</p>
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
                  <p>{risk.operationalImpact || "Not assessed"}</p>
                </div>
              </div>

              <button
                type="button"
                className="view-btn"
                onClick={() =>
                  setExpandedRisk(isExpanded ? null : risk._id)
                }
                aria-expanded={isExpanded}
              >
                {isExpanded ? "Hide Analysis ↑" : "View Analysis →"}
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
                            key={item._id || `${item.industry}-${index}`}
                          >
                            <strong>
                              {item.industry || "Industry unspecified"}
                            </strong>
                            <p>{item.impact || "Impact not specified."}</p>
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
                            key={item._id || `${item.title}-${index}`}
                          >
                            <div className="recommendation-heading">
                              <strong>
                                {item.title || "Recommended action"}
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
        })}
      </div>
    </div>
  );
}

export default Risks;
