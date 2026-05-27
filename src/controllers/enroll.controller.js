const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// 학생의 과목 수강 등록 (초대 코드 기준)
exports.enrollClass = async (req, res) => {
  const { code } = req.body;

  if (!code || code.trim() === '') {
    return res.status(400).json({ error: '올바른 초대 코드를 입력해주세요.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'STUDENT') {
      return res.status(403).json({ error: '학생 계정만 과목 등록이 가능합니다.' });
    }

    // 1. 해당 초대 코드를 가진 과목이 존재하는지 확인
    const targetClass = await prisma.classes.findUnique({
      where: { code: code.trim().toUpperCase() }
    });

    if (!targetClass) {
      return res.status(404).json({ error: '존재하지 않는 초대 코드입니다.' });
    }

    // 2. 해당 유저의 학생 프로필 조회
    const studentProfile = await prisma.student_profiles.findUnique({
      where: { user_id: decoded.userId }
    });

    if (!studentProfile) {
      return res.status(404).json({ error: '학생 프로필을 찾을 수 없습니다.' });
    }

    // 3. 다대다 관계 등록 (student_profiles <-> classes 관계 테이블 연결)
    await prisma.student_profiles.update({
      where: { id: studentProfile.id },
      data: {
        enrolled_classes: {
          connect: { id: targetClass.id }
        }
      }
    });

    return res.status(200).json({ message: '수강 등록 성공', targetClass });
  } catch (error) {
    console.error('Enroll Class Error:', error.message);
    return res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
  }
};

// 학생이 수강 중인 과목 목록 조회 (버그 수정 반영본)
exports.getEnrolledClasses = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'STUDENT') {
      return res.status(403).json({ error: '권한 없음' });
    }

    // users가 아닌 student_profiles 테이블을 매개로 하여 다대다 연결 목록 검색
    const studentProfile = await prisma.student_profiles.findUnique({
      where: { user_id: decoded.userId },
      include: { enrolled_classes: true }
    });

    if (!studentProfile) {
      return res.status(404).json({ error: '학생 프로필을 찾을 수 없습니다.' });
    }

    return res.status(200).json(studentProfile.enrolled_classes);
  } catch (error) {
    console.error('Fetch Classes Error:', error.message);
    return res.status(401).json({ error: '유효하지 않거나 만료된 인증 토큰입니다.' });
  }
};