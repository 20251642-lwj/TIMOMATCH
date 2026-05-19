// public/js/index.js

window.onload = function() {
  // 이미 발급받은 영구 토큰이 있다면 로그인 화면을 건너뛰고 바로 대시보드로 보냅니다.
  const jwt = localStorage.getItem('timo_jwt');
  if (jwt) {
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      if (payload.role === 'PROFESSOR') {
        location.href = '/prof-home.html';
      } else if (payload.role === 'STUDENT') {
        location.href = '/student-home.html';
      }
    } catch (error) {
      // 토큰이 손상되었을 경우 초기화
      localStorage.removeItem('timo_jwt');
    }
  }
};

function loginWithGithub() {
  // 백엔드(Express)에 설정된 OAuth 시작 엔드포인트로 이동합니다.
  window.location.href = '/api/auth/github';
}