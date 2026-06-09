// public/js/report.js

let currentProjectId = null;
let timelineChartInstance = null;
let currentUserRole = null;
let currentFeedbackAction = { type: null, id: null };

function initPage(payload) {
  currentUserRole = payload.role;
  
  if (currentUserRole !== 'PROFESSOR' && currentUserRole !== 'STUDENT') {
    alert('접근 권한이 없습니다.');
    window.location.replace('/dashboard.html');
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  currentProjectId = urlParams.get('projectId');

  if (!currentProjectId) {
    alert('잘못된 접근입니다.');
    window.history.back();
    return;
  }

  // 교수 권한일 때만 추가 액션 버튼들 활성화
  if (currentUserRole === 'PROFESSOR') {
    document.getElementById('btnCreateFeedback').style.display = 'inline-block';
    document.getElementById('btnForceAnalyze').style.display = 'inline-block';
  }

  // [핵심 변경] 모달에서 프롬프트를 넘겨받은 상태라면 강제 분석(POST), 아니면 단순 읽기(GET)
  const customPrompt = sessionStorage.getItem('timo_custom_prompt');
  if (customPrompt) {
    sessionStorage.removeItem('timo_custom_prompt');
    fetchAndAnalyzeReport(customPrompt);
  } else {
    fetchReadonlyReport();
  }

  fetchFeedbacks();
}

// 1. [학생/교수 공통] 읽기 전용 (DB 캐싱 데이터 및 실시간 깃허브 그래프만 로드)
function fetchReadonlyReport() {
  const token = localStorage.getItem('timo_jwt');
  
  fetch(`/api/projects/${currentProjectId}/report`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (!res.ok) throw new Error('리포트 데이터를 불러올 수 없습니다.');
    return res.json();
  })
  .then(data => renderReportData(data))
  .catch(err => {
    alert(`오류: ${err.message}`);
    window.history.back();
  });
}

// 2. [교수 전용] 토큰을 소모하여 Gemini API 강제 재호출
function fetchAndAnalyzeReport(customPromptStr = "") {
  const token = localStorage.getItem('timo_jwt');
  
  document.getElementById('loadingOverlay').style.display = 'flex';
  const statusTxt = document.getElementById('loadingStatus');
  setTimeout(() => { if(statusTxt) statusTxt.innerText = "Commit 및 PR 내역 통합 파싱 중..."; }, 1200);
  setTimeout(() => { if(statusTxt) statusTxt.innerText = "AI 기여도 분석 및 요약서 생성 중..."; }, 2400);

  fetch(`/api/projects/${currentProjectId}/analyze`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customPrompt: customPromptStr }) 
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  })
  .then(data => {
    document.getElementById('loadingOverlay').style.display = 'none';
    renderReportData(data);
  })
  .catch(err => {
    document.getElementById('loadingOverlay').style.display = 'none';
    alert(`분석 실패: ${err.message}`);
    fetchReadonlyReport(); // 실패 시 기존 데이터라도 보여주기 위해 롤백
  });
}

// 리포트 내부의 버튼을 눌러 강제 재분석 시도
function forceAnalyzeFromReport() {
  const customPrompt = prompt("AI에게 전달할 특별한 지시사항이 있다면 입력하세요.\n(없으면 비워두고 확인을 누르세요)");
  if (customPrompt !== null) {
    fetchAndAnalyzeReport(customPrompt.trim());
  }
}

// --- DOM 렌더링 로직 ---
function renderReportData(data) {
  document.getElementById('projectTitle').innerText = `${data.projectTitle} - 종합 보고서`;
  const linkEl = document.getElementById('githubLink');
  linkEl.href = data.githubUrl;
  linkEl.style.display = 'inline-block';

  // [NEW] 프로젝트 목표 렌더링
  if (data.projectGoal) {
    document.getElementById('goalContainer').style.display = 'block';
    document.getElementById('pGoal').innerText = data.projectGoal;
  }

  document.getElementById('mTotalCommits').innerText = data.metrics.totalCommits;
  document.getElementById('mTotalPRs').innerText = data.metrics.totalPRs;
  document.getElementById('mMerged').innerText = data.metrics.mergedPRs;
  document.getElementById('mOpen').innerText = data.metrics.openPRs;

  document.getElementById('rSummary').innerText = data.analysis.summary;
  document.getElementById('rEval').innerText = data.analysis.evaluation;

  const ctContainer = document.getElementById('contributorListContainer');
  if (!data.contributors || data.contributors.length === 0) {
    ctContainer.innerHTML = '<p style="color:var(--text-secondary); font-size:14px;">기여도 내역이 없습니다.</p>';
  } else {
    ctContainer.innerHTML = data.contributors.map(c => `
      <div class="contributor-card">
        <div class="contributor-header">
          <span class="contributor-name">${c.login}</span>
          <span class="contributor-percent">${c.commitPercentage}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width: ${c.commitPercentage}%;"></div></div>
        <div class="contributor-stats">커밋: ${c.commitCount}건 | 연관 PR: ${c.prCount}건</div>
      </div>
    `).join('');
  }

  const tlContainer = document.getElementById('prTimelineContainer');
  if (data.metrics.totalPRs === 0) {
    tlContainer.innerHTML = '<p style="color:var(--text-secondary); font-size:14px;">수집된 최신 Pull Request 내역이 없습니다.</p>';
  } else {
    tlContainer.innerHTML = data.rawPrs.map(pr => {
      const statusClass = pr.state === 'open' ? 'open' : 'closed';
      return `
        <div class="pr-item">
          <div><span class="pr-meta">${pr.author} (${pr.date})</span><div class="pr-title">${pr.title}</div></div>
          <div class="pr-status ${statusClass}">${pr.state}</div>
        </div>`;
    }).join('');
  }
  renderChart(data.timelineData);
}

function renderChart(timelineData) {
  if (!timelineData || timelineData.length === 0) return;
  const ctx = document.getElementById('timelineChart').getContext('2d');
  if (timelineChartInstance) timelineChartInstance.destroy();

  timelineChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timelineData.map(d => d.date),
      datasets: [
        { label: '커밋', data: timelineData.map(d => d.commitCount), borderColor: '#1976D2', backgroundColor: 'rgba(25, 118, 210, 0.1)', borderWidth: 2, fill: true, tension: 0.3 },
        { label: 'PR', data: timelineData.map(d => d.prCount), borderColor: '#E65100', backgroundColor: 'rgba(230, 81, 0, 0.1)', borderWidth: 2, fill: true, tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { position: 'top' } } }
  });
}

// --- 피드백 상호작용 로직 ---
function fetchFeedbacks() {
  const token = localStorage.getItem('timo_jwt');
  fetch(`/api/feedbacks/project/${currentProjectId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(feedbacks => renderFeedbacks(feedbacks))
  .catch(err => console.error("피드백 로드 에러:", err));
}

function renderFeedbacks(feedbacks) {
  const container = document.getElementById('feedbackListContainer');
  if (!feedbacks || feedbacks.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary); font-size:14px; margin:0;">아직 등록된 피드백이 없습니다.</p>';
    return;
  }

  container.innerHTML = feedbacks.map(fb => {
    let statusClass = 'status-pending'; let statusText = '대기 중 (학생 소명 필요)';
    if (fb.status === 'REPLIED') { statusClass = 'status-replied'; statusText = '학생 답변 완료 (교수 확인 대기)'; }
    if (fb.status === 'RESOLVED') { statusClass = 'status-resolved'; statusText = '해결 완료'; }

    let html = `
      <div class="feedback-item">
        <div class="feedback-header">
          <span style="font-size:13px; font-weight:700; color:var(--text-secondary);">게시일: ${new Date(fb.created_at).toLocaleDateString()}</span>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="feedback-content">${fb.content}</div>
    `;

    if (fb.student_reply) {
      html += `<div class="student-reply-box"><strong style="display:block; margin-bottom:4px; font-size:12px; opacity:0.8;">학생 소명 내용</strong>${fb.student_reply}</div>`;
    }

    const actions = [];
    if (currentUserRole === 'STUDENT' && fb.status === 'PENDING') {
      actions.push(`<button class="btn-secondary" style="height:32px; padding:0 12px; font-size:12px;" onclick="openFeedbackModal('REPLY', '${fb.id}')">소명 작성하기</button>`);
    }
    if (currentUserRole === 'PROFESSOR' && fb.status === 'REPLIED') {
      actions.push(`<button class="btn-submit" style="height:32px; padding:0 12px; font-size:12px;" onclick="resolveFeedback('${fb.id}')">수긍 및 해결 처리 (종료)</button>`);
    }
    
    if (actions.length > 0) {
      html += `<div style="display:flex; justify-content:flex-end; margin-top:8px;">${actions.join('')}</div>`;
    }
    html += `</div>`;
    return html;
  }).join('');
}

function openFeedbackModal(type, feedbackId = null) {
  currentFeedbackAction = { type, id: feedbackId };
  document.getElementById('feedbackModalTitle').innerText = type === 'CREATE' ? '새 피드백 작성' : '소명/답변 작성';
  document.getElementById('feedbackInput').value = '';
  document.getElementById('feedbackModalBackdrop').style.display = 'flex';
}

function closeFeedbackModal() {
  document.getElementById('feedbackModalBackdrop').style.display = 'none';
  currentFeedbackAction = { type: null, id: null };
}

function submitFeedbackAction() {
  const content = document.getElementById('feedbackInput').value.trim();
  if (!content) return alert('내용을 입력해주세요.');

  const token = localStorage.getItem('timo_jwt');
  const url = currentFeedbackAction.type === 'CREATE' 
    ? `/api/feedbacks/project/${currentProjectId}` 
    : `/api/feedbacks/${currentFeedbackAction.id}/reply`;

  fetch(url, {
    method: currentFeedbackAction.type === 'CREATE' ? 'POST' : 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(currentFeedbackAction.type === 'CREATE' ? { content } : { reply: content })
  })
  .then(async res => {
    if (!res.ok) throw new Error(await res.text());
    closeFeedbackModal();
    fetchFeedbacks();
  })
  .catch(err => alert("요청 실패: " + err.message));
}

function resolveFeedback(feedbackId) {
  if (!confirm('이 피드백에 대한 논의를 최종 종료(해결 처리) 하시겠습니까?')) return;
  
  const token = localStorage.getItem('timo_jwt');
  fetch(`/api/feedbacks/${feedbackId}/resolve`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(async res => {
    if (!res.ok) throw new Error(await res.text());
    fetchFeedbacks();
  })
  .catch(err => alert("종료 처리 실패: " + err.message));
}