const express = require("express");
const { register, login, logout, refreshToken, getCurrentUser, changePassword } = require("../controllers/authController");
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Public routes (no authentication required)
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);

// Protected routes (require authentication)
router.get('/me', authenticateToken, getCurrentUser);
router.post('/change-password', authenticateToken, changePassword);

module.exports = router;
