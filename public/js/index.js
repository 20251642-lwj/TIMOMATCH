// public/js/index.js

// 1. 인증 및 리다이렉트 (가장 먼저 실행)
window.onload = function() {
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
      localStorage.removeItem('timo_jwt');
    }
  }
};

// 2. UI 초기화 및 이벤트 리스너 바인딩
document.addEventListener('DOMContentLoaded', () => {
  const themeToggleBtn = document.getElementById('themeToggle');
  
  // 초기 테마 상태에 따른 버튼 텍스트 설정
  if (themeToggleBtn && document.body.classList.contains('dark-mode')) {
    themeToggleBtn.innerText = 'Light Mode';
  }

  // 테마 토글 이벤트 및 스토리지 저장
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      if (document.body.classList.contains('dark-mode')) {
        themeToggleBtn.innerText = 'Light Mode';
        localStorage.setItem('timo_theme', 'dark');
      } else {
        themeToggleBtn.innerText = 'Dark Mode';
        localStorage.setItem('timo_theme', 'light');
      }
    });
  }

  // 타이핑 효과 시작
  typeWriter();
});

// 3. 전역 로그인 함수 (HTML onclick 바인딩용)
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

// 4. 타이핑 효과 상세 구현
const phrases = [
  "깃허브 PR과 트러블슈팅 데이터를 분석하여\n최적의 팀원을 매칭합니다.",
  "AI 기반 꼼꼼한 코드 리뷰로\n프로젝트의 퀄리티를 높이세요.",
  "나의 개발 성향과 완벽히 맞는\n최적의 협업 파트너를 찾으세요."
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