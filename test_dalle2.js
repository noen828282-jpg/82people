const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID
});

async function test() {
  try {
    console.log('⏳ DALL-E 2로 테스트 이미지 생성 시도 중...');
    const response = await openai.images.generate({
      model: 'dall-e-2',
      prompt: 'a cute minimal robotic arm drawing a character portrait',
      n: 1,
      size: '256x256'
    });
    console.log('✅ DALL-E 2 성공! 이미지 URL:', response.data[0].url);
  } catch (error) {
    console.error('❌ DALL-E 2 실패:', error.message || error);
  }
}
test();
