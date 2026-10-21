
import "./RiskDetails.css";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

import {
  FaArrowLeft,
  FaGlobe,
  FaCube,
  FaExclamationTriangle,
  FaChartLine,
  FaShieldAlt,
  FaClipboardCheck,
  FaIndustry,
} from "react-icons/fa";

const API_URL = "https://nao-ysu5.onrender.com/api/risks";

function getRiskList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.risks)) return data.risks;
  return [];
}

function titleCase(value) {
  if (!value) return "Not available";

  const text = String(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getSeverityClass(severity) {
  return String(severity || "unknown")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function getTrendSymbol(trend) {
  const value = String(trend || "").toLowerCase();

  if (["increasing", "worsening"].includes(value)) return "↗";
  if (["decreasing", "improving"].includes(value)) return "↘";
  if (value === "stable") return "→";

  return "—";
}

function getMaterialName(risk) {
  const material = risk?.materialId;

  if (typeof material === "object" && material?.name) {
    return material.name;
  }

  return "Not linked";
}

function RiskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchSelectedRisk() {
      setLoading(true);
      setError("");
      setRisk(null);

      try {
        const response = await axios.get(API_URL);
        const allRisks = getRiskList(response.data);

        const selectedRisk = allRisks.find(
          (item) => String(item._id) === String(id)
        );

        if (cancelled) return;

        if (!selectedRisk) {
          setError(
            "This risk could not be found in the available risk records."
          );
          return;
        }

        setRisk(selectedRisk);
      } catch (err) {
        console.error("Failed to load risk details:", err);

        if (!cancelled) {
          setError(
            "Unable to load this risk. Please check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchSelectedRisk();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const industryImpacts = Array.isArray(risk?.industryImpacts)
    ? risk.industryImpacts
    : [];

  const recommendations = Array.isArray(risk?.recommendations)
    ? risk.recommendations
    : [];

  const supplierExposures = Array.isArray(risk?.supplierExposures)
    ? risk.supplierExposures
    : [];

  if (loading) {
    return (
      <div className="risk-details-page">
        <button
          className="risk-details-back"
          onClick={() => navigate("/risks")}
          type="button"
        >
          <FaArrowLeft /> Back to all risks
        </button>

        <div className="risk-details-message">
          <div className="risk-details-spinner" />
          <p>Loading risk details...</p>
        </div>
      </div>
    );
  }

  if (error || !risk) {
    return (
      <div className="risk-details-page">
        <button
          className="risk-details-back"
          onClick={() => navigate("/risks")}
          type="button"
        >
          <FaArrowLeft /> Back to all risks
        </button>

        <div className="risk-details-message risk-details-error">
          <FaExclamationTriangle />
          <h2>Risk details unavailable</h2>
          <p>{error || "This risk could not be found."}</p>

          <button
            type="button"
            onClick={() => navigate("/risks")}
          >
            View all risks
          </button>
        </div>
      </div>
    );
  }

  const severity = risk.severity || "Unknown";
  const trend = risk.trend || "Unknown";

  return (
    <div className="risk-details-page">
      <button
        className="risk-details-back"
        type="button"
        onClick={() => navigate("/risks")}
      >
        <FaArrowLeft />
        Back to all risks
      </button>

      <header className="risk-details-header">
        <div className="risk-details-heading-icon">
          <FaGlobe />
        </div>

        <div className="risk-details-heading-copy">
          <span className="risk-details-eyebrow">
            SUPPLY CHAIN RISK DETAILS
          </span>

          <h1>{risk.title || "Untitled risk"}</h1>

          <p>
            <FaGlobe />
            {risk.location || "Location unknown"}
          </p>
        </div>

        <span
          className={`risk-details-severity ${getSeverityClass(severity)}`}
        >
          {titleCase(severity)}
        </span>
      </header>

      <section className="risk-details-summary">
        <article className="risk-details-summary-card">
          <span>Risk Type</span>
          <strong>{risk.riskType || "Not classified"}</strong>
        </article>

        <article className="risk-details-summary-card">
          <span>Material</span>
          <strong>{getMaterialName(risk)}</strong>
        </article>

        <article className="risk-details-summary-card">
          <span>Risk Trend</span>
          <strong className="risk-details-trend">
            {getTrendSymbol(trend)} {titleCase(trend)}
          </strong>
        </article>

        <article className="risk-details-summary-card">
          <span>Risk Score</span>
          <strong>
            {risk.riskScore != null
              ? risk.riskScore
              : "Not recorded"}
          </strong>
        </article>
      </section>

      <section className="risk-details-panel">
        <div className="risk-details-section-heading">
          <FaExclamationTriangle />
          <h2>Risk Overview</h2>
        </div>

        <p className="risk-details-description">
          {risk.description ||
            "No description has been recorded for this risk."}
        </p>
      </section>

      <section className="risk-details-panel">
        <div className="risk-details-section-heading">
          <FaShieldAlt />
          <h2>Exposure and Operational Impact</h2>
        </div>

        <div className="risk-details-impact-grid">
          <article>
            <span>Severity</span>
            <strong>{titleCase(severity)}</strong>
          </article>

          <article>
            <span>Location</span>
            <strong>{risk.location || "Not specified"}</strong>
          </article>

          <article>
            <span>Material Exposure</span>
            <strong>{getMaterialName(risk)}</strong>
          </article>
        </div>

        <div className="risk-details-subsection">
          <h3>Operational Impact</h3>
          <p>
            {risk.operationalImpact ||
              "Operational impact has not been assessed or recorded."}
          </p>
        </div>

        <div className="risk-details-subsection">
          <h3>Supplier Exposure</h3>
          {supplierExposures.length > 0 ? (
            <ul>
              {supplierExposures.map((exposure, index) => (
                <li key={exposure._id || index}>
                  {exposure.name ||
                    exposure.supplierName ||
                    exposure.supplierId?.name ||
                    exposure.supplier?.name ||
                    `Supplier exposure ${index + 1}`}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No supplier exposure records are linked to this risk.
            </p>
          )}
        </div>

        <p className="risk-details-note">
          Product-level exposure is not inferred unless product
          relationships are available in the current data.
        </p>
      </section>

      <section className="risk-details-panel">
        <div className="risk-details-section-heading">
          <FaIndustry />
          <h2>Industry Impacts</h2>
        </div>

        {industryImpacts.length > 0 ? (
          <div className="risk-details-list">
            {industryImpacts.map((item, index) => (
              <article
                className="risk-details-list-item"
                key={item._id || `${item.industry}-${index}`}
              >
                <strong>
                  {item.industry || "Industry unspecified"}
                </strong>

                <p>
                  {item.impact || "Impact not specified."}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="risk-details-empty">
            No industry impacts have been recorded for this risk.
          </p>
        )}
      </section>

      <section className="risk-details-panel">
        <div className="risk-details-section-heading">
          <FaClipboardCheck />
          <h2>Recommended Actions</h2>
        </div>

        {recommendations.length > 0 ? (
          <div className="risk-details-list">
            {recommendations.map((item, index) => (
              <article
                className="risk-details-list-item"
                key={item._id || `${item.title}-${index}`}
              >
                <div className="risk-details-action-heading">
                  <strong>
                    {item.title ||
                      item.action ||
                      `Recommended action ${index + 1}`}
                  </strong>

                  {item.priority && (
                    <span
                      className={`risk-details-priority ${getSeverityClass(
                        item.priority
                      )}`}
                    >
                      {titleCase(item.priority)} priority
                    </span>
                  )}
                </div>

                <p>
                  {item.description ||
                    "No further action details provided."}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="risk-details-empty">
            No recommended actions have been recorded for this risk.
          </p>
        )}
      </section>

      <div className="risk-details-footer">
        <FaChartLine />
        <span>
          This view displays the information currently available
          for this risk in NAO.
        </span>
      </div>
    </div>
  );
}

export default RiskDetails;
