// public/js/index.js

// 1. UI 초기화 및 이벤트 리스너 바인딩
document.addEventListener('DOMContentLoaded', () => {
  // [수정됨] 테마 초기화 시 버튼 텍스트 동기화 (토글 로직 자체는 theme.js로 이관됨)
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn && document.body.classList.contains('dark-mode')) {
    themeToggleBtn.innerText = 'Light Mode';
  }

  // 타이핑 효과 시작
  typeWriter();
});

// 2. 전역 로그인 함수 (HTML onclick 바인딩용)
window.handleLoginClick = function() {
  const btn = document.getElementById('loginBtn');
  if (btn) {
    btn.innerText = 'GitHub와 연결 중...';
    btn.style.opacity = '0.8';
    btn.style.cursor = 'not-allowed';
    btn.style.transform = 'none';
  }
  
  loginWithGithub();
};

window.loginWithGithub = function() {
  window.location.href = '/api/auth/github';
};

// 뒤로가기(Bfcache) 복원 시 버튼 상태 초기화
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    const btn = document.getElementById('loginBtn');
    if (btn) {
      btn.innerText = 'GitHub로 시작하기';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.transform = ''; 
    }
  }
});

// 3. 타이핑 효과 상세 구현
const phrases = [
  "GitHub PR과 커밋 데이터를 정밀 분석하여\n팀 프로젝트의 실시간 협업 상태를 진단합니다.",
  "AI 기반 협업 패턴 분석과 리포트 제공으로\n투명하고 공정한 팀 프로젝트 평가를 지원합니다.",
  "프로젝트 목표 달성도 정량 측정,\n교수와 학생을 연결하는 AI 피드백 시스템, PRism."
];

let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;

function typeWriter() {
  const typingElement = document.getElementById('typingText');
  if (!typingElement) return;

  const currentPhrase = phrases[phraseIndex];

  if (isDeleting) {
    charIndex--;
  } else {
    charIndex++;
  }

  const currentText = currentPhrase.substring(0, charIndex);
  typingElement.innerHTML = currentText.replace(/\n/g, '<br>');

  let typeSpeed = isDeleting ? 30 : 50;

  if (!isDeleting && charIndex === currentPhrase.length) {
    typeSpeed = 2500; 
    isDeleting = true;
  } 
  else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    phraseIndex = (phraseIndex + 1) % phrases.length;
    typeSpeed = 500; 
  }

  setTimeout(typeWriter, typeSpeed);
}