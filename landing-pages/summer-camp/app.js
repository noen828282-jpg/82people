// 1. D-Day Countdown Timer
const TARGET_DATE = new Date('2026-07-30T12:00:00').getTime();

function updateCountdown() {
  const now = new Date().getTime();
  const distance = TARGET_DATE - now;

  const daysElement = document.getElementById('days');
  const hoursElement = document.getElementById('hours');
  const minutesElement = document.getElementById('minutes');
  const secondsElement = document.getElementById('seconds');

  if (distance < 0) {
    // Timer expired
    if (daysElement) {
      document.getElementById('countdown').innerHTML = "<div class='time-num' style='font-size: 1.8rem; background: linear-gradient(90deg, #ff7b54, #ffb26b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 800;'>WAVES & VIBES 바캉스가 시작되었습니다!</div>";
    }
    return;
  }

  // Time calculations
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  // Output the results
  if (daysElement) daysElement.innerText = String(days).padStart(2, '0');
  if (hoursElement) hoursElement.innerText = String(hours).padStart(2, '0');
  if (minutesElement) minutesElement.innerText = String(minutes).padStart(2, '0');
  if (secondsElement) secondsElement.innerText = String(seconds).padStart(2, '0');
}

// Run countdown immediately and then update every second
updateCountdown();
setInterval(updateCountdown, 1000);


// 2. Itinerary Tab Switcher
let activeDay = 1;
function switchTab(dayNum) {
  activeDay = dayNum;
  
  // Deactivate all tab buttons
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    btn.classList.remove('active');
  });

  // Activate selected button
  const selectedBtn = document.getElementById(`tab-btn-${dayNum}`);
  if (selectedBtn) selectedBtn.classList.add('active');

  renderItinerary();
}

// ==========================================================================
// 2.5 Real-time Cloud Synchronization Logic (keyvalue.immanuel.co + lz-string)
// ==========================================================================
const CLOUD_API_KEY = 'e5jke3u4';

let syncStatusTimeout = null;

function updateSyncStatus(status, text) {
  const badge = document.getElementById('sync-status');
  const textEl = badge ? badge.querySelector('.sync-text') : null;
  const iconEl = badge ? badge.querySelector('.sync-icon') : null;
  if (!badge || !textEl || !iconEl) return;
  
  // Clear any existing fade-out timeout
  if (syncStatusTimeout) {
    clearTimeout(syncStatusTimeout);
    syncStatusTimeout = null;
  }
  
  // Add 'visible' class along with status
  badge.className = 'sync-status visible ' + status; // status: 'syncing', 'synced', 'failed'
  textEl.innerText = text;
  
  if (status === 'syncing') {
    iconEl.setAttribute('icon', 'solar:restart-bold');
  } else if (status === 'synced') {
    iconEl.setAttribute('icon', 'solar:cloud-check-bold');
    // Fade out after 2.5 seconds
    syncStatusTimeout = setTimeout(() => {
      badge.classList.remove('visible');
    }, 2500);
  } else if (status === 'failed') {
    iconEl.setAttribute('icon', 'solar:cloud-cross-bold');
    // Keep visible longer on failure, fade out after 6 seconds
    syncStatusTimeout = setTimeout(() => {
      badge.classList.remove('visible');
    }, 6000);
  }
}

// Convert Standard Base64 to URL Safe Base64URL
function toBase64Url(base64) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convert Base64URL back to Standard Base64
function fromBase64Url(base64Url) {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64;
}

// Generic function to save data to the cloud in 150-char chunks
async function cloudSave(key, data) {
  try {
    const jsonStr = JSON.stringify(data);
    const compressed = LZString.compressToBase64(jsonStr);
    const safeBase64 = toBase64Url(compressed);
    
    // Chunking (URL segment max length around 180 chars, using 150 for absolute safety)
    const chunkSize = 150;
    const chunks = [];
    for (let i = 0; i < safeBase64.length; i += chunkSize) {
      chunks.push(safeBase64.substring(i, i + chunkSize));
    }
    
    const count = chunks.length;
    
    // Save chunks in parallel
    const promises = chunks.map((chunk, index) => {
      const url = `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${CLOUD_API_KEY}/${key}_chunk_${index}/${chunk}`;
      return fetch(url, { method: 'POST' });
    });
    
    // Save count
    const countUrl = `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${CLOUD_API_KEY}/${key}_count/${count}`;
    promises.push(fetch(countUrl, { method: 'POST' }));
    
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error(`Failed to save key ${key} to cloud:`, error);
    return false;
  }
}

// Generic function to load data from the cloud
async function cloudLoad(key, defaultValue) {
  try {
    // 1. Fetch count
    const countRes = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/GetValue/${CLOUD_API_KEY}/${key}_count`);
    if (!countRes.ok) return defaultValue;
    const countStr = await countRes.json();
    if (!countStr) return defaultValue;
    
    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) return defaultValue;
    
    // 2. Fetch chunks in parallel
    const chunkPromises = [];
    for (let i = 0; i < count; i++) {
      chunkPromises.push(
        fetch(`https://keyvalue.immanuel.co/api/KeyVal/GetValue/${CLOUD_API_KEY}/${key}_chunk_${i}`)
          .then(res => res.json())
      );
    }
    
    const chunkValues = await Promise.all(chunkPromises);
    if (chunkValues.some(v => v === null)) {
      return defaultValue;
    }
    
    const safeBase64 = chunkValues.join('');
    const base64 = fromBase64Url(safeBase64);
    const decompressed = LZString.decompressFromBase64(base64);
    if (!decompressed) return defaultValue;
    
    return JSON.parse(decompressed);
  } catch (error) {
    console.error(`Failed to load key ${key} from cloud:`, error);
    return defaultValue;
  }
}

let cloudSaveTimeout = null;
function triggerCloudSync() {
  updateSyncStatus('syncing', '클라우드에 저장 중...');
  if (cloudSaveTimeout) clearTimeout(cloudSaveTimeout);
  
  cloudSaveTimeout = setTimeout(async () => {
    const state = {
      checklist,
      budget,
      totalDue,
      summaryData,
      itineraryData,
      rolesData
    };
    const success = await cloudSave('camp_state_v4', state);
    if (success) {
      updateSyncStatus('synced', '클라우드 동기화 완료');
    } else {
      updateSyncStatus('failed', '동기화 실패 (오프라인?)');
    }
  }, 1500); // 1.5s debounce
}

async function syncFromCloud() {
  updateSyncStatus('syncing', '클라우드 동기화 중...');
  const remoteState = await cloudLoad('camp_state_v4', null);
  if (remoteState) {
    const localState = {
      checklist,
      budget,
      totalDue,
      summaryData,
      itineraryData,
      rolesData
    };
    
    // Only update and re-render if data has actually changed
    if (JSON.stringify(remoteState) !== JSON.stringify(localState)) {
      checklist = remoteState.checklist || checklist;
      budget = remoteState.budget || budget;
      totalDue = remoteState.totalDue !== undefined ? remoteState.totalDue : totalDue;
      summaryData = remoteState.summaryData || summaryData;
      itineraryData = remoteState.itineraryData || itineraryData;
      rolesData = remoteState.rolesData || rolesData;
      
      // Update local storage cache
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklist));
      localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budget));
      localStorage.setItem(TOTAL_DUE_STORAGE_KEY, totalDue);
      localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(summaryData));
      localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(itineraryData));
      localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(rolesData));
      
      // Re-render components
      renderSummaryGrid();
      renderItinerary();
      renderRoles();
      renderChecklist();
      renderBudgetTable();
      updateBudgetDashboard();
    }
    updateSyncStatus('synced', '클라우드 동기화 완료');
  } else {
    // If no data exists in cloud, initialize with current baseline
    updateSyncStatus('syncing', '클라우드 초기 데이터 설정 중...');
    const state = {
      checklist,
      budget,
      totalDue,
      summaryData,
      itineraryData,
      rolesData
    };
    const success = await cloudSave('camp_state_v4', state);
    if (success) {
      updateSyncStatus('synced', '클라우드 동기화 완료');
    } else {
      updateSyncStatus('failed', '동기화 실패');
    }
  }
}

// 3. Dynamic Checklist & Budget CRUD State Management
const CHECKLIST_STORAGE_KEY = '82people_summer_camp_checklist_v2';
const BUDGET_STORAGE_KEY = '82people_summer_camp_budget_v2';
const TOTAL_DUE_STORAGE_KEY = '82people_summer_camp_total_due_v2';
const SUMMARY_STORAGE_KEY = '82people_summer_camp_summary_v3';
const ITINERARY_STORAGE_KEY = '82people_summer_camp_itinerary_v3';
const ROLES_STORAGE_KEY = '82people_summer_camp_roles_v2';

let totalDue = 2882437; // 총 모인 회비

const DEFAULT_SUMMARY = [
  { id: 'sum-who', title: 'Who (참석인원)', text: '총 6명 (박동민, 김진식, 홍병길, 손성무, 이태원, 하덕영)', icon: 'solar:users-group-two-rounded-bold-duotone' },
  { id: 'sum-when', title: 'When (일정)', text: '2026.07.30(목) - 08.02(일) [3박 4일]', icon: 'solar:calendar-date-bold-duotone' },
  { id: 'sum-where', title: 'Where (목적지)', text: '울진 기성망양 해수욕장 & 삼성모텔', icon: 'solar:map-point-bold-duotone' },
  { id: 'sum-what', title: 'What (주요 활동)', text: '수중 해루질, 인생 2막 라이프 세션, 킹크랩 만찬', icon: 'solar:compass-bold-duotone' }
];

const DEFAULT_ROLES = [
  { id: 'role-1', title: '총괄 PM', desc: '전체 일정 조율, 차량 및 집결지 관리, 최종 비상 상황 의사결정 총괄.', icon: 'solar:crown-bold-duotone' },
  { id: 'role-2', title: '회계 (총무)', desc: '회비 사전 수납 및 관리, 현장 실시간 카드/현금 정산, 영수증 취합 및 예비비 방어.', icon: 'solar:wad-of-money-bold-duotone' },
  { id: 'role-3', title: '2Chef (메인 요리사)', desc: '전체 일정 먹거리 식단 기획, 백숙/BBQ 조리 지휘 및 남은 식자재 최적화 소진.', icon: 'solar:chef-hat-bold-duotone' },
  { id: 'role-4', title: '장보기 담당', desc: '5일장 전통시장 장보기 실행 및 이동식 보냉 아이스박스 보관 상태 신선도 유지.', icon: 'solar:cart-large-bold-duotone' },
  { id: 'role-5', title: '안전 책임자', desc: '해루질 수중 장비 점검, 현지 날씨 및 밀물/썰물 시간 확인, 음주 후 입수 절대 금지 통제.', icon: 'solar:shield-warning-bold-duotone' },
  { id: 'role-6', title: '기록 담당 (작가)', desc: '활동별 단체 사진 촬영, 실시간 여행 앨범 공유, 다음 모임(10주년) 아이디어 회고록 작성.', icon: 'solar:camera-bold-duotone' }
];

const DEFAULT_ITINERARY = {
  1: {
    title: '1일차: 집결 및 바다의 서막',
    items: [
      { time: '09:00 - 11:30', title: '각지 집결 및 청주 출발', desc: '서울권 KTX 탑승 조 및 충주권 자차 조 등 최종 청주 집결. 인원, 차량 배차 및 출발 인원 최종 점검.', badge: '체크: 지연자 발생 여부 실시간 확인' },
      { time: '11:30 - 13:00', title: '5일장 전통시장 정밀 장보기', desc: '바베큐용 돼지고기, 백숙용 생닭, 야채류(부추 등), 분식 식사거리, 음료 및 캠핑 소모품 대량 구매.', badge: '체크: 장보기 체크리스트 지참 및 총무 예산 집행 동행' },
      { time: '13:00 - 16:30', title: '울진 망양리로 이동', desc: '동해 해안도로를 따라 시원한 드라이브 감상 및 울진 진입.', badge: '' },
      { time: '16:30 - 17:30', title: '숙소 체크인 및 장비 세팅', desc: '울진 삼성모텔 체크인 및 방 배정. 신선식품 보관 및 물놀이 장비 사전 정비.', badge: '체크: 삼성모텔 예약 내역 및 방 개수 확인' },
      { time: '17:30 - 19:30', title: '첫 해변 수중탐사 (해루질)', desc: '기성망양 해변에 메인 타프 및 베이스캠프 구축. 기상과 파도 상태, 물때를 고려하여 가벼운 수중 탐사 및 해루질 시작.', badge: '체크: 안전 장비 착용 및 현지 날씨/조석 확인' },
      { time: '19:30~', title: '웰컴 BBQ 및 밤바다 만찬', desc: '숯불 삼겹살/목살구이와 신선한 현지 조개구이 만찬. 밤바다 소리와 함께하는 첫날밤 감성 토크.', badge: '' }
    ]
  },
  2: {
    title: '2일차: 파도와 열정, 그리고 미드나잇 라디오',
    items: [
      { time: '~11:00', title: '여유로운 기상 및 해장 식사', desc: '천천히 기상하여 속풀이 식사 준비. 장에서 본 재료로 해물라면 또는 몸보신용 백숙 조리.', badge: '체크: 과음 숙취 케어 및 충분한 수분 섭취' },
      { time: '11:00 - 13:00', title: '아이스 커피 & 해변 산책', desc: '망양리 인근 오션뷰 카페 방문. 맑은 바다를 보며 즐기는 모닝 티타임과 산책.', badge: '' },
      { time: '13:00 - 16:00', title: '본격 메인 해루질 세션', desc: '기성망양의 투명한 바닷속 진입. 스노클링 및 해산물 채취 활동.', badge: '체크: 수중 안전 절대 최우선, 2인 1조 버디제 필수' },
      { time: '16:00 - 18:00', title: '해변 스포츠 (족구 등)', desc: '모래사장 위에서 펼쳐지는 82PEOPLE 미니 체육대회. 설거지 및 뒷정리 벌칙 내기 룰 적용.', badge: '체크: 무리한 신체 접촉으로 인한 부상 방지' },
      { time: '18:00 - 21:00', title: '자연산 수산물 요리 만찬', desc: '직접 채취한 싱싱한 해산물 요리와 로컬 식재료를 활용한 야외 캠프 디너 파티.', badge: '' },
      { time: '21:00 - 03:00', title: '음주가무 & "인생 2막 설계" 라이프 세션', desc: '신나는 댄스 파티와 옛 노래 메들리. 중년의 초입에서 각자의 커리어, 가족, 인생 2막의 버킷리스트와 구체적인 목표를 함께 고민하고 정립하는 메인 미팅.', badge: '체크: 밤샘으로 인한 안전 위험 방지, 중간 휴식 시간 확보' }
    ]
  },
  3: {
    title: '3일차: 바다의 절정과 초호화 갈라 디너',
    items: [
      { time: '~12:00', title: '늦은 아침 및 든든한 브런치', desc: '느긋하게 일어나 잔여 식자재(백숙 고기 등)로 고소한 닭죽 조리 및 든든한 브런치 타임.', badge: '' },
      { time: '12:00 - 15:30', title: '자유 시간 및 힐링 액티비티', desc: '각자 선호하는 활동 진행: 바다 낚시 조, 해안길 드라이브 조, 혹은 백사장에서 낮잠 및 독서.', badge: '체크: 남은 소모품, 주류 및 생수 잔량 최종 점검' },
      { time: '15:30 - 17:00', title: '베이스캠프 철수 및 환경 정화', desc: '해변의 메인 천막/타프 철수 및 차량 적재. 82PEOPLE 클린 비치 캠페인 실행(쓰레기 수거).', badge: '체크: 개인 소지품 분실 주의, 차량 적재 밸런스 유지' },
      { time: '17:00 - 19:30', title: '개인 정돈 및 디너 세팅', desc: '모텔 샤워 및 깔끔한 복장 정돈. 갈라 디너를 위한 테이블 세팅 및 식기 준비.', badge: '' },
      { time: '19:30 - 23:00', title: '스페셜 이벤트: 킹크랩 & 랍스터 만찬', desc: '울진 최고의 특산품인 대게/킹크랩/랍스터를 공수하여 벌이는 초호화 갈라 만찬 파티.', badge: '체크: 현지 조리 예약 시간 및 픽업 동선 사전 확정' },
      { time: '23:00 - 03:00', title: '9회 캠프 후일담 & 차기 10주년 로드맵 기획', desc: '이번 여행의 단체 사진과 베스트 컷 공유. 9년간의 모임을 돌아보고 내년 기념비적인 **10주년 모임**에 대한 사전 아이디어 회의.', badge: '' }
    ]
  },
  4: {
    title: '4일차: 파도 소리를 가슴에 안고, 일상으로 리셋',
    items: [
      { time: '~11:00', title: '체크아웃 및 최종 객실 정리', desc: '삼성모텔 쓰레기 분리배출, 남은 짐 적재 및 최종 객실 키 반납.', badge: '체크: 두고 가는 물건(충전기, 의류 등) 없는지 세밀하게 점검' },
      { time: '11:00 - 13:00', title: '울진 작별 점심식사', desc: '울진 로컬 맛집(짬뽕 등 중식 또는 시원한 물회)에서 여행을 마무리하는 든든한 점심 식사.', badge: '체크: 총무의 회비 최종 정산 결과 공유 및 예비비 잔액 이월 처리' },
      { time: '13:00~', title: '각지 복귀 및 안전 운전', desc: '청주를 경유하여 서울/충주 등 각자의 원래 위치로 안전 귀가.', badge: '' }
    ]
  }
};

const DEFAULT_CHECKLIST = [
  { id: 'chk-1', text: '삼성모텔 예약 확정 및 예약된 객실 크기/개수 최종 재확인', checked: false },
  { id: 'chk-2', text: '참석자별 도착 시간표 공유 (서울 KTX조 시간 확인 및 자차 카풀 매칭 완료)', checked: false },
  { id: 'chk-3', text: '전통 5일장 장보기용 구매 수량 확정 및 1차 마트 장보기 담당자 조율', checked: false },
  { id: 'chk-4', text: '해루질용 수중 써치 랜턴, 장갑, 래시가드 및 아쿠아슈즈 개인 장비 지참 알림', checked: false },
  { id: 'chk-5', text: '캠프용 보냉 아이스박스, 생수 보냉팩, 대형 쓰레기 종량제 봉투 및 롤화장지 구비', checked: false },
  { id: 'chk-6', text: '회비 전용 통장 개설 및 1차 선입금 회비 (1인당 30만 원) 입금 상태 점검', checked: false },
  { id: 'chk-7', text: '스페셜 이벤트 킹크랩/랍스터 도매처 예약 확정 및 현지 수령 시간 조율', checked: false }
];

const DEFAULT_BUDGET = [
  { id: 'bd-1', category: 'Special Event', item: '킹크랩, 랍스터, 7080 노래방, 복귀 식사', cost: 1777000, color: 'color-event' },
  { id: 'bd-2', category: '숙박비', item: '삼성모텔 2객실 x 3박 기준', cost: 360000, color: 'color-stay' },
  { id: 'bd-3', category: '안주 및 식자재', item: '돼지고기, 생닭, 부추, 분식류, 부자재 소모품', cost: 340000, color: 'color-food' },
  { id: 'bd-4', category: '주류', item: '소주 70병, 맥주 40캔, 음료수, 생수', cost: 185000, color: 'color-drink' },
  { id: 'bd-5', category: '배달 및 기타', item: '짜장면 배달 및 마무리 정산 잡비', cost: 105000, color: 'color-misc' }
];

let checklist = [];
let budget = [];
let summaryData = [];
let itineraryData = {};
let rolesData = [];

let isChecklistEditMode = false;
let isBudgetEditMode = false;
let isSummaryEditMode = false;
let isItineraryEditMode = false;
let isRolesEditMode = false;
let isTotalDueEditing = false;

// Initialize state
document.addEventListener('DOMContentLoaded', () => {
  initData();
  renderSummaryGrid();
  renderItinerary();
  renderRoles();
  renderChecklist();
  renderBudgetTable();
  updateBudgetDashboard();
  
  // Start cloud sync
  syncFromCloud();
});

function initData() {
  const savedChecklist = localStorage.getItem(CHECKLIST_STORAGE_KEY);
  if (savedChecklist) {
    try {
      checklist = JSON.parse(savedChecklist);
    } catch (e) {
      checklist = DEFAULT_CHECKLIST;
    }
  } else {
    checklist = DEFAULT_CHECKLIST;
    saveChecklist();
  }

  const savedBudget = localStorage.getItem(BUDGET_STORAGE_KEY);
  if (savedBudget) {
    try {
      budget = JSON.parse(savedBudget);
    } catch (e) {
      budget = DEFAULT_BUDGET;
    }
  } else {
    budget = DEFAULT_BUDGET;
    saveBudget();
  }

  const savedTotalDue = localStorage.getItem(TOTAL_DUE_STORAGE_KEY);
  if (savedTotalDue) {
    totalDue = Number(savedTotalDue) || 2882437;
  } else {
    totalDue = 2882437;
    localStorage.setItem(TOTAL_DUE_STORAGE_KEY, totalDue);
  }

  const savedSummary = localStorage.getItem(SUMMARY_STORAGE_KEY);
  if (savedSummary) {
    try {
      summaryData = JSON.parse(savedSummary);
    } catch (e) {
      summaryData = DEFAULT_SUMMARY;
    }
  } else {
    summaryData = DEFAULT_SUMMARY;
    saveSummary();
  }

  const savedItinerary = localStorage.getItem(ITINERARY_STORAGE_KEY);
  if (savedItinerary) {
    try {
      itineraryData = JSON.parse(savedItinerary);
    } catch (e) {
      itineraryData = DEFAULT_ITINERARY;
    }
  } else {
    itineraryData = DEFAULT_ITINERARY;
    saveItinerary();
  }

  const savedRoles = localStorage.getItem(ROLES_STORAGE_KEY);
  if (savedRoles) {
    try {
      rolesData = JSON.parse(savedRoles);
    } catch (e) {
      rolesData = DEFAULT_ROLES;
    }
  } else {
    rolesData = DEFAULT_ROLES;
    saveRoles();
  }
}

function saveChecklist() {
  localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklist));
  triggerCloudSync();
}

function saveBudget() {
  localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budget));
  triggerCloudSync();
}

// --- CHECKLIST CRUD LOGIC ---

function renderChecklist() {
  const container = document.getElementById('checklist-container');
  if (!container) return;

  let html = '';

  if (isChecklistEditMode) {
    html += '<ul class="checklist-list">';
    checklist.forEach(item => {
      html += `
        <li class="checklist-item" style="display:flex; justify-content:space-between; align-items:center;">
          <div class="checklist-item-edit-wrapper">
            <button class="delete-item-btn" onclick="deleteChecklistItem('${item.id}')" title="삭제"><iconify-icon icon="solar:trash-bin-trash-bold" style="font-size: 0.85rem; display: flex; align-items: center; justify-content: center;"></iconify-icon></button>
            <input type="text" class="checklist-edit-input" value="${item.text}" onchange="editChecklistItemText('${item.id}', this.value)">
          </div>
        </li>
      `;
    });
    html += '</ul>';
    
    // Add item form
    html += `
      <div class="checklist-add-form">
        <input type="text" id="new-checklist-text" class="checklist-add-input" placeholder="새로운 준비 사항을 입력하세요...">
        <button class="action-btn primary" onclick="addChecklistItem()">추가</button>
      </div>
    `;
  } else {
    if (checklist.length === 0) {
      html += '<p style="text-align:center; color:var(--text-secondary); padding:20px 0;">등록된 체크 항목이 없습니다.</p>';
    } else {
      html += '<ul class="checklist-list">';
      checklist.forEach(item => {
        html += `
          <li class="checklist-item">
            <input type="checkbox" id="${item.id}" ${item.checked ? 'checked' : ''} onchange="toggleChecklistItem('${item.id}')">
            <label for="${item.id}">
              <span class="custom-checkbox"><iconify-icon icon="solar:check-bold"></iconify-icon></span>
              <span class="chk-text">${item.text}</span>
            </label>
          </li>
        `;
      });
      html += '</ul>';
    }
  }

  container.innerHTML = html;
}

function toggleChecklistEditMode() {
  isChecklistEditMode = !isChecklistEditMode;
  const btn = document.getElementById('edit-checklist-btn');
  if (btn) {
    if (isChecklistEditMode) {
      btn.innerText = '수정 완료';
      btn.classList.add('editing');
    } else {
      btn.innerText = '리스트 수정';
      btn.classList.remove('editing');
    }
  }
  renderChecklist();
}

function toggleChecklistItem(id) {
  const item = checklist.find(i => i.id === id);
  if (item) {
    item.checked = !item.checked;
    saveChecklist();
  }
}

function editChecklistItemText(id, newText) {
  const item = checklist.find(i => i.id === id);
  if (item && newText.trim()) {
    item.text = newText.trim();
    saveChecklist();
  }
}

function addChecklistItem() {
  const input = document.getElementById('new-checklist-text');
  if (!input || !input.value.trim()) return;

  const newItem = {
    id: 'chk-' + Date.now(),
    text: input.value.trim(),
    checked: false
  };

  checklist.push(newItem);
  saveChecklist();
  renderChecklist();
}

function deleteChecklistItem(id) {
  checklist = checklist.filter(item => item.id !== id);
  saveChecklist();
  renderChecklist();
}

function resetChecklist() {
  if (confirm('모든 체크 상태를 해제하시겠습니까?')) {
    checklist.forEach(item => {
      item.checked = false;
    });
    saveChecklist();
    renderChecklist();
  }
}

// --- BUDGET TABLE CRUD LOGIC ---

function renderBudgetTable() {
  const container = document.getElementById('budget-table-container');
  if (!container) return;

  let totalSpent = budget.reduce((sum, item) => sum + Number(item.cost), 0);

  let html = '';
  html += `<table>
    <thead>
      <tr>
        <th style="width: 25%;">구분</th>
        <th style="width: 45%;">주요 내역</th>
        <th style="width: 20%;">지정 예산</th>
        <th style="width: 10%; text-align:center;">${isBudgetEditMode ? '작업' : '비중'}</th>
      </tr>
    </thead>
    <tbody>`;

  budget.forEach(item => {
    let percentage = totalSpent > 0 ? ((item.cost / totalSpent) * 100).toFixed(1) : 0;
    let colorClass = item.color || 'color-misc';
    
    if (isBudgetEditMode) {
      html += `
        <tr>
          <td>
            <input type="text" class="table-input" value="${item.category}" onchange="updateBudgetItemField('${item.id}', 'category', this.value)">
          </td>
          <td>
            <input type="text" class="table-input" value="${item.item}" onchange="updateBudgetItemField('${item.id}', 'item', this.value)">
          </td>
          <td>
            <input type="number" class="table-input" value="${item.cost}" onchange="updateBudgetItemField('${item.id}', 'cost', this.value)">
          </td>
          <td style="text-align:center;">
            <button class="table-action-btn" onclick="deleteBudgetItem('${item.id}')">삭제</button>
          </td>
        </tr>
      `;
    } else {
      html += `
        <tr>
          <td><span class="indicator ${colorClass}"></span>${item.category}</td>
          <td>${item.item}</td>
          <td>${formatNumber(item.cost)}₩</td>
          <td style="text-align:center;">${percentage}%</td>
        </tr>
      `;
    }
  });

  if (isBudgetEditMode) {
    // Row for adding new items
    html += `
      <tr class="budget-add-row">
        <td>
          <input type="text" id="new-budget-category" class="table-input" placeholder="구분 예: 식비">
        </td>
        <td>
          <input type="text" id="new-budget-item" class="table-input" placeholder="상세 내용 입력">
        </td>
        <td>
          <input type="number" id="new-budget-cost" class="table-input" placeholder="금액">
        </td>
        <td style="text-align:center;">
          <button class="action-btn primary" style="padding: 4px 12px; font-size: 0.75rem; border-radius: 6px;" onclick="addBudgetItem()">추가</button>
        </td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function toggleBudgetEditMode() {
  isBudgetEditMode = !isBudgetEditMode;
  const btn = document.getElementById('edit-budget-btn');
  if (btn) {
    if (isBudgetEditMode) {
      btn.innerText = '수정 완료';
      btn.classList.add('editing');
    } else {
      btn.innerText = '지출 수정';
      btn.classList.remove('editing');
    }
  }
  renderBudgetTable();
  updateBudgetDashboard();
}

function updateBudgetItemField(id, field, value) {
  const item = budget.find(i => i.id === id);
  if (item) {
    if (field === 'cost') {
      item.cost = Number(value) || 0;
    } else {
      item[field] = value;
    }
    saveBudget();
    updateBudgetDashboard();
  }
}

function addBudgetItem() {
  const categoryInput = document.getElementById('new-budget-category');
  const itemInput = document.getElementById('new-budget-item');
  const costInput = document.getElementById('new-budget-cost');

  if (!categoryInput || !itemInput || !costInput) return;

  const category = categoryInput.value.trim();
  const itemText = itemInput.value.trim();
  const cost = Number(costInput.value) || 0;

  if (!category || !itemText) return;

  const colors = ['color-event', 'color-stay', 'color-food', 'color-drink', 'color-misc'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const newItem = {
    id: 'bd-' + Date.now(),
    category,
    item: itemText,
    cost,
    color: randomColor
  };

  budget.push(newItem);
  saveBudget();
  renderBudgetTable();
  updateBudgetDashboard();
}

function deleteBudgetItem(id) {
  budget = budget.filter(item => item.id !== id);
  saveBudget();
  renderBudgetTable();
  updateBudgetDashboard();
}

function updateBudgetDashboard() {
  const totalSpent = budget.reduce((sum, item) => sum + Number(item.cost), 0);
  const reserveFund = totalDue - totalSpent;

  const totalSpentEl = document.getElementById('total-spent');
  const reserveFundEl = document.getElementById('reserve-fund');

  if (totalSpentEl) totalSpentEl.innerText = formatNumber(totalSpent) + '₩';
  if (reserveFundEl) reserveFundEl.innerText = formatNumber(reserveFund) + '₩';

  renderTotalDueContainer();
}

function renderTotalDueContainer() {
  const dueContainer = document.getElementById('total-due-container');
  if (!dueContainer) return;
  if (isBudgetEditMode || isTotalDueEditing) {
    dueContainer.innerHTML = `<input type="number" id="input-total-due" class="table-input" style="font-size: 1.4rem; font-weight: 800; margin: 4px 0; width: 100%; max-width: 180px;" value="${totalDue}" onblur="saveTotalDueInline(this.value)" onkeydown="handleTotalDueInlineKey(event, this.value)">`;
    if (isTotalDueEditing) {
      setTimeout(() => {
        const input = document.getElementById('input-total-due');
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
    }
  } else {
    dueContainer.innerHTML = `<span id="total-due-value" class="stat-value" style="cursor: pointer; position: relative;" onclick="enableTotalDueEditing(event)" title="클릭하여 수정">${formatNumber(totalDue)}₩<span class="edit-icon-mini" style="opacity: 0.6; margin-left: 6px; vertical-align: middle; display: inline-flex;"><iconify-icon icon="solar:pen-bold" style="font-size: 0.9rem;"></iconify-icon></span></span>`;
  }
}

function enableTotalDueEditing(event) {
  if (event) event.stopPropagation();
  isTotalDueEditing = true;
  renderTotalDueContainer();
}

function saveTotalDueInline(value) {
  totalDue = Number(value) || 0;
  localStorage.setItem(TOTAL_DUE_STORAGE_KEY, totalDue);
  isTotalDueEditing = false;
  updateBudgetDashboard();
  triggerCloudSync();
}

function handleTotalDueInlineKey(event, value) {
  if (event.key === 'Enter') {
    saveTotalDueInline(value);
  } else if (event.key === 'Escape') {
    isTotalDueEditing = false;
    renderTotalDueContainer();
  }
}

function updateTotalDue(value) {
  totalDue = Number(value) || 0;
  localStorage.setItem(TOTAL_DUE_STORAGE_KEY, totalDue);
  updateBudgetDashboard();
  triggerCloudSync();
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// --- SUMMARY GRID EDITING LOGIC ---
function saveSummary() {
  localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(summaryData));
  triggerCloudSync();
}

function toggleSummaryEditMode() {
  isSummaryEditMode = !isSummaryEditMode;
  const btn = document.getElementById('edit-summary-btn');
  if (btn) {
    if (isSummaryEditMode) {
      btn.innerText = '수정 완료';
      btn.classList.add('editing');
    } else {
      btn.innerText = '개요 수정';
      btn.classList.remove('editing');
    }
  }
  renderSummaryGrid();
}

function renderSummaryGrid() {
  const container = document.getElementById('summary-grid-container');
  if (!container) return;

  let html = '';
  summaryData.forEach((item, idx) => {
    if (isSummaryEditMode) {
      html += `
        <div class="summary-item" style="background: rgba(255, 255, 255, 0.8); border: 1px solid var(--primary-ocean); border-radius: 16px; padding: 16px; display: block;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div class="summary-icon-box" style="width: 32px; height: 32px; font-size: 1.1rem; border-radius: 8px;">
              <iconify-icon icon="${item.icon}"></iconify-icon>
            </div>
            <input type="text" class="table-input" style="font-weight: 700; font-size: 0.75rem; text-transform: uppercase; padding: 4px 8px;" value="${item.title}" onchange="editSummaryField(${idx}, 'title', this.value)">
          </div>
          <div>
            <textarea class="table-input" style="height: 60px; font-size: 0.85rem; line-height: 1.4; resize: none; font-family: inherit;" onchange="editSummaryField(${idx}, 'text', this.value)">${item.text}</textarea>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="summary-item">
          <div class="summary-icon-box">
            <iconify-icon icon="${item.icon}"></iconify-icon>
          </div>
          <div class="summary-info">
            <span class="summary-title">${item.title}</span>
            <span class="summary-text">${item.text}</span>
          </div>
        </div>
      `;
    }
  });

  container.innerHTML = html;
}

function editSummaryField(idx, field, value) {
  if (summaryData[idx] && value.trim()) {
    summaryData[idx][field] = value.trim();
    saveSummary();
  }
}

// --- ITINERARY EDITING LOGIC ---
function saveItinerary() {
  localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(itineraryData));
  triggerCloudSync();
}

function toggleItineraryEditMode() {
  isItineraryEditMode = !isItineraryEditMode;
  const btn = document.getElementById('edit-itinerary-btn');
  if (btn) {
    if (isItineraryEditMode) {
      btn.innerText = '수정 완료';
      btn.classList.add('editing');
    } else {
      btn.innerText = '일정 수정';
      btn.classList.remove('editing');
    }
  }
  renderItinerary();
}

function renderItinerary() {
  const container = document.getElementById('itinerary-dynamic-container');
  if (!container) return;

  const dayData = itineraryData[activeDay] || { title: '', items: [] };

  let html = '';
  if (isItineraryEditMode) {
    html += `
      <div class="itinerary-content glass-card">
        <div class="pane-title-edit-wrapper" style="margin-bottom: 24px; display: flex; gap: 10px; align-items: center; max-width: 500px;">
          <label style="font-weight: 800; font-size: 0.88rem; color: var(--text-secondary); min-width: 80px;">일차 제목:</label>
          <input type="text" class="table-input" style="font-size: 1.1rem; font-weight: 800; padding: 8px 12px;" value="${dayData.title}" onchange="editDayTitle(${activeDay}, this.value)">
        </div>
        
        <div class="timeline edit-mode-timeline" style="padding-left: 0;">
    `;

    dayData.items.forEach((item, idx) => {
      html += `
        <div class="timeline-edit-item" style="background: rgba(255,255,255,0.65); border: 1px solid rgba(0,0,0,0.05); border-radius: 14px; padding: 20px; margin-bottom: 20px; position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.01);">
          <button class="table-action-btn" style="position: absolute; top: 12px; right: 12px; padding: 4px 10px; background: rgba(239, 107, 76, 0.08);" onclick="deleteItineraryItem(${activeDay}, ${idx})" title="일정 삭제">삭제</button>
          
          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 14px; margin-bottom: 10px;">
            <div>
              <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">시간대 (예: 09:00 - 11:30)</label>
              <input type="text" class="table-input" value="${item.time || ''}" onchange="editItineraryItemField(${activeDay}, ${idx}, 'time', this.value)">
            </div>
            <div>
              <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">활동/프로그램명</label>
              <input type="text" class="table-input" value="${item.title || ''}" onchange="editItineraryItemField(${activeDay}, ${idx}, 'title', this.value)">
            </div>
          </div>
          
          <div style="margin-bottom: 10px;">
            <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">활동 세부 내용</label>
            <textarea class="table-input" style="height: 60px; resize: vertical; font-family: inherit; line-height: 1.4;" onchange="editItineraryItemField(${activeDay}, ${idx}, 'desc', this.value)">${item.desc || ''}</textarea>
          </div>
          
          <div>
            <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">체크 포인트 (선택 사항)</label>
            <input type="text" class="table-input" placeholder="예: 체크: 장보기 체크리스트 지참" value="${item.badge || ''}" onchange="editItineraryItemField(${activeDay}, ${idx}, 'badge', this.value)">
          </div>
        </div>
      `;
    });

    html += `
        </div>
        <button class="action-btn primary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; border-radius: 12px; margin-top: 10px;" onclick="addItineraryItem(${activeDay})">
          <iconify-icon icon="solar:add-circle-bold" style="font-size: 1.15rem;"></iconify-icon>
          <span>새 일정 추가</span>
        </button>
      </div>
    `;
  } else {
    html += `
      <div class="itinerary-content glass-card">
        <h3 class="pane-title">${dayData.title}</h3>
        <div class="timeline">
    `;

    if (dayData.items.length === 0) {
      html += '<p style="text-align:center; color:var(--text-secondary); padding:40px 0;">등록된 일정이 없습니다.</p>';
    } else {
      dayData.items.forEach(item => {
        const badgeHtml = item.badge ? `<span class="point-badge">${item.badge}</span>` : '';
        html += `
          <div class="timeline-item">
            <div class="time-marker">${item.time || ''}</div>
            <div class="timeline-content">
              <h4>${item.title || ''}</h4>
              <p>${item.desc || ''}</p>
              ${badgeHtml}
            </div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function editDayTitle(dayNum, title) {
  if (itineraryData[dayNum]) {
    itineraryData[dayNum].title = title;
    saveItinerary();
  }
}

function editItineraryItemField(dayNum, idx, field, value) {
  if (itineraryData[dayNum] && itineraryData[dayNum].items[idx]) {
    itineraryData[dayNum].items[idx][field] = value;
    saveItinerary();
  }
}

function addItineraryItem(dayNum) {
  if (itineraryData[dayNum]) {
    itineraryData[dayNum].items.push({
      time: '12:00 - 13:00',
      title: '새 일정',
      desc: '일정 상세 내용을 입력하세요.',
      badge: ''
    });
    saveItinerary();
    renderItinerary();
  }
}

function deleteItineraryItem(dayNum, idx) {
  if (itineraryData[dayNum] && itineraryData[dayNum].items) {
    itineraryData[dayNum].items.splice(idx, 1);
    saveItinerary();
    renderItinerary();
  }
}

// --- ROLES EDITING LOGIC ---
function saveRoles() {
  localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(rolesData));
  triggerCloudSync();
}

function toggleRolesEditMode() {
  isRolesEditMode = !isRolesEditMode;
  const btn = document.getElementById('edit-roles-btn');
  if (btn) {
    if (isRolesEditMode) {
      btn.innerText = '수정 완료';
      btn.classList.add('editing');
    } else {
      btn.innerText = '역할 수정';
      btn.classList.remove('editing');
    }
  }
  renderRoles();
}

function renderRoles() {
  const container = document.getElementById('roles-grid-container');
  if (!container) return;

  let html = '';
  rolesData.forEach(role => {
    if (isRolesEditMode) {
      html += `
        <div class="glass-card role-card" style="padding: 20px; position: relative;">
          <button class="table-action-btn" style="position: absolute; top: 12px; right: 12px; padding: 4px 10px; background: rgba(239, 107, 76, 0.08);" onclick="deleteRole('${role.id}')">삭제</button>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; margin-top: 16px;">
            <div class="role-icon-box" style="width: 32px; height: 32px; font-size: 1.1rem; border-radius: 8px; margin: 0;">
              <iconify-icon icon="${role.icon}"></iconify-icon>
            </div>
            <input type="text" class="table-input" style="font-weight: 800; font-size: 1rem;" value="${role.title}" onchange="editRoleField('${role.id}', 'title', this.value)">
          </div>
          <div>
            <textarea class="table-input" style="height: 70px; font-size: 0.85rem; line-height: 1.4; resize: vertical; font-family: inherit;" onchange="editRoleField('${role.id}', 'desc', this.value)">${role.desc}</textarea>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="glass-card role-card">
          <div class="role-icon-box">
            <iconify-icon icon="${role.icon}"></iconify-icon>
          </div>
          <h3>${role.title}</h3>
          <p>${role.desc}</p>
        </div>
      `;
    }
  });

  if (isRolesEditMode) {
    html += `
      <div class="glass-card role-card" style="padding: 20px; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 180px; border-style: dashed; border-color: var(--primary-ocean); background: rgba(14, 165, 233, 0.02);">
        <button class="action-btn primary" style="display: flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px;" onclick="addRole()">
          <iconify-icon icon="solar:add-circle-bold" style="font-size: 1.1rem;"></iconify-icon>
          <span>새 역할 추가</span>
        </button>
      </div>
    `;
  }

  container.innerHTML = html;
}

function editRoleField(id, field, value) {
  const role = rolesData.find(r => r.id === id);
  if (role && value.trim()) {
    role[field] = value.trim();
    saveRoles();
  }
}

function addRole() {
  const newRole = {
    id: 'role-' + Date.now(),
    title: '새 역할',
    desc: '담당할 업무 상세 내용을 입력하세요.',
    icon: 'solar:user-bold-duotone'
  };
  rolesData.push(newRole);
  saveRoles();
  renderRoles();
}

function deleteRole(id) {
  rolesData = rolesData.filter(role => role.id !== id);
  saveRoles();
  renderRoles();
}
