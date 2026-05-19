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

    // 1. 보안: 교수 권한 검증
    if (decoded.role !== 'PROFESSOR') {
      return res.status(403).json({ error: '과목 개설 권한이 없습니다. 교수 계정으로 로그인해주세요.' });
    }

    // 2. 고유 초대 코드 생성 (중복 방지 루프)
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

    // 3. DB에 과목 생성
    const newClass = await prisma.classes.create({
      data: {
        name: name.trim(),
        code: generatedCode,
        professor_id: decoded.userId
      }
    });

    return res.status(201).json(newClass);
  } catch (error) {
    console.error('Class Creation Error:', error.message);
    return res.status(401).json({ error: '유효하지 않거나 만료된 인증 토큰입니다.' });
  }
};