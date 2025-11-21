// src/controllers/authController.js
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "SECRET_DE_L_ECOLE"; 

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



// Fonction pour se CONNECTER (Login)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. On cherche l'utilisateur par son email
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    // 2. On vérifie le mot de passe 
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    // 3. Tout est bon ! On fabrique le badge d'accès (Token JWT)
    const token = jwt.sign(
      { 
        userId: user.id, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: "24h" } // Le badge est valable 24h
    );

    // 4. On donne le badge au visiteur
    res.json({ message: "Connexion réussie !", token: token });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la connexion." });
  }
};

// GET /auth/me
exports.getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Pas de token." });
    
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, username: true, role: true, reputation: true, createdAt: true }
    });
    res.json(user);
  } catch (error) {
    res.status(401).json({ error: "Token invalide." });
  }
};

// 4. GET /admin/users (Lister tout le monde) 
exports.getAllUsers = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Pas de token." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Vérification du rôle ADMIN
    if (decoded.role !== "ADMIN") {
      return res.status(403).json({ error: "Accès interdit. Réservé aux admins." });
    }

    const users = await prisma.user.findMany({
      select: { id: true, email: true, username: true, role: true, reputation: true }
    });
    res.json(users);
  } catch (error) {
    res.status(401).json({ error: "Accès refusé." });
  }
};

///users/:id/role (Changer le rôle - ADMIN seulement) 
exports.updateRole = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Pas de token." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Vérification du rôle ADMIN
    if (decoded.role !== "ADMIN") {
      return res.status(403).json({ error: "Accès interdit. Réservé aux admins." });
    }

    const { id } = req.params;
    const { role } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { role: role },
      select: { id: true, username: true, role: true }
    });
    res.json({ message: "Rôle mis à jour", user: updatedUser });
  } catch (error) {
    res.status(400).json({ error: "Erreur (ID invalide ou rôle inexistant)." });
  }
};

// 6. PATCH /users/:id/reputation (Interne : Appelé par les autres services)
exports.incrementReputation = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body; // Le nombre de points (ex: 3, 1, -1)

    // 1. On met à jour les points
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        reputation: { increment: parseInt(amount) }
      }
    });

    // 2. LOGIQUE "LEVEL UP" : Passage automatique en EXPERT
    let message = "Réputation mise à jour.";
    
    // Si l'user dépasse 10 points et est encore un simple USER, il monte en grade !
    if (updatedUser.reputation >= 10 && updatedUser.role === 'USER') {
      await prisma.user.update({
        where: { id: parseInt(id) },
        data: { role: 'EXPERT' }
      });
      message += " Félicitations ! L'utilisateur est devenu EXPERT !";
    }

    res.json({ message, user: updatedUser });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de la réputation" });
  }
};