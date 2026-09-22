const mongoose = require("mongoose");
require("dotenv").config();

const News = require("../models/News");

const sampleNews = [
    {
        title: "China Tightens Graphite Export Controls",
        description: "China announced tighter export controls on graphite used in EV batteries.",
        content: "The new restrictions could disrupt global battery manufacturing and increase supply chain risks.",
        source: "Reuters",
        url: "https://example.com/news-1",
        imageUrl: "",
        publishedAt: new Date(),
        country: "china",
        category: "Trade",
        material: "Graphite"
    },
    {
        title: "Lithium Prices Continue to Rise",
        description: "Global demand for lithium continues to increase.",
        content: "Electric vehicle production has driven another increase in lithium prices.",
        source: "Bloomberg",
        url: "https://example.com/news-2",
        imageUrl: "",
        publishedAt: new Date(),
        country: "australia",
        category: "Mining",
        material: "Lithium"
    },
    {
        title: "Copper Supply Under Pressure",
        description: "Mining delays are affecting global copper availability.",
        content: "Several mining projects have reported delays, creating uncertainty in copper supply chains.",
        source: "Financial Times",
        url: "https://example.com/news-3",
        imageUrl: "",
        publishedAt: new Date(),
        country: "chile",
        category: "Mining",
        material: "Copper"
    }
];

const seedNews = async () => {

    try {

        await mongoose.connect(process.env.MONGO_URI);

        await News.deleteMany();

        await News.insertMany(sampleNews);

        console.log("News seeded successfully.");

        process.exit();

    } catch (error) {

        console.error(error);

        process.exit(1);

    }

};

seedNews();