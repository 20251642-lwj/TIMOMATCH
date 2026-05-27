// public/js/profile.js

// auth-guard.js에서 인증 검증 성공 후 호출하는 초기화 진입점
function initPage(payload) {
  fetchAdditionalProfile();
}

// 백엔드로부터 상세 데이터베이스 프로필 정보 수신 및 렌더링
function fetchAdditionalProfile() {
  const token = localStorage.getItem('timo_jwt');

  fetch('/api/profile', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '프로필 로드 실패');
    return data;
  })
  .then(user => {
    // 1. 기본 계정 정보 영역 데이터 바인딩
    document.getElementById('infoRole').innerText = user.role === 'PROFESSOR' ? '교수 (PROFESSOR)' : '학생 (STUDENT)';
    document.getElementById('infoName').innerText = user.name || 'TIMO 유저';

    // 2. 역할별 상세 프로필 데이터 바인딩
    if (user.role === 'STUDENT' && user.student_profile) {
      document.getElementById('studentFields').style.display = 'block';
      document.getElementById('infoRealNameStudent').innerText = user.student_profile.real_name || '-';
      document.getElementById('infoStudentNumber').innerText = user.student_profile.student_number || '-';
      
      // 기술 스택 칩(Chip) 컴포넌트 동적 생성
      const techContainer = document.getElementById('infoTechStack');
      if (techContainer) {
        const tags = user.student_profile.tech_stack;
        if (Array.isArray(tags) && tags.length > 0) {
          techContainer.innerHTML = tags.map(tag => `<span class="profile-tag">${tag}</span>`).join('');
        } else {
          techContainer.innerHTML = '<span style="color:var(--text-secondary); font-size:14px;">등록된 기술 스택이 없습니다.</span>';
        }
      }

    } else if (user.role === 'PROFESSOR' && user.professor_profile) {
      document.getElementById('professorFields').style.display = 'block';
      document.getElementById('infoRealNameProf').innerText = user.professor_profile.real_name || '-';
    }
  })
  .catch(err => {
    console.error(err.message);
    alert('프로필 정보를 불러오는 중 오류가 발생했습니다.');
  });
}