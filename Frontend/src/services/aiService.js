const analyzeNews = async (newsArticle) => {

    return {
        material: "Lithium",
        country: "China",
        riskType: "Export Restriction",
        severity: "High",
        trend: "Increasing",
        operationalImpact: "Battery manufacturing delays",
        affectedIndustries: [
            "Electric Vehicles",
            "Battery Manufacturing"
        ],
        recommendations: [
            "Diversify suppliers",
            "Increase inventory",
            "Monitor Chinese trade policy"
        ]
    };

};

module.exports = {
    analyzeNews,
};