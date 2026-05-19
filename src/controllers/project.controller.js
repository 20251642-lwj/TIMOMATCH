const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

exports.createProject = async (req, res) => {
  // [수정됨] req.body에서 class_id를 함께 받아옵니다.
  const { title, github_url, class_id } = req.body;

  if (!title || !github_url) {
    return res.status(400).json({ error: '프로젝트 이름과 GitHub 레포지토리 주소는 필수 항목입니다.' });
  }
  
  if (!class_id) {
    return res.status(400).json({ error: '프로젝트를 제출할 과목 정보가 누락되었습니다.' });
  }

  const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/;
  if (!githubRegex.test(github_url)) {
    return res.status(400).json({ error: '올바른 GitHub 레포지토리 주소 형식이 아닙니다.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: '인증 토큰 누락' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // [수정됨] 데이터베이스 생성 시 class_id 매핑 추가
    const newProject = await prisma.projects.create({
      data: {
        title: title.trim(),
        github_url: github_url.trim(),
        user_id: decoded.userId,
        class_id: class_id 
      }
    });

    return res.status(201).json(newProject);
  } catch (error) {
    console.error('Project Creation Error:', error.message);
    return res.status(401).json({ error: '인증 실패' });
  }
};
// src/controllers/project.controller.js 내 추가

exports.getProjects = async (req, res) => {
  // 1. 요청 헤더에서 JWT 인증 토큰 추출 및 검증
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 2. JWT 페이로드의 userId를 기반으로 해당 유저의 프로젝트만 조회 (최신순 정렬)
    const userProjects = await prisma.projects.findMany({
      where: { user_id: decoded.userId },
      orderBy: { created_at: 'desc' }
    });

    return res.status(200).json(userProjects);
  } catch (error) {
    console.error('Project Fetch Error:', error.message);
    return res.status(401).json({ error: '유효하지 않거나 만료된 인증 토큰입니다.' });
  }
};