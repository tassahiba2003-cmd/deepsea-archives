// src/controllers/taxonomyController.js
const axios = require("axios");

const OBSERVATION_SERVICE_URL = "http://localhost:5000";

function classifySpecies(name) {
    if (name.includes("Calamar") || name.includes("Poulpe") || name.includes("Kraken")) return "Céphalopodes";
    if (name.includes("Requin") || name.includes("Mégalodon")) return "Chondrichtyens";
    if (name.includes("Baleine") || name.includes("Dauphin")) return "Cétacés";
    return "Invertébrés Abyssaux Non-Identifiés";
}

exports.getStats = async (req, res) => {
    try {
        const responseSpecies = await axios.get(`${OBSERVATION_SERVICE_URL}/species`);
        const allSpecies = responseSpecies.data;

        let stats = {
            totalSpecies: allSpecies.length,
            totalObservations: 0,
            speciesDetails: [],
            classification: {}
        };

        for (const species of allSpecies) {
            try {
                const responseObs = await axios.get(`${OBSERVATION_SERVICE_URL}/species/${species.id}/observations`, {
  
                });
                const observations = responseObs.data;
                
                const nbObs = observations.length;
                stats.totalObservations += nbObs;

                // On range dans la classification
                const family = classifySpecies(species.name);
                if (!stats.classification[family]) {
                    stats.classification[family] = [];
                }
                stats.classification[family].push(species.name);

                stats.speciesDetails.push({
                    name: species.name,
                    observationCount: nbObs,
                    rarityScore: species.rarityScore || "N/A"
                });

            } catch (err) {
                console.error(`Erreur pour l'espèce ${species.name}`);
            }
        }

        // 3. Calculer la moyenne
        stats.averageObservationsPerSpecies = (stats.totalObservations / stats.totalSpecies).toFixed(2);

        res.json(stats);

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Erreur lors de la récupération des statistiques." });
    }
};