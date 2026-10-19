const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TRACKED_MATERIALS = [
  "Nickel",
  "Titanium",
  "Iridium",
  "Ruthenium",
];

const SUPPLIER_TYPES = [
  "Miner",
  "Refiner",
  "Processor",
  "Manufacturer",
  "Distributor",
  "Recycler",
  "LogisticsProvider",
  "EquipmentProvider",
  "TradingCompany",
  "Other",
  "Unknown",
];

const MATERIAL_RELATIONSHIP_TYPES = [
  "Mines",
  "Produces",
  "Refines",
  "Processes",
  "Recycles",
  "Distributes",
  "Supplies",
  "EquipmentProviderFor",
  "Purchases",
  "Uses",
  "Develops",
  "Researches",
  "Other",
  "Unknown",
];

const OPERATIONAL_IMPACT_CONFIDENCE = [
  "Low",
  "Medium",
  "High",
];

const normalizeForMatch = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(String(value));

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
};

const getCleanOrganizations = (
  organizations,
  articleText,
  relevantMaterials
) => {
  if (!Array.isArray(organizations)) {
    return [];
  }

  const normalizedArticle =
    normalizeForMatch(articleText);

  const seen = new Set();
  const cleaned = [];

  for (const organization of organizations) {
    if (
      !organization ||
      typeof organization.name !== "string"
    ) {
      continue;
    }

    const name = organization.name.trim();

    if (!name || name.length > 150) {
      continue;
    }

    const normalizedName =
      normalizeForMatch(name);

    // Do not create records for company names that
    // cannot be found in the supplied article text.
    if (
      !normalizedName ||
      !normalizedArticle.includes(normalizedName)
    ) {
      continue;
    }

    if (seen.has(normalizedName)) {
      continue;
    }

    seen.add(normalizedName);

    const supplierType =
      SUPPLIER_TYPES.includes(
        organization.supplierType
      )
        ? organization.supplierType
        : "Unknown";

    const confidence = [
      "Low",
      "Medium",
      "High",
    ].includes(organization.confidence)
      ? organization.confidence
      : "Low";

    const relatedMaterials = [
      ...new Set(
        (
          Array.isArray(organization.relatedMaterials)
            ? organization.relatedMaterials
            : []
        ).filter(
          (material) =>
            TRACKED_MATERIALS.includes(material) &&
            relevantMaterials.includes(material)
        )
      ),
    ];

    const materialRelationships = (
      Array.isArray(
        organization.materialRelationships
      )
        ? organization.materialRelationships
        : []
    )
      .filter(
        (relationship) =>
          relationship &&
          TRACKED_MATERIALS.includes(
            relationship.material
          ) &&
          relevantMaterials.includes(
            relationship.material
          ) &&
          MATERIAL_RELATIONSHIP_TYPES.includes(
            relationship.relationshipType
          ) &&
          relationship.relationshipType !== "Unknown"
      )
      .map((relationship) => ({
        material: relationship.material,
        relationshipType:
          relationship.relationshipType,
        summary:
          String(relationship.summary ?? "").trim(),
      }));

    // Countries are retained only when they are
    // explicitly present in the provided article text.
    let country =
      String(organization.country ?? "Unknown")
        .trim() || "Unknown";

    if (
      country !== "Unknown" &&
      !normalizedArticle.includes(
        normalizeForMatch(country)
      )
    ) {
      country = "Unknown";
    }

    // An AI-generated website is accepted only if
    // that actual URL appears in the article text.
    let website = "";

    if (
      isHttpUrl(organization.website) &&
      String(articleText).includes(
        organization.website
      )
    ) {
      website = organization.website;
    }

    cleaned.push({
      name,
      country,
      website,
      supplierType,

      roleDescription:
        String(
          organization.roleDescription ?? ""
        ).trim() ||
        "Organization mentioned in a relevant article; role requires review.",

      relatedMaterials,

      materialRelationships,

      confidence,

      evidenceSummary:
        String(
          organization.evidenceSummary ?? ""
        ).trim() ||
        "The organization is named in the source article. Its precise supply-chain role has not been independently verified.",
    });
  }

  return cleaned.slice(0, 12);
};

const analyzeNews = async ({
  title,
  description,
  content,
  source,
  url,
  publishedAt,
  possibleMaterials = [],
}) => {
  const safeTitle = String(title ?? "Unknown");

  const safeDescription = String(
    description ?? "Unknown"
  );

  const safeContent = String(
    content ?? "Unknown"
  ).slice(0, 5000);

  const safeSource = String(
    source ?? "Unknown"
  );

  const safeUrl = String(url ?? "Unknown");

  const safePublishedAt = String(
    publishedAt ?? "Unknown"
  );

  const materialHints = Array.isArray(
    possibleMaterials
  )
    ? possibleMaterials
    : [];

  const articleText = [
    safeTitle,
    safeDescription,
    safeContent,
  ].join("\n");

  try {
    const response =
      await openai.responses.create({
        model: "gpt-5.6-luna",

        input: `
You are the semantic news analyst for NAO, a Supply Chain Risk Intelligence platform.

NAO tracks these strategic materials:
- Nickel
- Titanium
- Iridium
- Ruthenium

Determine whether the article contains a meaningful supply-chain,
availability, production, demand, trade, industrial, technology,
substitution, or strategic-dependence signal involving one or more
of these materials.

Possible materials detected by local search:
${JSON.stringify(materialHints)}

These are retrieval hints only. Do not assume they are correct.

FALSE POSITIVES:
Reject articles about:
- titanium watches, watch bands, knives, accessories, and unrelated
  consumer products
- Titanium efficiency ratings
- Nickel comics, Nickelback, Nickelodeon
- Iridium Communications, satellite communications, software,
  developer tools, or security tools
- unrelated organizations with material-like names
- jewelry, advertisements, product reviews, entertainment, or sports
- stock-market stories with no meaningful strategic-material impact
- articles in which a material is an incidental product component

RELEVANT SIGNALS:
- supply disruptions, shortages, production cuts, and mine closures
- mining, refining, processing, recycling, and transport problems
- export controls, tariffs, sanctions, and trade restrictions
- geopolitical events affecting material supply
- supplier concentration or dependence on one country
- changes in production capacity, demand, or availability
- stockpiling, inventory constraints, and price pressure
- new sources of supply and material substitution
- research or technology that could affect material demand
- strategic dependence on a particular material

Research articles can be relevant when they could materially
affect future supply, demand, production, availability,
substitution, material intensity, or strategic dependence.
Do not assume research has been commercialized.

COMPANY AND ORGANIZATION EXTRACTION:
For relevant articles, identify named organizations that have
a meaningful connection to the reported supply-chain event.
Extract at most 12 organizations.

Use only organization names that actually appear in the supplied
title, description, or content.

Examples of roles include:
- miner or mining operator
- refiner or processor
- producer or recycler
- distributor or trading company
- manufacturer or equipment provider
- purchaser or material consumer
- project developer
- logistics provider
- research or technology organization
- another clearly described role

Do not automatically classify every organization as a supplier.
An equipment company is not thereby a supplier of the raw material.
A buyer or purchaser is not thereby a supplier.
A project announcement does not prove that commercial production
is already occurring.

For each organization:
- name: name as written in the article
- country: only when supported by the article; otherwise Unknown
- website: only if the exact website URL appears in the text;
  otherwise return an empty string
- supplierType: choose the closest allowed category; use Other
  or Unknown when the role does not match a category
- roleDescription: briefly explain the role supported by the article
- relatedMaterials: tracked materials genuinely connected to this
  organization in this article
- materialRelationships: list only relationships supported by
  the article, using the allowed relationship types
- confidence: confidence in extracting the organization's role,
  not proof that it is a verified supplier
- evidenceSummary: explain the article evidence supporting the role

Never invent a company, country, website, supplier relationship,
material relationship, commercial agreement, or production status.

If an organization is simply named without a clear role, say so.
If no relevant organizations are identified, return an empty array.

Supplier relationships and verification:
AI extraction does not independently verify a real commercial
supplier relationship. NAO will initially store article-based
company links as unverified.

OPERATIONAL IMPACT SCORE:
Return an integer from 0 to 100 that estimates the magnitude of
operational or business consequences, not event probability and
not material dependency.

0–19: negligible or speculative near-term consequences
20–39: limited or localized effects
40–59: meaningful cost pressure, availability concerns, or delays
60–79: serious constraints or substantial operational impacts
80–100: critical input unavailability or credible major stoppage

Do not treat a planned, pilot, academic, or uncommissioned facility
as available supply.

For the impact score, provide a concise rationale and confidence
level of Low, Medium, or High. Do not overstate certainty.

For relevant articles, severity must be Low, Medium, High,
Critical, or Unknown. Trend must be Improving, Stable,
Worsening, or Unknown.

If the article is irrelevant, return:
- isRelevant=false
- materials=[]
- material="Unknown"
- severity="Unknown"
- location="Unknown"
- trend="Unknown"
- industryImpacts=[]
- organizations=[]
- operationalImpactScore=0

ARTICLE

Title:
${safeTitle}

Description:
${safeDescription}

Content:
${safeContent}

Source:
${safeSource}

URL:
${safeUrl}

Published:
${safePublishedAt}
`,

        text: {
          format: {
            type: "json_schema",

            name: "nao_news_analysis",

            strict: true,

            schema: {
              type: "object",
              additionalProperties: false,

              properties: {
                isRelevant: {
                  type: "boolean",
                },

                materials: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: TRACKED_MATERIALS,
                  },
                },

                material: {
                  type: "string",
                },

                title: {
                  type: "string",
                },

                severity: {
                  type: "string",
                  enum: [
                    "Low",
                    "Medium",
                    "High",
                    "Critical",
                    "Unknown",
                  ],
                },

                location: {
                  type: "string",
                },

                description: {
                  type: "string",
                },

                operationalImpact: {
                  type: "string",
                },

                operationalImpactScore: {
                  type: "integer",
                  minimum: 0,
                  maximum: 100,
                },

                operationalImpactRationale: {
                  type: "string",
                },

                operationalImpactConfidence: {
                  type: "string",
                  enum:
                    OPERATIONAL_IMPACT_CONFIDENCE,
                },

                trend: {
                  type: "string",
                  enum: [
                    "Improving",
                    "Stable",
                    "Worsening",
                    "Unknown",
                  ],
                },

                industryImpacts: {
                  type: "array",

                  items: {
                    type: "object",
                    additionalProperties: false,

                    properties: {
                      industry: {
                        type: "string",
                      },

                      impact: {
                        type: "string",
                      },
                    },

                    required: [
                      "industry",
                      "impact",
                    ],
                  },
                },

                organizations: {
                  type: "array",

                  items: {
                    type: "object",
                    additionalProperties: false,

                    properties: {
                      name: {
                        type: "string",
                      },

                      country: {
                        type: "string",
                      },

                      website: {
                        type: "string",
                      },

                      supplierType: {
                        type: "string",
                        enum: SUPPLIER_TYPES,
                      },

                      roleDescription: {
                        type: "string",
                      },

                      relatedMaterials: {
                        type: "array",
                        items: {
                          type: "string",
                          enum: TRACKED_MATERIALS,
                        },
                      },

                      materialRelationships: {
                        type: "array",

                        items: {
                          type: "object",
                          additionalProperties: false,

                          properties: {
                            material: {
                              type: "string",
                              enum: TRACKED_MATERIALS,
                            },

                            relationshipType: {
                              type: "string",
                              enum:
                                MATERIAL_RELATIONSHIP_TYPES,
                            },

                            summary: {
                              type: "string",
                            },
                          },

                          required: [
                            "material",
                            "relationshipType",
                            "summary",
                          ],
                        },
                      },

                      confidence: {
                        type: "string",
                        enum: [
                          "Low",
                          "Medium",
                          "High",
                        ],
                      },

                      evidenceSummary: {
                        type: "string",
                      },
                    },

                    required: [
                      "name",
                      "country",
                      "website",
                      "supplierType",
                      "roleDescription",
                      "relatedMaterials",
                      "materialRelationships",
                      "confidence",
                      "evidenceSummary",
                    ],
                  },
                },
              },

              required: [
                "isRelevant",
                "materials",
                "material",
                "title",
                "severity",
                "location",
                "description",
                "operationalImpact",
                "operationalImpactScore",
                "operationalImpactRationale",
                "operationalImpactConfidence",
                "trend",
                "industryImpacts",
                "organizations",
              ],
            },
          },
        },
      });

    if (!response.output_text) {
      throw new Error(
        "OpenAI returned an empty analysis response."
      );
    }

    const result = JSON.parse(
      response.output_text
    );

    result.materials = Array.isArray(
      result.materials
    )
      ? [
          ...new Set(
            result.materials.filter((material) =>
              TRACKED_MATERIALS.includes(material)
            )
          ),
        ]
      : [];

    const numericImpactScore = Number(
      result.operationalImpactScore
    );

    result.operationalImpactScore =
      Number.isInteger(numericImpactScore) &&
      numericImpactScore >= 0 &&
      numericImpactScore <= 100
        ? numericImpactScore
        : 0;

    if (!result.isRelevant || result.materials.length === 0) {
      result.isRelevant = false;
      result.materials = [];
      result.material = "Unknown";
      result.severity = "Unknown";
      result.location = "Unknown";
      result.trend = "Unknown";
      result.industryImpacts = [];
      result.organizations = [];
      result.operationalImpactScore = 0;
      result.operationalImpactConfidence = "Low";
      result.operationalImpactRationale =
        "The article did not qualify as a relevant tracked-material risk.";
    } else {
      result.material =
        result.materials.join(" and ");

      result.organizations = getCleanOrganizations(
        result.organizations,
        articleText,
        result.materials
      );
    }

    if (
      !OPERATIONAL_IMPACT_CONFIDENCE.includes(
        result.operationalImpactConfidence
      )
    ) {
      result.operationalImpactConfidence = "Low";
    }

    if (
      typeof result.operationalImpactRationale !==
        "string" ||
      !result.operationalImpactRationale.trim()
    ) {
      result.operationalImpactRationale =
        "The assessment rationale was not provided.";
      result.operationalImpactConfidence = "Low";
    }

    return result;
  } catch (error) {
    console.error("OpenAI analysis error:", error);
    throw error;
  }
};

module.exports = {
  analyzeNews,
};