// public/js/prof-home.js

window.onload = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  
  if (tokenFromUrl) {
    localStorage.setItem('timo_jwt', tokenFromUrl);
    window.history.replaceState({}, document.title, "/prof-home.html");
  }

  const jwt = localStorage.getItem('timo_jwt');
  if (!jwt) {
    alert('접근 권한이 없습니다.');
    location.href = '/';
    return;
  }

  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    // 보안 검증: 교수가 아니면 튕겨냄
    if (payload.role !== 'PROFESSOR') {
      alert('교수 전용 페이지입니다.');
      location.href = '/student-home.html';
    }
  } catch (error) {
    handleLogout();
  }
};

function handleLogout() {
  localStorage.removeItem('timo_jwt');
  location.href = '/';
}

function createClass() {
  const className = document.getElementById('classNameInput').value;
  const resultBox = document.getElementById('creationResult');
  const jwt = localStorage.getItem('timo_jwt');

  if (!className || className.trim() === '') {
    alert('과목 이름을 입력해주세요.');
    return;
  }

  fetch('/api/classes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify({ name: className })
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '과목 개설에 실패했습니다.');
    return data;
  })
  .then(data => {
    resultBox.style.display = 'block';
    resultBox.style.backgroundColor = '#E8DEF8';
    resultBox.style.border = '1px solid #6750A4';
    resultBox.innerHTML = `
      <h4 style="margin: 0 0 8px; color: #1D1B20;">과목 개설 완료</h4>
      <p style="margin: 0 0 4px; color: #49454F;">과목명: <strong>${data.name}</strong></p>
      <p style="margin: 0; color: #49454F;">학생 초대 코드: <strong style="color: #B3261E; font-size: 20px;">${data.code}</strong> (이 코드를 학생들에게 공유하세요)</p>
    `;
    document.getElementById('classNameInput').value = '';
    
    // TODO: 과목 생성 성공 시, 하단의 내 과목 목록 갱신 함수 호출 예정
  })
  .catch(err => {
    resultBox.style.display = 'block';
    resultBox.style.backgroundColor = '#F9DEDC';
    resultBox.style.border = '1px solid #B3261E';
    resultBox.innerHTML = `<p style="margin: 0; color: #B3261E; font-weight: 600;">오류: ${err.message}</p>`;
  });
}