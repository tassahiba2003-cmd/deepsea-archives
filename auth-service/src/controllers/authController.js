// src/controllers/authController.js
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Fonction pour s'INSCRIRE
exports.register = async (req, res) => {
  try {
    // 1. On récupère les infos envoyées
    const { email, username, password, role } = req.body;

    // 2. On vérifie si l'utilisateur existe déjà
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: email }, { username: username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: "Cet email ou ce pseudo est déjà pris." });
    }

    // 3. On crypte le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. On enregistre dans la base de données
    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: role || "USER",
        reputation: 0
      }
    });

    // 5. Succès !
    res.status(201).json({ message: "Compte créé !", user: newUser });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de l'inscription." });
  }
};