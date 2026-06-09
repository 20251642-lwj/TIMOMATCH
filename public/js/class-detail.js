let currentClassId = null;
let currentUserRole = null;
let targetProjectId = null;
let selectedCategories = new Set(); 

function initPage(payload) {
  currentUserRole = payload.role;
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

    return `
      <div class="list-item" style="padding: 24px; display: flex; flex-direction: column; align-items: stretch;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <strong style="font-size:18px; display:block; margin-bottom:6px; cursor:pointer;" onclick="location.href='/report.html?projectId=${p.id}'">${p.title}</strong>
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
  
  // 학생이 이 과목에 아직 프로젝트를 제출하지 않은 경우
  if (projects.length === 0) {
    container.innerHTML = `
      <div class="section-card" style="text-align:center; padding:48px 24px; background:var(--glass-bg);">
        <div style="font-size:48px; margin-bottom:16px;">🚀</div>
        <h3 style="margin-bottom:8px;">아직 프로젝트를 제출하지 않으셨습니다.</h3>
        <p style="color:var(--text-secondary); margin-bottom:24px;">이 과목에서 평가받을 팀 프로젝트 깃허브 저장소를 연동해주세요.</p>
        <button class="btn-submit" onclick="openSubmitModal()" style="height:48px; padding:0 32px; font-size:15px; width:auto;">+ 새 프로젝트 제출하기</button>
      </div>
    `;
    return;
  }

  // 학생이 이미 제출한 경우
  const p = projects[0];
  const hasAiData = !!p.ai_summary;
  const summaryContent = hasAiData
    ? `<div style="margin-top: 16px; padding: 16px; background: rgba(33, 0, 93, 0.04); border-radius: 8px; border: 1px solid var(--primary-container);">
         <strong style="font-size:13px; color:var(--primary-bg); display:block; margin-bottom:8px;">[최근 AI 요약]</strong>
         <p style="margin:0; font-size:14px; color:var(--text-primary); line-height:1.6;">${p.ai_summary}</p>
       </div>`
    : `<p style="margin: 16px 0 0 0; font-size:13px; color:var(--text-disabled);">아직 교수님이 AI 진단을 수행하지 않았습니다.</p>`;

  container.innerHTML = `
    <div class="list-item" style="padding: 24px; display: flex; flex-direction: column; align-items: stretch; border-color:var(--card-border-selected);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span class="class-badge" style="margin-bottom:8px;">제출 완료</span>
          <strong style="font-size:18px; display:block; margin-bottom:6px;">${p.title}</strong>
          <a href="${p.github_url}" target="_blank" style="font-size:13px; color:var(--primary-bg); text-decoration:none; font-weight:600;">${p.github_url}</a>
        </div>
        <button class="btn-submit" onclick="location.href='/report.html?projectId=${p.id}'" style="height:44px; padding:0 20px; font-size:13px; font-weight:700; width:auto;">상세 리포트 보러가기</button>
      </div>
      ${summaryContent}
    </div>
  `;
}

// --- [학생 전용] 프로젝트 제출 모달 로직 ---
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
    // URL에 있는 현재 과목 ID를 자동으로 주입
    body: JSON.stringify({ title, github_url, class_id: currentClassId, project_goal })
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '프로젝트 제출에 실패했습니다.');
    alert('프로젝트가 성공적으로 제출되었습니다!');
    closeSubmitModal();
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