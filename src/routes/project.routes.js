const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');

router.post('/', projectController.createProject);
router.get('/', projectController.getProjects); 
router.get('/class/:classId', projectController.getClassProjects);

// [NEW] 리포트 페이지 로드 시 사용하는 읽기 전용 API
router.get('/:id/report', projectController.getProjectReport);

// 교수님이 명시적으로 버튼을 눌렀을 때만 호출되는 AI 강제 갱신 API
router.post('/:id/analyze', projectController.analyzeProjectPRs);

module.exports = router;