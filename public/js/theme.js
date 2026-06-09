// public/js/theme.js

const THEME_KEY = 'timo_theme';

// 1. 초기 테마 설정 및 UI 동기화
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  
  // 저장된 테마가 없으면 OS의 다크모드 설정을 감지
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
  
  if (isDark) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }

  // [버그 픽스 3] 페이지 로드 시 버튼 텍스트도 올바르게 동기화
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) {
    themeToggleBtn.innerText = isDark ? 'Light Mode' : 'Dark Mode';
  }
}

// 2. 테마 토글 및 UI 동기화 전역 함수
window.toggleTheme = function() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) {
    themeToggleBtn.innerText = isDark ? 'Light Mode' : 'Dark Mode';
  }
};

// 3. 전역 단축키 이벤트 리스너 (Ctrl/Cmd + Shift + L)
document.addEventListener('keydown', function(event) {
  // [버그 픽스 2] event.shiftKey 조건을 추가하여 브라우저 주소창 단축키(Ctrl+L)와 충돌 원천 차단
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
    event.preventDefault(); 
    window.toggleTheme();
  }
});

// [버그 픽스 1] <body> 태그가 브라우저에 그려진(DOM 준비 완료) 직후에 실행하여 TypeError 방지
document.addEventListener('DOMContentLoaded', initTheme);