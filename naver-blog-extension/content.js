// ==========================================================================
// 충주미세방충망 블로그 도우미 - content.js
// ==========================================================================

// 메시지 수신 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "injectPost") {
    const { title, body } = request;
    const result = injectPostToNaverEditor(title, body);
    sendResponse({ success: result });
    return true;
  }
});

// 네이버 스마트에디터로 데이터 주입 실행 함수
function injectPostToNaverEditor(title, bodyHTML) {
  try {
    // 1. 제목 입력 필드 탐색 및 입력
    const titleSelectors = [
      ".se-document-title-editor textarea",
      ".se-document-title textarea",
      "textarea[placeholder='제목']",
      "textarea[placeholder='제목을 입력하세요']",
      ".se-document-title [contenteditable='true']"
    ];

    let titleField = null;
    for (const selector of titleSelectors) {
      titleField = document.querySelector(selector);
      if (titleField) break;
    }

    if (titleField) {
      titleField.focus();
      // 기존 텍스트 전체 선택 후 삭제 및 입력 (React 상태 갱신 유도)
      if (titleField.tagName === "TEXTAREA" || titleField.tagName === "INPUT") {
        titleField.select();
        document.execCommand("delete", false, null);
        document.execCommand("insertText", false, title);
        
        // 추가로 React 합성 이벤트를 트리거하기 위한 커스텀 이벤트 전송
        titleField.dispatchEvent(new Event("input", { bubbles: true }));
        titleField.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        // contenteditable 형식인 경우
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
        document.execCommand("insertText", false, title);
        titleField.dispatchEvent(new Event("input", { bubbles: true }));
      }
      console.log("제목 입력 성공:", title);
    } else {
      console.warn("네이버 스마트에디터 제목 필드를 찾을 수 없습니다.");
    }

    // 2. 본문 에디터 필드 탐색 및 입력
    const bodySelectors = [
      ".se-component-content [contenteditable='true']",
      ".se-content [contenteditable='true']",
      ".se-canvas [contenteditable='true']",
      "[contenteditable='true'].se-section",
      "[contenteditable='true']"
    ];

    let bodyField = null;
    for (const selector of bodySelectors) {
      const el = document.querySelector(selector);
      // 에디터 본문 영역인지 검증하기 위해 플레이스홀더나 부모 클래스 체크
      if (el && (el.closest(".se-canvas") || el.closest(".se-main-container") || el.classList.contains("se-section"))) {
        bodyField = el;
        break;
      }
    }

    // 폴백: 세부조건 없이 가장 먼저 나오는 contenteditable 찾기
    if (!bodyField) {
      bodyField = document.querySelector("[contenteditable='true']");
    }

    if (bodyField) {
      bodyField.focus();
      
      // 안전한 삭제 및 HTML 인젝션 실행
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      
      // execCommand("insertHTML")를 사용해 HTML 서식(p, h2, table, strong 등)이 훼손되지 않게 주입
      document.execCommand("insertHTML", false, bodyHTML);
      
      // React 상태 갱신 유도
      bodyField.dispatchEvent(new Event("input", { bubbles: true }));
      console.log("본문 입력 성공");
      return true;
    } else {
      console.error("네이버 스마트에디터 본문 필드를 찾을 수 없습니다.");
      return false;
    }

  } catch (error) {
    console.error("네이버 스마트에디터 주입 오류:", error);
    return false;
  }
}
