const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const stateStore = new Set();

// 1. GitHub 로그인 링크 생성
exports.githubLogin = (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  stateStore.add(state);

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.FRONTEND_URL}/api/auth/github/callback&scope=read:user user:email repo&state=${state}`;
  
  res.redirect(githubAuthUrl);
};

// 2. GitHub 콜백 처리 (초기 PENDING 유저 생성)
exports.githubCallback = async (req, res) => {
  const { code, state } = req.query;

  if (!state || !stateStore.has(state)) {
    return res.status(403).json({ error: '유효하지 않은 상태 값입니다. (CSRF 의심)' });
  }
  stateStore.delete(state);

  try {
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: 'application/json' } }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) throw new Error('GitHub 토큰 발급 실패');

    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    const githubUser = userResponse.data;

    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), 
      Buffer.from(process.env.ENCRYPTION_IV, 'hex')
    );
    let encryptedToken = cipher.update(accessToken, 'utf8', 'hex');
    encryptedToken += cipher.final('hex');

    const githubIdStr = String(githubUser.id);
    
    // 이 단계에서는 users 테이블에 기본 정보만 저장
    const savedUser = await prisma.users.upsert({
      where: { github_id: githubIdStr },
      update: { github_token: encryptedToken },
      create: {
        github_id: githubIdStr,
        name: githubUser.name || githubUser.login,
        role: 'PENDING',
        github_token: encryptedToken
      }
    });

    const jwtToken = jwt.sign(
      { userId: savedUser.id, role: savedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } 
    );

    // 기존 savedUser.role 조건문 전체를 아래와 같이 교체
    if (savedUser.role === 'PENDING') {
      res.redirect(`/first-login.html?token=${jwtToken}`);
    } else {
      // 이미 역할을 부여받은 기존 유저는 학생/교수 구분 없이 통합 대시보드로 이동
      res.redirect(`/dashboard.html?token=${jwtToken}`);
    }

  } catch (error) {
    console.error('GitHub OAuth Error:', error.message);
    res.status(500).json({ error: '인증 처리 중 서버 오류가 발생했습니다.' });
  }
};

// 3. 프론트엔드 대학교 검색용 API
exports.getUniversities = async (req, res) => {
  try {
    const list = await prisma.universities.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
    res.json(list);
  } catch (error) {
    console.error('Fetch Universities Error:', error.message);
    res.status(500).json({ error: '대학교 목록을 불러오는 중 오류가 발생했습니다.' });
  }
};

// 4. [핵심] 역할 지정 및 다중 테이블 트랜잭션 저장 로직
exports.setRole = async (req, res) => {
  const { role, real_name, university_id, student_number, tech_stack } = req.body;

  if (!['STUDENT', 'PROFESSOR'].includes(role)) {
    return res.status(400).json({ error: '지정 불가능한 직군입니다.' });
  }

  // 공통 필수값 검증
  if (!real_name || !university_id) {
    return res.status(400).json({ error: '실명과 대학교 선택은 필수 항목입니다.' });
  }

  // 학생일 경우 학번 필수 검증 (교수는 검증하지 않음)
  if (role === 'STUDENT' && !student_number) {
    return res.status(400).json({ error: '학생은 학번을 반드시 입력해야 합니다.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    
    // [보안] 트랜잭션 시작: users 업데이트와 프로필 생성이 동시에 성공해야만 DB에 반영됨
    const [updatedUser] = await prisma.$transaction(async (tx) => {
      
      // 공통 작업: users 테이블의 role 업데이트
      const user = await tx.users.update({
        where: { id: userId },
        data: { role: role }
      });

      // 분기 작업: 역할에 맞는 프로필 테이블에 레코드 삽입
      if (role === 'STUDENT') {
        await tx.student_profiles.create({
          data: {
            user_id: userId,
            university_id: university_id,
            real_name: real_name,
            student_number: student_number,
            tech_stack: Array.isArray(tech_stack) ? tech_stack : []
          }
        });
      } else if (role === 'PROFESSOR') {
        await tx.professor_profiles.create({
          data: {
            user_id: userId,
            university_id: university_id,
            real_name: real_name
            // professor_number는 스키마에서 삭제되었으므로 제외됨
          }
        });
      }

      return [user];
    });

    const finalToken = jwt.sign(
      { userId: updatedUser.id, role: updatedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ message: '역할 지정 및 온보딩 완료', token: finalToken });
    
  } catch (error) {
    // Prisma 복합 고유키 위반 에러코드 (P2002) 처리: 이미 존재하는 학번 방어
    if (error.code === 'P2002') {
      return res.status(409).json({ error: '해당 대학교에 이미 가입된 학번입니다.' });
    }
    
    console.error('Set Role Error:', error.message);
    return res.status(401).json({ error: '인증이 만료되었거나 처리 중 오류가 발생했습니다.' });
  }
};