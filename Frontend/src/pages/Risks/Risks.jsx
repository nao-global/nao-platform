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
const MATERIALS_URL = `${API_BASE}/materials`;
const COMPANY_EXPOSURE_URL =
  `${API_BASE}/company-exposure/aerotech-titanium-demo`;

const FILTERS = ["All", "Critical", "High", "Medium", "Low"];

const JOURNEY_TABS = [
  "Overview",
  "Affected Materials",
  "Affected Components",
  "Operational Impact",
  "Source & Details",
  "Recommended Actions",
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

  if (typeof value === "object") {
    const id = value._id || value.id;
    return id ? String(id) : null;
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

function getMaterialId(risk) {
  return normalizeId(risk?.materialId);
}

function getMaterialName(risk) {
  const material = risk?.materialId || risk?.material;

  if (material && typeof material === "object") {
    return (
      material.name ||
      material.materialName ||
      risk?.materialName ||
      "Material not linked"
    );
  }

  return risk?.materialName || "Material not linked";
}

function getLinkMaterialId(link) {
  return normalizeId(link?.materialId || link?.material);
}

function getLinkMaterialName(link, materials = []) {
  const linkedMaterial = link?.materialId || link?.material;

  if (linkedMaterial && typeof linkedMaterial === "object") {
    return (
      linkedMaterial.name ||
      linkedMaterial.materialName ||
      link?.materialName ||
      "Material not linked"
    );
  }

  if (link?.materialName) {
    return link.materialName;
  }

  const linkedId = normalizeId(linkedMaterial);

  const match = materials.find(
    (material) => normalizeId(material._id) === linkedId
  );

  return (
    match?.name ||
    match?.materialName ||
    "Material not linked"
  );
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getSourceName(risk, sourceUrl) {
  if (typeof risk?.source === "string" && risk.source.trim()) {
    return risk.source.trim();
  }

  if (
    risk?.source &&
    typeof risk.source === "object" &&
    risk.source.name
  ) {
    return risk.source.name;
  }

  if (sourceUrl) {
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      return "Source article";
    }
  }

  return "Source not available";
}

function getEvidenceSource(companyExposure) {
  const evidence = Array.isArray(companyExposure?.evidence)
    ? companyExposure.evidence
    : [];

  return evidence.find((item) => item?.sourceUrl) || null;
}

function getPriorityClass(priority) {
  return String(priority || "Medium").toLowerCase();
}

function getFallbackRecommendations(materialName) {
  const material = materialName || "the affected material";

  return [
    {
      title: "Verify material sourcing",
      description:
        `Check whether AeroTech's qualified sourcing arrangements for ${material} could be affected. Confirm the connection before making procurement commitments.`,
      priority: "High",
      status: "Suggested",
      informationStatus: "Illustrative",
    },
    {
      title: "Review inventory coverage",
      description:
        `Compare verified ${material} inventory and replenishment lead times with upcoming production requirements.`,
      priority: "High",
      status: "Suggested",
      informationStatus: "Illustrative",
    },
    {
      title: "Assess component and production alternatives",
      description:
        "Review component requirements, technical compatibility, production schedules, and suitable contingency options using verified company information.",
      priority: "Medium",
      status: "Suggested",
      informationStatus: "Illustrative",
    },
  ];
}

// ======================================================
// RISKS PAGE
// ======================================================

function Risks() {
  const [risks, setRisks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [companyExposure, setCompanyExposure] = useState(null);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedRisk, setExpandedRisk] = useState(null);

  const [selectedRiskId, setSelectedRiskId] = useState(null);
  const [activeJourneyTab, setActiveJourneyTab] =
    useState("Overview");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [companyExposureWarning, setCompanyExposureWarning] =
    useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // ====================================================
  // FETCH LIVE NAO DATA
  // ====================================================

  const fetchRisks = useCallback(async () => {
    setLoading(true);
    setError("");
    setCompanyExposureWarning("");

    try {
      const [riskResult, exposureResult, materialsResult] =
        await Promise.allSettled([
          axios.get(API_URL),
          axios.get(COMPANY_EXPOSURE_URL),
          axios.get(MATERIALS_URL),
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
          "AeroTech's exposure could not be loaded. Global NAO risk signals remain available, but company-specific mapping is unavailable."
        );
      }

      if (materialsResult.status === "fulfilled") {
        const data = materialsResult.value.data;

        setMaterials(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.materials)
              ? data.materials
              : []
        );
      } else {
        console.warn(
          "Materials could not be loaded:",
          materialsResult.reason
        );

        setMaterials([]);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error(
        "Unexpected error loading risks:",
        err
      );

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
  // FILTER AND SORT VERIFIED GLOBAL RISKS
  // ====================================================

  const filteredRisks = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return risks
      .filter((risk) => {
        const matchesSeverity =
          activeFilter === "All" ||
          String(risk.severity || "").toLowerCase() ===
            activeFilter.toLowerCase();

        const industryText = Array.isArray(risk.industryImpacts)
          ? risk.industryImpacts
              .map(
                (item) =>
                  `${item.industry || ""} ${item.impact || ""}`
              )
              .join(" ")
          : "";

        const recommendationText = Array.isArray(
          risk.recommendations
        )
          ? risk.recommendations
              .map(
                (item) =>
                  `${item.title || ""} ${item.description || ""}`
              )
              .join(" ")
          : "";

        const searchableText = [
          risk.title,
          risk.location,
          risk.description,
          risk.severity,
          risk.trend,
          risk.operationalImpact,
          risk.source,
          risk.sourceUrl,
          getMaterialName(risk),
          industryText,
          recommendationText,
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
  // AEROTECH-RELATED RISK GROUPING
  // ====================================================

  const companyRiskId = normalizeId(companyExposure?.riskId);

  const companyRisk = companyRiskId
    ? filteredRisks.find(
        (risk) => normalizeId(risk._id) === companyRiskId
      ) || null
    : null;

  const globalRisks = companyRiskId
    ? filteredRisks.filter(
        (risk) => normalizeId(risk._id) !== companyRiskId
      )
    : filteredRisks;

  // The explicitly linked risk is preferred initially.
  // After a user selects a different risk, retain that selection.
  const selectedRisk = useMemo(() => {
    if (selectedRiskId) {
      const selected = risks.find(
        (risk) => normalizeId(risk._id) === selectedRiskId
      );

      if (selected) return selected;
    }

    return companyRisk || filteredRisks[0] || null;
  }, [risks, selectedRiskId, companyRisk, filteredRisks]);

  const selectedRiskIdNormalized = normalizeId(
    selectedRisk?._id
  );

  const selectedRiskIsDemoLinked = Boolean(
    selectedRiskIdNormalized &&
      companyRiskId &&
      selectedRiskIdNormalized === companyRiskId
  );

  // ====================================================
  // AEROTECH PRODUCT AND MATERIAL MAPPINGS
  // ====================================================

  const companyProducts = useMemo(
    () =>
      Array.isArray(companyExposure?.products)
        ? companyExposure.products
        : [],
    [companyExposure]
  );

  const productMaterialRows = useMemo(() => {
    const mapped = new Map();

    companyProducts.forEach((product) => {
      const links = Array.isArray(product.materials)
        ? product.materials
        : [];

      links.forEach((link) => {
        const name = getLinkMaterialName(link, materials);
        const id = getLinkMaterialId(link);

        if (!name || name === "Material not linked") return;

        const key = id || name.toLowerCase();

        if (!mapped.has(key)) {
          mapped.set(key, {
            id,
            name,
            productNames: [],
            dependencyLevels: [],
            relationshipBases: [],
          });
        }

        const row = mapped.get(key);

        if (
          product.name &&
          !row.productNames.includes(product.name)
        ) {
          row.productNames.push(product.name);
        }

        if (
          link.dependencyLevel &&
          !row.dependencyLevels.includes(link.dependencyLevel)
        ) {
          row.dependencyLevels.push(link.dependencyLevel);
        }

        if (
          link.relationshipBasis &&
          !row.relationshipBases.includes(link.relationshipBasis)
        ) {
          row.relationshipBases.push(link.relationshipBasis);
        }
      });
    });

    return [...mapped.values()];
  }, [companyProducts, materials]);

  const selectedMaterialId = getMaterialId(selectedRisk);
  const selectedMaterialName = getMaterialName(selectedRisk);

  const matchingMaterialRecord = materials.find(
    (material) => {
      const sameId =
        selectedMaterialId &&
        normalizeId(material._id) === selectedMaterialId;

      const materialName = String(
        material.name || material.materialName || ""
      ).toLowerCase();

      const sameName =
        selectedMaterialName !== "Material not linked" &&
        materialName === selectedMaterialName.toLowerCase();

      return Boolean(sameId || sameName);
    }
  );

  // This is a stored demo mapping, not proof of a real supplier
  // relationship or independently verified company exposure.
  const selectedMaterialProducts = useMemo(() => {
    if (!selectedRisk) return [];

    const targetName = selectedMaterialName.toLowerCase();

    return companyProducts.filter((product) => {
      const links = Array.isArray(product.materials)
        ? product.materials
        : [];

      return links.some((link) => {
        const linkId = getLinkMaterialId(link);
        const linkName = getLinkMaterialName(
          link,
          materials
        ).toLowerCase();

        return (
          (selectedMaterialId && linkId === selectedMaterialId) ||
          (targetName !== "material not linked" &&
            linkName === targetName)
        );
      });
    });
  }, [
    selectedRisk,
    selectedMaterialId,
    selectedMaterialName,
    companyProducts,
    materials,
  ]);

  const companyMaterialId = normalizeId(
    companyExposure?.materialId
  );

  const companyPrimaryMaterialName = String(
    companyExposure?.componentName || ""
  ).toLowerCase();

  const selectedRiskMatchesPrimaryExposure =
    Boolean(
      selectedMaterialId &&
        companyMaterialId &&
        selectedMaterialId === companyMaterialId
    ) ||
    (selectedMaterialName !== "Material not linked" &&
      companyPrimaryMaterialName.includes(
        selectedMaterialName.toLowerCase()
      ));

  // ====================================================
  // SELECTED RISK SOURCE AND COMPANY CONTEXT
  // ====================================================

  const fallbackEvidence = getEvidenceSource(companyExposure);

  // Only reuse the company exposure's source when this is the exact
  // risk linked by riskId. A separate Titanium story must keep its own
  // source rather than inheriting the Kenmare article by material alone.
  const selectedSourceUrl =
    selectedRisk?.sourceUrl ||
    selectedRisk?.url ||
    (selectedRiskIsDemoLinked
      ? companyExposure?.sourceUrl || fallbackEvidence?.sourceUrl
      : "") ||
    "";

  const selectedSourceName = getSourceName(
    selectedRisk,
    selectedSourceUrl
  );

  const selectedPublishedAt =
    selectedRisk?.publishedAt ||
    selectedRisk?.sourcePublishedAt ||
    (selectedRiskIsDemoLinked
      ? companyExposure?.sourcePublishedAt ||
        fallbackEvidence?.recordedAt
      : null);

  const selectedRiskTitle =
    selectedRisk?.title || "Select a disruption";

  const selectedRiskDescription =
    selectedRisk?.description ||
    "Select a verified NAO risk to trace its potential connection to AeroTech.";

  const inventory = companyExposure?.inventory || {};
  const financialExposure =
    companyExposure?.financialExposure || {};
  const productionExposure =
    companyExposure?.productionExposure || {};
  const supplierExposure =
    companyExposure?.supplierExposure || {};

  const inventoryDays = Number(inventory.daysRemaining);

  // Company-specific inventory assumptions are shown only for the
  // explicitly linked demo risk, not for every story about Titanium.
  const hasInventoryDays =
    selectedRiskIsDemoLinked &&
    inventory.daysRemaining !== null &&
    inventory.daysRemaining !== undefined &&
    Number.isFinite(inventoryDays);

  const isDemo =
    companyExposure?.isDemo === true ||
    companyExposure?.informationStatus === "Illustrative";

  // ====================================================
  // RECOMMENDATIONS FOR THE SELECTED JOURNEY
  // ====================================================

  const journeyRecommendations = useMemo(() => {
    if (!selectedRisk) return [];

    const companyRecommendations = Array.isArray(
      companyExposure?.recommendations
    )
      ? companyExposure.recommendations
      : [];

    const riskRecommendations = Array.isArray(
      selectedRisk.recommendations
    )
      ? selectedRisk.recommendations
      : [];

    // Stored company-level actions belong to the specifically
    // linked AeroTech risk, not every risk in the global feed.
    if (
      selectedRiskIsDemoLinked &&
      companyRecommendations.length
    ) {
      return companyRecommendations;
    }

    if (riskRecommendations.length) {
      return riskRecommendations;
    }

    if (selectedMaterialProducts.length) {
      return getFallbackRecommendations(selectedMaterialName);
    }

    return [
      {
        title: "Monitor the global signal",
        description:
          "Review the source and follow subsequent reporting before treating this event as an AeroTech-specific exposure.",
        priority: "Medium",
        status: "Suggested",
        informationStatus: "Illustrative",
      },
      {
        title: "Check for a material mapping",
        description:
          "Verify whether the affected material is used in AeroTech products and components before assigning company-level impact.",
        priority: "Medium",
        status: "Suggested",
        informationStatus: "Illustrative",
      },
    ];
  }, [
    selectedRisk,
    selectedRiskIsDemoLinked,
    selectedMaterialProducts,
    selectedMaterialName,
    companyExposure,
  ]);

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

  const handleSelectRisk = (risk) => {
    setSelectedRiskId(normalizeId(risk?._id));
    setActiveJourneyTab("Overview");
  };

  // ====================================================
  // SELECTED DISRUPTION: GLOBAL-TO-COMPANY JOURNEY
  // ====================================================

  const renderJourney = () => {
    if (!selectedRisk) {
      return (
        <section className="risk-journey">
          <div className="risk-journey-empty">
            <span className="journey-eyebrow">
              AEROTECH MANUFACTURING
            </span>

            <h2>From global disruption to company action</h2>

            <p>
              Select a verified disruption from the risk list below
              to trace its material, product, operational implications,
              source evidence, and recommended next steps.
            </p>
          </div>
        </section>
      );
    }

    const hasMappedProduct = selectedMaterialProducts.length > 0;

    const mappedEvidenceStatus = selectedRiskIsDemoLinked
      ? "Linked to AeroTech demo record"
      : hasMappedProduct
        ? "Material appears in demo product mappings"
        : "Global signal — no matching product mapping";

    const directRelationshipNote = selectedRiskIsDemoLinked
      ? "This risk is explicitly referenced by the AeroTech demo exposure record. The mapped company products and company impact assumptions remain illustrative."
      : hasMappedProduct
        ? `The selected risk concerns ${selectedMaterialName}, which appears in the AeroTech demo product mappings. This is a material mapping only; an actual supplier relationship or company disruption has not been verified.`
        : `No AeroTech demo product currently maps to ${selectedMaterialName}. Treat this as global intelligence until a company-material connection is verified.`;

    return (
      <section
        className="risk-journey"
        aria-label="Disruption to AeroTech business impact journey"
      >
        <div className="journey-header">
          <div className="journey-title-copy">
            <span className="journey-eyebrow">
              AEROTECH MANUFACTURING · RISK-TO-ACTION JOURNEY
            </span>

            <h2>From global disruption to company action</h2>

            <p>
              Follow what happened globally, which material is
              involved, where it appears in AeroTech's demo product
              mappings, and what should be checked next.
            </p>
          </div>

          <div className="journey-demo-tag">
            {isDemo ? "Illustrative company data" : "Company context"}
          </div>
        </div>

        <div className="journey-selector-row">
          <label htmlFor="journey-risk-selector">
            Selected disruption
          </label>

          <select
            id="journey-risk-selector"
            value={selectedRiskIdNormalized || ""}
            onChange={(event) => {
              setSelectedRiskId(event.target.value || null);
              setActiveJourneyTab("Overview");
            }}
          >
            {risks.map((risk) => (
              <option
                key={risk._id}
                value={normalizeId(risk._id)}
              >
                {risk.title || "Untitled risk"} —{" "}
                {getMaterialName(risk)}
              </option>
            ))}
          </select>
        </div>

        <div className="journey-risk-banner">
          <div className="journey-event-icon" aria-hidden="true">
            <span>!</span>
          </div>

          <div className="journey-event-main">
            <div className="journey-event-title-row">
              <h3>{selectedRiskTitle}</h3>

              <span
                className={`badge ${getSeverityClass(
                  selectedRisk.severity
                )}`}
              >
                {selectedRisk.severity || "Unknown"}
              </span>
            </div>

            <div className="journey-event-meta">
              <span>{selectedMaterialName}</span>
              <span className="journey-meta-dot">•</span>

              <span>
                {selectedRisk.location || "Location not specified"}
              </span>

              <span className="journey-meta-dot">•</span>
              <span>{formatDate(selectedPublishedAt)}</span>
            </div>

            <div className="journey-status-row">
              <span className="journey-status-chip">
                {mappedEvidenceStatus}
              </span>

              <span className="journey-demo-chip">
                Company impact not independently verified
              </span>
            </div>
          </div>
        </div>

        {/* Six-stage stepper removed. Existing navigation tabs retained. */}

        <nav
          className="journey-tabs"
          aria-label="Selected risk details"
          role="tablist"
        >
          {JOURNEY_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeJourneyTab === tab}
              className={
                activeJourneyTab === tab
                  ? "journey-tab active"
                  : "journey-tab"
              }
              onClick={() => setActiveJourneyTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="journey-tab-content" role="tabpanel">
          {/* ---------------------------------------------
              OVERVIEW: GLOBAL EVENT -> COMPANY CONTEXT
          --------------------------------------------- */}
          {activeJourneyTab === "Overview" && (
            <div className="journey-overview">
              <div className="journey-two-column">
                <section className="journey-info-panel">
                  <span className="journey-section-kicker">
                    GLOBAL SIGNAL
                  </span>

                  <h3>{selectedRiskTitle}</h3>
                  <p>{selectedRiskDescription}</p>

                  <div className="journey-info-meta">
                    <span>
                      Source:{" "}
                      {getSourceName(
                        selectedRisk,
                        selectedSourceUrl
                      )}
                    </span>

                    <span>
                      Published: {formatDate(selectedPublishedAt)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="journey-text-link"
                    onClick={() =>
                      setActiveJourneyTab("Source & Details")
                    }
                  >
                    Review source and evidence →
                  </button>
                </section>

                <section className="journey-info-panel journey-company-panel">
                  <span className="journey-section-kicker">
                    AEROTECH INTERPRETATION
                  </span>

                  <h3>What could this mean for the company?</h3>
                  <p>{directRelationshipNote}</p>

                  <div className="journey-company-highlight">
                    <span>Mapped product count</span>

                    <strong>
                      {selectedMaterialProducts.length}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="journey-text-link"
                    onClick={() =>
                      setActiveJourneyTab("Affected Components")
                    }
                  >
                    Trace component and products →
                  </button>
                </section>
              </div>

              <div className="journey-metric-grid">
                <article className="journey-metric">
                  <span>Global risk severity</span>

                  <strong>
                    {selectedRisk.severity || "Unknown"}
                  </strong>

                  <small>
                    Severity recorded for the global risk
                  </small>
                </article>

                <article className="journey-metric">
                  <span>Strategic material</span>

                  <strong>{selectedMaterialName}</strong>

                  <small>
                    {matchingMaterialRecord?.category ||
                      "Material category not available"}
                  </small>
                </article>

                <article className="journey-metric">
                  <span>Mapped AeroTech products</span>

                  <strong>
                    {selectedMaterialProducts.length}
                  </strong>

                  <small>Illustrative product mapping</small>
                </article>

                <article className="journey-metric">
                  <span>Inventory coverage</span>

                  <strong>
                    {hasInventoryDays
                      ? `${inventoryDays} days`
                      : "Unknown"}
                  </strong>

                  <small>
                    {hasInventoryDays
                      ? "Illustrative assumption, not actual stock"
                      : "No matching company-specific value"}
                  </small>
                </article>
              </div>

              <div className="journey-explanation">
                <strong>Evidence boundary</strong>

                <p>
                  A global event can indicate a risk worth monitoring,
                  but it does not automatically prove AeroTech has been
                  disrupted. NAO uses the stored material mappings to
                  explain possible relevance and highlights which
                  company-specific facts still need verification.
                </p>
              </div>
            </div>
          )}

          {/* ---------------------------------------------
              AFFECTED MATERIALS
          --------------------------------------------- */}
          {activeJourneyTab === "Affected Materials" && (
            <div className="journey-section">
              <div className="journey-section-heading">
                <div>
                  <h3>AeroTech's mapped strategic materials</h3>

                  <p>
                    These materials come from the current demo
                    product-to-material records.
                  </p>
                </div>

                <span className="journey-count-tag">
                  {productMaterialRows.length} mapped
                </span>
              </div>

              {productMaterialRows.length ? (
                <div className="journey-material-list">
                  {productMaterialRows.map((row) => {
                    const isSelectedMaterial =
                      (selectedMaterialId &&
                        row.id === selectedMaterialId) ||
                      row.name.toLowerCase() ===
                        selectedMaterialName.toLowerCase();

                    const materialRecord = materials.find(
                      (material) =>
                        (row.id &&
                          normalizeId(material._id) === row.id) ||
                        String(
                          material.name ||
                            material.materialName ||
                            ""
                        ).toLowerCase() === row.name.toLowerCase()
                    );

                    return (
                      <article
                        key={row.id || row.name}
                        className={`journey-material-card ${
                          isSelectedMaterial ? "selected" : ""
                        }`}
                      >
                        <div className="journey-material-symbol">
                          {row.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="journey-material-main">
                          <div className="journey-material-title">
                            <h4>{row.name}</h4>

                            {isSelectedMaterial && (
                              <span className="journey-selected-tag">
                                Selected risk material
                              </span>
                            )}
                          </div>

                          <p>
                            {materialRecord?.category ||
                              "Strategic material"}
                          </p>

                          {materialRecord?.description && (
                            <p className="journey-material-description">
                              {materialRecord.description}
                            </p>
                          )}

                          <div className="journey-chip-row">
                            {row.dependencyLevels.map((level) => (
                              <span
                                className="journey-material-chip"
                                key={level}
                              >
                                {level} dependency
                              </span>
                            ))}

                            <span className="journey-demo-chip">
                              Demo mapping
                            </span>
                          </div>

                          <div className="journey-product-links">
                            <span>Mapped products</span>

                            <div>
                              {row.productNames.map((name) => (
                                <span
                                  className="journey-product-chip"
                                  key={name}
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>

                          <p className="journey-basis-note">
                            {row.relationshipBases[0] ||
                              "Illustrative demo mapping only; not verified company or product data."}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="journey-empty">
                  No AeroTech product-material mappings were returned.
                </div>
              )}

              {!productMaterialRows.some(
                (row) =>
                  row.name.toLowerCase() ===
                    selectedMaterialName.toLowerCase() ||
                  (selectedMaterialId && row.id === selectedMaterialId)
              ) && (
                <div className="journey-notice">
                  <strong>No material mapping found</strong>

                  <p>
                    {selectedMaterialName} is not currently mapped to
                    an AeroTech demo product. Keep this as a global
                    signal until a product relationship is verified.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------
              CRITICAL COMPONENT -> AEROTECH PRODUCTS
          --------------------------------------------- */}
          {activeJourneyTab === "Affected Components" && (
            <div className="journey-section">
              <div className="journey-section-heading">
                <div>
                  <h3>Products and components in the exposure path</h3>

                  <p>
                    Trace the selected material through the stored
                    AeroTech demo component and product mappings.
                  </p>
                </div>

                <span className="journey-count-tag">
                  {selectedMaterialProducts.length} mapped
                </span>
              </div>

              {selectedRiskMatchesPrimaryExposure &&
                companyExposure?.componentName && (
                  <article className="journey-critical-component">
                    <span className="journey-section-kicker">
                      COMPONENT IN THE AEROTECH DEMO SCENARIO
                    </span>

                    <h4>{companyExposure.componentName}</h4>

                    <p>
                      {selectedRiskIsDemoLinked
                        ? "This component is stored on the AeroTech exposure record explicitly linked to this Titanium risk. It demonstrates how NAO traces a global event into a company-level scenario; it does not prove an actual supplier relationship or production disruption."
                        : "The stored demo scenario maps Titanium to this component. The selected risk is not the specific risk linked to that scenario, so this is a possible material path for review—not evidence that this separate event affects AeroTech."}
                    </p>

                    <div className="journey-chip-row">
                      <span className="journey-material-chip selected">
                        {selectedMaterialName}
                      </span>

                      <span className="journey-demo-chip">
                        Illustrative component mapping
                      </span>
                    </div>
                  </article>
                )}

              {selectedMaterialProducts.length ? (
                <div className="journey-component-list">
                  {selectedMaterialProducts.map((product, index) => {
                    const links = Array.isArray(product.materials)
                      ? product.materials
                      : [];

                    return (
                      <article
                        key={product.productKey || product.name || index}
                        className="journey-component-card"
                      >
                        <div className="journey-component-number">
                          {String(index + 1).padStart(2, "0")}
                        </div>

                        <div className="journey-component-main">
                          <div className="journey-component-title">
                            <div>
                              <span className="journey-section-kicker">
                                {product.category || "Demo component"}
                              </span>

                              <h4>
                                {product.name || "AeroTech demo product"}
                              </h4>
                            </div>

                            <span className="journey-demo-chip">
                              Illustrative
                            </span>
                          </div>

                          {product.description && (
                            <p>{product.description}</p>
                          )}

                          <div className="journey-component-meta">
                            <span>Mapped materials</span>

                            <div className="journey-chip-row">
                              {links.map((link, linkIndex) => (
                                <span
                                  className={`journey-material-chip ${
                                    getLinkMaterialName(
                                      link,
                                      materials
                                    ).toLowerCase() ===
                                    selectedMaterialName.toLowerCase()
                                      ? "selected"
                                      : ""
                                  }`}
                                  key={
                                    getLinkMaterialId(link) ||
                                    `${product.name}-${linkIndex}`
                                  }
                                >
                                  {getLinkMaterialName(link, materials)}
                                  {link.dependencyLevel
                                    ? ` · ${link.dependencyLevel}`
                                    : ""}
                                </span>
                              ))}
                            </div>
                          </div>

                          {product.operationalImpact && (
                            <div className="journey-component-impact">
                              <strong>Possible component impact</strong>
                              <p>{product.operationalImpact}</p>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="journey-empty">
                  <strong>
                    No mapped AeroTech component found for this material.
                  </strong>

                  <p>
                    This disruption remains a global signal until a
                    matching material-to-product mapping is available.
                  </p>

                  {companyProducts.length > 0 && (
                    <div className="journey-other-products">
                      <span>Other demo products available</span>

                      {companyProducts.map((product) => (
                        <span
                          className="journey-product-chip"
                          key={product.productKey || product.name}
                        >
                          {product.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="journey-footnote">
                The product and component mappings are fictional demo
                data. They illustrate a traceability path and do not
                verify actual product structures or procurement.
              </p>
            </div>
          )}

          {/* ---------------------------------------------
              OPERATIONAL IMPACT
          --------------------------------------------- */}
          {activeJourneyTab === "Operational Impact" && (
            <div className="journey-section">
              <div className="journey-section-heading">
                <div>
                  <h3>Potential operational impact</h3>

                  <p>
                    Scenario-based implications for AeroTech, not
                    confirmed losses or disruptions.
                  </p>
                </div>

                <span className="journey-demo-chip">
                  Illustrative assessment
                </span>
              </div>

              {hasMappedProduct ? (
                <>
                  <div className="journey-impact-grid">
                    <article className="journey-impact-card">
                      <span>Inventory coverage</span>

                      <strong>
                        {hasInventoryDays
                          ? `${inventoryDays} days`
                          : "Not supplied"}
                      </strong>

                      <small>
                        {hasInventoryDays
                          ? inventory.assumptionNotes ||
                            "Illustrative inventory assumption only."
                          : "Verify inventory and replenishment data for this material."}
                      </small>
                    </article>

                    <article className="journey-impact-card">
                      <span>Production continuity</span>

                      <strong>
                        {selectedRiskIsDemoLinked
                          ? productionExposure.severity ||
                            "Scenario to assess"
                          : "To be assessed"}
                      </strong>

                      <small>
                        {selectedRiskIsDemoLinked
                          ? productionExposure.estimatedProductionImpact ||
                            "Assess whether component availability could affect production."
                          : "Evaluate the selected material against real production requirements; no impact has been quantified."}
                      </small>
                    </article>

                    <article className="journey-impact-card">
                      <span>Financial exposure</span>

                      <strong>
                        {selectedRiskIsDemoLinked &&
                        financialExposure.estimatedLoss != null
                          ? `${financialExposure.currency || "USD"} ${Number(
                              financialExposure.estimatedLoss
                            ).toLocaleString()}`
                          : "Not quantified"}
                      </strong>

                      <small>
                        {selectedRiskIsDemoLinked
                          ? financialExposure.estimatedCostImpact ||
                            financialExposure.assumptionNotes ||
                            "No verified company-specific financial estimate is available."
                          : "No verified company-specific financial estimate is available for this selected risk."}
                      </small>
                    </article>

                    <article className="journey-impact-card">
                      <span>Supplier concentration</span>

                      <strong>
                        {selectedRiskIsDemoLinked &&
                        supplierExposure.supplierCount != null
                          ? supplierExposure.supplierCount
                          : "Not verified"}
                      </strong>

                      <small>
                        {selectedRiskIsDemoLinked && supplierExposure.notes
                          ? supplierExposure.notes
                          : "AeroTech supplier count and geographic dependencies have not been verified."}
                      </small>
                    </article>
                  </div>

                  <div className="journey-impact-explanation">
                    <strong>How this could affect AeroTech</strong>

                    <p>
                      If a disruption affects an input used by a mapped
                      product, material availability could influence
                      component planning or production continuity. The
                      actual likelihood, duration, and cost need to be
                      assessed with verified inventory, sourcing, and
                      production records.
                    </p>
                  </div>
                </>
              ) : (
                <div className="journey-notice">
                  <strong>
                    Company impact has not been established
                  </strong>

                  <p>
                    No AeroTech demo product is mapped to{" "}
                    {selectedMaterialName}. NAO should monitor this
                    global signal, but must not assign company inventory,
                    production, or financial exposure without a valid
                    product relationship and supporting data.
                  </p>
                </div>
              )}

              {selectedRisk.operationalImpact && (
                <div className="journey-global-impact">
                  <span className="journey-section-kicker">
                    GLOBAL / INDUSTRY CONTEXT
                  </span>

                  <p>{selectedRisk.operationalImpact}</p>

                  <small>
                    This description is the risk's recorded operational
                    impact; it is not a measured AeroTech-specific impact.
                  </small>
                </div>
              )}

              <p className="journey-footnote">
                Never treat the illustrative inventory value, a suggested
                production scenario, or an unquantified cost description
                as a measured fact about AeroTech Manufacturing.
              </p>
            </div>
          )}

          {/* ---------------------------------------------
              SOURCE AND DETAILS
          --------------------------------------------- */}
          {activeJourneyTab === "Source & Details" && (
            <div className="journey-section">
              <div className="journey-section-heading">
                <div>
                  <h3>Source and evidence</h3>

                  <p>
                    Inspect the evidence behind the selected global
                    risk before deciding how it relates to AeroTech.
                  </p>
                </div>
              </div>

              <article className="journey-source-card">
                <div className="journey-source-symbol">↗</div>

                <div className="journey-source-main">
                  <span className="journey-section-kicker">
                    ORIGINAL SOURCE
                  </span>

                  <h4>{selectedRiskTitle}</h4>

                  <p className="journey-source-name">
                    {selectedSourceName}
                  </p>

                  <p className="journey-source-date">
                    Published {formatDate(selectedPublishedAt)}
                  </p>

                  <p>{selectedRiskDescription}</p>

                  {selectedSourceUrl ? (
                    <a
                      href={selectedSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="journey-source-link"
                    >
                      Open original article{" "}
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <p className="journey-source-unavailable">
                      No source URL is recorded for this risk.
                    </p>
                  )}
                </div>
              </article>

              <div className="journey-source-details">
                <div>
                  <span>Material</span>
                  <strong>{selectedMaterialName}</strong>
                </div>

                <div>
                  <span>Location in risk record</span>
                  <strong>
                    {selectedRisk.location || "Not specified"}
                  </strong>
                </div>

                <div>
                  <span>Risk severity</span>
                  <strong>
                    {selectedRisk.severity || "Unknown"}
                  </strong>
                </div>

                <div>
                  <span>Trend</span>
                  <strong>
                    {selectedRisk.trend || "Unknown"}
                  </strong>
                </div>

                <div>
                  <span>Evidence status</span>
                  <strong>
                    {selectedRisk.evidenceStatus ||
                      "Returned in NAO verified-risk feed"}
                  </strong>
                </div>
              </div>

              <div className="journey-notice">
                <strong>Evidence boundary</strong>

                <p>
                  The external source supports the reported event as
                  represented in the risk record. It does not, by
                  itself, verify a supplier relationship with AeroTech,
                  an AeroTech-specific shortage, inventory level,
                  production delay, or financial loss.
                </p>
              </div>
            </div>
          )}

          {/* ---------------------------------------------
              RECOMMENDED ACTIONS
          --------------------------------------------- */}
          {activeJourneyTab === "Recommended Actions" && (
            <div className="journey-section">
              <div className="journey-section-heading">
                <div>
                  <h3>Recommended actions for AeroTech</h3>

                  <p>
                    Suggested actions connected to the selected risk.
                    They are not confirmations that work has already
                    been completed.
                  </p>
                </div>

                <span className="journey-count-tag">
                  {journeyRecommendations.length} suggestions
                </span>
              </div>

              {journeyRecommendations.length ? (
                <div className="journey-actions-list">
                  {journeyRecommendations.map((item, index) => (
                    <article
                      className="journey-action-card"
                      key={
                        item._id ||
                        `${item.title || "action"}-${index}`
                      }
                    >
                      <div className="journey-action-number">
                        {index + 1}
                      </div>

                      <div className="journey-action-main">
                        <div className="journey-action-title-row">
                          <h4>
                            {item.title || "Recommended action"}
                          </h4>

                          <span
                            className={`journey-priority journey-priority-${getPriorityClass(
                              item.priority
                            )}`}
                          >
                            {item.priority || "Medium"} priority
                          </span>
                        </div>

                        <p>
                          {item.description ||
                            "Review this action and determine an appropriate next step."}
                        </p>

                        {item.reason && (
                          <div className="journey-action-reason">
                            <strong>Why this matters</strong>
                            <p>{item.reason}</p>
                          </div>
                        )}

                        <div className="journey-action-meta">
                          <span>{item.status || "Suggested"}</span>

                          <span>
                            {item.informationStatus || "Illustrative"}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="journey-empty">
                  No recommendations are recorded for this risk yet.
                </div>
              )}

              <div className="journey-next-step">
                <strong>Before taking action</strong>

                <p>
                  Verify the affected material, supplier exposure,
                  inventory, technical compatibility, and production
                  requirements. Supplier and procurement choices should
                  only be made after checking actual company data.
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="journey-disclaimer">
          <span className="journey-disclaimer-icon">i</span>

          <p>
            <strong>Demo data notice:</strong>{" "}
            AeroTech Manufacturing is fictional. Product mappings,
            inventory coverage, and company impact scenarios are
            illustrative unless separately verified with company records.
            A global risk's severity is not automatically AeroTech's
            severity.
          </p>
        </footer>
      </section>
    );
  };

  // ====================================================
  // EXISTING RISK CARD AND EXPANDABLE ANALYSIS
  // ====================================================

  const renderRiskCard = (risk, isCompanyLinked = false) => {
    const riskId = normalizeId(risk._id);
    const isExpanded = expandedRisk === riskId;
    const isSelected = selectedRiskIdNormalized === riskId;
    const severity = risk.severity || "Unknown";
    const trend = risk.trend || "Unknown";

    const industryImpacts = Array.isArray(risk.industryImpacts)
      ? risk.industryImpacts
      : [];

    const recommendations = Array.isArray(risk.recommendations)
      ? risk.recommendations
      : [];

    return (
      <article
        className={`risk-item ${
          isCompanyLinked ? "risk-item-company-linked" : ""
        } ${isSelected ? "risk-item-selected" : ""}`}
        key={riskId}
      >
        <div className="risk-top">
          <div className="risk-heading-copy">
            <h2>{risk.title || "Untitled risk"}</h2>

            {isCompanyLinked && (
              <span className="company-risk-badge">
                AeroTech demo-linked risk
              </span>
            )}

            <p className="risk-location">
              <span aria-hidden="true">⌖</span>{" "}
              {risk.location || "Location unknown"}
            </p>
          </div>

          <span className={`badge ${getSeverityClass(severity)}`}>
            {severity}
          </span>
        </div>

        {risk.description && (
          <p className="risk-description">{risk.description}</p>
        )}

        <div className="risk-details">
          <div className="risk-detail">
            <strong>Material</strong>
            <p>{getMaterialName(risk)}</p>
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

        {isCompanyLinked && (
          <p className="company-risk-disclaimer">
            This risk is explicitly linked to AeroTech's demo exposure
            record. The product-level relationship and company impact
            remain illustrative.
          </p>
        )}

        <div className="risk-card-actions">
          <button
            type="button"
            className="trace-risk-btn"
            onClick={() => handleSelectRisk(risk)}
            aria-pressed={isSelected}
          >
            {isSelected
              ? "Selected for journey ✓"
              : "Trace this disruption →"}
          </button>

          <button
            type="button"
            className="view-btn"
            onClick={() =>
              setExpandedRisk(isExpanded ? null : riskId)
            }
            aria-expanded={isExpanded}
          >
            {isExpanded ? "Hide Analysis ↑" : "View Analysis →"}
          </button>
        </div>

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
                        {item.industry || "Industry unspecified"}
                      </strong>

                      <p>
                        {item.impact || "Impact not specified."}
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
                        `${item.title || "action"}-${index}`
                      }
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
            Follow verified global signals through AeroTech's demo
            materials and products to potential business impact and
            next actions.
          </p>

          {lastUpdated && (
            <span className="risks-last-updated">
              Last refreshed {lastUpdated.toLocaleTimeString()}
            </span>
          )}
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

      {/* Main disruption-to-action experience */}
      {renderJourney()}

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
          onChange={(event) => setSearch(event.target.value)}
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
              className={activeFilter === filter ? "active" : ""}
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
          The explicitly linked AeroTech demo risk appears first
          when it matches the current filters. Other verified NAO
          signals remain global intelligence; a matching material
          alone does not prove actual company exposure. Use
          &quot;Trace this disruption&quot; to follow another risk
          through the assessment journey above.
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
                    This risk is referenced by the existing AeroTech
                    demo exposure record. Company product relationships
                    and impact assumptions remain illustrative.
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
                    Verified NAO signals across tracked materials and
                    regions. Select a disruption to explore possible
                    relevance to AeroTech without assuming a direct
                    supplier or operational relationship.
                  </p>
                </div>
              </div>

              <div className="risk-group-list">
                {globalRisks.map((risk) =>
                  renderRiskCard(risk, false)
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