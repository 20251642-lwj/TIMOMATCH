const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

exports.getDashboardData = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '인증 토큰 누락' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const role = decoded.role;

    if (role === 'PROFESSOR') {
      const profProfile = await prisma.professor_profiles.findUnique({
        where: { user_id: userId },
        include: { managed_classes: true }
      });

      if (!profProfile) return res.status(404).json({ error: '교수 프로필을 찾을 수 없습니다.' });

      return res.status(200).json({
        role: 'PROFESSOR',
        classes: profProfile.managed_classes
      });
    } 
    
    if (role === 'STUDENT') {
      const studentProfile = await prisma.student_profiles.findUnique({
        where: { user_id: userId },
        include: { enrolled_classes: true }
      });

      if (!studentProfile) return res.status(404).json({ error: '학생 프로필을 찾을 수 없습니다.' });

      // [핵심 반영] 단일 user_id가 아닌 members N:M 관계를 통한 내가 속한 프로젝트 조회
      const projects = await prisma.projects.findMany({
        where: { 
          members: { 
            some: { user_id: userId } 
          } 
        },
        include: { 
          class: true,
          members: {
            include: {
              user: { select: { name: true } }
            }
          }
        },
        orderBy: { 
          created_at: "desc" 
        }
      });

      return res.status(200).json({
        role: 'STUDENT',
        classes: studentProfile.enrolled_classes,
        projects: projects
      });
    }

    return res.status(403).json({ error: '권한 없음' });

  } catch (error) {
    console.error('Dashboard Error:', error);
    return res.status(500).json({ error: '대시보드 데이터 조회 실패' });
  }
};