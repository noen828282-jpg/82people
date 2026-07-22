const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID
});

async function test() {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello, this is a test connection to verify API key credit balance.' }]
    });
    console.log('✅ GPT 연결 성공! 응답:', response.choices[0].message.content);
  } catch (error) {
    console.error('❌ GPT 연결 실패:', error.message || error);
  }
}
test();
