const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

exports.createProject = async (req, res) => {
  const { title, github_url } = req.body;

  // 1. 필수 입력값 검증 (산지화)
  if (!title || !github_url) {
    return res.status(400).json({ error: '프로젝트 이름과 GitHub 레포지토리 주소는 필수 항목입니다.' });
  }

  // 2. 정규식을 이용한 안전한 GitHub URL 포맷 검증
  const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/;
  if (!githubRegex.test(github_url)) {
    return res.status(400).json({ error: '올바른 GitHub 레포지토리 주소 형식이 아닙니다. (https://github.com/소유자/저장소)' });
  }

  // 3. 요청 헤더에서 JWT 인증 토큰 추출 및 검증
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 4. 데이터베이스 연동 및 레코드 생성 (1:N 외래키 매핑)
    const newProject = await prisma.projects.create({
      data: {
        title: title.trim(),
        github_url: github_url.trim(),
        user_id: decoded.userId
      }
    });

    return res.status(201).json(newProject);
  } catch (error) {
    console.error('Project Creation Error:', error.message);
    return res.status(401).json({ error: '유효하지 않거나 만료된 인증 토큰입니다.' });
  }
};