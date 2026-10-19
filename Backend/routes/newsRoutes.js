const express = require("express");
const router = express.Router();

const {
  getAllNews,
  getNewsById,
  createNews,
  fetchExternalNews,
  processExternalNews,
} = require("../controllers/newsController");

router.get("/", getAllNews);
router.get("/fetch", fetchExternalNews);

// Keep the existing GET endpoint for compatibility.
router.get("/process", processExternalNews);

// Use POST for a manual news-processing action.
router.post("/process", processExternalNews);

router.get("/:id", getNewsById);
router.post("/", createNews);

module.exports = router;