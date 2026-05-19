// src/routes/auth.routes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// 위의 컨트롤러에 선언된 최신 익스포트 함수들과 완벽하게 싱크 결합
router.get('/github', authController.githubLogin);
router.get('/github/callback', authController.githubCallback);
router.post('/role', authController.setRole);

module.exports = router;