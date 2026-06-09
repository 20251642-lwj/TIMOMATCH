function initPage(payload) {
  fetchDashboardData();
}

function fetchDashboardData() {
  const token = localStorage.getItem('timo_jwt');
  const container = document.getElementById('dashboardContent');

  fetch('/api/dashboard', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  })
  .then(data => {
    if (data.role === 'PROFESSOR') {
      renderProfessorDashboard(data, container);
    } else if (data.role === 'STUDENT') {
      renderStudentDashboard(data, container);
    }
  })
  .catch(err => {
    container.innerHTML = `<p style="color:#BA1A1A;">데이터 로드 오류: ${err.message}</p>`;
  });
}

function renderProfessorDashboard(data, container) {
  document.getElementById('dashboardTitle').innerText = '교수 대시보드';
  document.getElementById('dashboardSubtitle').innerText = '운영 중인 과목 목록입니다. 과목을 선택하여 학생들의 AI 진단 현황을 관리하세요.';

  if (!data.classes || data.classes.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);">현재 배정된 과목이 없습니다.</p>';
    return;
  }

  const html = data.classes.map(c => `
    <div class="list-item" style="padding: 24px; cursor: pointer; transition: all 0.2s ease;" onclick="location.href='/class-detail.html?classId=${c.id}'" onmouseover="this.style.background='var(--card-hover)'" onmouseout="this.style.background='var(--glass-bg)'">
      <div>
        <strong style="font-size:18px; display:block; margin-bottom:6px;">${c.name}</strong>
        <span style="font-size:13px; color:var(--text-secondary);">과목 코드: ${c.code}</span>
      </div>
      <button class="btn-secondary" style="height:36px; padding:0 16px; font-size:13px; pointer-events:none;">프로젝트 관리 →</button>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="section-card">
      <h3>내 강의 목록</h3>
      <div class="list-grid">${html}</div>
    </div>
  `;
}

function renderStudentDashboard(data, container) {
  document.getElementById('dashboardTitle').innerText = '학생 대시보드';
  document.getElementById('dashboardSubtitle').innerText = '수강 중인 과목과 제출한 프로젝트의 실시간 AI 진단 결과를 확인하세요.';

  let html = '';

  html += '<div class="section-card"><h3>수강 중인 과목 (입장하기)</h3>';
  if (!data.classes || data.classes.length === 0) {
    html += '<p style="color:var(--text-secondary); font-size:14px;">현재 수강 중인 과목이 없습니다.</p>';
  } else {
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">';
    
    data.classes.forEach(c => {
      const myProject = data.projects ? data.projects.find(p => p.class_id === c.id) : null;
      const clickAction = `location.href='/class-detail.html?classId=${c.id}'`;
        
      const statusColor = myProject ? 'var(--primary-bg)' : 'var(--text-disabled)';
      const statusText = myProject ? '팀 소속 완료 (상세 보기 →)' : '팀 미배정 (입장하여 합류하기)';

      html += `
        <div class="list-item" style="padding: 24px; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; justify-content: space-between; aspect-ratio: 4/3;" 
             onclick="${clickAction}" onmouseover="this.style.background='var(--card-hover)'" onmouseout="this.style.background='var(--glass-bg)'">
          <div>
            <span class="class-badge" style="margin-bottom:12px;">${c.code}</span>
            <strong style="font-size:18px; display:block; margin-bottom:8px; line-height:1.4;">${c.name}</strong>
          </div>
          <div style="margin-top: auto; border-top: 1px solid var(--card-border); padding-top: 16px;">
            <span style="font-size:13px; font-weight:700; color:${statusColor};">${statusText}</span>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }
  html += '</div>';

  html += '<div class="section-card" style="margin-top:24px;"><h3>내 프로젝트 팀 현황 요약</h3>';
  if (!data.projects || data.projects.length === 0) {
    html += '<p style="color:var(--text-secondary); font-size:14px;">소속된 프로젝트 팀이 없습니다.</p>';
  } else {
    html += '<div class="list-grid">' + data.projects.map(p => {
      const className = p.class ? p.class.name : '지정되지 않음';
      
      // [NEW] 팀원 정보 문자열 추출
      const membersList = p.members && p.members.length > 0
        ? p.members.map(m => m.user.name + (m.role === 'LEADER' ? '(팀장)' : '')).join(', ')
        : '소속 팀원 없음';

      const hasAiData = !!p.ai_summary;
      const summaryContent = hasAiData
        ? `<div style="margin-top: 16px; padding: 16px; background: rgba(33, 0, 93, 0.04); border-radius: 8px; border: 1px solid var(--primary-container);">
             <strong style="font-size:13px; color:var(--primary-bg); display:block; margin-bottom:8px;">[최근 AI 요약]</strong>
             <p style="margin:0; font-size:14px; color:var(--text-primary); line-height:1.6;">${p.ai_summary}</p>
           </div>`
        : `<p style="margin: 16px 0 0 0; font-size:13px; color:var(--text-disabled);">아직 교수님이 AI 진단을 수행하지 않았습니다.</p>`;

      return `
        <div class="list-item" style="padding: 24px; display: flex; flex-direction: column; align-items: stretch;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span class="class-badge" style="margin-bottom:8px;">${className}</span>
              <strong style="font-size:18px; display:block; margin-bottom:6px;">${p.title}</strong>
              <div style="font-size:13px; color:var(--text-secondary); margin-bottom: 8px;">팀원: ${membersList}</div>
              <a href="${p.github_url}" target="_blank" style="font-size:13px; color:var(--primary-bg); text-decoration:none; font-weight:600;">${p.github_url}</a>
            </div>
            <button class="btn-submit" onclick="location.href='/report.html?projectId=${p.id}'" style="height:44px; padding:0 20px; font-size:13px; font-weight:700; width:auto;">상세 리포트 보기</button>
          </div>
          ${summaryContent}
        </div>
      `;
    }).join('') + '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
}