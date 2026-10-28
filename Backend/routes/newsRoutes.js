const express = require("express");
const router = express.Router();

const {
  getAllNews,
  getNewsById,
  createNews,
  fetchExternalNews,
  processExternalNews,
  processScheduledExternalNews,
} = require("../controllers/newsController");

router.get("/", getAllNews);
router.get("/fetch", fetchExternalNews);

// Keep the existing manual processing endpoints for compatibility.
router.get("/process", processExternalNews);
router.post("/process", processExternalNews);

// Protected endpoint called by the Render Cron Job.
// Keep this route before /:id.
router.post(
  "/process-scheduled",
  processScheduledExternalNews
);

router.get("/:id", getNewsById);
router.post("/", createNews);

module.exports = router;