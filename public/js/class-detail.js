let currentClassId = null;
let currentUserRole = null;
let targetProjectId = null;
let selectedCategories = new Set();
let currentUserId = null;

// JWT 토큰에서 안전하게 userId 추출
function getUserIdFromToken() {
  try {
    const token = localStorage.getItem('timo_jwt');
    if (!token) return null;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload).userId;
  } catch(e) { return null; }
}

function initPage(payload) {
  currentUserRole = payload.role;
  currentUserId = payload.userId || getUserIdFromToken();
  const urlParams = new URLSearchParams(window.location.search);
  currentClassId = urlParams.get('classId');

  if (!currentClassId) {
    alert('잘못된 접근입니다. 과목 선택이 누락되었습니다.');
    window.location.replace('/dashboard.html');
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
    if (currentUserRole === 'PROFESSOR') {
      renderProfessorView(projects, container);
    } else if (currentUserRole === 'STUDENT') {
      renderStudentView(projects, container);
    }
  })
  .catch(err => {
    container.innerHTML = `<p style="color:#BA1A1A; margin:0;">데이터 로드 오류: ${err.message}</p>`;
  });
}

function renderProfessorView(projects, container) {
  document.getElementById('classTitle').innerText = '수강생 프로젝트 목록';
  if (projects.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary); margin:0;">해당 강좌에 아직 등록된 학생 프로젝트가 없습니다.</p>';
    return;
  }

  container.innerHTML = projects.map(p => {
    const hasAiData = !!p.ai_summary;
    const summaryContent = hasAiData
      ? `<div style="margin-top: 16px; padding: 16px; background: rgba(33, 0, 93, 0.04); border-radius: 8px; border: 1px solid var(--primary-container);">
           <strong style="font-size:13px; color:var(--primary-bg); display:block; margin-bottom:8px;">[AI 핵심 요약]</strong>
           <p style="margin:0 0 8px 0; font-size:14px; color:var(--text-primary); line-height:1.6;">${p.ai_summary}</p>
           <span style="font-size:12px; color:var(--text-secondary);">마지막 분석: ${new Date(p.last_analyzed_at).toLocaleString('ko-KR')}</span>
         </div>`
      : `<p style="margin: 16px 0 0 0; font-size:13px; color:var(--text-disabled);">아직 진행된 AI 분석이 없습니다.</p>`;

    const btnText = hasAiData ? 'AI 재분석 수행' : '실시간 AI 최초 분석';
    const membersList = p.members && p.members.length > 0
        ? p.members.map(m => m.user.name + (m.role === 'LEADER' ? '(팀장)' : '')).join(', ')
        : '없음';

    return `
      <div class="list-item" style="padding: 24px; display: flex; flex-direction: column; align-items: stretch;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <strong style="font-size:18px; display:block; margin-bottom:6px; cursor:pointer;" onclick="location.href='/report.html?projectId=${p.id}'">${p.title}</strong>
            <div style="font-size:13px; color:var(--text-secondary); margin-bottom: 8px;">소속 학생: ${membersList}</div>
            <a href="${p.github_url}" target="_blank" style="font-size:13px; color:var(--primary-bg); text-decoration:none; font-weight:600;">${p.github_url}</a>
          </div>
          <button class="btn-submit" onclick="triggerLiveAnalysis('${p.id}')" style="height:44px; padding:0 20px; font-size:13px; font-weight:700; width:auto;">${btnText}</button>
        </div>
        ${summaryContent}
      </div>
    `;
  }).join('');
}

function renderStudentView(projects, container) {
  document.getElementById('classTitle').innerText = '내 프로젝트 관리';
  
  // 1. 내가 속한 프로젝트 검색 (LEADER 또는 MEMBER)
  const myProject = projects.find(p => p.members && p.members.some(m => m.user_id === currentUserId));

  if (!myProject) {
    // 2. 미제출 상태 (팀장 개설 or 팀원 합류 선택)
    let joinBtnHtml = '';
    if (projects.length > 0) {
      joinBtnHtml = `<button class="btn-secondary" onclick="openJoinModal()" style="height:48px; padding:0 32px; font-size:15px; width:auto; margin-left: 12px;">기존 팀에 합류하기</button>`;
    }

    container.innerHTML = `
      <div class="section-card" style="text-align:center; padding:48px 24px; background:var(--glass-bg);">
        <h3 style="margin-bottom:8px;">아직 소속된 프로젝트 팀이 없습니다.</h3>
        <p style="color:var(--text-secondary); margin-bottom:24px;">새로운 팀을 개설하거나, 이미 만들어진 팀에 합류하세요.</p>
        <div style="display: flex; justify-content: center;">
          <button class="btn-submit" onclick="openSubmitModal()" style="height:48px; padding:0 32px; font-size:15px; width:auto;">+ 새 팀 개설 (팀장)</button>
          ${joinBtnHtml}
        </div>
      </div>
    `;
    return;
  }

  // 3. 소속된 프로젝트가 있는 경우 상세 현황 노출
  const hasAiData = !!myProject.ai_summary;
  const summaryContent = hasAiData
    ? `<div style="margin-top: 16px; padding: 16px; background: rgba(33, 0, 93, 0.04); border-radius: 8px; border: 1px solid var(--primary-container);">
         <strong style="font-size:13px; color:var(--primary-bg); display:block; margin-bottom:8px;">[최근 AI 요약]</strong>
         <p style="margin:0; font-size:14px; color:var(--text-primary); line-height:1.6;">${myProject.ai_summary}</p>
       </div>`
    : `<p style="margin: 16px 0 0 0; font-size:13px; color:var(--text-disabled);">아직 교수님이 AI 진단을 수행하지 않았습니다.</p>`;

  const membersList = myProject.members.map(m => m.user.name + (m.role === 'LEADER' ? '(팀장)' : '')).join(', ');

  container.innerHTML = `
    <div class="list-item" style="padding: 24px; display: flex; flex-direction: column; align-items: stretch; border-color:var(--card-border-selected);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span class="class-badge" style="margin-bottom:8px;">소속 완료</span>
          <strong style="font-size:18px; display:block; margin-bottom:6px;">${myProject.title}</strong>
          <div style="font-size:13px; color:var(--text-secondary); margin-bottom: 8px;">팀원: ${membersList}</div>
          <a href="${myProject.github_url}" target="_blank" style="font-size:13px; color:var(--primary-bg); text-decoration:none; font-weight:600;">${myProject.github_url}</a>
        </div>
        <button class="btn-submit" onclick="location.href='/report.html?projectId=${myProject.id}'" style="height:44px; padding:0 20px; font-size:13px; font-weight:700; width:auto;">상세 리포트 보러가기</button>
      </div>
      ${summaryContent}
    </div>
  `;
}

// --- [학생 전용] 팀장 프로젝트 개설 로직 ---
function openSubmitModal() {
  document.getElementById('submitTitle').value = '';
  document.getElementById('submitGithubUrl').value = '';
  document.getElementById('submitGoal').value = '';
  document.getElementById('submitProjectModal').style.display = 'flex';
}

function closeSubmitModal() {
  document.getElementById('submitProjectModal').style.display = 'none';
}

function submitNewProject() {
  const title = document.getElementById('submitTitle').value.trim();
  const github_url = document.getElementById('submitGithubUrl').value.trim();
  const project_goal = document.getElementById('submitGoal').value.trim();

  if (!title || !github_url || !project_goal) {
    alert('모든 항목을 올바르게 입력해주세요.');
    return;
  }

  const token = localStorage.getItem('timo_jwt');
  fetch('/api/projects', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, github_url, class_id: currentClassId, project_goal })
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '프로젝트 생성에 실패했습니다.');
    alert('프로젝트 팀이 성공적으로 개설되었습니다!');
    closeSubmitModal();
    fetchClassProjects(); 
  })
  .catch(err => alert(`오류: ${err.message}`));
}

// --- [학생 전용] 팀원 합류 로직 ---
function openJoinModal() {
  const token = localStorage.getItem('timo_jwt');
  fetch(`/api/projects/class/${currentClassId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(projects => {
    const select = document.getElementById('joinProjectSelect');
    select.innerHTML = '<option value="">-- 합류할 팀을 선택하세요 --</option>' + 
      projects.map(p => {
        const leader = p.members.find(m => m.role === 'LEADER');
        const leaderName = leader && leader.user ? leader.user.name : '알 수 없음';
        return `<option value="${p.id}">${p.title} (개설자: ${leaderName})</option>`;
      }).join('');
    document.getElementById('joinProjectModal').style.display = 'flex';
  });
}

function closeJoinModal() {
  document.getElementById('joinProjectModal').style.display = 'none';
}

function submitJoinProject() {
  const projectId = document.getElementById('joinProjectSelect').value;
  if (!projectId) return alert('합류할 프로젝트 팀을 선택해주세요.');

  const token = localStorage.getItem('timo_jwt');
  fetch(`/api/projects/${projectId}/join`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '합류에 실패했습니다.');
    alert('프로젝트 팀에 성공적으로 합류했습니다!');
    closeJoinModal();
    fetchClassProjects();
  })
  .catch(err => alert(`오류: ${err.message}`));
}

// --- [교수 전용] 모달 및 프롬프트 커스터마이징 로직 ---
function triggerLiveAnalysis(projectId) {
  targetProjectId = projectId;
  document.getElementById('customPromptInput').value = ''; 
  selectedCategories.clear();
  document.querySelectorAll('.cat-chip').forEach(chip => chip.classList.remove('selected'));
  document.getElementById('promptModalBackdrop').style.display = 'flex';
}

function closePromptModal() {
  document.getElementById('promptModalBackdrop').style.display = 'none';
  targetProjectId = null;
}

function toggleCategory(element) {
  const val = element.getAttribute('data-val');
  if (selectedCategories.has(val)) {
    selectedCategories.delete(val);
    element.classList.remove('selected');
  } else {
    selectedCategories.add(val);
    element.classList.add('selected');
  }
}

function executeAnalysis() {
  const additionalText = document.getElementById('customPromptInput').value.trim();
  let finalPrompt = "";
  
  if (selectedCategories.size > 0) {
    finalPrompt += "다음 카테고리를 최우선으로 점검하십시오: [" + Array.from(selectedCategories).join(", ") + "]. ";
  }
  if (additionalText) {
    finalPrompt += "추가 지시사항: " + additionalText;
  }
  
  finalPrompt = finalPrompt.trim();
  if (finalPrompt) sessionStorage.setItem('timo_custom_prompt', finalPrompt);
  else sessionStorage.removeItem('timo_custom_prompt');
  
  window.location.href = `/report.html?projectId=${targetProjectId}`;
}