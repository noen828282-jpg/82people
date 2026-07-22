const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

// 1. API 키 확인
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY_HERE') {
  console.error('\x1b[31m%s\x1b[0m', '❌ 오류: .env 파일에 올바른 OPENAI_API_KEY를 입력해 주세요.');
  console.error('\x1b[33m%s\x1b[0m', '프로젝트 루트에 있는 .env 파일의 "YOUR_OPENAI_API_KEY_HERE" 부분을 본인의 API 키로 교체해야 합니다.');
  process.exit(1);
}

// 2. OpenAI 클라이언트 초기화
const orgId = process.env.OPENAI_ORG_ID;
const clientOptions = { apiKey };
if (orgId && orgId.startsWith('org-')) {
  clientOptions.organization = orgId;
}
const openai = new OpenAI(clientOptions);

// 3. 고정 캐릭터 정체성 (마스터 뼈대 프롬프트)
const MASTER_IDENTITY = 
  "A high-quality realistic photo of a 23-year-old Korean woman with a slim build, sharp straight shoulders, and a smooth V-shaped jawline. " +
  "She has natural dark brown long wavy hair with see-through bangs and side bangs framing her cheeks. " +
  "Her facial features include clear double eyelids with natural under-eye fat (aegyosal) and a slight, warm upturned lip corner. " +
  "She is wearing a minimalist white camisole tank top and high-waisted white slim-fit jeans.";

// 4. 구도별 세부 프롬프트 템플릿
const TEMPLATES = {
  fullbody: {
    name: '정면 전신컷',
    prompt: `${MASTER_IDENTITY} Standing naturally in a full body shot, eye-level angle, looking straight into the camera with a calm and confident gaze. Background is a clean, neutral light grey studio, soft three-point studio lighting with subtle rim lights highlighting her shoulders and hair, shallow depth of field, hyper-realistic, 8k.`,
    size: '1024x1792'
  },
  closeup: {
    name: '얼굴 클로즈업',
    prompt: `${MASTER_IDENTITY} Close-up portrait, focusing on her face and neck. She has a clean v-shaped jawline, clear double eyelids, and a warm, gentle smile with upturned lip corners. Natural skin texture, detailed eyes, standing in front of an out-of-focus soft studio background, soft side key light, hyper-realistic, 8k.`,
    size: '1024x1024'
  },
  halfbody: {
    name: '정면 반신컷',
    prompt: `${MASTER_IDENTITY} Standing naturally in a half body shot (waist up), eye-level angle, looking at the camera. She stands in front of a modern minimalist architectural background with clean concrete textures and neutral colors, soft natural daylight, shallow depth of field, hyper-realistic, 8k.`,
    size: '1024x1792'
  },
  side_left: {
    name: '좌측 45도 전신컷',
    prompt: `${MASTER_IDENTITY} Standing in a three-quarter full body shot, angled 45 degrees to the left, but she turns her head to look directly at the camera. Clean light grey studio backdrop, soft studio lighting with volumetric shadows highlighting her slim silhouette and side profile, hyper-realistic, 8k.`,
    size: '1024x1792'
  },
  side_right: {
    name: '우측 45도 전신컷',
    prompt: `${MASTER_IDENTITY} Standing in a three-quarter full body shot, angled 45 degrees to the right, turning her head to look directly at the camera. Clean light grey studio backdrop, soft studio lighting highlighting her straight shoulders and slim jawline, volumetric shadows, hyper-realistic, 8k.`,
    size: '1024x1792'
  },
  back: {
    name: '뒷모습 전신컷',
    prompt: `${MASTER_IDENTITY} Full body back shot, showing the back of her head, dark brown wavy hair flowing down, and her slim body silhouette from behind. She stands in a clean minimalist architectural space, soft diffused light, hyper-realistic, 8k.`,
    size: '1024x1792'
  }
};

// 5. 이미지 다운로드 유틸리티 함수
function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: Status Code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => reject(err));
    });
  });
}

// 6. 메인 실행 함수
async function main() {
  // 명령 인자 분석 (예: --type=closeup)
  const args = process.argv.slice(2);
  let type = 'fullbody'; // 기본값

  for (const arg of args) {
    if (arg.startsWith('--type=')) {
      type = arg.split('=')[1].toLowerCase();
    }
  }

  // 타입 유효성 검사
  if (!TEMPLATES[type]) {
    console.error('\x1b[31m%s\x1b[0m', `❌ 오류: 알 수 없는 타입 '${type}' 입니다.`);
    console.log('사용 가능한 타입: ' + Object.keys(TEMPLATES).join(', '));
    process.exit(1);
  }

  const selectedTemplate = TEMPLATES[type];
  console.log(`\n🚀 [GPT 이미지 2.0] 캐릭터 일관성 생성 시작...`);
  console.log(`📌 선택된 컷: ${selectedTemplate.name} (${type})`);
  console.log(`📏 출력 크기: ${selectedTemplate.size}`);
  console.log(`⚙️ 생성 프롬프트:\n   "${selectedTemplate.prompt.substring(0, 120)}..."`);

  try {
    // API 호출 (2026년 기준 dall-e-3 대신 최신 gpt-image-2 모델 사용)
    console.log(`\n⏳ OpenAI gpt-image-2 API를 통해 이미지를 렌더링 중입니다. (보통 15~30초 소요)`);
    const response = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: selectedTemplate.prompt,
      n: 1,
      size: selectedTemplate.size
    });

    console.log(`\n✅ 이미지 렌더링 성공!`);

    // 저장 폴더 세팅
    const outputDir = path.join(__dirname, 'assets', 'character');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 파일명 지정 (서하_타입_타임스탬프.png)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const fileName = `서하_${type}_${timestamp}.png`;
    const destPath = path.join(outputDir, fileName);

    const imageObject = response.data[0];

    if (imageObject.b64_json) {
      console.log(`⏳ base64 이미지 데이터를 파일로 저장 중...`);
      fs.writeFileSync(destPath, Buffer.from(imageObject.b64_json, 'base64'));
      console.log('\x1b[32m%s\x1b[0m', `\n🎉 이미지 저장 완료!`);
      console.log(`📂 저장 경로: ${path.relative(process.cwd(), destPath)}\n`);
    } else if (imageObject.url) {
      console.log(`⏳ 이미지를 로컬 폴더에 다운로드 중입니다...`);
      await downloadImage(imageObject.url, destPath);
      console.log('\x1b[32m%s\x1b[0m', `\n🎉 다운로드 완료!`);
      console.log(`📂 저장 경로: ${path.relative(process.cwd(), destPath)}\n`);
    } else {
      throw new Error('API 응답에 이미지 데이터(b64_json 또는 url)가 누락되었습니다.');
    }

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '\n❌ 이미지 생성 중 오류가 발생했습니다:');
    console.error(error.message || error);
  }
}

main();
