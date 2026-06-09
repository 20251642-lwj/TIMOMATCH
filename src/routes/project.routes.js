// src/routes/project.routes.js

const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');

router.post('/', projectController.createProject);
router.get('/', projectController.getProjects); 

// 특정 과목에 제출된 전체 프로젝트 리스트 조회 (교수 및 학생 합류용)
router.get('/class/:classId', projectController.getClassProjects);

// [NEW] 팀원 합류 라우터 추가
router.post('/:projectId/join', projectController.joinProject);

// 리포트 읽기 전용 및 AI 재분석 엔진
router.get('/:id/report', projectController.getProjectReport);
router.post('/:id/analyze', projectController.analyzeProjectPRs);

module.exports = router;