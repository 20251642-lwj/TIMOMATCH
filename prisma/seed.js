// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const universityNames = [
  "서울대학교", "고려대학교", "연세대학교", "서강대학교", "성균관대학교", 
  "한양대학교", "중앙대학교", "경희대학교", "한국외국어대학교", "서울시립대학교",
  "이화여자대학교", "건국대학교", "동국대학교", "홍익대학교", "국민대학교",
  "숭실대학교", "세종대학교", "단국대학교", "광운대학교", "명지대학교",
  "상명대학교", "가톨릭대학교", "한국항공대학교", "가천대학교", "인하대학교",
  "아주대학교", "경북대학교", "부산대학교", "전남대학교", "전북대학교",
  "충남대학교", "충북대학교", "강원대학교", "제주대학교", "경상국립대학교",
  "한국과학기술원(KAIST)", "포항공과대학교(POSTECH)", "광주과학기술원(GIST)",
  "대구경북과학기술원(DGIST)", "울산과학기술원(UNIST)", "한국에너지공과대학교(KENTECH)"
];

async function main() {
  console.log('대학교 초기 데이터(Seed) 삽입 시작...');
  
  for (const name of universityNames) {
    await prisma.universities.upsert({
      where: { name: name },
      update: {}, // 이미 존재하면 아무것도 변경하지 않음
      create: { name: name } // 존재하지 않으면 새로 생성
    });
  }
  
  console.log('대학교 데이터 삽입 완료.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });