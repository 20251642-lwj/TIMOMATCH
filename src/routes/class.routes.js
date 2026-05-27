const express = require('express');
const router = express.Router();
const classController = require('../controllers/class.controller');

// POST /api/classes
router.post('/', classController.createClass);
router.get('/managed', classController.getManagedClasses);

module.exports = router;