// src/controllers/observationController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require("axios");
const AUTH_SERVICE_URL = "http://localhost:4000";

// --- GESTION DES ESPÈCES ---

// 1. POST /species (Créer une espèce)
exports.createSpecies = async (req, res) => {
  try {
    const { name } = req.body;
    const authorId = req.user.userId; // On récupère l'ID de celui qui crée

    const species = await prisma.species.create({
      data: { name, authorId }
    });
    res.status(201).json(species);
  } catch (error) {
    res.status(400).json({ error: "Erreur : Cette espèce existe déjà." });
  }
};

// 2. GET /species (Voir toutes les espèces)
exports.getAllSpecies = async (req, res) => {
  try {
    const species = await prisma.species.findMany();
    res.json(species);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// 3. GET /species/:id (Voir une espèce précise)
exports.getSpeciesById = async (req, res) => {
  try {
    const { id } = req.params;
    const species = await prisma.species.findUnique({
      where: { id: parseInt(id) }
    });
    if (!species) return res.status(404).json({ error: "Espèce introuvable" });
    res.json(species);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};





// 4. POST /observations (Créer une observation)
exports.createObservation = async (req, res) => {
  try {
    const { speciesId, description, dangerLevel } = req.body;
    const authorId = req.user.userId;

    if (!description || description.trim() === "") {
        return res.status(400).json({ error: "La description est obligatoire." });
    }

    // compris entre 1 et 5
    if (dangerLevel < 1 || dangerLevel > 5) {
        return res.status(400).json({ error: "Le niveau de danger doit être entre 1 et 5" });
    }

    const lastObservation = await prisma.observation.findFirst({
        where: {
            authorId: authorId,              
            speciesId: parseInt(speciesId)    
        },
        orderBy: { createdAt: 'desc' }        
    });

    if (lastObservation) {
        const now = new Date();
        const lastDate = new Date(lastObservation.createdAt);
        const diffEnMinutes = (now - lastDate) / 1000 / 60; 

        if (diffEnMinutes < 5) {
            return res.status(429).json({ 
                error: `Doucement ! Attendez encore ${Math.ceil(5 - diffEnMinutes)} minutes avant de reposter sur cette espèce.` 
            });
        }
    }

    const observation = await prisma.observation.create({
      data: {
        speciesId: parseInt(speciesId),
        description,
        dangerLevel: parseInt(dangerLevel),
        authorId,
        status: "PENDING" 
      }
    });
    res.status(201).json(observation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la création (Vérifie que l'ID de l'espèce existe !)" });
  }
};

// 5. GET /species/:id/observations (Voir les observations d'une espèce précise)
exports.getObservationsBySpecies = async (req, res) => {
    try {
        const { id } = req.params; // id de l'espèce
        const observations = await prisma.observation.findMany({
            where: { speciesId: parseInt(id) }
        });
        res.json(observations);
    } catch (error) {
        res.status(500).json({ error: "Erreur serveur" });
    }
};


// --- VALIDATION ET MODÉRATION ---


// Fonction utilitaire pour donner des points (évite de répéter le code)
async function giveReputation(userId, amount) {
  try {
    await axios.patch(`${AUTH_SERVICE_URL}/users/${userId}/reputation`, { amount });
  } catch (err) {
    console.error(`Erreur points pour user ${userId}:`, err.message);
  }
}

// 6. VALIDER (+3 pour l'auteur, +1 pour l'expert)
exports.validateObservation = async (req, res) => {
  try {
    const { id } = req.params;
    const validatorId = req.user.userId;

    if (req.user.role === 'USER') return res.status(403).json({ error: "Interdit." });
    const observation = await prisma.observation.findUnique({ where: { id: parseInt(id) } });
    if (!observation) return res.status(404).json({ error: "Introuvable" });
    if (observation.authorId === validatorId) return res.status(400).json({ error: "Auto-validation interdite" });

    // Mise à jour statut
    const updatedObs = await prisma.observation.update({
      where: { id: parseInt(id) },
      data: { status: "VALIDATED", validatedBy: validatorId, validatedAt: new Date() }
    });

    // --- DISTRIBUTION DES POINTS ---
    // 1. Auteur : +3 points
    await giveReputation(observation.authorId, 3);

    // 2. Validateur (si Expert) : +1 point
    // (On considère que le travail mérite salaire pour motiver les experts)
    if (req.user.role === 'EXPERT') {
        await giveReputation(validatorId, 1);
    }

    // 3. Rareté (Code précédent)
    const validCount = await prisma.observation.count({ where: { speciesId: observation.speciesId, status: "VALIDATED" } });
    await prisma.species.update({ where: { id: observation.speciesId }, data: { rarityScore: 1 + (validCount / 5) } });

    res.json({ message: "Validé ! Points distribués.", observation: updatedObs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// 7. REJETER (-1 pour l'auteur)
exports.rejectObservation = async (req, res) => {
  try {
    const { id } = req.params;
    const validatorId = req.user.userId;

    if (req.user.role === 'USER') return res.status(403).json({ error: "Interdit." });

    const observation = await prisma.observation.findUnique({ where: { id: parseInt(id) } });
    if (!observation) return res.status(404).json({ error: "Introuvable" });
    if (observation.authorId === validatorId) return res.status(400).json({ error: "Auto-rejet interdit" });

    const updatedObs = await prisma.observation.update({
      where: { id: parseInt(id) },
      data: { status: "REJECTED", validatedBy: validatorId, validatedAt: new Date() }
    });

    // --- DISTRIBUTION DES POINTS ---
    // Auteur : -1 point
    await giveReputation(observation.authorId, -1);

    res.json({ message: "Rejeté. Points retirés.", observation: updatedObs });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};