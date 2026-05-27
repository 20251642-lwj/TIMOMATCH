const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

exports.getProfile = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 유저 정보와 서브 프로필 테이블을 동시에 조회
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: {
        student_profile: true,
        professor_profile: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: '존재하지 않는 사용자입니다.' });
    }

    // 보안을 위해 해싱된 토큰 등 민감한 정보는 제외하고 반환
    return res.status(200).json({
      id: user.id,
      name: user.name,
      role: user.role,
      student_profile: user.student_profile,
      professor_profile: user.professor_profile
    });

  } catch (error) {
    console.error('Fetch Profile Error:', error.message);
    return res.status(401).json({ error: '유효하지 않거나 만료된 인증 토큰입니다.' });
  }
};