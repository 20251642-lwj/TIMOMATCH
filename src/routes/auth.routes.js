const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.get('/github', authController.githubLogin);
router.get('/github/callback', authController.githubCallback);
router.get('/universities', authController.getUniversities); // [NEW] 대학교 목록 엔드포인트 등록
router.post('/role', authController.setRole);

module.exports = router;