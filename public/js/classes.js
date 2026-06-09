// public/js/classes.js

let currentRole = null;

function initPage(payload) {
  currentRole = payload.role;
  setupVisibilityByRole();
  fetchClassesData(); // 통일된 단일 호출
}

function setupVisibilityByRole() {
  if (currentRole === 'PROFESSOR') {
    document.getElementById('pageTitle').innerText = '과목 및 프로젝트 관리';
    document.getElementById('pageDescription').innerText = '새 강좌를 개설하고 과목에 입장하여 학생들의 현황을 관리하세요.';
    document.getElementById('profActionCard').style.display = 'block';
    document.getElementById('listCardTitle').innerText = '내가 개설한 과목 목록';
  } else if (currentRole === 'STUDENT') {
    document.getElementById('pageTitle').innerText = '수강 과목 및 프로젝트';
    document.getElementById('pageDescription').innerText = '과목에 입장하여 깃허브 저장소를 연동하고 리포트를 확인하세요.';
    document.getElementById('studentActionCard').style.display = 'block';
    document.getElementById('listCardTitle').innerText = '내가 수강 중인 과목 목록';
  }
}

// 클립보드 복사 유틸리티
window.copyCode = function(element, codeText) {
  navigator.clipboard.writeText(codeText).then(() => {
    const originalText = element.innerText;
    element.innerText = '복사 완료!';
    element.classList.add('copied');
    element.title = '클립보드에 복사되었습니다';
    setTimeout(() => {
      element.innerText = originalText;
      element.classList.remove('copied');
      element.title = '클릭하여 복사';
    }, 1500);
  }).catch(err => {
    console.error('클립보드 복사 실패:', err);
    alert('복사 기능을 지원하지 않는 환경입니다.');
  });
};

function fetchClassesData() {
  const token = localStorage.getItem('timo_jwt');
  const container = document.getElementById('classListContainer');

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
      renderProfessorClasses(data.classes, container);
    } else if (data.role === 'STUDENT') {
      renderStudentClasses(data.classes, data.projects, container);
    }
  })
  .catch(err => {
    container.innerHTML = `<p style="color:#BA1A1A;">데이터 로드 오류: ${err.message}</p>`;
  });
}

// [교수 도메인]
function handleCreateClass() {
  const className = document.getElementById('classNameInput').value.trim();
  const resultBox = document.getElementById('creationResult');
  const token = localStorage.getItem('timo_jwt');

  if (!className) return alert('과목 이름을 입력해주세요.');

  fetch('/api/classes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name: className })
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '과목 개설 실패');
    resultBox.style.display = 'block';
    resultBox.className = 'result-alert alert-success';
    resultBox.innerHTML = `
      <strong style="display:block; margin-bottom:4px;">과목 생성 성공</strong>
      과목명: ${data.name}<br>
      초대 코드: <span class="code-badge" onclick="copyCode(this, '${data.code}')" title="클릭하여 복사">${data.code}</span>
    `;
    document.getElementById('classNameInput').value = '';
    fetchClassesData();
  })
  .catch(err => {
    resultBox.style.display = 'block';
    resultBox.className = 'result-alert alert-danger';
    resultBox.innerText = `오류: ${err.message}`;
  });
}

function renderProfessorClasses(classes, container) {
  if (!classes || classes.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);">현재 개설된 과목이 없습니다.</p>';
    return;
  }
  let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">';
  classes.forEach(c => {
    html += `
      <div class="list-item" style="padding: 24px; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; justify-content: space-between; aspect-ratio: 4/3;" 
           onclick="location.href='/class-detail.html?classId=${c.id}'" onmouseover="this.style.background='var(--card-hover)'" onmouseout="this.style.background='var(--glass-bg)'">
        <div>
          <span class="class-badge" style="margin-bottom:12px;" onclick="event.stopPropagation(); copyCode(this, '${c.code}')" title="클릭하여 복사">${c.code}</span>
          <strong style="font-size:18px; display:block; margin-bottom:8px; line-height:1.4;">${c.name}</strong>
        </div>
        <div style="margin-top: auto; border-top: 1px solid var(--card-border); padding-top: 16px;">
          <span style="font-size:13px; font-weight:700; color:var(--primary-bg);">학생 프로젝트 관리 (입장) →</span>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

// [학생 도메인]
function handleEnrollClass() {
  const code = document.getElementById('inviteCode').value.trim().toUpperCase();
  const msgElement = document.getElementById('enrollMessage');
  const token = localStorage.getItem('timo_jwt');

  if (!code) return alert('초대 코드를 입력하세요.');

  fetch('/api/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ code: code })
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '등록 실패');
    msgElement.style.display = 'block';
    msgElement.style.color = '#0F5132';
    msgElement.innerText = `${data.targetClass.name} 과목 수강 등록 완료`;
    document.getElementById('inviteCode').value = '';
    fetchClassesData();
  })
  .catch(err => {
    msgElement.style.display = 'block';
    msgElement.style.color = '#BA1A1A';
    msgElement.innerText = `등록 실패: ${err.message}`;
  });
}

function renderStudentClasses(classes, projects, container) {
  if (!classes || classes.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);">현재 수강 중인 과목이 없습니다.</p>';
    return;
  }
  let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">';
  classes.forEach(c => {
    const myProject = projects ? projects.find(p => p.class_id === c.id) : null;
    const clickAction = `location.href='/class-detail.html?classId=${c.id}'`;
    const statusColor = myProject ? 'var(--primary-bg)' : 'var(--text-disabled)';
    const statusText = myProject ? '제출 완료 (상세 보기 →)' : '미제출 (입장하여 제출하기)';

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
  container.innerHTML = html;
}