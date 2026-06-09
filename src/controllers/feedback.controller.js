const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

// 1. 특정 프로젝트의 모든 피드백 쓰레드 조회
exports.getProjectFeedbacks = async (req, res) => {
  const { projectId } = req.params;
  try {
    const feedbacks = await prisma.feedbacks.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'asc' }
    });
    return res.status(200).json(feedbacks);
  } catch (error) {
    return res.status(500).json({ error: '피드백 조회 실패' });
  }
};

// 2. [교수 전용] 새로운 피드백 생성 (상태: PENDING)
exports.createFeedback = async (req, res) => {
  const { projectId } = req.params;
  const { content } = req.body;
  const authHeader = req.headers.authorization;
  
  if (!content) return res.status(400).json({ error: '내용을 입력해주세요.' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'PROFESSOR') return res.status(403).json({ error: '교수만 피드백을 남길 수 있습니다.' });

    const newFeedback = await prisma.feedbacks.create({
      data: {
        project_id: projectId,
        content: content,
        status: 'PENDING'
      }
    });
    return res.status(201).json(newFeedback);
  } catch (error) {
    return res.status(500).json({ error: '피드백 생성 실패' });
  }
};

// 3. [학생 전용] 피드백에 대한 소명/답변 작성 (상태: PENDING -> REPLIED)
exports.replyFeedback = async (req, res) => {
  const { feedbackId } = req.params;
  const { reply } = req.body;
  const authHeader = req.headers.authorization;

  if (!reply) return res.status(400).json({ error: '답변 내용을 입력해주세요.' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'STUDENT') return res.status(403).json({ error: '학생만 답변할 수 있습니다.' });

    const updatedFeedback = await prisma.feedbacks.update({
      where: { id: feedbackId },
      data: {
        student_reply: reply,
        status: 'REPLIED'
      }
    });
    return res.status(200).json(updatedFeedback);
  } catch (error) {
    return res.status(500).json({ error: '답변 등록 실패' });
  }
};

// 4. [교수 전용] 피드백 최종 확인 및 종료 (상태: REPLIED -> RESOLVED)
exports.resolveFeedback = async (req, res) => {
  const { feedbackId } = req.params;
  const authHeader = req.headers.authorization;

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'PROFESSOR') return res.status(403).json({ error: '교수만 피드백을 종료할 수 있습니다.' });

    const resolvedFeedback = await prisma.feedbacks.update({
      where: { id: feedbackId },
      data: {
        status: 'RESOLVED',
        resolved_at: new Date()
      }
    });
    return res.status(200).json(resolvedFeedback);
  } catch (error) {
    return res.status(500).json({ error: '피드백 상태 변경 실패' });
  }
};