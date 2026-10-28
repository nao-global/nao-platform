import "./Dashboard.css";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://nao-ysu5.onrender.com/api";
const REFRESH_INTERVAL = 60000;
const AEROTECH_DEMO_KEY = "aerotech-titanium-demo";

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

function getMaterialId(risk) {
  return normalizeId(risk?.materialId);
}

function getLinkedMaterialId(productMaterial) {
  return normalizeId(productMaterial?.materialId);
}

function getMaterialName(risk) {
  const material = risk?.materialId;

  if (
    material &&
    typeof material === "object" &&
    material.name
  ) {
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

function getInventoryDescription(inventory) {
  if (!inventory) {
    return "Verified inventory coverage is not available.";
  }

  return (
    inventory.assumptionNotes ||
    "Inventory information has not been independently verified."
  );
}

function getFinancialDescription(financialExposure) {
  if (!financialExposure) {
    return "No company-specific financial assessment is available.";
  }

  return (
    financialExposure.estimatedCostImpact ||
    financialExposure.assumptionNotes ||
    financialExposure.notes ||
    "No financial estimate is available."
  );
}

// ======================================================
// DASHBOARD
// ======================================================

function Dashboard() {
  const [risks, setRisks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [companyExposure, setCompanyExposure] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [companyExposureLoading, setCompanyExposureLoading] =
    useState(true);

  const [error, setError] = useState("");
  const [companyExposureError, setCompanyExposureError] =
    useState("");

  const [lastUpdated, setLastUpdated] = useState(null);

  // ====================================================
  // FETCH DASHBOARD DATA
  // ====================================================

  const fetchDashboard = useCallback(async (automatic = false) => {
    if (automatic) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setCompanyExposureLoading(true);
    setError("");
    setCompanyExposureError("");

    try {
      // Keep the existing risk and material requests.
      // Company exposure is requested separately in the same
      // batch, but its failure won't prevent the main dashboard
      // from loading.
      const companyExposureRequest = axios
        .get(
          `${API_BASE}/company-exposure/${AEROTECH_DEMO_KEY}`
        )
        .then((response) => ({ response }))
        .catch((requestError) => ({ requestError }));

      const [
        riskResponse,
        materialResponse,
        exposureResult,
      ] = await Promise.all([
        axios.get(`${API_BASE}/risks`),
        axios.get(`${API_BASE}/materials`),
        companyExposureRequest,
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

      if (exposureResult.requestError) {
        console.error(
          "Unable to load AeroTech company exposure:",
          exposureResult.requestError
        );

        setCompanyExposure(null);
        setCompanyExposureError(
          "AeroTech company exposure could not be loaded. The general NAO risk data is still available."
        );
      } else {
        const exposureData = exposureResult.response.data;

        setCompanyExposure(
          exposureData?.companyExposure ||
          exposureData ||
          null
        );
      }

      setLastUpdated(new Date());
    } catch (requestError) {
      console.error(
        "Unable to load NAO dashboard:",
        requestError
      );

      setError(
        "Unable to load live NAO data. Check your connection and try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      setCompanyExposureLoading(false);
    }
  }, []);

  // ====================================================
  // AUTOMATIC REFRESH
  // ====================================================

  useEffect(() => {
    fetchDashboard();

    const interval = setInterval(() => {
      fetchDashboard(true);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // ====================================================
  // PRIORITIZE VERIFIED RISKS
  // ====================================================

  const prioritizedRisks = useMemo(
    () =>
      [...risks].sort(
        (a, b) =>
          (severityOrder[getSeverity(a)] ?? 4) -
          (severityOrder[getSeverity(b)] ?? 4)
      ),
    [risks]
  );

  // Prefer the risk explicitly linked to AeroTech's
  // exposure record. If it isn't present in the verified
  // risk response, fall back to a risk linked to the
  // company's recorded material, then the global priority.
  const companyLinkedRisk = risks.find(
    (risk) =>
      normalizeId(risk._id) ===
      normalizeId(companyExposure?.riskId)
  );

  const exposureMaterialId = normalizeId(
    companyExposure?.materialId
  );

  const materialLinkedRisk = exposureMaterialId
    ? prioritizedRisks.find(
        (risk) =>
          getMaterialId(risk) === exposureMaterialId
      )
    : null;

  const primaryRisk =
    companyLinkedRisk ||
    materialLinkedRisk ||
    prioritizedRisks[0] ||
    null;

  const primaryRiskIsCompanyLinked = Boolean(
    companyLinkedRisk || materialLinkedRisk
  );

  // ====================================================
  // OVERALL RISK METRICS
  // ====================================================

  const highCriticalCount = risks.filter((risk) =>
    ["high", "critical"].includes(getSeverity(risk))
  ).length;

  const overallExposure = highCriticalCount
    ? "HIGH"
    : risks.some(
          (risk) => getSeverity(risk) === "medium"
        )
      ? "ELEVATED"
      : risks.length
        ? "LOW"
        : "UNKNOWN";

  const riskRecommendations = useMemo(
    () => getRecommendations(prioritizedRisks),
    [prioritizedRisks]
  );

  const primaryRecommendations = Array.isArray(
    primaryRisk?.recommendations
  )
    ? primaryRisk.recommendations
    : [];

  // ====================================================
  // COMPANY PRODUCT AND MATERIAL MAPPING
  // ====================================================

  const companyProducts = Array.isArray(
    companyExposure?.products
  )
    ? companyExposure.products
    : [];

  // The risk-read API returns verified risks only.
  // Match their material IDs against the company's
  // explicitly stored product/material relationships.
  const verifiedRiskMaterialIds = new Set(
    risks
      .map((risk) => getMaterialId(risk))
      .filter(Boolean)
  );

  const mappedProductsForVerifiedRisks =
    companyProducts.filter((product) =>
      Array.isArray(product.materials) &&
      product.materials.some((productMaterial) =>
        verifiedRiskMaterialIds.has(
          getLinkedMaterialId(productMaterial)
        )
      )
    );

  const primaryMaterialId =
    exposureMaterialId ||
    getMaterialId(primaryRisk);

  const primaryMaterial =
    materials.find(
      (material) =>
        normalizeId(material._id) === primaryMaterialId
    ) || null;

  // Only products linked to the selected material
  // are shown in the primary exposure mapping.
  const primaryRiskProducts =
    primaryMaterialId
      ? companyProducts.filter((product) =>
          Array.isArray(product.materials) &&
          product.materials.some(
            (productMaterial) =>
              getLinkedMaterialId(productMaterial) ===
              primaryMaterialId
          )
        )
      : [];

  const productMaterialLinkCount =
    companyProducts.reduce(
      (total, product) =>
        total +
        (Array.isArray(product.materials)
          ? product.materials.length
          : 0),
      0
    );

    // Count unique materials linked to AeroTech products.
const criticalMaterialCount = new Set(
  companyProducts
    .flatMap((product) =>
      Array.isArray(product.materials)
        ? product.materials.map(getLinkedMaterialId)
        : []
    )
    .filter(Boolean)
   ).size;

  const primaryProductNames = primaryRiskProducts
    .slice(0, 2)
    .map((product) => product.name)
    .join(", ");

  const primaryProductSummary =
    primaryRiskProducts.length > 0
      ? `${primaryProductNames}${
          primaryRiskProducts.length > 2
            ? ` +${primaryRiskProducts.length - 2} more`
            : ""
        }`
      : companyExposureLoading
        ? "Loading company mappings..."
        : "No product mapping for this material";

  // ====================================================
  // COMPANY RECOMMENDATIONS
  // ====================================================

  const companyRecommendations = Array.isArray(
    companyExposure?.recommendations
  )
    ? companyExposure.recommendations
    : [];

  // Prefer the recommendations already recorded on
  // the company exposure. Otherwise, retain the existing
  // recommendations aggregated from NAO risk records.
  const dashboardRecommendations =
    companyRecommendations.length > 0
      ? companyRecommendations.map((item) => ({
          ...item,
          riskTitle:
            companyExposure?.disruptionTitle ||
            primaryRisk?.title ||
            "AeroTech company exposure",
          riskSeverity:
            primaryRisk?.severity || "Unknown",
        }))
      : riskRecommendations;

  // ====================================================
  // REGIONS AND REFRESH METADATA
  // ====================================================

  const regions = [
    ...new Set(
      risks
        .map((risk) => risk.location)
        .filter(
          (location) =>
            location &&
            String(location).toLowerCase() !== "unknown"
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

  const trendSymbol = [
    "increasing",
    "worsening",
  ].includes(trend)
    ? "↗"
    : ["decreasing", "improving"].includes(trend)
      ? "↘"
      : trend === "stable"
        ? "→"
        : "—";

  // ====================================================
  // COMPANY EXPOSURE DETAIL
  // ====================================================

  const displayDisruptionTitle =
    companyExposure?.disruptionTitle &&
    primaryRiskIsCompanyLinked
      ? companyExposure.disruptionTitle
      : primaryRisk?.title;

  const displayDisruptionDescription =
    companyExposure?.disruptionDescription &&
    primaryRiskIsCompanyLinked
      ? companyExposure.disruptionDescription
      : primaryRisk?.description;

  const inventory = companyExposure?.inventory;
  const financialExposure =
    companyExposure?.financialExposure;
  const productionExposure =
    companyExposure?.productionExposure;

  const inventoryIsIllustrative =
    inventory?.informationStatus === "Illustrative";

  const inventoryHeadline =
    inventory?.daysRemaining != null
      ? inventoryIsIllustrative
        ? `${inventory.daysRemaining} days (demo)`
        : `${inventory.daysRemaining} days recorded`
      : inventory?.stockLevel || "Not available";

  const financialIsIllustrative =
    financialExposure?.informationStatus ===
    "Illustrative";

  const financialHeadline = financialIsIllustrative
    ? "Illustrative only"
    : financialExposure?.estimatedLoss != null
      ? "Estimate recorded"
      : "Not quantified";

  const operationalImpactHeadline =
    productionExposure?.informationStatus ===
    "Illustrative"
      ? "Illustrative scenario"
      : productionExposure?.severity
        ? titleCase(productionExposure.severity)
        : "Not assessed";

  // ====================================================
  // RISK NAVIGATION
  // ====================================================

  const openRiskDetails = (risk) => {
    if (!risk?._id) {
      console.error(
        "Cannot open risk details: risk ID is missing."
      );
      return;
    }

    window.location.href =
      `/risks/${encodeURIComponent(risk._id)}`;
  };

  const handleRiskKeyDown = (event, risk) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRiskDetails(risk);
    }
  };

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div className="nao-dashboard">
      {/* ----------------------------------------------- */}
      {/* DASHBOARD HEADER                                */}
      {/* ----------------------------------------------- */}

      <header className="dashboard-topbar">
        <div>
          <h1>
            {companyExposure?.companyName
              ? `${companyExposure.companyName} Exposure`
              : "NAO Risk View"}
          </h1>

          <p>
            {companyExposure?.isDemo
              ? "Strategic Materials Intelligence · Illustrative company data"
              : "Strategic Materials Intelligence"}
          </p>
        </div>

        <div className="dashboard-topbar-right">
          <span className="dashboard-updated">
            <FaSyncAlt />
            Last updated: {updatedAt}
          </span>

          <span className="business-unit-chip">
            <FaIndustry />
            {companyExposure?.companyName
              ? `${companyExposure.companyName}${
                  companyExposure.isDemo ? " · DEMO" : ""
                }`
              : "Company exposure unavailable"}
          </span>

          <button
            type="button"
            className="dashboard-refresh"
            onClick={() => fetchDashboard(true)}
            disabled={loading || refreshing}
          >
            <FaSyncAlt
              className={
                refreshing ? "refresh-spinning" : ""
              }
            />

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {/* ----------------------------------------------- */}
      {/* ERRORS                                          */}
      {/* ----------------------------------------------- */}

      {error && (
        <div className="dashboard-error" role="alert">
          <FaExclamationTriangle />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => fetchDashboard()}
          >
            Try again
          </button>
        </div>
      )}

      {companyExposureError && (
        <div className="dashboard-error" role="status">
          <FaExclamationTriangle />
          <span>{companyExposureError}</span>
        </div>
      )}

      <main className="dashboard-content">
        {/* --------------------------------------------- */}
        {/* OVERVIEW CARDS                                */}
        {/* --------------------------------------------- */}

        <section className="dashboard-overview">
          <article className="overview-card">
            <div>
              <span className="overview-label">
                Overall Risk Exposure
              </span>

              <strong
                className={`overview-exposure ${overallExposure.toLowerCase()}`}
              >
                {loading && !risks.length
                  ? "..."
                  : overallExposure}
              </strong>

              <span className="overview-footnote">
                {highCriticalCount} high / critical
                verified risks
              </span>
            </div>

            <div className="overview-icon exposure-icon">
              <FaExclamationCircle />
            </div>
          </article>

          {/* AFFECTED PRODUCTS */}
<article className="overview-card">
  <div>
    <span className="overview-label">
      Affected Products
    </span>

    <strong className="overview-number">
      {loading || companyExposureLoading
        ? "..."
        : primaryRiskProducts.length}
    </strong>

    <span className="overview-footnote">
      AeroTech demo products linked to the current disruption
    </span>
  </div>

  <div className="overview-icon neutral-icon">
    <FaBox />
  </div>
</article>

{/* CRITICAL MATERIAL */}
{/* CRITICAL MATERIALS */}
<article className="overview-card">
  <div>
    <span className="overview-label">
      Materials Mapped
    </span>

    <strong className="overview-number">
      {companyExposureLoading
        ? "..."
        : criticalMaterialCount}
    </strong>

    <span className="overview-footnote">
      Unique materials linked to AeroTech demo products
    </span>
  </div>

  <div className="overview-icon neutral-icon">
    <FaCube />
  </div>
</article>

          <article className="overview-card">
            <div>
              <span className="overview-label">
                Recommended Actions
              </span>

              <strong className="overview-number">
                {loading || companyExposureLoading
                  ? "..."
                  : dashboardRecommendations.length}
              </strong>

              <span className="overview-footnote">
                {companyRecommendations.length > 0
                  ? "Company exposure suggestions"
                  : "Recorded risk recommendations"}
              </span>
            </div>

            <div className="overview-icon action-icon">
              <FaClipboardList />
            </div>
          </article>
        </section>

        {/* --------------------------------------------- */}
        {/* LIVE DATA STATUS                              */}
        {/* --------------------------------------------- */}

        <div className="dashboard-live-note">
          <span className="live-indicator" />

          Live NAO risk/material data · Refreshes every
          60 seconds

          <span>
            {lastUpdated
              ? `Last checked ${lastUpdated.toLocaleString()}`
              : "Waiting for data"}
          </span>
        </div>

        {/* --------------------------------------------- */}
        {/* PRIMARY DISRUPTION                            */}
        {/* --------------------------------------------- */}

        <section
          className="primary-disruption primary-disruption-clickable"
          role="link"
          tabIndex={0}
          aria-label={`View details for ${
            displayDisruptionTitle ||
            "primary disruption"
          }`}
          onClick={() => {
            if (primaryRisk?._id) {
              openRiskDetails(primaryRisk);
            }
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();

              if (primaryRisk?._id) {
                openRiskDetails(primaryRisk);
              }
            }
          }}
        >
          <div className="primary-disruption-icon">
            <FaGlobe />
          </div>

          <div className="primary-disruption-main">
            <span className="section-eyebrow">
              PRIMARY DISRUPTION
            </span>

            <h2>
              {displayDisruptionTitle ||
                (loading
                  ? "Loading risk information..."
                  : "No verified risks available")}
            </h2>

            <p>
              {displayDisruptionDescription ||
                "A verified risk description will appear here when available."}
            </p>
          </div>

          <div className="disruption-meta">
            <span className="section-eyebrow">
              Risk Type
            </span>

            <strong>
              {primaryRisk?.riskType || "Not classified"}
            </strong>
          </div>

          <div className="disruption-meta">
            <span className="section-eyebrow">
              Affected Region
            </span>

            <strong>
              {primaryRisk?.location || "Not specified"}
            </strong>
          </div>

          <div className="disruption-meta">
            <span className="section-eyebrow">
              Severity
            </span>

            <span
              className={`severity-pill ${getSeverity(primaryRisk)}`}
            >
              {primaryRisk
                ? titleCase(getSeverity(primaryRisk))
                : "Unknown"}
            </span>
          </div>
        </section>

        {/* --------------------------------------------- */}
        {/* EXPOSURE MAPPING AND GLOBAL SIGNALS           */}
        {/* --------------------------------------------- */}

        <div className="dashboard-main-grid">
          <section className="dashboard-panel exposure-panel">
            <div className="panel-heading">
              <div>
                <span className="section-eyebrow">
                  EXPOSURE MAPPING
                </span>

                <h2>
                  How a disruption could affect AeroTech
                </h2>
              </div>
            </div>

            <div className="exposure-flow">
              <article className="exposure-step">
                <span className="step-title">
                  Disruption Signal
                </span>

                <div className="step-icon signal-icon">
                  <FaBroadcastTower />
                </div>

                <strong>
                  {displayDisruptionTitle ||
                    "No risk selected"}
                </strong>

                <span>
                  {primaryRisk?.location ||
                    "Location unavailable"}
                </span>
              </article>

              <FaArrowRight className="flow-arrow" />

              <article className="exposure-step">
                <span className="step-title">
                  Strategic Material
                </span>

                <div className="step-icon material-icon">
                  <FaCube />
                </div>

                <strong>
                  {primaryMaterial?.name ||
                    (companyExposure?.componentName
                      ? companyExposure.componentName
                      : getMaterialName(primaryRisk))}
                </strong>

                <span>
                  {primaryMaterial?.category ||
                    "Category unavailable"}
                </span>
              </article>

              <FaArrowRight className="flow-arrow" />

              <article className="exposure-step">
                <span className="step-title">
                  Mapped AeroTech Products
                </span>

                <div className="step-icon product-icon">
                  <FaBox />
                </div>

                <strong>
                  {companyExposureLoading
                    ? "Loading..."
                    : `${primaryRiskProducts.length} mapped`}
                </strong>

                <span>{primaryProductSummary}</span>
              </article>

              <FaArrowRight className="flow-arrow" />

              <article className="exposure-step">
                <span className="step-title">
                  Operational Impact
                </span>

                <div className="step-icon dependency-icon">
                  <FaShieldAlt />
                </div>

                <strong>
                  {operationalImpactHeadline}
                </strong>

                <span>
                  {productionExposure?.estimatedProductionImpact ||
                    (primaryRiskIsCompanyLinked
                      ? primaryRisk?.operationalImpact
                      : "Company-specific operational impact has not been verified.")}
                </span>
              </article>
            </div>

            <p className="exposure-disclaimer">
              <FaExclamationTriangle />

              The AeroTech product/material mappings and
              company impact assessments are illustrative
              demonstration data. A material link does not
              prove actual product exposure, supplier
              dependency, inventory coverage, production
              losses, or financial impact.
            </p>
          </section>

          {/* ------------------------------------------- */}
          {/* VERIFIED GLOBAL SIGNALS                    */}
          {/* ------------------------------------------- */}

          <section className="dashboard-panel global-signals-panel">
            <div className="panel-heading">
              <div>
                <span className="section-eyebrow">
                  GLOBAL SIGNALS
                </span>

                <h2>Priority verified risks</h2>
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
                {prioritizedRisks
                  .slice(0, 5)
                  .map((risk) => {
                    const riskTrend = getTrend(risk);

                    const symbol = [
                      "increasing",
                      "worsening",
                    ].includes(riskTrend)
                      ? "↗"
                      : [
                            "decreasing",
                            "improving",
                          ].includes(riskTrend)
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
                        aria-label={`View details for ${
                          risk.title || "Untitled risk"
                        }`}
                        onClick={() =>
                          openRiskDetails(risk)
                        }
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
                            {risk.location || "Location unknown"}
                            {" · "}
                            {getMaterialName(risk)}
                          </span>
                        </div>

                        <span
                          className={`signal-severity ${getSeverity(risk)}`}
                        >
                          {titleCase(getSeverity(risk))}
                        </span>

                        <span
                          className={`signal-trend ${riskTrend}`}
                        >
                          {symbol}
                        </span>
                      </article>
                    );
                  })}
              </div>
            ) : (
              <p className="empty-state">
                {loading
                  ? "Loading verified risks..."
                  : "No verified risks are currently available."}
              </p>
            )}

            <div className="signal-footer">
              {risks.length} verified risks · {regions.length} recorded regions
            </div>
          </section>
        </div>

        {/* --------------------------------------------- */}
        {/* BUSINESS EXPOSURE AND TREND                  */}
        {/* --------------------------------------------- */}

        <div className="dashboard-main-grid impact-grid">
          <section className="dashboard-panel potential-impact-panel">
            <div className="panel-heading">
              <div>
                <span className="section-eyebrow">
                  POTENTIAL IMPACT
                </span>

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
                  <span>Financial exposure</span>

                  <strong>{financialHeadline}</strong>

                  <p>
                    {getFinancialDescription(financialExposure)}
                  </p>
                </div>
              </article>

              <article className="impact-metric">
                <div className="impact-icon">
                  <FaBox />
                </div>

                <div>
                  <span>Inventory coverage</span>

                  <strong>
                    {companyExposureLoading
                      ? "Loading..."
                      : inventoryHeadline}
                  </strong>

                  <p>
                    {getInventoryDescription(inventory)}
                  </p>
                </div>
              </article>

              <article className="impact-metric">
                <div className="impact-icon">
                  <FaChartLine />
                </div>

                <div>
                  <span>Recorded risk score</span>

                  <strong>
                    {primaryRisk?.riskScore != null
                      ? `${primaryRisk.riskScore}/100`
                      : primaryRisk
                        ? titleCase(getSeverity(primaryRisk))
                        : "Unknown"}
                  </strong>

                  <p>
                    {primaryRisk?.riskScoreCompleteness
                      ? `Score completeness: ${primaryRisk.riskScoreCompleteness}.`
                      : "No numerical risk score is recorded for the selected risk."}
                  </p>
                </div>
              </article>
            </div>

            {Array.isArray(primaryRisk?.industryImpacts) &&
              primaryRisk.industryImpacts.length > 0 && (
                <div className="industry-impacts">
                  <span className="section-eyebrow">
                    INDUSTRIES AFFECTED BY THE NAO RISK
                  </span>

                  {primaryRisk.industryImpacts
                    .slice(0, 4)
                    .map((item, index) => (
                      <div
                        className="industry-impact-row"
                        key={
                          item._id ||
                          `${item.industry}-${index}`
                        }
                      >
                        <strong>
                          {item.industry || "Industry"}
                        </strong>

                        <span>
                          {item.impact ||
                            "Impact not specified"}
                        </span>
                      </div>
                    ))}
                </div>
              )}

            {financialIsIllustrative && (
              <p className="actions-context">
                Financial details are illustrative. No verified
                AeroTech loss or recovery-cost figure is available.
              </p>
            )}
          </section>

          {/* ------------------------------------------- */}
          {/* RISK TREND                                  */}
          {/* ------------------------------------------- */}

          <section className="dashboard-panel trend-panel">
            <div className="panel-heading">
              <div>
                <span className="section-eyebrow">
                  EXPOSURE TREND
                </span>

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
                  {primaryRisk
                    ? titleCase(trend)
                    : "Unknown"}
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
                Historical risk scores are not available
                to produce a reliable time-series chart yet.
              </div>
            </div>

            <div className="trend-legend">
              <span />
              Current recorded direction
            </div>
          </section>
        </div>

        {/* --------------------------------------------- */}
        {/* RECOMMENDED ACTIONS                           */}
        {/* --------------------------------------------- */}

        <section className="dashboard-panel recommendations-panel">
          <div className="panel-heading">
            <div>
              <span className="section-eyebrow">
                RECOMMENDED ACTIONS
              </span>

              <h2>Next steps</h2>
            </div>
          </div>

          {dashboardRecommendations.length ? (
            <div className="recommendations-grid">
              {dashboardRecommendations
                .slice(0, 3)
                .map((item, index) => (
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
                        {item.riskTitle ||
                          "AeroTech company exposure"}
                        {" · "}
                        Priority:{" "}
                        {titleCase(item.priority || "Unknown")}
                        {item.status
                          ? ` · ${item.status}`
                          : ""}
                      </span>

                      {item.informationStatus ===
                        "Illustrative" && (
                        <p className="recommendation-risk">
                          Illustrative suggestion — validate
                          against company data before acting.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <p className="empty-state">
              {loading || companyExposureLoading
                ? "Loading recommendations..."
                : "No recommendations are recorded in the available data."}
            </p>
          )}

          {companyRecommendations.length > 0 && (
            <p className="actions-context">
              These company-exposure recommendations are suggestions.
              Validate them against actual AeroTech operations,
              inventory, and sourcing information before acting.
            </p>
          )}

          {companyRecommendations.length === 0 &&
            primaryRecommendations.length > 0 && (
              <p className="actions-context">
                The leading risk has{" "}
                {primaryRecommendations.length} recorded
                recommendation(s).
              </p>
            )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;