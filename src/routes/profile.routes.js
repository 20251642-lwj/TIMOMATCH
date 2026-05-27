const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');

// GET /api/profile
router.get('/', profileController.getProfile);

module.exports = router;