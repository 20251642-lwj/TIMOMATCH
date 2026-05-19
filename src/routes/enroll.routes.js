const express = require('express');
const router = express.Router();
const enrollController = require('../controllers/enroll.controller');

router.post('/', enrollController.enrollClass);
router.get('/', enrollController.getMyClasses); // [추가됨] 수강 목록 조회

module.exports = router;