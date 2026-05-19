require('dotenv').config();
const express = require('express');
const path = require('path');
const { exec } = require('child_process'); // 브라우저 자동 실행을 위한 내장 모듈 추가

const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const classRoutes = require('./routes/class.routes');
const enrollRoutes = require('./routes/enroll.routes');

const app = express();

app.use(express.json());
app.disable('x-powered-by');

// 정적 HTML 파일 제공
app.use(express.static(path.join(__dirname, '../public')));

// 라우터 연결
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/enroll', enrollRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`🌐 접속 주소: ${url}`);

  // 운영체제(OS) 판별 및 브라우저 실행 명령어 설정
  const startCommand = process.platform === 'win32' ? 'start' 
                     : process.platform === 'darwin' ? 'open' 
                     : 'xdg-open';

  // 서버 구동 즉시 기본 브라우저를 띄워 해당 URL로 연결
  exec(`${startCommand} ${url}`, (err) => {
    if (err) console.error('브라우저 자동 실행 실패:', err.message);
  });
});