// public/js/student-home.js

// --- [1] 초기 로드 및 인증 검증 ---
window.onload = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  if (tokenFromUrl) {
    localStorage.setItem('timo_jwt', tokenFromUrl);
    window.history.replaceState({}, document.title, "/student-home.html");
  }

  const jwt = localStorage.getItem('timo_jwt');
  if (!jwt) {
    alert('접근 권한이 없습니다.');
    location.href = '/';
    return;
  }

  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    if (payload.role !== 'STUDENT') {
      alert('학생 전용 페이지입니다.');
      location.href = '/prof-home.html';
    }

    // 인증 통과 후 데이터 로드
    fetchMyClasses(jwt);
    fetchMyProjects(jwt);
  } catch (error) {
    handleLogout();
  }
};

function handleLogout() {
  localStorage.removeItem('timo_jwt');
  location.href = '/';
}

// --- [2] 수강 등록 및 과목 조회 ---
function enrollClass() {
  const code = document.getElementById('inviteCode').value.toUpperCase();
  const msgElement = document.getElementById('enrollMessage');
  const jwt = localStorage.getItem('timo_jwt');

  if (!code) {
    alert('초대 코드를 입력하세요.');
    return;
  }

  fetch('/api/enroll', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify({ code: code })
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  })
  .then(data => {
    msgElement.style.display = 'block';
    msgElement.style.color = '#0F5132';
    msgElement.innerText = `${data.targetClass.name} 과목에 등록되었습니다!`;
    document.getElementById('inviteCode').value = '';
    
    // 성공 시 수강 목록 즉시 새로고침
    fetchMyClasses(jwt);
  })
  .catch(err => {
    msgElement.style.display = 'block';
    msgElement.style.color = '#BA1A1A';
    msgElement.innerText = `등록 실패: ${err.message}`;
  });
}

function fetchMyClasses(token) {
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
    const list = document.getElementById('classList');
    list.innerHTML = '';
    if (classes.length === 0) {
      list.innerHTML = '<p style="color: #49454F;">아직 등록된 과목이 없습니다.</p>';
      return;
    }
    classes.forEach(cls => {
      list.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid #CAC4D0; border-radius: 12px; background: white;">
          <strong style="font-size: 18px; color: #1D1B20;">${cls.name}</strong>
          <button onclick="openProjectForm('${cls.id}', '${cls.name}')" style="background: #21005D; color: white; border: none; padding: 8px 16px; border-radius: 100px; cursor: pointer; font-weight: 600;">프로젝트 제출</button>
        </div>
      `;
    });
  })
  .catch(err => {
    document.getElementById('classList').innerHTML = `<p style="color: #BA1A1A;">과목을 불러오지 못했습니다: ${err.message}</p>`;
  });
}

// --- [3] 프로젝트 폼 제어 및 생성 ---
function openProjectForm(classId, className) {
  document.getElementById('projectFormContainer').style.display = 'block';
  document.getElementById('formTargetTitle').innerText = `[${className}] 프로젝트 연동`;
  document.getElementById('selectedClassId').value = classId;
  document.getElementById('creationMessage').style.display = 'none';
  
  // 폼 위치로 스크롤 이동
  window.scrollTo({ top: document.getElementById('projectFormContainer').offsetTop - 20, behavior: 'smooth' });
}

function createNewProject() {
  const title = document.getElementById('projectTitle').value;
  const githubUrl = document.getElementById('projectUrl').value;
  const classId = document.getElementById('selectedClassId').value;
  const msgElement = document.getElementById('creationMessage');
  const jwt = localStorage.getItem('timo_jwt');

  if (!title || !githubUrl) {
    alert('모든 필드를 입력해주세요.');
    return;
  }

  if (!classId) {
    alert('프로젝트를 제출할 과목을 먼저 선택해주세요.');
    return;
  }

  fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify({ title, github_url: githubUrl, class_id: classId })
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '생성 실패');
    return data;
  })
  .then(data => {
    msgElement.style.display = 'block';
    msgElement.style.color = '#0F5132';
    msgElement.innerText = `프로젝트가 성공적으로 제출되었습니다. (ID: ${data.id})`;
    document.getElementById('projectTitle').value = '';
    document.getElementById('projectUrl').value = '';
    
    // 성공 시 프로젝트 목록 즉시 새로고침
    fetchMyProjects(jwt);
  })
  .catch(err => {
    msgElement.style.display = 'block';
    msgElement.style.color = '#BA1A1A';
    msgElement.innerText = `생성 실패: ${err.message}`;
  });
}

// --- [4] 내 프로젝트 조회 ---
function fetchMyProjects(token) {
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
    const listContainer = document.getElementById('projectList');
    listContainer.innerHTML = '';

    if (projects.length === 0) {
      listContainer.innerHTML = '<p style="color: #49454F;">아직 생성된 프로젝트가 없습니다.</p>';
      return;
    }

    projects.forEach(project => {
      const date = new Date(project.created_at).toLocaleDateString('ko-KR');
      const projectCard = `
        <div style="padding: 16px; border: 1px solid #CAC4D0; border-radius: 12px; background: white;">
          <h4 style="margin: 0 0 8px; color: #1D1B20;">${project.title}</h4>
          <p style="margin: 0 0 8px; font-size: 14px; color: #49454F;">🔗 <a href="${project.github_url}" target="_blank" style="color: #6750A4;">${project.github_url}</a></p>
          <span style="font-size: 12px; color: #49454F;">제출일: ${date}</span>
        </div>
      `;
      listContainer.innerHTML += projectCard;
    });
  })
  .catch(err => {
    document.getElementById('projectList').innerHTML = `<p style="color: #BA1A1A;">목록을 불러오지 못했습니다: ${err.message}</p>`;
  });
}