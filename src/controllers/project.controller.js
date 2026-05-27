const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

exports.createProject = async (req, res) => {
  const { title, github_url, class_id } = req.body;

  if (!title || !github_url || !class_id) {
    return res.status(400).json({ error: '프로젝트 이름, GitHub 레포지토리, 제출 대상 과목은 필수입니다.' });
  }

  const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/;
  if (!githubRegex.test(github_url)) {
    return res.status(400).json({ error: '올바른 GitHub 레포지토리 주소 형식이 아닙니다.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: '인증 토큰 누락' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'STUDENT') {
      return res.status(403).json({ error: '프로젝트 제출은 학생 권한만 가능합니다.' });
    }

    // [NEW] 방어적 프로그래밍: 실제 수강 중인 과목인지 교차 검증
    const studentProfile = await prisma.student_profiles.findUnique({
      where: { user_id: decoded.userId },
      include: { enrolled_classes: true }
    });

    if (!studentProfile) {
      return res.status(404).json({ error: '학생 프로필을 찾을 수 없습니다.' });
    }

    const isEnrolled = studentProfile.enrolled_classes.some(c => c.id === class_id);
    if (!isEnrolled) {
      return res.status(403).json({ error: '본인이 수강 중인 과목에만 프로젝트를 제출할 수 있습니다.' });
    }

    const newProject = await prisma.projects.create({
      data: {
        title: title.trim(),
        github_url: github_url.trim(),
        user_id: decoded.userId, // 프로젝트는 스키마상 users 테이블을 직접 참조함
        class_id: class_id 
      }
    });

    return res.status(201).json(newProject);
  } catch (error) {
    console.error('Project Creation Error:', error.message);
    return res.status(401).json({ error: '인증 및 처리 실패' });
  }
};

exports.getProjects = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userProjects = await prisma.projects.findMany({
      where: { user_id: decoded.userId },
      // [NEW] 프론트엔드에서 프로젝트 카드에 과목명을 바로 표시할 수 있도록 Join(include) 추가
      include: { class: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });

    return res.status(200).json(userProjects);
  } catch (error) {
    console.error('Project Fetch Error:', error.message);
    return res.status(401).json({ error: '데이터를 불러오는 중 오류가 발생했습니다.' });
  }
};

// src/controllers/project.controller.js 하단에 추가

const crypto = require('crypto');
const axios = require('axios');

// 토큰 복호화 유틸리티 함수
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

// GitHub URL 파싱 유틸리티 함수
function parseGithubUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace('.git', '') };
}

// 특정 과목 내 프로젝트 목록 조회 (교수용)
exports.getClassProjects = async (req, res) => {
  const { classId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '인증 토큰 누락' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'PROFESSOR') return res.status(403).json({ error: '권한 없음' });

    const projects = await prisma.projects.findMany({
      where: { class_id: classId },
      orderBy: { created_at: 'desc' }
    });

    return res.status(200).json(projects);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// src/controllers/project.controller.js (부분 수정)

// 실시간 PR 및 커밋 수집, AI 통합 리포트 생성 API
exports.analyzeProjectPRs = async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '인증 토큰 누락' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'PROFESSOR') return res.status(403).json({ error: '교수 계정만 분석 가능합니다.' });

    // 1. 프로젝트 및 토큰 정보 조회
    const project = await prisma.projects.findUnique({
      where: { id: id },
      include: { user: true }
    });

    if (!project || !project.user || !project.user.github_token) {
      return res.status(400).json({ error: '프로젝트 또는 깃허브 연동 정보가 없습니다.' });
    }

    const decryptedToken = decryptGithubToken(project.user.github_token);
    const repoInfo = parseGithubUrl(project.github_url);
    if (!repoInfo) return res.status(400).json({ error: '올바르지 않은 저장소 주소입니다.' });

    const authConfig = {
      headers: { Authorization: `Bearer ${decryptedToken}`, Accept: 'application/vnd.github.v3+json' }
    };

    // 2. PR 데이터와 커밋 데이터를 병렬로 수집 (속도 최적화)
    const [prRes, commitRes] = await Promise.all([
      axios.get(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/pulls?state=all&per_page=30`, authConfig).catch(() => ({ data: [] })),
      axios.get(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/commits?per_page=100`, authConfig).catch(() => ({ data: [] }))
    ]);

    const prs = prRes.data;
    const commits = commitRes.data;

    // 3. 정량 데이터 가공 (메트릭 산출)
    const totalPRs = prs.length;
    const mergedPRs = prs.filter(pr => pr.merged_at !== null).length;
    const openPRs = prs.filter(pr => pr.state === 'open').length;
    const closedPRs = totalPRs - mergedPRs - openPRs;
    const totalCommits = commits.length;

    // 4. 팀원별 기여도(커밋 비중) 분석 알고리즘
    const contributorMap = new Map();
    
    commits.forEach(c => {
      // 작성자 정보가 없는 커밋(로컬 설정 누락 등) 방어
      const authorLogin = c.author ? c.author.login : (c.commit.author ? c.commit.author.name : 'Unknown');
      
      if (!contributorMap.has(authorLogin)) {
        contributorMap.set(authorLogin, { login: authorLogin, commitCount: 0, prCount: 0 });
      }
      contributorMap.get(authorLogin).commitCount += 1;
    });

    prs.forEach(pr => {
      const authorLogin = pr.user ? pr.user.login : 'Unknown';
      if (contributorMap.has(authorLogin)) {
        contributorMap.get(authorLogin).prCount += 1;
      }
    });

    const contributorsArray = Array.from(contributorMap.values())
      .map(c => ({
        ...c,
        commitPercentage: totalCommits > 0 ? Math.round((c.commitCount / totalCommits) * 100) : 0
      }))
      .sort((a, b) => b.commitCount - a.commitCount); // 커밋 수 내림차순 정렬

    // 5. 스마트 평가 멘트 생성 (스마트 폴백 로직 탑재)
    let summaryMessage = `${project.title} 프로젝트는 현재까지 총 ${totalCommits}개의 커밋과 ${totalPRs}개의 PR을 기록했습니다. `;
    let evalMessage = "";
    
    // 지니 계수(불평등 지수) 간이 적용: 1위 기여자의 비중 확인
    const topContributorShare = contributorsArray.length > 0 ? contributorsArray[0].commitPercentage : 0;
    const isImbalanced = contributorsArray.length > 1 && topContributorShare > 70; // 1명이 70% 이상 독식

    if (totalPRs === 0) {
      // PR 0개 상황: Direct Commit 폴백
      if (totalCommits > 0) {
        summaryMessage += "안정적인 커밋 이력이 존재하나, 코드 리뷰(PR) 절차 없이 메인 브랜치에 직접 병합(Direct Commit)하고 있습니다.";
        if (isImbalanced) {
          evalMessage = `[경고] PR 절차 누락 및 작업 불균형. '${contributorsArray[0].login}' 학생에게 커밋 부하가 ${topContributorShare}% 집중되어 있습니다. 팀워크 개선이 시급합니다.`;
        } else {
          evalMessage = "팀원 간 커밋 기여도는 비교적 균등하나, 협업 프로세스 정립을 위해 Pull Request 기반의 브랜치 전략 도입을 권장합니다.";
        }
      } else {
        summaryMessage += "유효한 개발 데이터가 없습니다.";
        evalMessage = "형상 관리가 전혀 이루어지지 않고 있습니다.";
      }
    } else {
      // PR 존재 상황
      const mergeRate = Math.round((mergedPRs / totalPRs) * 100);
      summaryMessage += `메인 코드 병합률은 ${mergeRate}%입니다.`;
      
      if (isImbalanced) {
        evalMessage = `PR 절차를 활용하고 있으나, 특정 인원('${contributorsArray[0].login}')의 기여도가 비정상적으로 높습니다(${topContributorShare}%). 코드 리뷰는 원활한지, 작업 분배가 적절한지 확인이 필요합니다.`;
      } else if (mergeRate >= 70) {
        evalMessage = "팀원 간 작업 분배가 안정적이며, 활발한 코드 교류와 리뷰(PR)를 통해 성공적인 협업을 수행하고 있습니다. 훌륭합니다.";
      } else {
        evalMessage = "정상적인 협업 프로세스를 따르고 있으나, 병합(Merge)되지 못하고 방치되거나 거절된 PR 비중이 높습니다. 의사소통 강화를 권장합니다.";
      }
    }

    return res.status(200).json({
      projectTitle: project.title,
      githubUrl: project.github_url,
      metrics: {
        totalCommits: totalCommits,
        totalPRs: totalPRs,
        mergedPRs: mergedPRs,
        openPRs: openPRs
      },
      contributors: contributorsArray, // 프론트엔드에서 렌더링할 팀원 통계 배열
      analysis: {
        summary: summaryMessage,
        evaluation: evalMessage
      },
      rawPrs: prs.slice(0, 5).map(pr => ({
        title: pr.title,
        state: pr.state,
        author: pr.user.login,
        date: new Date(pr.created_at).toLocaleDateString('ko-KR')
      }))
    });

  } catch (error) {
    console.error('Realtime Analysis Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};