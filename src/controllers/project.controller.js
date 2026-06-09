const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const prisma = new PrismaClient();

// --- [공통 헬퍼 함수] ---
function decryptGithubToken(encryptedToken) {
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(process.env.ENCRYPTION_IV, 'hex')
  );
  let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function parseGithubUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace('.git', '') };
}

// 깃허브 데이터 페칭 및 가공 공통 로직
async function getGithubMetricsData(project) {
  if (!project || !project.user || !project.user.github_token) {
    throw new Error('프로젝트 또는 깃허브 연동 정보가 없습니다.');
  }

  const decryptedToken = decryptGithubToken(project.user.github_token);
  const repoInfo = parseGithubUrl(project.github_url);
  if (!repoInfo) throw new Error('올바르지 않은 저장소 주소입니다.');

  const authConfig = {
    headers: { Authorization: `Bearer ${decryptedToken}`, Accept: 'application/vnd.github.v3+json' }
  };

  const [prRes, commitRes] = await Promise.all([
    axios.get(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/pulls?state=all&per_page=30`, authConfig).catch(() => ({ data: [] })),
    axios.get(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/commits?per_page=100`, authConfig).catch(() => ({ data: [] }))
  ]);

  const prs = prRes.data;
  const commits = commitRes.data;

  const totalPRs = prs.length;
  const mergedPRs = prs.filter(pr => pr.merged_at !== null).length;
  const openPRs = prs.filter(pr => pr.state === 'open').length;
  const totalCommits = commits.length;

  const timelineMap = new Map();

  // [NEW] 1. 타임라인 시작일(제출일 or 첫 커밋일 중 빠른 날)과 종료일(오늘) 계산
  let startDate = new Date(project.created_at);
  commits.forEach(c => {
    const cDate = new Date(c.commit.author.date);
    if (cDate < startDate) startDate = cDate;
  });

  // [NEW] 2. startDate부터 오늘까지 모든 날짜를 순회하며 0으로 초기화
  const today = new Date();
  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (!timelineMap.has(dateStr)) {
      timelineMap.set(dateStr, { commit: 0, pr: 0 });
    }
  }
  
  // 혹시 타임존(UTC -> KST) 차이로 오늘 날짜가 생성 안 될 경우를 대비해 오늘 날짜 명시적 추가
  const todayStr = today.toISOString().split('T')[0];
  if (!timelineMap.has(todayStr)) {
    timelineMap.set(todayStr, { commit: 0, pr: 0 });
  }

  // 3. 실제 커밋과 PR 데이터를 덮어쓰며 카운트 증가
  commits.forEach(c => {
    const dateStr = new Date(c.commit.author.date).toISOString().split('T')[0];
    // 극단적으로 과거의 예외 데이터가 있을 수 있으므로 방어 로직 추가
    if (!timelineMap.has(dateStr)) timelineMap.set(dateStr, { commit: 0, pr: 0 });
    timelineMap.get(dateStr).commit += 1;
  });
  prs.forEach(pr => {
    const dateStr = new Date(pr.created_at).toISOString().split('T')[0];
    if (!timelineMap.has(dateStr)) timelineMap.set(dateStr, { commit: 0, pr: 0 });
    timelineMap.get(dateStr).pr += 1;
  });

  // 4. 날짜순 정렬
  const timelineData = Array.from(timelineMap.entries())
    .map(([date, counts]) => ({ date, commitCount: counts.commit, prCount: counts.pr }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const contributorMap = new Map();
  commits.forEach(c => {
    const authorLogin = c.author ? c.author.login : (c.commit.author ? c.commit.author.name : 'Unknown');
    if (!contributorMap.has(authorLogin)) contributorMap.set(authorLogin, { login: authorLogin, commitCount: 0, prCount: 0 });
    contributorMap.get(authorLogin).commitCount += 1;
  });
  prs.forEach(pr => {
    const authorLogin = pr.user ? pr.user.login : 'Unknown';
    if (contributorMap.has(authorLogin)) contributorMap.get(authorLogin).prCount += 1;
  });

  const contributorsArray = Array.from(contributorMap.values())
    .map(c => ({
      ...c,
      commitPercentage: totalCommits > 0 ? Math.round((c.commitCount / totalCommits) * 100) : 0
    }))
    .sort((a, b) => b.commitCount - a.commitCount);

  return {
    metrics: { totalCommits, totalPRs, mergedPRs, openPRs },
    contributors: contributorsArray,
    timelineData,
    rawPrs: prs.slice(0, 5).map(pr => ({ title: pr.title, state: pr.state, author: pr.user ? pr.user.login : 'Unknown', date: new Date(pr.created_at).toLocaleDateString('ko-KR') })),
    geminiData: {
      lightWeightPrs: prs.slice(0, 10).map(pr => ({ title: pr.title, state: pr.state, author: pr.user ? pr.user.login : 'Unknown' })),
      lightWeightContributors: contributorsArray.map(c => ({ login: c.login, percent: c.commitPercentage })),
      totalCommits,
      totalPRs
    }
  };
}


// --- [API 엔드포인트 로직] ---

exports.createProject = async (req, res) => {
  const { title, github_url, class_id, project_goal } = req.body;
  if (!title || !github_url || !class_id || !project_goal) return res.status(400).json({ error: '필수 항목 누락' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '인증 토큰 누락' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'STUDENT') return res.status(403).json({ error: '학생 권한만 가능합니다.' });

    const newProject = await prisma.projects.create({
      data: { title: title.trim(), github_url: github_url.trim(), project_goal: project_goal.trim(), user_id: decoded.userId, class_id: class_id }
    });
    return res.status(201).json(newProject);
  } catch (error) {
    return res.status(500).json({ error: '생성 실패' });
  }
};

exports.getProjects = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '인증 토큰 누락' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userProjects = await prisma.projects.findMany({
      where: { user_id: decoded.userId },
      include: { class: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });
    return res.status(200).json(userProjects);
  } catch (error) {
    return res.status(500).json({ error: '조회 실패' });
  }
};

exports.getClassProjects = async (req, res) => {
  const { classId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '인증 토큰 누락' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'PROFESSOR') {
      const projects = await prisma.projects.findMany({ where: { class_id: classId }, orderBy: { created_at: 'desc' } });
      return res.status(200).json(projects);
    } else if (decoded.role === 'STUDENT') {
      const projects = await prisma.projects.findMany({ where: { class_id: classId, user_id: decoded.userId }, orderBy: { created_at: 'desc' } });
      return res.status(200).json(projects);
    } else {
      return res.status(403).json({ error: '권한 없음' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.getProjectReport = async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '인증 토큰 누락' });

  try {
    const project = await prisma.projects.findUnique({ where: { id: id }, include: { user: true } });
    if (!project) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });

    const ghData = await getGithubMetricsData(project);

    return res.status(200).json({
      projectTitle: project.title,
      githubUrl: project.github_url,
      projectGoal: project.project_goal,
      metrics: ghData.metrics,
      contributors: ghData.contributors,
      timelineData: ghData.timelineData,
      rawPrs: ghData.rawPrs,
      analysis: {
        summary: project.ai_summary || "아직 교수님이 AI 진단을 수행하지 않았습니다.",
        evaluation: project.ai_evaluation || "평가 대기 중입니다."
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.analyzeProjectPRs = async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '인증 토큰 누락' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'PROFESSOR') return res.status(403).json({ error: '교수 권한만 AI 재분석을 수행할 수 있습니다.' });

    const { customPrompt } = req.body;
    const project = await prisma.projects.findUnique({ where: { id: id }, include: { user: true } });
    const ghData = await getGithubMetricsData(project);

    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY 누락');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const studentGoal = project.project_goal ? `\n\n[학생이 설정한 프로젝트 목표]\n"${project.project_goal}"\n위 목표를 달성하기 위해 현재의 커밋/PR 협업 지표가 적절한지 평가에 반드시 반영하십시오.` : "";
    const professorRequirement = customPrompt ? `\n\n[교수님 특별 요청사항]\n"${customPrompt}"` : "";

    const prompt = `당신은 대학교 컴퓨터공학 교수를 보조하는 AI 조교입니다. 학생 팀 프로젝트의 GitHub 데이터를 객관적으로 평가하십시오.${studentGoal}${professorRequirement}\n[데이터]\n커밋수:${ghData.geminiData.totalCommits}, PR수:${ghData.geminiData.totalPRs}\n팀원비중:${JSON.stringify(ghData.geminiData.lightWeightContributors)}\n최근PR:${JSON.stringify(ghData.geminiData.lightWeightPrs)}\n\n[요구사항]\n1. 'summary': 정량적 진행 요약 (1문장)\n2. 'evaluation': 학생의 목표 달성 여부 및 협업/품질 상태 분석 (2문장)\n반드시 {"summary": "요약", "evaluation": "평가"} JSON 형태로만 응답하십시오.`;

    const result = await model.generateContent(prompt);
    const cleanJsonStr = result.response.text().trim().replace(/```json/gi, '').replace(/```/g, '').trim();
    const aiAnalysis = JSON.parse(cleanJsonStr);

    const summaryMessage = aiAnalysis.summary || "AI 요약 실패";
    const evalMessage = aiAnalysis.evaluation || "AI 평가 실패";

    await prisma.projects.update({
      where: { id: id },
      data: { ai_summary: summaryMessage, ai_evaluation: evalMessage, last_analyzed_at: new Date(), last_commit_count: ghData.geminiData.totalCommits }
    });

    return res.status(200).json({
      projectTitle: project.title,
      githubUrl: project.github_url,
      projectGoal: project.project_goal,
      metrics: ghData.metrics,
      contributors: ghData.contributors,
      timelineData: ghData.timelineData,
      rawPrs: ghData.rawPrs,
      analysis: { summary: summaryMessage, evaluation: evalMessage }
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};