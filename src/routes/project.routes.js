// src/routes/project.routes.js

const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');

// [유지] 기존에 작성해두신 라우트 무결성 보존
router.post('/', projectController.createProject);
router.get('/', projectController.getProjects); 

// [신규 추가] 특정 과목에 제출된 프로젝트 리스트 조회 (교수용)
router.get('/class/:classId', projectController.getClassProjects);

// [신규 추가] 실시간 GitHub 수집 및 AI 분석 엔진 실행
router.post('/:id/analyze', projectController.analyzeProjectPRs);

module.exports = router;