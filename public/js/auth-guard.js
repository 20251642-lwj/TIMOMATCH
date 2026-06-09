// public/js/auth-guard.js

document.addEventListener('DOMContentLoaded', () => {
  handleUrlToken();
  verifyAuthentication();
});

// URL 파라미터로 전달된 토큰을 파싱하여 스토리지에 저장하는 함수
function handleUrlToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  
  if (tokenFromUrl) {
    localStorage.setItem('timo_jwt', tokenFromUrl);
    // 보안 및 미관을 위해 주소창의 쿼리 스트링 제거
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function verifyAuthentication() {
  const token = localStorage.getItem('timo_jwt');
  if (!token) {
    window.location.replace('/');
    return;
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const isExpired = (payload.exp * 1000) < Date.now();

    if (isExpired) {
      localStorage.removeItem('timo_jwt');
      alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      window.location.replace('/');
      return;
    }

    injectGlobalNavigationBar(payload.role);
    
    // 페이지 자체 초기화 로직이 정의되어 있다면 호출
    if (typeof initPage === 'function') {
      initPage(payload);
    }
  } catch (error) {
    localStorage.removeItem('timo_jwt');
    window.location.replace('/');
  }
}

function injectGlobalNavigationBar(role) {
  const gnbContainer = document.getElementById('gnb-container');
  if (!gnbContainer) return;

  const basePath = window.location.pathname;

  let menuHtml = `
    <div class="gnb-header">PRsim</div>
    <ul class="gnb-menu">
      <li class="${basePath.includes('dashboard') ? 'active' : ''}">
        <a href="/dashboard.html">대시보드 홈</a>
      </li>
      <li class="${basePath.includes('classes') ? 'active' : ''}">
        <a href="/classes.html">${role === 'PROFESSOR' ? '과목 관리' : '수강 과목 및 프로젝트'}</a>
      </li>
      <li class="${basePath.includes('profile') ? 'active' : ''}">
        <a href="/profile.html">프로필 설정</a>
      </li>
    </ul>
    <div class="gnb-footer">
      <button onclick="handleGlobalLogout()" class="btn-logout-text">로그아웃</button>
    </div>
  `;

  gnbContainer.innerHTML = menuHtml;
}

function handleGlobalLogout() {
  localStorage.removeItem('timo_jwt');
  window.location.replace('/');
}