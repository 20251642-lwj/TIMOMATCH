// public/js/class-detail.js

let currentClassId = null;

function initPage(payload) {
  if (payload.role !== 'PROFESSOR') {
    alert('교수 전용 권한 페이지입니다.');
    window.location.replace('/dashboard.html');
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  currentClassId = urlParams.get('classId');

  if (!currentClassId) {
    alert('잘못된 접근입니다. 과목 선택이 누락되었습니다.');
    window.location.replace('/classes.html');
    return;
  }
  fetchClassProjects();
}

function fetchClassProjects() {
  const token = localStorage.getItem('timo_jwt');
  const container = document.getElementById('projectGrid');

  fetch(`/api/projects/class/${currentClassId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  })
  .then(projects => {
    if (projects.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary); margin:0;">해당 강좌에 아직 등록된 학생 프로젝트가 없습니다.</p>';
      return;
    }

    container.innerHTML = projects.map(p => `
      <div class="list-item" style="padding: 20px;">
        <div>
          <strong style="font-size:17px; display:block; margin-bottom:4px;">${p.title}</strong>
          <a href="${p.github_url}" target="_blank" style="font-size:13px; color:var(--primary-bg); text-decoration:none; font-weight:600;">${p.github_url}</a>
        </div>
        <button class="btn-submit" onclick="triggerLiveAnalysis('${p.id}')" style="height:40px; padding:0 16px; font-size:13px; font-weight:700;">실시간 AI 분석</button>
      </div>
    `).join('');
  })
  .catch(err => {
    container.innerHTML = `<p style="color:#BA1A1A; margin:0;">데이터 로드 오류: ${err.message}</p>`;
  });
}

function triggerLiveAnalysis(projectId) {
  const overlay = document.getElementById('loadingOverlay');
  const statusTxt = document.getElementById('loadingStatus');
  const token = localStorage.getItem('timo_jwt');

  overlay.style.display = 'flex';
  statusTxt.innerText = "GitHub Repository 커넥션 수립 중...";

  setTimeout(() => {
    statusTxt.innerText = "Commit 및 PR 내역 통합 파싱 중...";
  }, 1200);

  setTimeout(() => {
    statusTxt.innerText = "AI 기여도 분석 및 요약서 생성 중...";
  }, 2400);

  const apiCall = fetch(`/api/projects/${projectId}/analyze`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  });

  const delay = new Promise(resolve => setTimeout(resolve, 3200));

  Promise.all([apiCall, delay])
    .then(([result]) => {
      overlay.style.display = 'none';
      openReportModal(result);
    })
    .catch(err => {
      overlay.style.display = 'none';
      alert(`분석 실패: ${err.message}`);
    });
}

function openReportModal(data) {
  document.getElementById('reportModalBackdrop').style.display = 'flex';
  document.getElementById('modalProjectTitle').innerText = `${data.projectTitle} - AI 보고서`;
  
  // 1. 핵심 메트릭 바인딩
  document.getElementById('mTotalCommits').innerText = data.metrics.totalCommits;
  document.getElementById('mTotalPRs').innerText = data.metrics.totalPRs;
  document.getElementById('mMerged').innerText = data.metrics.mergedPRs;
  document.getElementById('mOpen').innerText = data.metrics.openPRs;

  // 2. 스마트 분석 요약 바인딩
  document.getElementById('rSummary').innerText = data.analysis.summary;
  document.getElementById('rEval').innerText = data.analysis.evaluation;

  // 3. 기여자(Contributor) 프로그레스 바 렌더링
  const ctContainer = document.getElementById('contributorListContainer');
  if (!data.contributors || data.contributors.length === 0) {
    ctContainer.innerHTML = '<p style="color:var(--text-secondary); font-size:13px; margin:0;">기여도(커밋) 내역이 없습니다.</p>';
  } else {
    ctContainer.innerHTML = data.contributors.map(c => `
      <div style="padding:12px; border:1px solid var(--card-border); border-radius:8px; background:var(--glass-bg);">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <strong style="font-size:14px; color:var(--text-primary);">${c.login}</strong>
          <span style="font-size:13px; font-weight:700; color:var(--primary-bg);">${c.commitPercentage}%</span>
        </div>
        <div style="width: 100%; background: var(--card-border); border-radius: 4px; height: 8px; overflow: hidden; margin-bottom:6px;">
          <div style="width: ${c.commitPercentage}%; background: var(--primary-bg); height: 100%;"></div>
        </div>
        <span style="font-size:12px; color:var(--text-secondary);">커밋: ${c.commitCount}건 | 연관 PR: ${c.prCount}건</span>
      </div>
    `).join('');
  }

  // 4. PR 타임라인 바인딩
  const tlContainer = document.getElementById('prTimelineContainer');
  if (data.metrics.totalPRs === 0) {
    tlContainer.innerHTML = '<p style="color:var(--text-secondary); font-size:13px; margin:0;">수집된 최신 Pull Request 내역이 없습니다. (Direct Commit 방식 사용 중)</p>';
    return;
  }

  tlContainer.innerHTML = data.rawPrs.map(pr => `
    <div style="padding:12px; border:1px solid var(--card-border); border-radius:8px; background:var(--glass-bg); display:flex; justify-content:space-between; align-items:center;">
      <div>
        <span style="font-size:11px; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:2px;">${pr.author} (${pr.date})</span>
        <strong style="font-size:14px; color:var(--text-primary);">${pr.title}</strong>
      </div>
      <span style="font-size:12px; font-weight:700; color:${pr.state === 'open' ? '#0F5132' : '#6C757D'};">
        ${pr.state.toUpperCase()}
      </span>
    </div>
  `).join('');
}

function closeReportModal() {
  document.getElementById('reportModalBackdrop').style.display = 'none';
}