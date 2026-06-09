const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedback.controller');

// GET /api/feedbacks/project/:projectId
router.get('/project/:projectId', feedbackController.getProjectFeedbacks);

// POST /api/feedbacks/project/:projectId (교수: 피드백 생성)
router.post('/project/:projectId', feedbackController.createFeedback);

// PUT /api/feedbacks/:feedbackId/reply (학생: 피드백 답변)
router.put('/:feedbackId/reply', feedbackController.replyFeedback);

// PUT /api/feedbacks/:feedbackId/resolve (교수: 피드백 확인/종료)
router.put('/:feedbackId/resolve', feedbackController.resolveFeedback);

module.exports = router;