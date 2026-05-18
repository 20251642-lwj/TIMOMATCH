const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.get('/github/login', authController.loginWithGitHub);
router.get('/github/callback', authController.handleGitHubCallback);
router.patch('/role', authController.updateRole); // 추가된 라우트

module.exports = router;