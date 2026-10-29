
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

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://nao-ysu5.onrender.com/api";

const API_URL = `${API_BASE}/risks`;

const COMPANY_EXPOSURE_URL =
  `${API_BASE}/company-exposure/aerotech-titanium-demo`;

function getRiskList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.risks)) return data.risks;
  return [];
}

function normalizeId(value) {
  if (!value) return null;

  if (typeof value === "object") {
    const id = value._id || value.id;
    return id ? String(id) : null;
  }

  return String(value);
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
  const material = risk?.materialId || risk?.material;

  if (typeof material === "object" && material) {
    return (
      material.name ||
      material.materialName ||
      risk?.materialName ||
      "Not linked"
    );
  }

  return risk?.materialName || "Not linked";
}

function RiskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [risk, setRisk] = useState(null);
  const [companyExposure, setCompanyExposure] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exposureWarning, setExposureWarning] = useState("");

  // ======================================================
  // FETCH THE SELECTED RISK AND AEROTECH DEMO EXPOSURE
  // ======================================================

  useEffect(() => {
    let cancelled = false;

    async function fetchSelectedRisk() {
      setLoading(true);
      setError("");
      setExposureWarning("");
      setRisk(null);
      setCompanyExposure(null);

      try {
        const [riskResult, exposureResult] =
          await Promise.allSettled([
            axios.get(API_URL),
            axios.get(COMPANY_EXPOSURE_URL),
          ]);

        if (cancelled) return;

        // The risk record is required for this page.
        if (riskResult.status !== "fulfilled") {
          throw riskResult.reason;
        }

        const allRisks = getRiskList(riskResult.value.data);

        const selectedRisk = allRisks.find(
          (item) => normalizeId(item._id) === String(id)
        );

        if (!selectedRisk) {
          setError(
            "This risk could not be found in the available risk records."
          );
          return;
        }

        setRisk(selectedRisk);

        // Exposure is supplementary. Its failure should not prevent
        // the individual risk details from being displayed.
        if (exposureResult.status === "fulfilled") {
          const data = exposureResult.value.data;

          setCompanyExposure(
            data?.companyExposure || data || null
          );
        } else {
          console.warn(
            "Could not load AeroTech demo exposure:",
            exposureResult.reason
          );

          setExposureWarning(
            "AeroTech demo recommendations could not be loaded. Recommendations recorded directly against this risk are still available."
          );
        }
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

  // ======================================================
  // RISK INFORMATION
  // ======================================================

  const industryImpacts = Array.isArray(risk?.industryImpacts)
    ? risk.industryImpacts
    : [];

  const riskRecommendations = Array.isArray(risk?.recommendations)
    ? risk.recommendations
    : [];

  const supplierExposures = Array.isArray(risk?.supplierExposures)
    ? risk.supplierExposures
    : [];

  // ======================================================
  // MATCH THE RISK TO THE AEROTECH EXPOSURE RECORD
  // ======================================================

  const linkedRiskId = normalizeId(companyExposure?.riskId);
  const selectedRiskId = normalizeId(risk?._id);

  const isAeroTechLinkedRisk = Boolean(
    selectedRiskId &&
      linkedRiskId &&
      selectedRiskId === linkedRiskId
  );

  const companyRecommendations = Array.isArray(
    companyExposure?.recommendations
  )
    ? companyExposure.recommendations
    : [];

  // Prefer recommendations attached to the risk itself.
  // Only fall back to the company record when the risk ID matches
  // the exact risk explicitly linked to that company record.
  const recommendations =
    riskRecommendations.length > 0
      ? riskRecommendations
      : isAeroTechLinkedRisk
        ? companyRecommendations
        : [];

  const usingCompanyRecommendations =
    riskRecommendations.length === 0 &&
    isAeroTechLinkedRisk &&
    companyRecommendations.length > 0;

  // ======================================================
  // LOADING STATE
  // ======================================================

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

  // ======================================================
  // ERROR STATE
  // ======================================================

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

  // ======================================================
  // PAGE
  // ======================================================

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

      {/* RISK HEADER */}

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
          className={`risk-details-severity ${getSeverityClass(
            severity
          )}`}
        >
          {titleCase(severity)}
        </span>
      </header>

      {/* RISK SUMMARY */}

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

      {/* RISK OVERVIEW */}

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

      {/* EXPOSURE AND OPERATIONAL IMPACT */}

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

      {/* INDUSTRY IMPACTS */}

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

      {/* RECOMMENDED ACTIONS */}

      <section className="risk-details-panel">
        <div className="risk-details-section-heading">
          <FaClipboardCheck />
          <h2>Recommended Actions</h2>
        </div>

        {usingCompanyRecommendations && (
          <p className="risk-details-note">
            These actions come from the explicitly linked AeroTech
            demo exposure record. They are illustrative suggestions,
            not confirmation of an actual company disruption or
            completed response.
          </p>
        )}

        {exposureWarning && isAeroTechLinkedRisk && (
          <p className="risk-details-empty" role="status">
            {exposureWarning}
          </p>
        )}

        {recommendations.length > 0 ? (
          <div className="risk-details-list">
            {recommendations.map((item, index) => (
              <article
                className="risk-details-list-item"
                key={
                  item._id ||
                  `${item.title || item.action || "action"}-${index}`
                }
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
                    item.action ||
                    "Review this suggested action and determine the appropriate next step."}
                </p>

                {item.reason && (
                  <p>
                    <strong>Why this matters: </strong>
                    {item.reason}
                  </p>
                )}

                {(item.status || item.informationStatus) && (
                  <p className="risk-details-note">
                    {item.status || "Suggested"}
                    {item.informationStatus
                      ? ` · ${item.informationStatus}`
                      : ""}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="risk-details-empty">
            {isAeroTechLinkedRisk
              ? "No recommendations are currently available for this risk. Check the linked AeroTech exposure record."
              : "No recommendations have been recorded for this risk. Company-specific demo actions are not shown because this risk is not explicitly linked to the AeroTech exposure record."}
          </p>
        )}
      </section>

      {/* FOOTER */}

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
