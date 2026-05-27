const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const prisma = new PrismaClient();

exports.createClass = async (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '올바른 과목 이름을 입력해주세요.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 1. 보안: 교수 권한 1차 검증
    if (decoded.role !== 'PROFESSOR') {
      return res.status(403).json({ error: '과목 개설 권한이 없습니다.' });
    }

    // 2. [NEW] 관계 무결성 보장: users 테이블의 id로 professor_profiles의 고유 id를 조회
    const profProfile = await prisma.professor_profiles.findUnique({
      where: { user_id: decoded.userId }
    });

    if (!profProfile) {
      return res.status(404).json({ error: '교수 프로필을 찾을 수 없습니다. 온보딩을 다시 진행해주세요.' });
    }

    // 3. 고유 초대 코드 생성 (중복 방지 루프)
    let isUnique = false;
    let generatedCode = '';
    
    while (!isUnique) {
      const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
      generatedCode = `TIMO-${randomStr}`;
      
      const existingClass = await prisma.classes.findUnique({
        where: { code: generatedCode }
      });
      if (!existingClass) {
        isUnique = true;
      }
    }

    // 4. DB에 과목 생성 (수정된 외래키 매핑 적용)
    const newClass = await prisma.classes.create({
      data: {
        name: name.trim(),
        code: generatedCode,
        professor_profile_id: profProfile.id // users.id가 아닌 professor_profiles.id 연결
      }
    });

    return res.status(201).json(newClass);
  } catch (error) {
    console.error('Class Creation Error:', error.message);
    return res.status(401).json({ error: '요청 처리 중 오류가 발생했습니다.' });
  }
};
// src/controllers/class.controller.js 하단에 추가

exports.getManagedClasses = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 1. 보안: 교수 권한 검증
    if (decoded.role !== 'PROFESSOR') {
      return res.status(403).json({ error: '과목 관리 권한이 없습니다.' });
    }

    // 2. professor_profile 식별자 획득
    const profProfile = await prisma.professor_profiles.findUnique({
      where: { user_id: decoded.userId }
    });

    if (!profProfile) {
      return res.status(404).json({ error: '교수 프로필을 찾을 수 없습니다.' });
    }

    // 3. 해당 교수가 개설한 과목 목록 조회 (최신순 정렬)
    const classes = await prisma.classes.findMany({
      where: { professor_profile_id: profProfile.id },
      orderBy: { created_at: 'desc' }
    });

    return res.status(200).json(classes);
  } catch (error) {
    console.error('Fetch Managed Classes Error:', error.message);
    return res.status(401).json({ error: '유효하지 않거나 만료된 인증 토큰입니다.' });
  }
};