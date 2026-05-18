require('dotenv').config();
const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');

const app = express();

app.use(express.json());
app.disable('x-powered-by');

// 정적 HTML 파일 제공
app.use(express.static(path.join(__dirname, '../public')));

// 라우터 연결
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});