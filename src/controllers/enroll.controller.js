const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

exports.enrollClass = async (req, res) => {
  const { code } = req.body; // 학생이 입력한 초대 코드

  if (!code || typeof code !== 'string' || code.trim() === '') {
    return res.status(400).json({ error: '초대 코드를 정확히 입력해주세요.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 1. 보안: 학생 권한 검증
    if (decoded.role !== 'STUDENT') {
      return res.status(403).json({ error: '수강 등록 권한이 없습니다. 학생 계정으로 로그인해주세요.' });
    }

    // 2. 초대 코드 유효성 검증 (해당 코드를 가진 과목 찾기)
    const targetClass = await prisma.classes.findUnique({
      where: { code: code.trim().toUpperCase() }
    });

    if (!targetClass) {
      return res.status(404).json({ error: '유효하지 않은 초대 코드입니다. 다시 확인해주세요.' });
    }

    // 3. 중복 수강 등록 방지: 학생이 이미 이 과목을 듣고 있는지 확인
    const existingEnrollment = await prisma.users.findFirst({
      where: {
        id: decoded.userId,
        enrolled_classes: {
          some: { id: targetClass.id }
        }
      }
    });

    if (existingEnrollment) {
      return res.status(409).json({ error: '이미 수강 등록이 완료된 과목입니다.' });
    }

    // 4. 수강 등록 처리 (Prisma N:M 연결)
    // 현재 학생(user) 업데이트: enrolled_classes 관계 목록에 targetClass.id를 'connect(연결)' 함
    const updatedUser = await prisma.users.update({
      where: { id: decoded.userId },
      data: {
        enrolled_classes: {
          connect: { id: targetClass.id }
        }
      },
      include: {
        enrolled_classes: true // 업데이트 후 소속된 과목 목록도 함께 반환
      }
    });

    return res.status(200).json({
      message: '성공적으로 수강 등록되었습니다.',
      targetClass: targetClass,
      enrolledClasses: updatedUser.enrolled_classes
    });

  } catch (error) {
    console.error('Enrollment Error:', error.message);
    return res.status(401).json({ error: '인증 처리 중 오류가 발생했습니다.' });
  }
};

// src/controllers/enroll.controller.js 하단에 추가

exports.getMyClasses = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: '인증 토큰 누락' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'STUDENT') return res.status(403).json({ error: '권한 없음' });

    // 유저의 고유 ID로 검색하여, 다대다(N:M)로 연결된 enrolled_classes 목록만 추출
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: { enrolled_classes: true }
    });

    return res.status(200).json(user.enrolled_classes);
  } catch (error) {
    console.error('Fetch Classes Error:', error.message);
    return res.status(401).json({ error: '인증 실패' });
  }
};