const crypto = require("crypto");
const ProcessedArticle = require("../models/ProcessedArticle");
const Risk = require("../models/Risk");

const STALE_PROCESSING_MS = 30 * 60 * 1000;

const canonicalizeUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  try {
    const url = new URL(rawUrl.trim());
    url.hash = "";

    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();

      if (
        normalizedKey.startsWith("utm_") ||
        ["fbclid", "gclid", "mc_cid", "mc_eid", "ref"].includes(
          normalizedKey
        )
      ) {
        url.searchParams.delete(key);
      }
    }

    url.searchParams.sort();
    url.hostname = url.hostname.toLowerCase();

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return rawUrl.trim();
  }
};

const getArticleTrackingData = (article = {}) => {
  const title =
    String(article.title || "").trim() || "Untitled article";

  const source =
    typeof article.source === "string"
      ? article.source.trim() || "Unknown"
      : String(article.source?.name || "Unknown").trim();

  const parsedPublishedAt = article.publishedAt
    ? new Date(article.publishedAt)
    : null;

  const publishedAt =
    parsedPublishedAt &&
    !Number.isNaN(parsedPublishedAt.getTime())
      ? parsedPublishedAt
      : new Date();

  const normalizedContent = [
    title,
    article.description || "",
    article.content || "",
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const contentHash = crypto
    .createHash("sha256")
    .update(normalizedContent || title)
    .digest("hex");

  const canonicalUrl =
    canonicalizeUrl(article.url || article.sourceUrl) ||
    `content:${contentHash}`;

  return {
    canonicalUrl,
    contentHash,
    title,
    source,
    publishedAt,
  };
};

// If NAO already saved a risk for an article before article tracking
// was introduced, create a tracking record to avoid analysing it again.
const backfillFromExistingRisks = async (article, trackingData) => {
  const sourceUrls = [
    article?.url,
    article?.sourceUrl,
    canonicalizeUrl(article?.url || article?.sourceUrl),
  ].filter(
    (value, index, values) =>
      value && values.indexOf(value) === index
  );

  if (sourceUrls.length === 0) return false;

  const existingRisks = await Risk.find({
    sourceUrl: { $in: sourceUrls },
  })
    .select("_id")
    .lean();

  if (existingRisks.length === 0) return false;

  try {
    await ProcessedArticle.create({
      ...trackingData,
      status: "Processed",
      attempts: 0,
      lastError:
        "Existing NAO risk record found; skipped repeat AI analysis.",
      processedAt: new Date(),
      riskIds: existingRisks.map((risk) => risk._id),
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  return true;
};

// Pre-filter only. claimArticle() performs the final claim before AI analysis.
const isArticleEligible = async (article) => {
  const trackingData = getArticleTrackingData(article);

  const existing = await ProcessedArticle.findOne({
    canonicalUrl: trackingData.canonicalUrl,
  });

  if (
    existing &&
    ["Processed", "Skipped"].includes(existing.status)
  ) {
    return false;
  }

  if (
    existing?.status === "Processing" &&
    existing.updatedAt &&
    Date.now() - existing.updatedAt.getTime() < STALE_PROCESSING_MS
  ) {
    return false;
  }

  if (
    !existing &&
    (await backfillFromExistingRisks(article, trackingData))
  ) {
    return false;
  }

  return true;
};

const claimArticle = async (article) => {
  const trackingData = getArticleTrackingData(article);
  const { canonicalUrl, contentHash } = trackingData;
  const now = new Date();

  const existing = await ProcessedArticle.findOne({
    canonicalUrl,
  });

  if (
    existing &&
    ["Processed", "Skipped"].includes(existing.status)
  ) {
    return {
      claimed: false,
      reason: "Already completed",
      trackingData,
    };
  }

  if (
    existing?.status === "Processing" &&
    existing.updatedAt &&
    now.getTime() - existing.updatedAt.getTime() <
      STALE_PROCESSING_MS
  ) {
    return {
      claimed: false,
      reason: "Already processing",
      trackingData,
    };
  }

  if (
    !existing &&
    (await backfillFromExistingRisks(article, trackingData))
  ) {
    return {
      claimed: false,
      reason:
        "An existing risk record was migrated to article history",
      trackingData,
    };
  }

  // If identical content was already completed under another URL,
  // mark this URL as skipped too.
  const duplicateContent = await ProcessedArticle.findOne({
    canonicalUrl: { $ne: canonicalUrl },
    contentHash,
    status: { $in: ["Processed", "Skipped"] },
  });

  if (duplicateContent) {
    const update = {
      ...trackingData,
      status: "Skipped",
      lastError:
        "Identical content was already processed under another URL.",
      processedAt: now,
      riskIds: [],
    };

    if (existing) {
      await ProcessedArticle.updateOne(
        { _id: existing._id },
        { $set: update }
      );
    } else {
      try {
        await ProcessedArticle.create({
          ...update,
          attempts: 0,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }

    return {
      claimed: false,
      reason: "Duplicate content",
      trackingData,
    };
  }

  if (existing) {
    const record = await ProcessedArticle.findOneAndUpdate(
      {
        _id: existing._id,
        $or: [
          { status: "Failed" },
          {
            status: "Processing",
            updatedAt: {
              $lt: new Date(
                now.getTime() - STALE_PROCESSING_MS
              ),
            },
          },
        ],
      },
      {
        $set: {
          ...trackingData,
          status: "Processing",
          lastError: "",
          processedAt: null,
          riskIds: [],
        },
        $inc: { attempts: 1 },
      },
      { new: true }
    );

    return record
      ? { claimed: true, record, trackingData }
      : {
          claimed: false,
          reason: "Could not acquire processing claim",
          trackingData,
        };
  }

  try {
    const record = await ProcessedArticle.create({
      ...trackingData,
      status: "Processing",
      attempts: 1,
      lastError: "",
      processedAt: null,
    });

    return { claimed: true, record, trackingData };
  } catch (error) {
    // The unique canonicalUrl index stops two requests from inserting
    // a tracking record for the same article at the same time.
    if (error.code === 11000) {
      return {
        claimed: false,
        reason: "Article claimed by another request",
        trackingData,
      };
    }

    throw error;
  }
};

const finishArticle = async ({
  canonicalUrl,
  status,
  lastError = "",
  riskIds = [],
}) => {
  if (!["Processed", "Skipped", "Failed"].includes(status)) {
    throw new Error(
      `Unsupported processed-article status: ${status}`
    );
  }

  const completed = ["Processed", "Skipped"].includes(status);

  const result = await ProcessedArticle.updateOne(
    { canonicalUrl },
    {
      $set: {
        status,
        lastError: String(lastError || "").slice(0, 2000),
        processedAt: completed ? new Date() : null,
        riskIds: [...new Set(riskIds.map(String))],
      },
    }
  );

  if (result.matchedCount === 0) {
    throw new Error(
      `Processed-article record not found for ${canonicalUrl}`
    );
  }
};

module.exports = {
  getArticleTrackingData,
  isArticleEligible,
  claimArticle,
  finishArticle,
};