const crypto = require("crypto");
const News = require("../models/News");
const NewsProcessingState = require("../models/NewsProcessingState");

const { analyzeNews } = require("../services/aiService");
const { saveRisksFromAnalysis } = require("../services/riskService");

const {
  isArticleEligible,
  claimArticle,
  finishArticle,
  getArticleTrackingData,
} = require("../services/processedArticleService");

// ======================================================
// BASIC NEWS CRUD
// ======================================================

const getAllNews = async (req, res) => {
  try {
    const news = await News.find({}).sort({ publishedAt: -1 });
    return res.status(200).json(news);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error while fetching news.",
    });
  }
};

const getNewsById = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);

    if (!news) {
      return res.status(404).json({
        message: "News article not found.",
      });
    }

    return res.status(200).json(news);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error while fetching news.",
    });
  }
};

const createNews = async (req, res) => {
  try {
    const news = await News.create(req.body);
    return res.status(201).json(news);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error while creating news.",
    });
  }
};

// ======================================================
// HELPERS
// ======================================================

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
        data = {
          message: rawBody || "Invalid JSON response",
        };
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
// MATERIALS AND SEARCH QUERIES
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

  if (excludedTerm) return null;

  const materialInTitle = wordMatch(title, material);
  const materialMentions = countMatches(fullText, [material]);

  if (materialMentions === 0) return null;

  const matchedSignals = materialSignals[material].filter((term) =>
    wordMatch(fullText, term)
  );

  const titleSignals = materialSignals[material].filter((term) =>
    wordMatch(title, term)
  );

  if (matchedSignals.length === 0) return null;

  const penaltyMatches = countMatches(fullText, penaltyTerms);

  let score = materialInTitle ? 5 : 3;
  score += Math.min(matchedSignals.length, 6);
  score += Math.min(titleSignals.length * 2, 4);
  score -= penaltyMatches;

  if (score < 5) return null;

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
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Server error while fetching external news.",
      error: error.message,
    });
  }
};

// ======================================================
// SCHEDULED PROCESSING STATE
// ======================================================

const NEWS_PROCESSING_STATE_ID = "external-news-processing";
const NEWS_PROCESSING_INTERVAL_MS = 30 * 60 * 60 * 1000;
const NEWS_PROCESSING_LOCK_MS = 2 * 60 * 60 * 1000;

const claimScheduledRun = async () => {
  const now = new Date();

  const existingState = await NewsProcessingState.findById(
    NEWS_PROCESSING_STATE_ID
  );

  if (existingState?.lastScheduledRunAt) {
    const nextDueAt = new Date(
      existingState.lastScheduledRunAt.getTime() +
        NEWS_PROCESSING_INTERVAL_MS
    );

    if (now < nextDueAt) {
      return {
        shouldRun: false,
        reason: "The 30-hour processing interval has not elapsed.",
        nextDueAt,
        lastScheduledRunAt: existingState.lastScheduledRunAt,
      };
    }
  }

  const token = crypto.randomUUID();

  try {
    const state = await NewsProcessingState.findOneAndUpdate(
      {
        _id: NEWS_PROCESSING_STATE_ID,
        $or: [
          { lockUntil: null },
          { lockUntil: { $exists: false } },
          { lockUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          lockToken: token,
          lockUntil: new Date(
            now.getTime() + NEWS_PROCESSING_LOCK_MS
          ),
          lastStartedAt: now,
          status: "Running",
          lastError: "",
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    if (!state || state.lockToken !== token) {
      return {
        shouldRun: false,
        reason: "Another scheduled processing run is active.",
      };
    }

    return { shouldRun: true, token, startedAt: now };
  } catch (error) {
    if (error.code === 11000) {
      return {
        shouldRun: false,
        reason: "Another scheduled processing run is active.",
      };
    }

    throw error;
  }
};

const finishScheduledRun = async (
  token,
  { status, error = "" }
) => {
  if (!token) return;

  const now = new Date();

  const update = {
    lastFinishedAt: now,
    status,
    lastError: String(error || "").slice(0, 2000),
    lockToken: null,
    lockUntil: null,
  };

  // Only a fully successful run advances the 30-hour clock.
  // A partial or failed run can be retried on the next hourly check.
  if (status === "Succeeded") {
    update.lastScheduledRunAt = now;
  }

  await NewsProcessingState.updateOne(
    {
      _id: NEWS_PROCESSING_STATE_ID,
      lockToken: token,
    },
    { $set: update }
  );
};

// ======================================================
// PROCESS EXTERNAL NEWS
// ======================================================

const processExternalNews = async (req, res) => {
  const scheduledRunToken = req.scheduledRunToken || null;

  try {
    const maxPerMaterial = 10;
    const maxAiCandidates = 40;

    const fetchErrors = [];
    const aiErrors = [];
    const materialBuckets = {};

    for (const material of materials) {
      materialBuckets[material] = new Map();
    }

    let totalDiscoveredCandidates = 0;

    // 1. DISCOVER ARTICLES
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

            if (!scored) continue;

            totalDiscoveredCandidates++;

            const key = article.url || article.title;

            const candidate = {
              article,
              localScore: scored.score,
              localSignals: scored.signals,
              material,
            };

            const existing = materialBuckets[material].get(key);

            if (
              !existing ||
              candidate.localScore > existing.localScore
            ) {
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

    // 2. SELECT THE TOP CANDIDATES PER MATERIAL
    const topByMaterial = {};

    for (const material of materials) {
      topByMaterial[material] = [
        ...materialBuckets[material].values(),
      ]
        .sort((a, b) => b.localScore - a.localScore)
        .slice(0, maxPerMaterial);
    }

    // 3. MERGE DUPLICATES ACROSS MATERIAL SEARCHES
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

    // 4. FILTER OUT PREVIOUSLY COMPLETED ARTICLES BEFORE THE AI LIMIT.
    // This allows newer eligible articles to fill the queue.
    const rankedCandidates = [...uniqueArticles.values()].sort(
      (a, b) => b.localScore - a.localScore
    );

    const aiCandidates = [];
    let alreadyTrackedSkipped = 0;

    for (const candidate of rankedCandidates) {
      if (await isArticleEligible(candidate.article)) {
        aiCandidates.push(candidate);
      } else {
        alreadyTrackedSkipped++;
      }

      if (aiCandidates.length >= maxAiCandidates) break;
    }

    // 5. AI ANALYSIS, HISTORY TRACKING, AND RISK SAVING
    const results = [];

    let aiRelevant = 0;
    let aiRejected = 0;
    let risksSaved = 0;
    let risksAlreadyExist = 0;
    let risksSkipped = 0;
    let riskPersistenceErrors = 0;
    let aiAttempts = 0;
    let claimRaceSkipped = 0;

    for (const candidate of aiCandidates) {
      let trackingData = getArticleTrackingData(
        candidate.article
      );

      try {
        // Claim the article before using AI. This is the final
        // database-backed check if two requests overlap.
        const claim = await claimArticle(candidate.article);

        trackingData = claim.trackingData || trackingData;

        if (!claim.claimed) {
          claimRaceSkipped++;
          continue;
        }

        aiAttempts++;

        const aiAnalysis = await analyzeNews({
          title: candidate.article.title,
          description: candidate.article.description,
          content: candidate.article.content,
          source: candidate.article.source?.name,
          url: candidate.article.url,
          publishedAt: candidate.article.publishedAt,
          possibleMaterials: candidate.possibleMaterials,
        });

        // 5A. Articles the AI considers irrelevant are remembered too.
        if (aiAnalysis?.isRelevant !== true) {
          aiRejected++;

          await finishArticle({
            canonicalUrl: trackingData.canonicalUrl,
            status: "Skipped",
            lastError:
              "AI classified this article as not relevant to NAO risk intelligence.",
          });

          results.push({
            possibleMaterials: candidate.possibleMaterials,
            localScore: candidate.localScore,
            localSignalsByMaterial:
              candidate.localSignalsByMaterial,
            article: candidate.article,
            aiAnalysis,
            processingStatus: "Skipped",
            riskPersistence: null,
            riskPersistenceError: null,
          });

          continue;
        }

        // 5B. Relevant articles proceed to the existing risk service.
        aiRelevant++;

        let riskPersistence = null;
        let riskPersistenceError = null;
        let persistenceSucceeded = true;
        let riskIds = [];

        try {
          const persistence = await saveRisksFromAnalysis({
            aiAnalysis,
            article: candidate.article,
          });

          risksSaved += persistence.saved.length;
          risksAlreadyExist += persistence.existing.length;
          risksSkipped += persistence.skipped.length;

          const savedRiskIds = persistence.saved.map(
            (risk) => risk._id
          );

          const existingRiskIds = persistence.existing.map(
            (risk) => risk._id
          );

          riskIds = [
            ...new Set(
              [...savedRiskIds, ...existingRiskIds].map(String)
            ),
          ];

          riskPersistence = {
            savedCount: persistence.saved.length,
            savedRiskIds,
            existingCount: persistence.existing.length,
            existingRiskIds,
            skipped: persistence.skipped,
          };
        } catch (error) {
          persistenceSucceeded = false;
          riskPersistenceErrors++;
          riskPersistenceError = error.message;

          console.error(
            `Risk persistence failed for "${candidate.article.title}":`,
            error.message
          );
        }

        // Do not mark the article completed if saving risks failed.
        const processingStatus = persistenceSucceeded
          ? "Processed"
          : "Failed";

        await finishArticle({
          canonicalUrl: trackingData.canonicalUrl,
          status: processingStatus,
          lastError: riskPersistenceError || "",
          riskIds,
        });

        results.push({
          possibleMaterials: candidate.possibleMaterials,
          localScore: candidate.localScore,
          localSignalsByMaterial:
            candidate.localSignalsByMaterial,
          article: candidate.article,
          aiAnalysis,
          processingStatus,
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

        // Keep failed articles retryable on a later run.
        try {
          await finishArticle({
            canonicalUrl: trackingData.canonicalUrl,
            status: "Failed",
            lastError: error.message,
          });
        } catch (trackingError) {
          console.error(
            "Could not update processed-article failure status:",
            trackingError.message
          );
        }

        aiErrors.push(aiError);
        console.error("AI/news processing failed:", aiError);
      }
    }

    // 6. UPDATE SCHEDULE STATUS
    const runHadErrors =
      fetchErrors.length > 0 ||
      aiErrors.length > 0 ||
      riskPersistenceErrors > 0;

    const scheduleStatus = runHadErrors
      ? "Partial"
      : "Succeeded";

    if (scheduledRunToken) {
      const details = runHadErrors
        ? JSON.stringify({
            fetchErrors: fetchErrors.length,
            aiErrors: aiErrors.length,
            riskPersistenceErrors,
          })
        : "";

      await finishScheduledRun(scheduledRunToken, {
        status: scheduleStatus,
        error: details,
      });
    }

    // 7. RESPONSE
    return res.status(200).json({
      message:
        "News discovery, deduplication, AI analysis, and risk persistence completed.",

      totalDiscoveredCandidates,
      candidatesBeforeAI: uniqueArticles.size,
      eligibleCandidatesSelected: aiCandidates.length,
      candidatesSentToAI: aiAttempts,
      aiAttempts,
      alreadyTrackedSkipped,
      claimRaceSkipped,

      aiRelevant,
      aiRejected,

      risksSaved,
      risksAlreadyExist,
      risksSkipped,
      riskPersistenceErrors,

      schedule: scheduledRunToken
        ? {
            status: scheduleStatus,
            intervalHours: 30,
          }
        : null,

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
    console.error("External news processing failed:", error);

    if (scheduledRunToken) {
      try {
        await finishScheduledRun(scheduledRunToken, {
          status: "Failed",
          error: error.message,
        });
      } catch (stateError) {
        console.error(
          "Could not update scheduled-run state:",
          stateError.message
        );
      }
    }

    return res.status(500).json({
      message: "Server error while processing external news.",
      error: error.message,
    });
  }
};

// ======================================================
// PROTECTED SCHEDULED ENDPOINT
// ======================================================

const processScheduledExternalNews = async (req, res) => {
  const expectedSecret = process.env.NEWS_CRON_SECRET;
  const providedSecret = req.get("x-cron-secret") || "";

  if (!expectedSecret) {
    return res.status(503).json({
      message:
        "Scheduled news processing is not configured on this server.",
    });
  }

  const receivedBuffer = Buffer.from(providedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  const authorized =
    receivedBuffer.length === expectedBuffer.length &&
    receivedBuffer.length > 0 &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

  if (!authorized) {
    return res.status(401).json({
      message: "Unauthorized scheduled request.",
    });
  }

  try {
    const claim = await claimScheduledRun();

    if (!claim.shouldRun) {
      return res.status(200).json({
        message: "Scheduled news processing was skipped.",
        skipped: true,
        reason: claim.reason,
        nextDueAt: claim.nextDueAt || null,
        lastScheduledRunAt:
          claim.lastScheduledRunAt || null,
      });
    }

    req.scheduledRunToken = claim.token;
    return processExternalNews(req, res);
  } catch (error) {
    console.error(
      "Unable to start scheduled news processing:",
      error
    );

    return res.status(500).json({
      message: "Could not start scheduled news processing.",
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
  processScheduledExternalNews,
};