const express = require("express");

const router = express.Router();

const {
    getAllNews,
    getNewsById,
    createNews,
} = require("../controllers/newsController");

router.get("/", getAllNews);

router.get("/:id", getNewsById);

router.post("/", createNews);

module.exports = router;