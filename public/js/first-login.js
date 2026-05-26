// public/js/first-login.js

const PREDEFINED_TECH_STACKS = ["React", "Vue.js", "Next.js", "Spring Boot", "Node.js", "Express", "Python", "Django", "Java", "C++", "C#", "Go", "TypeScript", "MySQL", "PostgreSQL", "Docker", "AWS", "Kubernetes"];

let selectedRole = null;
let allUniversities = [];
let selectedUniversityId = null;
let selectedTechStacks = new Set(); // 다중 선택 관리를 위한 Set 자료구조

window.onload = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (token) {
    sessionStorage.setItem('timo_temp_token', token);
    window.history.replaceState({}, document.title, "/first-login.html");
  } else if (!sessionStorage.getItem('timo_temp_token')) {
    alert('인증 정보가 없습니다. 다시 로그인해주세요.');
    location.href = '/';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  fetchUniversities();
  renderTechStacks();

  document.getElementById('realName')?.addEventListener('input', checkStep2Validity);
  document.getElementById('userNumber')?.addEventListener('input', checkStep2Validity);
  
  const univSearchInput = document.getElementById('univSearch');
  if (univSearchInput) {
    univSearchInput.addEventListener('input', handleUnivSearch);
    univSearchInput.addEventListener('focus', handleUnivSearch);
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      const dropdown = document.getElementById('univDropdown');
      if (dropdown) dropdown.style.display = 'none';
    }
  });
});

function fetchUniversities() {
  fetch('/api/auth/universities')
    .then(res => res.json())
    .then(data => { allUniversities = data; })
    .catch(err => console.error('University Load Error:', err));
}

function handleUnivSearch() {
  const keyword = document.getElementById('univSearch').value.trim();
  const dropdown = document.getElementById('univDropdown');
  if (!dropdown) return;

  selectedUniversityId = null;
  checkStep2Validity();

  if (!keyword) { dropdown.style.display = 'none'; return; }

  const filtered = allUniversities.filter(univ => univ.name.includes(keyword));
  if (filtered.length === 0) { dropdown.style.display = 'none'; return; }

  dropdown.innerHTML = '';
  filtered.forEach(univ => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.innerText = univ.name;
    item.onclick = () => {
      document.getElementById('univSearch').value = univ.name;
      selectedUniversityId = univ.id;
      dropdown.style.display = 'none';
      checkStep2Validity();
    };
    dropdown.appendChild(item);
  });
  dropdown.style.display = 'block';
}

function renderTechStacks() {
  const container = document.getElementById('techStackContainer');
  if (!container) return;
  container.innerHTML = '';

  PREDEFINED_TECH_STACKS.forEach(tech => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerText = tech;
    chip.onclick = () => toggleTechStack(tech, chip);
    container.appendChild(chip);
  });
}

function toggleTechStack(tech, element) {
  if (selectedTechStacks.has(tech)) {
    selectedTechStacks.delete(tech);
    element.classList.remove('selected');
  } else {
    selectedTechStacks.add(tech);
    element.classList.add('selected');
  }
}

// 화면 전환 및 라벨 동적 제어 함수
function goToStep(stepIndex) {
  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'none';
  document.getElementById('step3').style.display = 'none';

  document.getElementById(`step${stepIndex}`).style.display = 'block';

  if (stepIndex === 2) {
    const numberGroup = document.getElementById('userNumberGroup');
    const numberLabel = document.getElementById('userNumberLabel');
    const numberInput = document.getElementById('userNumber');
    const nextBtn = document.getElementById('step2NextBtn');

    if (selectedRole === 'STUDENT') {
      numberGroup.style.display = 'block';
      numberLabel.innerText = '학번';
      numberInput.placeholder = '학번을 입력하세요 (숫자만 허용)';
      nextBtn.innerText = '다음 단계로';
    } else if (selectedRole === 'PROFESSOR') {
      numberGroup.style.display = 'none'; // 교수는 식별 번호 입력란 숨김
      nextBtn.innerText = '확정 및 시작하기'; // 스텝 생략에 따른 버튼명 변경
    }
    checkStep2Validity();
  }
}

function selectRole(role) {
  selectedRole = role;
  goToStep(2); // 역할 선택 즉시 Step 2로 자동 슬라이드
}

function checkStep2Validity() {
  const realName = document.getElementById('realName')?.value.trim() || '';
  const userNumber = document.getElementById('userNumber')?.value.trim() || '';
  const nextBtn = document.getElementById('step2NextBtn');
  if (!nextBtn) return;

  // 연속된 공백 차단 로직 (외국인 단일 공백은 허용)
  const isNameValid = realName.length >= 2 && !/\s{2,}/.test(realName);
  const isUnivValid = selectedUniversityId !== null;
  let isNumberValid = true;

  if (selectedRole === 'STUDENT') {
    isNumberValid = /^\d+$/.test(userNumber); // 학번은 숫자만
  }

  if (isNameValid && isUnivValid && isNumberValid) {
    nextBtn.disabled = false;
  } else {
    nextBtn.disabled = true;
  }
}

function handleStep2Next() {
  if (selectedRole === 'PROFESSOR') {
    submitRole(); // 교수는 즉시 최종 전송
  } else {
    goToStep(3); // 학생은 기술 스택 선택 창으로 전환
  }
}

function submitRole() {
  const realName = document.getElementById('realName')?.value.trim() || '';
  const userNumber = selectedRole === 'STUDENT' ? document.getElementById('userNumber')?.value.trim() : null;
  const tempToken = sessionStorage.getItem('timo_temp_token');
  
  // 버튼 이중 클릭 방지
  const btnId = selectedRole === 'PROFESSOR' ? 'step2NextBtn' : 'submitBtn';
  const submitBtn = document.getElementById(btnId);
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = '데이터 저장 중...';
  }

  const payload = {
    role: selectedRole,
    real_name: realName,
    university_id: selectedUniversityId
  };

  if (selectedRole === 'STUDENT') {
    payload.student_number = userNumber;
    payload.tech_stack = Array.from(selectedTechStacks);
  }

  fetch('/api/auth/role', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tempToken}`
    },
    body: JSON.stringify(payload)
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '온보딩 처리에 실패했습니다.');
    return data;
  })
  .then(data => {
    if (data.token) {
      localStorage.setItem('timo_jwt', data.token);
      sessionStorage.removeItem('timo_temp_token');
      location.href = selectedRole === 'PROFESSOR' ? '/prof-home.html' : '/student-home.html';
    }
  })
  .catch(err => {
    alert(err.message);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = selectedRole === 'PROFESSOR' ? '확정 및 시작하기' : '최종 확정 및 시작하기';
    }
  });
}