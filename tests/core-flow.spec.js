import { test, expect } from '@playwright/test';

test.describe('TIMO Match 실제 DB 연동 테스트 (성공/실패 분기 포함)', () => {
  test.setTimeout(120000);
  // 브라우저 Local Storage에서 복사한 진짜 JWT 토큰을 입력합니다.
  
  const PROF_TOKEN = ''; 
  const STUDENT_TOKEN = '';

  test('교수-학생 상호작용 및 예외 처리 UI 시연', async ({ page: profPage, context }) => {
    
    // =========================================================
    // 교수 화면: 과목 개설 (첫 번째 탭)
    // =========================================================
    await profPage.goto(`http://localhost:3000/prof-home.html?token=${PROF_TOKEN}`);

    await profPage.fill('#classNameInput', '2026 캡스톤 디자인 (Playwright 시연)');
    await profPage.click('button:has-text("과목 개설 및 초대 코드 발급")');

    await expect(profPage.locator('#creationResult')).toBeVisible();

    // 실제 서버가 생성한 화면의 텍스트에서 정규식을 통해 TIMO-XXXXXX 형태의 코드를 추출합니다.
    const resultText = await profPage.locator('#creationResult').innerText();
    const inviteCodeMatch = resultText.match(/TIMO-[A-Z0-9]+/);
    const realInviteCode = inviteCodeMatch[0];


    // =========================================================
    // 학생 화면 (실패 케이스): 잘못된 코드 입력 (두 번째 탭)
    // =========================================================
    const failStudentPage = await context.newPage(); 
    await failStudentPage.goto(`http://localhost:3000/student-home.html?token=${STUDENT_TOKEN}`);

    await failStudentPage.fill('#inviteCode', 'TIMO-WRONG');
    await failStudentPage.click('button:has-text("등록")');

    await expect(failStudentPage.locator('#enrollMessage')).toBeVisible();
    await expect(failStudentPage.locator('#enrollMessage')).toContainText('유효하지 않은 초대 코드');


    // =========================================================
    // 학생 화면 (성공 케이스): 정상 등록 및 제출 (세 번째 탭)
    // =========================================================
    const successStudentPage = await context.newPage(); 
    await successStudentPage.goto(`http://localhost:3000/student-home.html?token=${STUDENT_TOKEN}`);

    // 1부에서 추출한 실제 DB 기반의 초대 코드를 입력합니다.
    await successStudentPage.fill('#inviteCode', realInviteCode);
    await successStudentPage.click('button:has-text("등록")');

    const submitBtn = successStudentPage.locator('button:has-text("프로젝트 제출")').first();
    await submitBtn.waitFor({ state: 'visible' });
    await submitBtn.click();

    await successStudentPage.fill('#projectTitle', 'Playwright 자동화 스크립트');
    await successStudentPage.fill('#projectUrl', 'https://github.com/20251642-lwj/playwright');
    await successStudentPage.click('button:has-text("제출하기")');

    await expect(successStudentPage.locator('#creationMessage')).toBeVisible();
    
    // 3개의 탭이 모두 열린 상태로 마무리
    await profPage.pause(); 
  });
});