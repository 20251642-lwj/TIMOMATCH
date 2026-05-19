// public/js/first-login.js

let selectedRole = null;

window.onload = function() {
  // 1. URL에 포함된 임시 토큰 파싱
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token) {
    // 보안: 임시 토큰은 브라우저를 닫으면 사라지는 sessionStorage에 보관
    sessionStorage.setItem('timo_temp_token', token);
    // URL에서 토큰 문자열을 숨겨서 깔끔하게 만듦
    window.history.replaceState({}, document.title, "/first-login.html");
  } else {
    // 토큰이 아예 없다면 비정상 접근이므로 쫓아냄
    const tempToken = sessionStorage.getItem('timo_temp_token');
    if (!tempToken) {
      alert('인증 정보가 없습니다. 다시 로그인해주세요.');
      location.href = '/';
    }
  }
};

function selectRole(role) {
  selectedRole = role;
  
  // UI 스타일 초기화
  document.getElementById('card-student').classList.remove('selected');
  document.getElementById('card-prof').classList.remove('selected');
  
  // 선택된 카드 스타일 강조
  if (role === 'STUDENT') {
    document.getElementById('card-student').classList.add('selected');
  } else if (role === 'PROFESSOR') {
    document.getElementById('card-prof').classList.add('selected');
  }

  // 제출 버튼 활성화
  document.getElementById('submitBtn').disabled = false;
}

function submitRole() {
  if (!selectedRole) return;

  const tempToken = sessionStorage.getItem('timo_temp_token');
  
  // 버튼 이중 클릭 방지
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('submitBtn').innerText = '처리 중...';

  fetch('/api/auth/role', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tempToken}`
    },
    body: JSON.stringify({ role: selectedRole })
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '역할 설정에 실패했습니다.');
    return data;
  })
  .then(data => {
    // 2. 역할이 확정된 영구 토큰을 받아서 localStorage로 이관
    if (data.token) {
      localStorage.setItem('timo_jwt', data.token);
      sessionStorage.removeItem('timo_temp_token');
      
      // 3. 선택한 역할에 맞는 대시보드로 자동 이동
      if (selectedRole === 'PROFESSOR') {
        location.href = '/prof-home.html';
      } else {
        location.href = '/student-home.html';
      }
    }
  })
  .catch(err => {
    alert(err.message);
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitBtn').innerText = '역할 확정 및 시작하기';
  });
}