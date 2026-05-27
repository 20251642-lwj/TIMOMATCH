// public/js/classes.js

let currentRole = null;

// auth-guard 검증 완료 후 자동 실행될 초기화 로직
function initPage(payload) {
  currentRole = payload.role;
  setupVisibilityByRole();
  
  if (currentRole === 'PROFESSOR') {
    fetchProfessorClasses();
  } else if (currentRole === 'STUDENT') {
    fetchStudentClasses();
    fetchStudentProjects();
  }
}

function setupVisibilityByRole() {
  if (currentRole === 'PROFESSOR') {
    document.getElementById('pageTitle').innerText = '과목 관리 및 개설';
    document.getElementById('pageDescription').innerText = '새 강좌를 개설하고 초대 코드를 발급하여 학생들을 관리합니다.';
    document.getElementById('profActionCard').style.display = 'block';
    document.getElementById('listCardTitle').innerText = '내가 개설한 과목 목록';
  } else if (currentRole === 'STUDENT') {
    document.getElementById('pageTitle').innerText = '수강 과목 및 프로젝트 제출';
    document.getElementById('pageDescription').innerText = '참여 중인 과목을 확인하고 과목별 GitHub 저장소 연동을 수행합니다.';
    document.getElementById('studentActionCard').style.display = 'block';
    document.getElementById('studentProjectSection').style.display = 'block';
    document.getElementById('listCardTitle').innerText = '내가 수강 중인 과목 목록';
  }
}

// ==========================================
// [교수 도메인] 비즈니스 로직
// ==========================================
function handleCreateClass() {
  const className = document.getElementById('classNameInput').value.trim();
  const resultBox = document.getElementById('creationResult');
  const token = localStorage.getItem('timo_jwt');

  if (!className) {
    alert('과목 이름을 입력해주세요.');
    return;
  }

  fetch('/api/classes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: className })
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '과목 개설 실패');
    return data;
  })
  .then(data => {
    resultBox.style.display = 'block';
    resultBox.className = 'result-alert alert-success';
    resultBox.innerHTML = `
      <strong style="display:block; margin-bottom:4px;">과목 생성 성공</strong>
      과목명: ${data.name}<br>
      초대 코드: <span class="code-badge">${data.code}</span> (학생들에게 이 코드를 전달하세요)
    `;
    document.getElementById('classNameInput').value = '';
    fetchProfessorClasses(); // 목록 동적 리로드
  })
  .catch(err => {
    resultBox.style.display = 'block';
    resultBox.className = 'result-alert alert-danger';
    resultBox.innerText = `오류: ${err.message}`;
  });
}

function fetchProfessorClasses() {
  const token = localStorage.getItem('timo_jwt');
  const container = document.getElementById('classListContainer');

  fetch('/api/classes/managed', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  })
  .then(classes => {
    if (classes.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary); margin:0;">아직 개설한 과목이 없습니다.</p>';
      return;
    }
    
    // [시연용 업데이트] 과목 상세 대시보드로 이동하는 '과목 관리' 버튼 추가 바인딩
    container.innerHTML = classes.map(cls => `
      <div class="list-item">
        <strong>${cls.name}</strong>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div>
            <span style="font-size:12px; color:var(--text-secondary); margin-right:4px;">초대 코드:</span>
            <span class="code-badge">${cls.code}</span>
          </div>
          <button class="btn-submit" onclick="location.href='/class-detail.html?classId=${cls.id}'" style="height:32px; padding:0 12px; font-size:12px; font-weight:700;">과목 관리</button>
        </div>
      </div>
    `).join('');
  })
  .catch(err => {
    container.innerHTML = `<p style="color:#BA1A1A; margin:0;">조회 실패: ${err.message}</p>`;
  });
}

// ==========================================
// [학생 도메인] 비즈니스 로직
// ==========================================
function handleEnrollClass() {
  const code = document.getElementById('inviteCode').value.trim().toUpperCase();
  const msgElement = document.getElementById('enrollMessage');
  const token = localStorage.getItem('timo_jwt');

  if (!code) {
    alert('초대 코드를 입력하세요.');
    return;
  }

  fetch('/api/enroll', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ code: code })
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '등록 실패');
    return data;
  })
  .then(data => {
    msgElement.style.display = 'block';
    msgElement.style.color = '#0F5132';
    msgElement.innerText = `${data.targetClass.name} 과목 수강 등록 완료`;
    document.getElementById('inviteCode').value = '';
    fetchStudentClasses();
  })
  .catch(err => {
    msgElement.style.display = 'block';
    msgElement.style.color = '#BA1A1A';
    msgElement.innerText = `등록 실패: ${err.message}`;
  });
}

function fetchStudentClasses() {
  const token = localStorage.getItem('timo_jwt');

  fetch('/api/enroll', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  })
  .then(classes => {
    const container = document.getElementById('classListContainer');
    if (classes.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary); margin:0;">등록된 수강 과목이 존재하지 않습니다.</p>';
      return;
    }
    container.innerHTML = classes.map(cls => `
      <div class="list-item">
        <strong>${cls.name}</strong>
        <button class="btn-submit" onclick="openProjectForm('${cls.id}', '${cls.name}')" style="height:36px; flex:none; padding:0 16px; font-size:13px;">프로젝트 제출</button>
      </div>
    `).join('');
  })
  .catch(err => {
    document.getElementById('classListContainer').innerHTML = `<p style="color:#BA1A1A; margin:0;">조회 실패: ${err.message}</p>`;
  });
}

function openProjectForm(classId, className) {
  document.getElementById('projectFormContainer').style.display = 'block';
  document.getElementById('formTargetTitle').innerText = `[${className}] 프로젝트 연동 제출`;
  document.getElementById('selectedClassId').value = classId;
  document.getElementById('creationMessage').style.display = 'none';
  
  window.scrollTo({ top: document.getElementById('projectFormContainer').offsetTop - 20, behavior: 'smooth' });
}

function handleCreateProject() {
  const title = document.getElementById('projectTitle').value.trim();
  const githubUrl = document.getElementById('projectUrl').value.trim();
  const classId = document.getElementById('selectedClassId').value;
  const msgElement = document.getElementById('creationMessage');
  const token = localStorage.getItem('timo_jwt');

  if (!title || !githubUrl || !classId) {
    alert('모든 입력 필드를 채워주십시오.');
    return;
  }

  fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title, github_url: githubUrl, class_id: classId })
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '제출 실패');
    return data;
  })
  .then(() => {
    msgElement.style.display = 'block';
    msgElement.style.color = '#0F5132';
    msgElement.innerText = '프로젝트가 데이터베이스에 성공적으로 저장되었습니다.';
    document.getElementById('projectTitle').value = '';
    document.getElementById('projectUrl').value = '';
    fetchStudentProjects();
  })
  .catch(err => {
    msgElement.style.display = 'block';
    msgElement.style.color = '#BA1A1A';
    msgElement.innerText = `제출 실패: ${err.message}`;
  });
}

function fetchStudentProjects() {
  const token = localStorage.getItem('timo_jwt');

  fetch('/api/projects', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  })
  .then(projects => {
    const container = document.getElementById('projectListContainer');
    if (projects.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary); margin:0;">제출한 프로젝트 유효 내역이 없습니다.</p>';
      return;
    }
    container.innerHTML = projects.map(p => {
      const date = new Date(p.created_at).toLocaleDateString('ko-KR');
      return `
        <div class="project-card">
          <div class="class-badge">${p.class?.name || '소속 과목 명칭 누락'}</div>
          <h4>${p.title}</h4>
          <p>레포지토리: <a href="${p.github_url}" target="_blank" style="color:var(--primary-bg); font-weight:600;">${p.github_url}</a></p>
          <span>연동 등록일: ${date}</span>
        </div>
      `;
    }).join('');
  })
  .catch(err => {
    document.getElementById('projectListContainer').innerHTML = `<p style="color:#BA1A1A; margin:0;">조회 실패: ${err.message}</p>`;
  });
}