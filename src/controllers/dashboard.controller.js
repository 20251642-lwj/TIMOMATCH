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
      const profile = await prisma.professor_profiles.findUnique({
        where: { user_id: userId },
        include: { managed_classes: true }
      });
      return res.status(200).json({ role, classes: profile ? profile.managed_classes : [] });
      
    } else if (role === 'STUDENT') {
      const profile = await prisma.student_profiles.findUnique({
        where: { user_id: userId },
        include: { enrolled_classes: true }
      });
      const projects = await prisma.projects.findMany({
        where: { user_id: userId },
        include: { class: true },
        orderBy: { created_at: 'desc' }
      });
      return res.status(200).json({ 
        role, 
        classes: profile ? profile.enrolled_classes : [],
        projects: projects
      });
    }

    return res.status(403).json({ error: '유효하지 않은 권한입니다.' });
  } catch (error) {
    console.error('Dashboard Error:', error.message);
    return res.status(500).json({ error: '서버 오류' });
  }
};