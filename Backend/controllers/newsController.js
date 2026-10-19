
const News = require("../models/News");
const { analyzeNews } = require("../services/aiService");
const { saveRisksFromAnalysis } = require("../services/riskService");

// ======================================================
// BASIC NEWS CRUD
// ======================================================

const getAllNews = async (req, res) => {
  try {
    const news = await News.find({}).sort({ publishedAt: -1 });
    res.status(200).json(news);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error while fetching news." });
  }
};

const getNewsById = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);

    if (!news) {
      return res.status(404).json({ message: "News article not found." });
    }

    res.status(200).json(news);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error while fetching news." });
  }
};

const createNews = async (req, res) => {
  try {
    const news = await News.create(req.body);
    res.status(201).json(news);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error while creating news." });
  }
};

// ======================================================
// HELPERS
// ======================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const wordMatch = (text, term) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
};

const countMatches = (text, terms) =>
  terms.reduce(
    (count, term) => count + (wordMatch(text, term) ? 1 : 0),
    0
  );

// ======================================================
// NEWSAPI REQUEST
// ======================================================

const fetchNewsApiWithRetry = async (url, attempts = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Api-Key": process.env.NEWS_API_KEY,
          Accept: "application/json",
          "User-Agent": "NAO-Risk-Intelligence/1.0",
        },
      });

      const rawBody = await response.text();
      let data;

      try {
        data = JSON.parse(rawBody);
      } catch {
        data = { message: rawBody || "Invalid JSON response" };
      }

      if (response.ok) {
        return data;
      }

      lastError = new Error(
        `NewsAPI HTTP ${response.status}: ${
          data?.message || "Request failed"
        }`
      );

      const retryable =
        response.status === 429 || response.status >= 500;

      if (!retryable || attempt === attempts) {
        throw lastError;
      }
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        const cause = error?.cause;

        throw new Error(
          [
            `NewsAPI failed after ${attempts} attempts.`,
            `message=${error.message}`,
            `code=${cause?.code || error.code || "unknown"}`,
            `cause=${cause?.message || "none"}`,
          ].join(" ")
        );
      }
    }

    await sleep(2000);
  }

  throw lastError;
};

// ======================================================
// MATERIALS
// ======================================================

const materials = ["nickel", "titanium", "iridium", "ruthenium"];


const materialSearches = {
  nickel: [
    `"nickel" AND (mining OR production OR refinery OR refining OR smelter OR "nickel ore" OR export OR import OR supply) NOT nickelback NOT nickelodeon NOT "Nickel Comics" NOT football NOT soccer NOT basketball NOT movie NOT film NOT album`,
    `"nickel" AND (shortage OR demand OR prices OR Indonesia OR Philippines OR sanctions OR tariff OR disruption OR capacity OR reserves) NOT nickelback NOT nickelodeon NOT "Nickel Comics" NOT football NOT soccer NOT basketball NOT movie NOT film NOT album`,
  ],

  titanium: [
    `"titanium" AND ("titanium sponge" OR mining OR production OR aerospace OR aircraft OR alloy OR ilmenite OR rutile OR export OR import OR supply) NOT "pocket knife" NOT "pocket knives" NOT "watch band" NOT "watch bands" NOT jewelry NOT jewellery NOT iphone NOT smartphone NOT "smart watch" NOT "smartwatch" NOT gaming`,
    `"titanium" AND (shortage OR demand OR prices OR sanctions OR tariff OR disruption OR capacity OR ore OR production) NOT "pocket knife" NOT "pocket knives" NOT "watch band" NOT "watch bands" NOT jewelry NOT jewellery NOT iphone NOT smartphone NOT "smart watch" NOT "smartwatch" NOT gaming`,
  ],

  iridium: [
    `"iridium" AND (mining OR refining OR "platinum group metals" OR PGM OR catalyst OR electrolyzer OR electrolysis OR hydrogen OR supply) NOT "Iridium Communications" NOT "Iridium client" NOT "Iridium CLI" NOT "Iridium Core" NOT "satellite communications" NOT "satellite phone" NOT "satellite phones" NOT "Rocket Lab" NOT "Mynaric"`,
    `"iridium" AND (shortage OR demand OR prices OR refining OR "South Africa" OR Zimbabwe OR catalyst OR substitution OR supply) NOT "Iridium Communications" NOT "Iridium client" NOT "Iridium CLI" NOT "Iridium Core" NOT "satellite communications" NOT "satellite phone" NOT "satellite phones" NOT "Rocket Lab" NOT "Mynaric"`,
  ],

  ruthenium: [
    `"ruthenium" AND (mining OR refining OR "platinum group metals" OR PGM OR catalyst OR electrolyzer OR electrolysis OR hydrogen OR supply) NOT watchmaker NOT watchmakers NOT jewelry NOT jewellery NOT necklace NOT ring NOT rings NOT fashion`,
    `"ruthenium" AND (shortage OR demand OR prices OR refining OR "South Africa" OR Zimbabwe OR catalyst OR substitution OR supply) NOT watchmaker NOT watchmakers NOT jewelry NOT jewellery NOT necklace NOT ring NOT rings NOT fashion`,
  ],
};

const materialSignals = {
  nickel: [
    "mining", "mine", "production", "refinery", "refining",
    "smelter", "processing", "ore", "export", "import", "supply",
    "shortage", "demand", "prices", "capacity", "reserves", "battery",
    "stainless steel", "class 1 nickel", "indonesia", "philippines",
    "sanctions", "tariff", "disruption",
  ],

  titanium: [
    "mining", "mine", "production", "titanium sponge", "refinery",
    "refining", "processing", "ore", "ilmenite", "rutile", "export",
    "import", "supply", "shortage", "demand", "prices", "capacity",
    "aerospace", "aircraft", "titanium alloy", "sanctions", "tariff",
    "disruption",
  ],

  iridium: [
    "mining", "mine", "production", "refining", "processing", "supply",
    "shortage", "demand", "prices", "capacity", "reserves",
    "platinum group metals", "pgm", "catalyst", "electrolyzer",
    "electrolysis", "hydrogen", "water oxidation", "substitution",
    "south africa", "zimbabwe", "sanctions", "tariff", "disruption",
  ],

  ruthenium: [
    "mining", "mine", "production", "refining", "processing", "supply",
    "shortage", "demand", "prices", "capacity", "reserves",
    "platinum group metals", "pgm", "catalyst", "electrolyzer",
    "electrolysis", "hydrogen", "water oxidation", "substitution",
    "south africa", "zimbabwe", "sanctions", "tariff", "disruption",
  ],
};

const materialExclusions = {
  nickel: ["nickel comics", "nickelback", "nickelodeon"],

  titanium: [
    "pocket knife", "pocket knives", "watch band", "watch bands",
    "jewelry", "jewellery", "iphone", "smartphone", "smartphones",
    "smartwatch", "smart watch", "edc card", "pocket tool",
  ],

  iridium: [
    "iridium communications", "iridium client", "iridium cli",
    "iridium-core", "iridium core", "satellite communications",
    "satellite phone", "satellite phones", "rocket lab", "mynaric",
  ],

  ruthenium: [
    "watchmaker", "watchmakers", "jewelry", "jewellery",
    "necklace", "ring", "rings", "fashion",
  ],
};

const penaltyTerms = [
  "car", "cars", "automotive", "motorcycle", "motorcycles",
  "vehicle", "vehicles", "phone", "phones", "stock", "stocks",
  "investor", "investors", "share price",
];


const scoreArticle = (article, material) => {
  const title = normalize(article.title);
  const description = normalize(article.description);
  const content = normalize(article.content);
  const fullText = `${title} ${description} ${content}`;

  const excludedTerm = materialExclusions[material].find((term) =>
    fullText.includes(term)
  );

  if (excludedTerm) {
    return null;
  }

  const materialInTitle = wordMatch(title, material);
  const materialMentions = countMatches(fullText, [material]);

  if (materialMentions === 0) {
    return null;
  }

  const matchedSignals = materialSignals[material].filter((term) =>
    wordMatch(fullText, term)
  );

  const titleSignals = materialSignals[material].filter((term) =>
    wordMatch(title, term)
  );

  if (matchedSignals.length === 0) {
    return null;
  }

  const penaltyMatches = countMatches(fullText, penaltyTerms);

  let score = materialInTitle ? 5 : 3;
  score += Math.min(matchedSignals.length, 6);
  score += Math.min(titleSignals.length * 2, 4);
  score -= penaltyMatches;

  if (score < 5) {
    return null;
  }

  return {
    score,
    signals: {
      materialInTitle,
      materialMentions,
      supplyMatches: matchedSignals.length,
      titleSupplyMatches: titleSignals.length,
      penaltyMatches,
    },
  };
};

// ======================================================
// RAW EXTERNAL NEWS
// ======================================================

const fetchExternalNews = async (req, res) => {
  try {
    const query =
      "(nickel OR titanium OR iridium OR ruthenium) AND " +
      "(mining OR production OR refining OR supply OR shortage OR demand) " +
      "NOT nickelback NOT nickelodeon " +
      'NOT "Iridium Communications" ' +
      'NOT "satellite communications" ' +
      'NOT "Rocket Lab" ' +
      'NOT "pocket knife" ' +
      'NOT "watch band" ' +
      "NOT jewelry " +
      "NOT jewellery " +
      "NOT smartphone";

    const url =
      `https://newsapi.org/v2/everything?` +
      `q=${encodeURIComponent(query)}` +
      `&language=en&sortBy=relevancy&pageSize=50`;

    const data = await fetchNewsApiWithRetry(url);
    res.status(200).json(data);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server error while fetching external news.",
      error: error.message,
    });
  }
};

// ======================================================
// PROCESS EXTERNAL NEWS
// ======================================================

const processExternalNews = async (req, res) => {
  try {
    // Increased from 4 to 10 articles per material.
    const maxPerMaterial = 10;

    // Increased from 16 to 40 unique articles sent to AI.
    const maxAiCandidates = 40;

    const fetchErrors = [];
    const aiErrors = [];
    const materialBuckets = {};

    for (const material of materials) {
      materialBuckets[material] = new Map();
    }

    let totalDiscoveredCandidates = 0;

    // 1. DISCOVERY
    for (const material of materials) {
      for (const query of materialSearches[material]) {
        try {
          const url =
            `https://newsapi.org/v2/everything?` +
            `q=${encodeURIComponent(query)}` +
            `&language=en&sortBy=relevancy&pageSize=40`;

          const data = await fetchNewsApiWithRetry(url);

          for (const article of data.articles || []) {
            const scored = scoreArticle(article, material);

            if (!scored) {
              continue;
            }

            totalDiscoveredCandidates++;

            const key = article.url || article.title;

            const candidate = {
              article,
              localScore: scored.score,
              localSignals: scored.signals,
              material,
            };

            const existing = materialBuckets[material].get(key);

            if (!existing || candidate.localScore > existing.localScore) {
              materialBuckets[material].set(key, candidate);
            }
          }
        } catch (error) {
          fetchErrors.push({
            material,
            query,
            error: error.message,
          });
        }
      }
    }

    // 2. TOP CANDIDATES PER MATERIAL
    const topByMaterial = {};

    for (const material of materials) {
      topByMaterial[material] = [
        ...materialBuckets[material].values(),
      ]
        .sort((a, b) => b.localScore - a.localScore)
        .slice(0, maxPerMaterial);
    }

    // 3. CROSS-MATERIAL MERGE
    const uniqueArticles = new Map();

    for (const material of materials) {
      for (const candidate of topByMaterial[material]) {
        const key = candidate.article.url || candidate.article.title;
        const existing = uniqueArticles.get(key);

        if (!existing) {
          uniqueArticles.set(key, {
            article: candidate.article,
            localScore: candidate.localScore,
            possibleMaterials: [material],
            localSignalsByMaterial: {
              [material]: candidate.localSignals,
            },
          });

          continue;
        }

        if (!existing.possibleMaterials.includes(material)) {
          existing.possibleMaterials.push(material);
        }

        existing.localSignalsByMaterial[material] =
          candidate.localSignals;

        if (candidate.localScore > existing.localScore) {
          existing.localScore = candidate.localScore;
        }
      }
    }

    // 4. AI QUEUE
    const aiCandidates = [...uniqueArticles.values()]
      .sort((a, b) => b.localScore - a.localScore)
      .slice(0, maxAiCandidates);

      
    // 5. AI ANALYSIS + RISK PERSISTENCE
    const results = [];

    let aiRelevant = 0;
    let aiRejected = 0;
    let risksSaved = 0;
    let risksAlreadyExist = 0;
    let risksSkipped = 0;
    let riskPersistenceErrors = 0;

    for (const candidate of aiCandidates) {
      try {
        const aiAnalysis = await analyzeNews({
          title: candidate.article.title,
          description: candidate.article.description,
          content: candidate.article.content,
          source: candidate.article.source?.name,
          url: candidate.article.url,
          publishedAt: candidate.article.publishedAt,
          possibleMaterials: candidate.possibleMaterials,
        });

        // AI DECISION
        if (aiAnalysis?.isRelevant === true) {
          aiRelevant++;
        } else {
          aiRejected++;
        }

        // RISK PERSISTENCE
        let riskPersistence = null;
        let riskPersistenceError = null;

        // Only relevant AI results are sent to MongoDB.
        if (aiAnalysis?.isRelevant === true) {
          try {
            const persistence = await saveRisksFromAnalysis({
              aiAnalysis,
              article: candidate.article,
            });

            risksSaved += persistence.saved.length;
            risksAlreadyExist += persistence.existing.length;
            risksSkipped += persistence.skipped.length;

            riskPersistence = {
              savedCount: persistence.saved.length,
              savedRiskIds: persistence.saved.map((risk) => risk._id),
              existingCount: persistence.existing.length,
              existingRiskIds: persistence.existing.map((risk) => risk._id),
              skipped: persistence.skipped,
            };
          } catch (error) {
            riskPersistenceErrors++;
            riskPersistenceError = error.message;

            console.log(
              `Risk persistence failed for "${candidate.article.title}":`,
              error.message
            );
          }
        }

        // STORE RESULT
        results.push({
          possibleMaterials: candidate.possibleMaterials,
          localScore: candidate.localScore,
          localSignalsByMaterial: candidate.localSignalsByMaterial,
          article: candidate.article,
          aiAnalysis,
          riskPersistence,
          riskPersistenceError,
        });
      } catch (error) {
        const aiError = {
          title: candidate.article.title,
          url: candidate.article.url,
          error: error.message,
          code: error?.code || null,
          status: error?.status || null,
          cause: error?.cause?.message || null,
        };

        aiErrors.push(aiError);
        console.log("AI analysis failed:", aiError);
      }
    }

    // 6. RESPONSE
    res.status(200).json({
      message: "News filtering, AI analysis, and risk persistence completed.",
      totalDiscoveredCandidates,
      candidatesBeforeAI: uniqueArticles.size,
      candidatesSentToAI: aiCandidates.length,
      aiAttempts: aiCandidates.length - aiErrors.length,
      aiRelevant,
      aiRejected,
      risksSaved,
      risksAlreadyExist,
      risksSkipped,
      riskPersistenceErrors,
      candidatesByMaterial: Object.fromEntries(
        materials.map((material) => [
          material,
          topByMaterial[material].length,
        ])
      ),
      fetchErrors,
      aiErrors,
      results,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server error while processing external news.",
      error: error.message,
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getAllNews,
  getNewsById,
  createNews,
  fetchExternalNews,
  processExternalNews,
};
