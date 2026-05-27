const express = require('express');
const router = express.Router();
const enrollController = require('../controllers/enroll.controller');

// POST /api/enroll - 초대 코드로 수강 과목 등록
router.post('/', enrollController.enrollClass);

// GET /api/enroll - 내가 수강 중인 과목 목록 조회 (이름 일치화)
router.get('/', enrollController.getEnrolledClasses);

module.exports = router;