// src/controllers/observationController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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

// 6. POST /observations/:id/validate (Valider)
exports.validateObservation = async (req, res) => {
  try {
    const { id } = req.params;
    const validatorId = req.user.userId; 

    // A. Vérifier le rôle (Pas de simples USER)
    if (req.user.role === 'USER') {
      return res.status(403).json({ error: "Action interdite aux simples utilisateurs." });
    }

    // B. Récupérer l'observation pour vérifier l'auteur
    const observation = await prisma.observation.findUnique({ where: { id: parseInt(id) } });
    if (!observation) return res.status(404).json({ error: "Observation introuvable." });

    // C. Règle : Interdit de s'auto-valider
    if (observation.authorId === validatorId) {
      return res.status(400).json({ error: "Interdit de valider sa propre observation !" });
    }

    // D. Mise à jour
    const updatedObs = await prisma.observation.update({
      where: { id: parseInt(id) },
      data: {
        status: "VALIDATED",
        validatedBy: validatorId,
        validatedAt: new Date()
      }
    });

    res.json({ message: "Observation validée avec succès !", observation: updatedObs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur lors de la validation." });
  }
};

// 7. POST /observations/:id/reject (Rejeter)
exports.rejectObservation = async (req, res) => {
    try {
      const { id } = req.params;
      const validatorId = req.user.userId;
  
      // A. Vérifier le rôle
      if (req.user.role === 'USER') {
        return res.status(403).json({ error: "Action interdite aux simples utilisateurs." });
      }
  
      // B. Vérifier l'auteur
      const observation = await prisma.observation.findUnique({ where: { id: parseInt(id) } });
      if (!observation) return res.status(404).json({ error: "Observation introuvable." });
  
      // C. Règle : Interdit de s'auto-rejeter 
      if (observation.authorId === validatorId) {
        return res.status(400).json({ error: "Interdit de rejeter sa propre observation !" });
      }
  
      // D. Mise à jour
      const updatedObs = await prisma.observation.update({
        where: { id: parseInt(id) },
        data: {
          status: "REJECTED",
          validatedBy: validatorId,
          validatedAt: new Date()
        }
      });
  
      res.json({ message: "Observation rejetée.", observation: updatedObs });
    } catch (error) {
      res.status(500).json({ error: "Erreur serveur lors du rejet." });
    }
  };