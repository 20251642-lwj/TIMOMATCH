const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const stateStore = new Set();

// 1. 라우터명 일치 (loginWithGitHub -> githubLogin)
exports.githubLogin = (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  stateStore.add(state);

  // redirect_uri의 경우 프론트엔드 라우터 규약인 /api/auth/github/callback 주소 체계와 정렬
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.FRONTEND_URL}/api/auth/github/callback&scope=read:user user:email repo&state=${state}`;
  
  res.redirect(githubAuthUrl);
};

// 2. 라우터명 일치 (handleGitHubCallback -> githubCallback)
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

    // 기존의 고도화된 AES-256-CBC 암호화 엔진 무결성 유지
    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), 
      Buffer.from(process.env.ENCRYPTION_IV, 'hex')
    );
    let encryptedToken = cipher.update(accessToken, 'utf8', 'hex');
    encryptedToken += cipher.final('hex');

    const userEmail = githubUser.email || `${githubUser.login}@github.com`;
    
    const savedUser = await prisma.users.upsert({
      where: { email: userEmail },
      update: { 
        github_token: encryptedToken 
      },
      create: {
        id: crypto.randomUUID(),
        email: userEmail,
        name: githubUser.name || githubUser.login,
        role: 'PENDING',
        github_token: encryptedToken,
        github_email: userEmail
      }
    });

    const jwtToken = jwt.sign(
      { userId: savedUser.id, role: savedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } 
    );

    if (savedUser.role === 'PENDING') {
      res.redirect(`/first-login.html?token=${jwtToken}`);
    } else if (savedUser.role === 'PROFESSOR') {
      res.redirect(`/prof-home.html?token=${jwtToken}`);
    } else if (savedUser.role === 'STUDENT') {
      res.redirect(`/student-home.html?token=${jwtToken}`);
    }

  } catch (error) {
    console.error('GitHub OAuth Error:', error.message);
    res.status(500).json({ error: '인증 처리 중 서버 오류가 발생했습니다.' });
  }
};

// 3. 라우터 및 프론트 규약 일치 (updateRole -> setRole, PATCH -> POST 연동 구조 대응)
exports.setRole = async (req, res) => {
  const { role } = req.body;

  if (!['STUDENT', 'PROFESSOR'].includes(role)) {
    return res.status(400).json({ error: '지정 불가능한 허가 직군입니다.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '제시된 출입 서류가 누락되었습니다.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const updatedUser = await prisma.users.update({
      where: { id: decoded.userId },
      data: { role: role }
    });

    const finalToken = jwt.sign(
      { userId: updatedUser.id, role: updatedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ message: '역할 지정 성료', token: finalToken });
  } catch (error) {
    return res.status(401).json({ error: '만료되었거나 위조 흔적이 있는 토큰입니다.' });
  }
};