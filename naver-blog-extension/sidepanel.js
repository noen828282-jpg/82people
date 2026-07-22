// ==========================================================================
// 충주미세방충망 블로그 도우미 - sidepanel.js
// ==========================================================================

let uploadedImages = []; // { id, file, originalUrl, watermarkedUrl, label: 'none'|'before'|'after' }
let geminiApiKey = "";
let companyName = "충주미세방충망";
let phoneNumber = "010-6261-0930";

// 1. 초기 로드 및 환경 설정 연동
document.addEventListener("DOMContentLoaded", async () => {
  // 로컬 스토리지에서 기존 설정 불러오기
  const data = await chrome.storage.local.get(["apiKey", "companyName", "phoneNumber"]);
  if (data.apiKey) {
    geminiApiKey = data.apiKey;
    document.getElementById("input-api-key").value = data.apiKey;
  }
  if (data.companyName) {
    companyName = data.companyName;
    document.getElementById("input-company-name").value = data.companyName;
  }
  if (data.phoneNumber) {
    phoneNumber = data.phoneNumber;
    document.getElementById("input-phone-number").value = data.phoneNumber;
  }

  // UI 이벤트 리스너 등록
  setupUIEventListeners();
});

// 2. UI 이벤트 리스너 등록 함수
function setupUIEventListeners() {
  const btnToggleSettings = document.getElementById("btn-toggle-settings");
  const settingsPanel = document.getElementById("settings-panel");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const btnGenerate = document.getElementById("btn-generate");
  const btnSendNaver = document.getElementById("btn-send-naver");
  const btnCopyTitle = document.getElementById("btn-copy-title");
  const btnCopyBody = document.getElementById("btn-copy-body");

  // 설정 패널 토글
  btnToggleSettings.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
  });

  // 설정 저장
  btnSaveSettings.addEventListener("click", async () => {
    const key = document.getElementById("input-api-key").value.trim();
    const name = document.getElementById("input-company-name").value.trim() || "충주미세방충망";
    const phone = document.getElementById("input-phone-number").value.trim() || "010-6261-0930";

    await chrome.storage.local.set({ apiKey: key, companyName: name, phoneNumber: phone });
    geminiApiKey = key;
    companyName = name;
    phoneNumber = phone;

    alert("설정이 안전하게 저장되었습니다.");
    settingsPanel.classList.add("hidden");
    
    // 다시 워터마크 그리기 (업체 정보가 변경되었을 수 있으므로)
    reprocessAllImages();
  });

  // 드래그 앤 드롭 파일 업로드
  dropZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // 글 생성 클릭
  btnGenerate.addEventListener("click", handleGeneratePost);

  // 네이버 전송
  btnSendNaver.addEventListener("click", handleSendToNaver);

  // 복사 기능
  btnCopyTitle.addEventListener("click", () => {
    const titleVal = document.getElementById("result-title").value;
    navigator.clipboard.writeText(titleVal);
    alert("제목이 클립보드에 복사되었습니다.");
  });

  btnCopyBody.addEventListener("click", () => {
    const bodyContainer = document.getElementById("result-body-preview");
    
    // 클립보드에 리치 텍스트 복사 시뮬레이션
    const range = document.createRange();
    range.selectNode(bodyContainer);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
    
    alert("본문이 서식을 유지한 채 클립보드에 복사되었습니다. 네이버 스마트에디터에 바로 붙여넣기 할 수 있습니다.");
  });
}

// 3. 파일 업로드 및 이미지 프로세싱
function handleFiles(files) {
  if (uploadedImages.length + files.length > 10) {
    alert("시공 사진은 최대 10장까지만 업로드할 수 있습니다.");
    return;
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) continue;

    const id = Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const reader = new FileReader();

    reader.onload = (e) => {
      const originalUrl = e.target.result;
      
      const newImg = {
        id: id,
        file: file,
        originalUrl: originalUrl,
        watermarkedUrl: "",
        label: "none" // 'none' | 'before' | 'after'
      };
      
      uploadedImages.push(newImg);
      processImageWatermark(newImg);
    };

    reader.readAsDataURL(file);
  }
}

// 이미지에 워터마크 그리기 (Canvas 활용)
function processImageWatermark(imgObj) {
  const img = new Image();
  img.src = imgObj.originalUrl;
  
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    // 블로그 포스팅 최적화 가로 해상도 (최대 가로/세로 1000px으로 리사이징)
    const MAX_WIDTH = 1000;
    const MAX_HEIGHT = 1000;
    let width = img.width;
    let height = img.height;
    
    if (width > height) {
      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
    } else {
      if (height > MAX_HEIGHT) {
        width *= MAX_HEIGHT / height;
        height = MAX_HEIGHT;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    
    // 1. 이미지 그리기
    ctx.drawImage(img, 0, 0, width, height);
    
    // 2. 우측 하단 워터마크 밴드
    const txt = `${companyName} ${phoneNumber}`;
    ctx.font = "bold " + Math.max(14, Math.round(width * 0.024)) + "px 'Pretendard', sans-serif";
    const textWidth = ctx.measureText(txt).width;
    const paddingX = Math.round(width * 0.02);
    const paddingY = Math.round(height * 0.015);
    const rectWidth = textWidth + paddingX * 2;
    const rectHeight = Math.round(width * 0.024) + paddingY * 2;
    
    const rectX = width - rectWidth - Math.round(width * 0.02);
    const rectY = height - rectHeight - Math.round(height * 0.02);
    
    // 검정색 반투명 둥근 사각형 배경
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    drawRoundedRect(ctx, rectX, rectY, rectWidth, rectHeight, 6);
    
    // 흰색 글자
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, rectX + paddingX, rectY + rectHeight / 2);
    
    // 3. 상단 중앙 시공전/후 라벨 오버레이 (라벨이 지정된 경우만)
    if (imgObj.label === "before" || imgObj.label === "after") {
      const labelText = imgObj.label === "before" ? "[시공 전]" : "[시공 후]";
      const labelColor = imgObj.label === "before" ? "#2563eb" : "#059669"; // 파란색 / 초록색
      
      const labelFontSize = Math.max(16, Math.round(width * 0.028));
      ctx.font = "bold " + labelFontSize + "px 'Pretendard', sans-serif";
      const lblTextWidth = ctx.measureText(labelText).width;
      
      const lblPadX = Math.round(width * 0.025);
      const lblPadY = Math.round(height * 0.015);
      const lblRectWidth = lblTextWidth + lblPadX * 2;
      const lblRectHeight = labelFontSize + lblPadY * 2;
      
      const lblRectX = (width - lblRectWidth) / 2; // 상단 가운데 정렬
      const lblRectY = Math.round(height * 0.03);
      
      ctx.fillStyle = labelColor;
      drawRoundedRect(ctx, lblRectX, lblRectY, lblRectWidth, lblRectHeight, 8);
      
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, width / 2, lblRectY + lblRectHeight / 2);
      ctx.textAlign = "left"; // 다시 원위치
    }
    
    // 결과 저장 및 UI 갱신
    imgObj.watermarkedUrl = canvas.toDataURL("image/jpeg", 0.9);
    renderPhotosList();
  };
}

// 둥근 사각형 그리기 헬퍼
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

// 사진 목록 렌더링
function renderPhotosList() {
  const listEl = document.getElementById("photos-list");
  const countBadge = document.getElementById("photo-count-badge");
  
  countBadge.textContent = `${uploadedImages.length} / 10장`;
  
  if (uploadedImages.length === 0) {
    listEl.classList.add("hidden");
    listEl.innerHTML = "";
    return;
  }
  
  listEl.classList.remove("hidden");
  listEl.innerHTML = "";
  
  uploadedImages.forEach((imgObj, idx) => {
    const card = document.createElement("div");
    card.className = "photo-card flex flex-col p-1.5";
    card.draggable = true;
    
    // 드래그 앤 드롭 시작할 때 데이터 심기 (네이버 에디터로 직접 삽입 지원)
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/html", `<img src="${imgObj.watermarkedUrl}" width="800" style="display:block; margin: 15px auto;" alt="시공사진" />`);
      e.dataTransfer.setData("DownloadURL", `image/jpeg:시공사진_${idx+1}.jpg:${imgObj.watermarkedUrl}`);
    });
    
    // HTML 템플릿 세팅
    card.innerHTML = `
      <div class="relative w-full aspect-video rounded-md overflow-hidden bg-zinc-100">
        <img src="${imgObj.watermarkedUrl || imgObj.originalUrl}" class="w-full h-full object-cover">
        <button class="btn-delete absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors" data-id="${imgObj.id}">
          <iconify-icon icon="solar:close-circle-bold" class="text-sm"></iconify-icon>
        </button>
      </div>
      <div class="flex items-center justify-between mt-1.5 px-0.5">
        <span class="text-[9px] text-zinc-400 font-bold">#사진 ${idx + 1}</span>
        <div class="flex bg-zinc-100 rounded-md p-0.5 space-x-0.5">
          <button class="btn-label px-1.5 py-0.5 rounded text-[9px] font-bold ${imgObj.label === 'none' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}" data-id="${imgObj.id}" data-label="none">없음</button>
          <button class="btn-label px-1.5 py-0.5 rounded text-[9px] font-bold ${imgObj.label === 'before' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}" data-id="${imgObj.id}" data-label="before">시공전</button>
          <button class="btn-label px-1.5 py-0.5 rounded text-[9px] font-bold ${imgObj.label === 'after' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}" data-id="${imgObj.id}" data-label="after">시공후</button>
        </div>
      </div>
    `;
    
    // 버튼 이벤트 리스너
    card.querySelector(".btn-delete").addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      uploadedImages = uploadedImages.filter(item => item.id !== id);
      renderPhotosList();
    });
    
    card.querySelectorAll(".btn-label").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const newLabel = e.currentTarget.getAttribute("data-label");
        
        const targetImg = uploadedImages.find(item => item.id === id);
        if (targetImg) {
          targetImg.label = newLabel;
          // 라벨 오버레이를 새로 입히기 위해 리워터마킹
          processImageWatermark(targetImg);
        }
      });
    });
    
    listEl.appendChild(card);
  });
}

// 전체 이미지 재생성 (워터마크 텍스트 수정 시 적용)
function reprocessAllImages() {
  uploadedImages.forEach(img => {
    processImageWatermark(img);
  });
}

// 4. 블로그 포스팅 AI 생성 로직 (Gemini API 호출)
async function handleGeneratePost() {
  if (!geminiApiKey) {
    alert("환경 설정에서 Gemini API Key를 먼저 저장해주세요.");
    document.getElementById("settings-panel").classList.remove("hidden");
    return;
  }

  const seoMode = document.getElementById("select-seo-mode").value;
  const city = document.getElementById("select-city").value;
  const apartment = document.getElementById("input-apartment").value.trim();
  const keywords = document.getElementById("input-keywords").value.trim();

  if (!apartment) {
    alert("아파트나 시공 현장명을 입력해 주세요 (예: 푸르지오 1차).");
    document.getElementById("input-apartment").focus();
    return;
  }

  // 로딩 시작
  const btnGenerate = document.getElementById("btn-generate");
  const spinner = document.getElementById("loading-spinner");
  const resultSection = document.getElementById("result-section");

  btnGenerate.disabled = true;
  btnGenerate.classList.add("opacity-50");
  spinner.classList.remove("hidden");
  resultSection.classList.add("hidden");

  // 프롬프트 가이드 제작
  const prompt = buildGeminiPrompt(seoMode, city, apartment, keywords);

  try {
    const response = await callGeminiAPI(prompt);
    
    // 결과 파싱
    const { title, body } = parseGeminiResponse(response);
    
    // UI 반영
    document.getElementById("result-title").value = title;
    
    const previewEl = document.getElementById("result-body-preview");
    previewEl.innerHTML = body;
    
    // SEO 지표 연동
    updateSeoMetrics(body);
    
    resultSection.classList.remove("hidden");
    // 결과 영역으로 스크롤 이동
    resultSection.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    console.error("API Error: ", error);
    alert("블로그 생성 중 오류가 발생했습니다: " + error.message);
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.classList.remove("opacity-50");
    spinner.classList.add("hidden");
  }
}

// SEO 모드별 세부 프롬프트 설계
function buildGeminiPrompt(mode, city, apartment, keywords) {
  const keywordList = keywords ? keywords.split(",").map(k => k.trim()) : [];
  const mainKeyword = `${city}미세방충망`;
  const subKeywordsText = keywordList.length > 0 ? `서브 키워드: ${keywordList.join(", ")}` : "";
  
  // 10년 경력 베테랑 기사 페르소나 정의
  const basePersona = `
당신은 충북권(충주, 청주, 제천 등)에서 가장 꼼꼼하게 시공하기로 소문난 10년 경력의 방충망 시공 전문 업체 [${companyName}]의 대표이자 베테랑 기사입니다. 
당신이 오늘 직접 ${city}의 [${apartment}] 아파트를 방문하여 시공한 생생한 작업 기록을 토대로 블로그 포스팅을 작성해야 합니다.

작성 기본 가이드라인:
1. **친근하고 신뢰감 있는 사장님 말투**: "~습니다", "~요"를 자연스럽게 섞어서 동네 이웃에게 직접 말하듯 솔직하고 담백하게 작성하세요. 지나치게 격식 차린 번역 투 문장이나 '혁신적인', '게임체인저', '완벽한' 같은 기계적인 표현은 절대 금지합니다.
2. **지역 밀착 신뢰 강조**: 외주나 하청을 절대 쓰지 않고 대표 기사인 본인이 직접 꼼꼼하게 시공한다는 고집을 은연중에 어필하세요.
3. **사진 삽입 가이드 포함**: 본문 중간 흐름이 넘어가는 적절한 곳에 대괄호와 빨간색 스타일이 가능한 가이드 텍스트(예: <p style="color:#ef4444; font-weight:bold;">[여기에 시공 전 부식된 알루미늄 방충망 사진을 드래그해서 넣어주세요]</p>) 형태로 사진 배치 안내 문구를 넣어주세요. 사진 안내는 총 4~6곳 정도 배치하세요.
4. **HTML 서식 사용**: 네이버 블로그에 복사해 넣었을 때 줄바꿈과 강조 서식이 그대로 먹히도록 문단은 <p> 태그로 묶고 소제목은 <h2>나 <h3>, 강조 텍스트는 <strong> 태그를 활용해 정돈된 HTML 구조로 응답하세요.
`;

  let modeSpecificPrompt = "";
  
  switch(mode) {
    case "c-rank":
      modeSpecificPrompt = `
[선택 모드: C-Rank & DIA+ 현장감 시공 일지]
네이버 DIA+ 핵심 가치인 '실제 작업 경험'을 완벽히 입증할 수 있도록 시간 순서대로 작업의 디테일을 풀어내야 합니다.
- **도입부**: 의뢰를 받게 된 배경 및 고객의 걱정거리(기존 알루미늄망에 먼지가 뽀얗고 삭아서 손만 대도 구멍이 나서 환기를 못 시켰다는 사연 등).
- **작업 순서 기술**:
  1. 탈거 작업: 창틀에서 기존 방충망 틀을 조심스럽게 떼어내어 아파트 밖(주차장 등) 야외 작업대로 이동.
  2. 세척 및 부자재 보수: 틀에 쌓인 먼지를 닦고, 삭아서 닳아버린 모헤어(창틀 틈새 털)를 새것으로 무상 교체.
  3. 교체 작업: 국산 정품 모노필라멘트 30메시 미세망을 단단하게 끼워 넣어 우는 곳 없이 팽팽하게 작업.
  4. 마감 작업: 창틀 하단 물구멍 전용 미세 스티커 부착 서비스.
  5. 장착 완료: 고객 댁에 재설치한 뒤, 방충망이 없는 것처럼 밖의 전망이 맑게 보이는 깨끗한 투명 시야 시연.
- **글의 핵심 키워드**: 메인 키워드인 [${mainKeyword}]를 자연스럽게 5~7회 포함하고, ${subKeywordsText}도 자연스럽게 문맥에 녹여 넣으세요.
`;
      break;

    case "alcon":
      modeSpecificPrompt = `
[선택 모드: Alcon 지역 밀착 & 고객 고민 유형별 매핑]
검색자의 다양한 목적과 우려사항을 하나의 포스팅 내에서 소제목(H2/H3)을 세분화하여 전부 만족시켜 체류 시간을 극대화해야 합니다.
- **메인 타겟 키워드**: [${mainKeyword}] 및 ${city} [${apartment}] 미세방충망 교체.
- **소제목 구조**:
  - H2: "1. 삭아서 부스러지는 알루미늄 방충망의 숨은 위험성" (기존 망의 호흡기 위협 문제 진단)
  - H2: "2. 왜 국산 친환경 모노필라멘트 30메시여야 할까요?" (자재 강도 및 삭지 않는 우수한 수명 설명)
  - H2: "3. 촘촘해지면 바람이 안 통할까 봐 걱정하셨나요?" (통기성 검증 및 실제 미풍 유입 확인)
  - H2: "4. 날벌레와 초파리 차단은 기본, 물구멍 서비스까지" (마감 디테일)
- **내용**: 충청권 주택/아파트 단지의 특성과 여름철 벌레 문제를 세세하게 다루어 충청도 거주자들의 폭넓은 공감을 사도록 유도하세요.
`;
      break;

    case "aeo":
      modeSpecificPrompt = `
[선택 모드: AEO 자재 스펙 비교 및 FAQ (AI 요약 노출용)]
네이버 검색 시 최상단 'AI 브리핑'에 인용될 수 있도록 극도로 잘 정리된 정보성 구조를 가져갑니다.
- **포스트 시작**: 오늘 시공한 ${city} [${apartment}] 아파트의 방충망 종류와 특징을 3문장으로 두괄식 요약.
- **스펙 비교표 포함 (HTML <table> 활용)**:
  - 열: 구분, 일반 알루미늄 방충망, 국산 모노필라멘트 미세망, 스테인리스 안전방충망
  - 행: 재질, 메시(조밀도), 벌레 차단율, 내구수명, 추락방지 성능, 대략적인 가성비 평점
  - <table> 태그를 깔끔한 스타일(border, padding 적용 스타일링)을 적용해 작성해 주어 복사 시 네이버에 표로 들어가게 하세요.
- **본문 뒤 FAQ 필수 탑재**:
  - Q1: 미세방충망 물청소 및 관리 팁은 무엇인가요?
  - Q2: 시공할 때 먼지가 집안에 날리지 않나요? (야외 작업 원칙 서술)
  - Q3: 충주뿐만 아니라 청주나 제천 등 다른 충청 지역도 출장 시공 가격이 같나요?
`;
      break;

    case "home-plate":
      modeSpecificPrompt = `
[선택 모드: Home-Plate 비포&애프터 감성 스토리텔링 (추천 피드용)]
딱딱한 시공 기술 설명보다는, 집안 환경 개선이 주는 가족의 행복과 맑은 거실 시야 확보가 주는 감동을 드라마틱하게 서술하여 이웃 소통과 공유를 늘립니다.
- **제목 스타일**: 시적이고 눈길을 끄는 형태 (예: "방충망 하나 바꿨더니, 답답했던 거실 창문이 액자가 되었습니다.")
- **시나리오**: "아이들이 밤마다 모기나 정체 모를 벌레에 물려 긁느라 잠 못 자는 모습이 안타까워 새벽에 고민 끝에 전화를 주셨던 애틋한 어머님 사연" 또는 "반려동물이 방충망을 긁어 찢어질까 봐 아찔한 마음으로 문을 못 열던 반려가족 사연"을 감정적으로 극대화하여 풀어내세요.
- **Before & After 대비 극대화**: 부식되어 시꺼멓게 풍경을 가리던 비포 모습과, 시공 후 망이 없는 것처럼 밖의 초록빛 풍경이 그대로 전해지는 애프터 시청각 감각 묘사.
- **마무리**: 공감을 구하며 이웃들과의 활발한 덧글 교류를 제안하는 따뜻한 마무리.
`;
      break;

    case "insight-edge":
      modeSpecificPrompt = `
[선택 모드: Insight-Edge 방충망 기술 및 단가 차별화 칼럼]
일반적인 광고 홍보 포스팅과 차별화되도록, 저가형 시공의 맹점을 과학적, 합리적으로 지적하여 충주미세방충망의 프리미엄 가치를 부각합니다.
- **주요 논점**:
  - 1. 왜 일부 저가형 방충망 업체는 국산이 아닌 저품질 재생 원사를 쓰는지 폭로.
  - 2. 방충망 코너가 쉽게 찢어지는 문제를 막기 위한 코너 결합부 보강 공정의 가치.
  - 3. 오래된 샷시의 틈새로 벌레가 우글거리는 원인인 모헤어 털 마모 문제를 진단하고, 이를 전면 무상 교체해주어야만 방충망 교체 효과가 온전하다는 전문 지식 전파.
- **효과**: 독자가 이 글을 읽은 뒤 "아, 무조건 싼 곳에서 망만 갈아끼우면 손해구나. 정석대로 꼼꼼히 해주는 [충주미세방충망]에 맡겨야겠다"라는 확신을 심어주도록 품격 있게 구성하세요.
`;
      break;
  }

  return `
${basePersona}

${modeSpecificPrompt}

위 가이드를 엄격히 준수하여 포스팅을 생성해 주세요. 
반환 형식은 반드시 JSON 문자열 형식이어야 하며, 다른 서론/설명 없이 오직 아래 구조의 JSON 데이터만 출력하세요. 마크다운의 \`\`\`json 블록으로 감싸주세요.

{
  "title": "여기에 포스팅 최적화 제목을 입력하세요 (메인 키워드가 반드시 자연스럽게 들어가야 함)",
  "body": "여기에 문단별로 <p>, <h2>, <h3>, <strong>, <table>, <tr>, <td> 등의 HTML 태그를 적절히 활용하여 작성한 풍부한 본문 전체 텍스트를 기입하세요. 이미지 삽입 권장 지점은 가이드 문구로 반드시 삽입해야 합니다."
}
`;
}

// Gemini API 호출 함수 (REST API) - 안정적인 폴백 메커니즘 적용
async function callGeminiAPI(promptText) {
  // 1차 시도: v1 (정식 출시 버전을 사용하는 gemini-1.5-flash)
  try {
    console.log("Gemini API 1차 시도 (v1 / gemini-1.5-flash)...");
    return await executeGeminiRequest("v1", "gemini-1.5-flash", promptText);
  } catch (error) {
    console.warn("1차 시도 실패. 2차 시도를 진행합니다 (v1beta / gemini-1.5-flash-latest).", error);
    // 2차 시도: v1beta (최신 알리어스를 사용하는 gemini-1.5-flash-latest)
    try {
      return await executeGeminiRequest("v1beta", "gemini-1.5-flash-latest", promptText);
    } catch (error2) {
      console.warn("2차 시도 실패. 최종 시도를 진행합니다 (v1beta / gemini-1.5-flash).", error2);
      // 3차 시도: v1beta (기존의 v1beta / gemini-1.5-flash)
      return await executeGeminiRequest("v1beta", "gemini-1.5-flash", promptText);
    }
  }
}

// 실제 HTTP 통신을 담당하는 헬퍼 함수
async function executeGeminiRequest(apiVersion, modelName, promptText) {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${geminiApiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error?.message || `${apiVersion}/${modelName} 호출 실패`);
  }

  const resJson = await response.json();
  const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResult) {
    throw new Error("결과 텍스트를 받지 못했습니다.");
  }

  return textResult;
}

// API 원시 응답 JSON 파싱
function parseGeminiResponse(rawText) {
  try {
    // 마크다운 JSON 블록이 감싸져 있을 수 있으므로 정제
    let cleanText = rawText.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    const parsed = JSON.parse(cleanText);
    return {
      title: parsed.title || "충주미세방충망 시공 후기",
      body: parsed.body || "<p>내용이 올바르게 생성되지 않았습니다.</p>"
    };
  } catch (e) {
    console.error("JSON 파싱 오류, 일반 텍스트 모드로 복구합니다.", e);
    // JSON 구조가 아닐 경우의 폴백 처리
    return {
      title: "충주미세방충망 전문 시공 현장 일지",
      body: `<p>${rawText.replace(/\n/g, "<br>")}</p>`
    };
  }
}

// 5. SEO 검증 실시간 스코어보드 업데이트
function updateSeoMetrics(bodyText) {
  // 글자 수 측정 (HTML 태그 제거 후 공백 제외 글자 수)
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = bodyText;
  const pureText = tempDiv.textContent || tempDiv.innerText || "";
  const charCount = pureText.replace(/\s/g, "").length;

  const seoWordCountEl = document.getElementById("seo-word-count");
  if (charCount >= 1300) {
    seoWordCountEl.innerHTML = `<span class="text-green-600 font-bold">${charCount}자 (적정)</span>`;
  } else {
    seoWordCountEl.innerHTML = `<span class="text-amber-500 font-bold">${charCount}자 (다소 부족, 권장 1,500자)</span>`;
  }

  // 핵심 키워드 반복 횟수 측정
  const city = document.getElementById("select-city").value;
  const mainKeyword = `${city}미세방충망`;
  
  // 정규식 매칭을 통해 등장 횟수 산출
  const regex = new RegExp(mainKeyword, "g");
  const matches = pureText.match(regex);
  const keywordCount = matches ? matches.length : 0;

  const seoKeywordCountEl = document.getElementById("seo-keyword-count");
  if (keywordCount >= 5 && keywordCount <= 9) {
    seoKeywordCountEl.innerHTML = `<span class="text-green-600 font-bold">${keywordCount}회 (최적)</span>`;
  } else if (keywordCount < 5) {
    seoKeywordCountEl.innerHTML = `<span class="text-amber-500 font-bold">${keywordCount}회 (부족, 5~8회 권장)</span>`;
  } else {
    seoKeywordCountEl.innerHTML = `<span class="text-rose-500 font-bold">${keywordCount}회 (과다, 8회 이하 권장)</span>`;
  }
}

// 6. 네이버 블로그 에디터 탭으로 글 주입
async function handleSendToNaver() {
  const title = document.getElementById("result-title").value;
  const body = document.getElementById("result-body-preview").innerHTML;

  // 1. 활성화된 탭 중 네이버 스마트에디터가 켜져 있는 탭을 조회
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tabs.length === 0) {
    alert("활성화된 브라우저 탭을 찾을 수 없습니다.");
    return;
  }

  const activeTab = tabs[0];
  const url = activeTab.url || "";
  
  // 네이버 글쓰기 페이지 검증
  if (!url.includes("blog.naver.com") && !url.includes("blog.write.naver.com")) {
    alert("현재 활성화된 크롬 탭이 네이버 블로그 글쓰기 페이지가 아닙니다.\n왼쪽 화면에 네이버 에디터 창을 열어두고 다시 시도해 주세요.");
    return;
  }

  // 2. content.js 스크립트 주입 및 메시지 전송
  try {
    // 탭에 스크립트가 이미 활성화되어 있는지 확인하기 위해 메시지 송신 테스트
    chrome.tabs.sendMessage(activeTab.id, { action: "ping" }, (response) => {
      // 에러가 나거나 응답이 없다면 수동 인젝션 실행
      if (chrome.runtime.lastError || !response) {
        injectContentScriptAndSendData(activeTab.id, title, body);
      } else {
        // 이미 스크립트가 실행 중이므로 바로 전송
        chrome.tabs.sendMessage(activeTab.id, { action: "injectPost", title, body }, (res) => {
          if (res && res.success) {
            alert("제목과 본문이 네이버 스마트에디터로 성공적으로 입력되었습니다!\n\n이제 사진 카드를 원하시는 자리에 차례로 드래그해서 넣어주세요.");
          } else {
            alert("데이터 입력에 실패했습니다. 에디터를 한 번 클릭하신 후 다시 시도해 주세요.");
          }
        });
      }
    });
  } catch (err) {
    console.error("인젝션 오류: ", err);
    alert("네이버 전송 중 오류가 발생했습니다: " + err.message);
  }
}

// 수동 스크립트 인젝션 후 데이터 주입
function injectContentScriptAndSendData(tabId, title, body) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ["content.js"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      alert("네이버 스마트에디터에 인젝션 스크립트를 삽입할 수 없습니다. 페이지를 새로고침 해보세요.");
      return;
    }
    
    // 약간의 딜레이를 주어 content.js 로드 완료 대기 후 전송
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: "injectPost", title, body }, (res) => {
        if (res && res.success) {
          alert("제목과 본문이 네이버 스마트에디터로 성공적으로 입력되었습니다!\n\n이제 사진 카드를 원하시는 자리에 차례로 드래그해서 넣어주세요.");
        } else {
          alert("네이버 스마트에디터에 연결되었으나 입력을 완료하지 못했습니다. 글쓰기 영역을 한 번 마우스로 클릭한 뒤 다시 전송을 눌러주세요.");
        }
      });
    }, 150);
  });
}
