const News = require("../models/News");
const { analyzeNews } = require("../services/aiService")


const getAllNews = async (req, res) => {

    try {

        const news = await News.find();

        res.status(200).json(news);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Failed to fetch news."
        });

    }

};


const getNewsById = async (req, res) => {

    try {

        const news = await News.findById(req.params.id);

        if (!news) {

            return res.status(404).json({
                message: "News article not found."
            });

        }

        res.status(200).json(news);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Failed to fetch news article."
        });

    }

};


const createNews = async (req, res) => {

    try {

        const news = await News.create(req.body);

        res.status(201).json(news);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Failed to create news article."
        });

    }

};

module.exports = {
    getAllNews,
    getNewsById,
    createNews,
};