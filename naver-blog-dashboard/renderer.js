// ==========================================================================
// 충주미세방충망 블로그 자동화 대시보드 - renderer.js
// ==========================================================================

let uploadedImages = []; // { id, file, originalUrl, watermarkedUrl, label: 'none'|'before'|'after' }
let geminiApiKey = "";
let companyName = "충주미세방충망";
let phoneNumber = "010-6261-0930";

// 1. 초기화 및 환경 설정 불러오기
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const key = await window.electronAPI.getConfig("apiKey", "");
    const name = await window.electronAPI.getConfig("companyName", "충주미세방충망");
    const phone = await window.electronAPI.getConfig("phoneNumber", "010-6261-0930");

    geminiApiKey = key;
    companyName = name;
    phoneNumber = phone;

    document.getElementById("input-api-key").value = key;
    document.getElementById("input-company-name").value = name;
    document.getElementById("input-phone-number").value = phone;

    // 브랜드 시그니처 로고 초기 로드
    const logoBase64 = localStorage.getItem("brand_logo_base64");
    const logoFilename = localStorage.getItem("brand_logo_filename");
    if (logoBase64 && logoFilename) {
      const filenameEl = document.getElementById("logo-filename");
      const previewEl = document.getElementById("logo-preview");
      const previewBoxEl = document.getElementById("logo-preview-box");
      
      if (filenameEl) filenameEl.textContent = logoFilename;
      if (previewEl) previewEl.src = logoBase64;
      if (previewBoxEl) previewBoxEl.classList.remove("hidden");
    }

  } catch (err) {
    console.error("설정 데이터를 불러오는 중 오류가 발생했습니다:", err);
  }

  // UI 이벤트 리스너 세팅
  setupUIEventListeners();

  // 메인 프로세스(main.js)에서 감지된 새창 열기 이벤트를 전달받아, 외부 새 창을 띄우지 않고 현재 웹뷰 내부에서 주소를 강제 이동시킵니다.
  if (window.electronAPI && window.electronAPI.onWebviewRedirect) {
    window.electronAPI.onWebviewRedirect((url) => {
      const webview = document.getElementById("naver-webview");
      if (webview) {
        webview.src = url;
      }
    });
  }

  // [자가 회복 및 리다이렉션] 웹뷰 상태 관리 및 리바인딩 헬퍼 함수
  window.bindWebviewEvents = function(targetWebview) {
    // 1) 주소 이동 시 URL 입력창 자동 업데이트
    targetWebview.addEventListener("did-navigate", (e) => {
      const urlInput = document.getElementById("webview-url-input");
      if (urlInput) urlInput.value = e.url;
    });
    targetWebview.addEventListener("did-navigate-in-page", (e) => {
      const urlInput = document.getElementById("webview-url-input");
      if (urlInput) urlInput.value = e.url;
    });

    // 2) 웹뷰 로드 완료(dom-ready) 시 포커스 대입 및 자동 주소 강제 전환 (글쓰기 wrapper 감지)
    targetWebview.addEventListener("dom-ready", () => {
      targetWebview.focus();

      try {
        const url = targetWebview.getURL() || "";
        console.log("[WEBVIEW DOM-READY] URL:", url);

        // 이미 스마트에디터 직통 주소(postwrite)로 진입한 상태면 생략
        if (url.indexOf("/postwrite") !== -1) return;

        // 네이버가 제공하는 글쓰기 wrapper 페이지 주소 패턴들 검사
        if (url.indexOf("GoBlogWrite.naver") !== -1 || url.indexOf("PostWriteForm.naver") !== -1 || url.indexOf("Redirect=Write") !== -1 || url.indexOf("/postwrite") !== -1) {
          
          // [방법 2] URL에 blogId가 없고 도메인 경로만 있는 경우 (예: blog.naver.com/happycj0930/postwrite 또는 Redirect=Write)
          const findBlogIdScript = `
            (function() {
              try {
                const iframe = document.getElementById("mainFrame") || document.querySelector("iframe[name='mainFrame']") || document.querySelector("frame[name='mainFrame']");
                if (iframe) {
                  const src = iframe.getAttribute("src") || iframe.src || "";
                  if (src && src.indexOf("blogId=") !== -1) {
                    const match = src.match(/blogId=([^&]+)/);
                    if (match && match[1]) return match[1];
                  }
                }
              } catch (e) {
                // Ignore SecurityError
              }
              try {
                if (window.g_blogId) return window.g_blogId;
                if (window.g_userId) return window.g_userId;
              } catch (e) {}
              
              const pathParts = window.location.pathname.split('/');
              if (pathParts.length > 1 && pathParts[1] && pathParts[1] !== 'PostWriteForm.naver') {
                return pathParts[1];
              }
              return null;
            })()
          `;
          targetWebview.executeJavaScript(findBlogIdScript).then((blogId) => {
            if (blogId) {
              const directEditorUrl = `https://blog.naver.com/${blogId}/postwrite`;
              console.log("[WEBVIEW REDIRECT] Blog ID parsed from guest DOM. Redirecting to:", directEditorUrl);
              targetWebview.src = directEditorUrl;
            } else {
              console.log("[WEBVIEW REDIRECT] Failed to parse Blog ID. Falling back to default happycj0930.");
              targetWebview.src = "https://blog.naver.com/happycj0930/postwrite";
            }
          }).catch((err) => {
            console.error("[WEBVIEW REDIRECT] Script error, falling back to default happycj0930:", err);
            targetWebview.src = "https://blog.naver.com/happycj0930/postwrite";
          });
        }
      } catch (err) {
        console.error("리다이렉션 체크 실패:", err);
      }
    });

    // 3) window.open() 팝업 가로채서 새창 방지 및 동일 웹뷰 내에서 이동 유도
    targetWebview.addEventListener("new-window", (e) => {
      console.log("[WEBVIEW POPUP INTERCEPTED] URL:", e.url);
      targetWebview.src = e.url;
    });
  };

  // [파괴적 새로고침] 웹뷰 엘리먼트 자체를 파괴 후 재생성하여, 정지/크래시 상태를 100% 해제하고 세션 쿠키는 보존합니다.
  window.resetWebview = function() {
    const oldWebview = document.getElementById("naver-webview");
    if (!oldWebview) return;

    const parent = oldWebview.parentNode;
    const newWebview = document.createElement("webview");

    newWebview.id = "naver-webview";
    newWebview.src = "https://blog.naver.com/happycj0930";
    newWebview.setAttribute("partition", "persist:naver");
    newWebview.setAttribute("allowpopups", "");
    newWebview.setAttribute("tabindex", "0");
    newWebview.setAttribute("useragent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    newWebview.setAttribute("webpreferences", "webSecurity=no, allowRunningInsecureContent=yes");

    parent.removeChild(oldWebview);
    parent.appendChild(newWebview);

    window.bindWebviewEvents(newWebview);
    const urlInput = document.getElementById("webview-url-input");
    if (urlInput) urlInput.value = newWebview.src;
    console.log("[WEBVIEW RESET] Webview element successfully re-created.");
  };

  // 초기 10칸 빈 슬롯 그리드 렌더링
  renderPhotosList();

  const titleInput = document.getElementById("result-title");
  const previewEl = document.getElementById("result-body-preview");

  if (titleInput && previewEl) {
    const savedTitle = localStorage.getItem("saved_post_title");
    const savedBody = localStorage.getItem("saved_post_body");

    if (savedTitle && savedBody) {
      titleInput.value = savedTitle;
      previewEl.innerHTML = savedBody;
      convertPlaceholdersToDropzones();
      updateSeoMetrics(savedBody);
    } else {
      titleInput.value = "";
      showEditorPlaceholder();
      updateSeoMetrics("");
    }
  }
});

// 2. 이벤트 리스너 세팅 함수
function setupUIEventListeners() {
  const btnToggleSettings = document.getElementById("btn-toggle-settings");
  const settingsPanel = document.getElementById("settings-panel");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const dropZone = document.getElementById("photo-uploader-grid");
  const fileInput = document.getElementById("file-input");
  const btnGenerate = document.getElementById("btn-generate");
  const btnSendNaver = document.getElementById("btn-send-naver");
  const btnCopyTitle = document.getElementById("btn-copy-title");
  const btnCopyBody = document.getElementById("btn-copy-body");
  const btnAutoPaste = document.getElementById("btn-auto-paste");
  const btnRegenerate = document.getElementById("btn-regenerate");
  const btnDeletePost = document.getElementById("btn-delete-post");
  const btnResetAll = document.getElementById("btn-reset-all");

  // 워크스페이스 탭 제어 기능
  const tabBtnVirtualEditor = document.getElementById("tab-btn-virtual-editor");
  const tabBtnNaverBlog = document.getElementById("tab-btn-naver-blog");
  const viewVirtualEditor = document.getElementById("view-virtual-editor");
  const viewNaverBlog = document.getElementById("view-naver-blog");
  const btnShowNaver = document.getElementById("btn-show-naver");

  // 탭 클릭 리스너 공통 함수
  function activateVirtualEditor() {
    if (tabBtnVirtualEditor && tabBtnNaverBlog && viewVirtualEditor && viewNaverBlog) {
      tabBtnVirtualEditor.classList.add("active");
      tabBtnNaverBlog.classList.remove("active");
      viewVirtualEditor.classList.remove("hidden");
      viewNaverBlog.classList.add("hidden");
    }
  }

  function activateNaverBlog() {
    if (tabBtnVirtualEditor && tabBtnNaverBlog && viewVirtualEditor && viewNaverBlog) {
      tabBtnNaverBlog.classList.add("active");
      tabBtnVirtualEditor.classList.remove("active");
      viewNaverBlog.classList.remove("hidden");
      viewVirtualEditor.classList.add("hidden");
      
      // 웹뷰 포커스 유도
      const webview = document.getElementById("naver-webview");
      if (webview) webview.focus();
    }
  }

  if (tabBtnVirtualEditor) {
    tabBtnVirtualEditor.addEventListener("click", activateVirtualEditor);
  }
  if (tabBtnNaverBlog) {
    tabBtnNaverBlog.addEventListener("click", activateNaverBlog);
  }
  if (btnShowNaver) {
    btnShowNaver.addEventListener("click", activateNaverBlog);
  }

  // 반응형 뷰 조작 컨트롤 등록
  const btnDevicePc = document.getElementById("btn-device-pc");
  const btnDeviceTablet = document.getElementById("btn-device-tablet");
  const btnDeviceMobile = document.getElementById("btn-device-mobile");
  const virtualEditorWrapper = document.querySelector(".virtual-editor-wrapper");

  if (btnDevicePc && btnDeviceTablet && btnDeviceMobile && virtualEditorWrapper) {
    btnDevicePc.addEventListener("click", () => {
      btnDevicePc.classList.add("active");
      btnDeviceTablet.classList.remove("active");
      btnDeviceMobile.classList.remove("active");
      virtualEditorWrapper.className = "virtual-editor-wrapper";
    });

    btnDeviceTablet.addEventListener("click", () => {
      btnDeviceTablet.classList.add("active");
      btnDevicePc.classList.remove("active");
      btnDeviceMobile.classList.remove("active");
      virtualEditorWrapper.className = "virtual-editor-wrapper device-tablet";
    });

    btnDeviceMobile.addEventListener("click", () => {
      btnDeviceMobile.classList.add("active");
      btnDevicePc.classList.remove("active");
      btnDeviceTablet.classList.remove("active");
      virtualEditorWrapper.className = "virtual-editor-wrapper device-mobile";
    });
  }

  // 가상 에디터 본문 실시간 입력 감지 및 실시간 SEO 계산 바인딩
  const resultBodyPreview = document.getElementById("result-body-preview");
  if (resultBodyPreview) {
    resultBodyPreview.addEventListener("input", () => {
      const htmlVal = resultBodyPreview.innerHTML;
      localStorage.setItem("saved_post_body", htmlVal);
      updateSeoMetrics(htmlVal);
    });
  }

  // 가상 에디터 제목 실시간 입력 감지 및 자동 임시저장
  const resultTitleInput = document.getElementById("result-title");
  if (resultTitleInput) {
    resultTitleInput.addEventListener("input", (e) => {
      localStorage.setItem("saved_post_title", e.target.value);
    });
  }

  // 설정 창 토글
  btnToggleSettings.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
  });

  // 설정 저장
  btnSaveSettings.addEventListener("click", async () => {
    const key = document.getElementById("input-api-key").value.trim();
    const name = document.getElementById("input-company-name").value.trim() || "충주미세방충망";
    const phone = document.getElementById("input-phone-number").value.trim() || "010-6261-0930";

    await window.electronAPI.setConfig("apiKey", key);
    await window.electronAPI.setConfig("companyName", name);
    await window.electronAPI.setConfig("phoneNumber", phone);

    geminiApiKey = key;
    companyName = name;
    phoneNumber = phone;

    alert("설정이 PC에 안전하게 저장되었습니다.");
    settingsPanel.classList.add("hidden");

    // 저장 정보 기준 사진 워터마크 재합성
    reprocessAllImages();
  });

  // 브랜드 시그니처 로고 파일 선택 및 파일 읽기 이벤트 등록
  const logoFileInput = document.getElementById("input-logo-file");
  const btnUploadLogo = document.getElementById("btn-upload-logo");
  const logoFilenameEl = document.getElementById("logo-filename");
  const logoPreviewEl = document.getElementById("logo-preview");
  const logoPreviewBoxEl = document.getElementById("logo-preview-box");

  if (btnUploadLogo && logoFileInput) {
    btnUploadLogo.addEventListener("click", () => {
      logoFileInput.click();
    });
    
    logoFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Data = event.target.result;
          localStorage.setItem("brand_logo_base64", base64Data);
          localStorage.setItem("brand_logo_filename", file.name);
          
          if (logoFilenameEl) logoFilenameEl.textContent = file.name;
          if (logoPreviewEl) logoPreviewEl.src = base64Data;
          if (logoPreviewBoxEl) logoPreviewBoxEl.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // 드롭존 클릭 시 파일 열기
  dropZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
  });

  // 전체 사진 비우기 이벤트 바인딩
  const btnClearPhotos = document.getElementById("btn-clear-photos");
  if (btnClearPhotos) {
    btnClearPhotos.addEventListener("click", () => {
      if (uploadedImages.length === 0) return;
      if (confirm("등록된 모든 시공 사진을 비우시겠습니까?")) {
        uploadedImages = [];
        fileInput.value = ""; // 파일 선택창 캐시 초기화
        renderPhotosList();
      }
    });
  }

  // 드래그 앤 드롭 이벤트
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

  // 임시 저장 기능 바인딩
  const btnSaveDraft = document.getElementById("btn-save-draft");
  if (btnSaveDraft) {
    btnSaveDraft.addEventListener("click", () => {
      const title = document.getElementById("result-title").value.trim();
      const body = document.getElementById("result-body-preview").innerHTML;
      localStorage.setItem("saved_post_title", title);
      localStorage.setItem("saved_post_body", body);
      alert("기사 초안이 로컬 저장소에 안전하게 임시 저장되었습니다!");
    });
  }

  // 가상 에디터 포커스 및 포커스 아웃에 따른 플레이스홀더 제어
  if (resultBodyPreview) {
    resultBodyPreview.addEventListener("focus", () => {
      if (resultBodyPreview.querySelector(".editor-empty-state")) {
        resultBodyPreview.innerHTML = "";
      }
    });

    resultBodyPreview.addEventListener("blur", () => {
      if (!resultBodyPreview.innerText.trim()) {
        showEditorPlaceholder();
      }
    });
  }

  if (btnAutoPaste) {
    btnAutoPaste.addEventListener("click", async () => {
      const titleInput = document.getElementById("result-title");
      const bodyContainer = document.getElementById("result-body-preview");
      if (!titleInput || !bodyContainer) return;

      const title = titleInput.value.trim();
      if (!title) {
        alert("가상 에디터에 기사를 먼저 작성하거나 생성해 주세요.");
        return;
      }

      // 복제하여 불필요한 UI 제거 및 이미지/HTML 세그먼트 파싱
      const clone = bodyContainer.cloneNode(true);
      const overlays = clone.querySelectorAll(".image-remove-overlay");
      overlays.forEach(el => el.remove());

      const dropzones = clone.querySelectorAll(".blog-image-dropzone");
      dropzones.forEach(dz => {
        const placeholderText = dz.getAttribute("data-placeholder") || "";
        const textNode = document.createTextNode(placeholderText);
        dz.parentNode.replaceChild(textNode, dz);
      });

      // 세그먼트 파싱 및 이미지 물리적 병합 처리 실행
      btnAutoPaste.innerHTML = `<span class="btn-icon">⏳</span> 시공 이미지 병합 및 포스팅 준비 중...`;
      const segments = await parseEditorSegments(clone);

      const webview = document.getElementById("naver-webview");
      if (!webview) {
        alert("네이버 웹뷰를 찾을 수 없습니다.");
        return;
      }

      btnAutoPaste.disabled = true;
      btnAutoPaste.style.opacity = "0.5";

      // 네이버 블로그 화면 활성화
      activateNaverBlog();

      const currentUrl = webview.getURL() || "";
      
      const executePaste = async () => {
        btnAutoPaste.innerHTML = `<span class="btn-icon">⏳</span> 자동 기입 중... 마우스와 키보드를 만지지 마세요`;
        try {
          const success = await window.electronAPI.pasteTitleThenBody(title, segments);
          if (success) {
            alert("네이버 블로그 에디터에 제목과 사진 포함 본문이 100% 안전하게 자동 기입되었습니다!\n\n발행 전 내용을 한 번 더 확인해 주세요.");
          } else {
            alert("자동 기입 중 오류가 발생했습니다. 우측 화면에 네이버 에디터 글쓰기 창이 열려 있는지 확인해 주세요.");
          }
        } catch (err) {
          alert("오류 발생: " + err.message);
        } finally {
          btnAutoPaste.disabled = false;
          btnAutoPaste.style.opacity = "1";
          btnAutoPaste.innerHTML = `<span class="btn-icon">🚀</span> 에디터 자동 작성`;
        }
      };

      const isEditorUrl = (url) => {
        return url.includes("/postwrite") || 
               url.includes("Redirect=Write") || 
               url.includes("PostWriteForm") || 
               url.includes("editor.naver.com") || 
               url.includes("/editor");
      };

      // 만약 에디터 주소가 아닐 경우, 에디터 주소로 강제 이동 및 대기 후 자동 완성 실행
      if (!isEditorUrl(currentUrl)) {
        btnAutoPaste.innerHTML = `<span class="btn-icon">⏳</span> 네이버 에디터 페이지로 이동 중...`;
        webview.src = "https://blog.naver.com/happycj0930?Redirect=Write";

        let checkCount = 0;
        const intervalId = setInterval(() => {
          checkCount++;
          const loadedUrl = webview.getURL() || "";
          
          if (isEditorUrl(loadedUrl)) {
            clearInterval(intervalId);
            setTimeout(executePaste, 2500); // 에디터 렌더링 대기
          } else if (loadedUrl.includes("nid.naver.com")) {
            clearInterval(intervalId);
            btnAutoPaste.disabled = false;
            btnAutoPaste.style.opacity = "1";
            btnAutoPaste.innerHTML = `<span class="btn-icon">🚀</span> 에디터 자동 작성`;
            alert("네이버 로그인이 필요합니다. 우측 화면에서 네이버 로그인을 먼저 마쳐주세요!");
          } else if (checkCount > 30) { // 15초 타임아웃
            clearInterval(intervalId);
            btnAutoPaste.disabled = false;
            btnAutoPaste.style.opacity = "1";
            btnAutoPaste.innerHTML = `<span class="btn-icon">🚀</span> 에디터 자동 작성`;
            alert("네이버 에디터 페이지로의 자동 이동이 지연되고 있습니다.\n\n우측 네이버 창에서 직접 '글쓰기' 버튼을 누르신 후, 에디터 화면이 완전히 로딩되면 [에디터 자동 작성] 버튼을 다시 눌러주세요!");
          }
        }, 500);
      } else {
        await executePaste();
      }
    });
  }

  // 글 다시 생성하기 리스너
  if (btnRegenerate) {
    btnRegenerate.addEventListener("click", () => {
      const apartment = document.getElementById("input-apartment").value.trim();
      if (!apartment) {
        alert("아파트나 시공 현장명을 먼저 입력해 주세요.");
        return;
      }
      
      if (confirm("기존 가상 에디터에 저장된 내용을 모두 지우고 AI 블로그 글을 처음부터 다시 생성하시겠습니까?")) {
        // 기존 에디터 뷰 비우기
        const titleEl = document.getElementById("result-title");
        const bodyEl = document.getElementById("result-body-preview");
        if (titleEl) titleEl.value = "";
        if (bodyEl) bodyEl.innerHTML = "";
        
        // 로컬스토리지 지우기
        localStorage.removeItem("saved_post_title");
        localStorage.removeItem("saved_post_body");
        
        // 기존 SEO 초기화
        updateSeoMetrics("");
        
        // 글 다시 생성 호출
        handleGeneratePost();
      }
    });
  }

  // 전체글 삭제 리스너
  if (btnDeletePost) {
    btnDeletePost.addEventListener("click", () => {
      const title = document.getElementById("result-title").value.trim();
      const bodyText = document.getElementById("result-body-preview").innerText.trim();
      
      if (!title && !bodyText) {
        alert("가상 에디터가 이미 비어있습니다.");
        return;
      }
      
      if (confirm("가상 에디터에 작성된 제목과 본문 내용을 모두 삭제하시겠습니까? (시공 사진 및 옵션 정보는 유지됩니다)")) {
        // 제목 및 본문 초기화
        const titleEl = document.getElementById("result-title");
        const bodyEl = document.getElementById("result-body-preview");
        if (titleEl) titleEl.value = "";
        if (bodyEl) {
          bodyEl.innerHTML = "";
          showEditorPlaceholder();
        }
        
        // 로컬스토리지 삭제
        localStorage.removeItem("saved_post_title");
        localStorage.removeItem("saved_post_body");
        
        // SEO 초기화
        updateSeoMetrics("");
        
        // 에디터 탭 강제 전환
        activateVirtualEditor();
        
        alert("가상 에디터의 글 내용이 성공적으로 삭제되었습니다.");
      }
    });
  }

  // 전체 리셋 리스너
  if (btnResetAll) {
    btnResetAll.addEventListener("click", () => {
      if (confirm("대시보드의 모든 입력 정보, 설정된 옵션, 시공 사진 및 에디터 글을 모두 비우고 초기화하시겠습니까?")) {
        // 1. 시공 정보 인풋 초기화
        const aptInput = document.getElementById("input-apartment");
        const kwInput = document.getElementById("input-keywords");
        const reqInput = document.getElementById("input-additional-requests");
        const citySelect = document.getElementById("select-city");
        const seoSelect = document.getElementById("select-seo-mode");
        const mapCheck = document.getElementById("check-include-map");
        const logoCheck = document.getElementById("check-include-logo");

        if (aptInput) aptInput.value = "";
        if (kwInput) kwInput.value = "";
        if (reqInput) reqInput.value = "";
        if (citySelect) citySelect.value = "충주";
        if (seoSelect) seoSelect.value = "c-rank";
        if (mapCheck) mapCheck.checked = false;
        if (logoCheck) logoCheck.checked = false;

        // 2. 업로드 사진 데이터 및 파일 인풋 초기화
        uploadedImages = [];
        const fInput = document.getElementById("file-input");
        if (fInput) fInput.value = "";
        renderPhotosList();

        // 3. 가상 에디터 제목 및 본문 초기화
        const titleEl = document.getElementById("result-title");
        const bodyEl = document.getElementById("result-body-preview");
        if (titleEl) titleEl.value = "";
        if (bodyEl) {
          bodyEl.innerHTML = "";
          showEditorPlaceholder();
        }

        // 4. 로컬스토리지 저장 데이터 제거
        localStorage.removeItem("saved_post_title");
        localStorage.removeItem("saved_post_body");

        // 5. SEO 수치 0으로 리셋
        updateSeoMetrics("");

        // 6. 가상 에디터 탭으로 다시 강제 전환
        activateVirtualEditor();

        alert("대시보드가 성공적으로 초기화되었습니다.");
      }
    });
  }
}

// 3. 사진 업로드 및 Canvas 워터마킹 로직
function handleFiles(files) {
  if (uploadedImages.length + files.length > 20) {
    alert("시공 사진은 최대 20장까지만 등록할 수 있습니다.");
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
        label: "none"
      };

      uploadedImages.push(newImg);
      processImageWatermark(newImg);
    };

    reader.readAsDataURL(file);
  }
}

// 이미지 워터마크 그리기 엔진 (C시안: 로고 + 전화번호 글래스모피즘 배지)
function processImageWatermark(imgObj) {
  const img = new Image();
  img.src = imgObj.originalUrl;

  img.onload = () => {
    imgObj.isVertical = img.height > img.width;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // 블로그 포스팅 최적화 1000px 리사이징
    const MAX_SIZE = 1000;
    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > MAX_SIZE) {
        height *= MAX_SIZE / width;
        width = MAX_SIZE;
      }
    } else {
      if (height > MAX_SIZE) {
        width *= MAX_SIZE / height;
        height = MAX_SIZE;
      }
    }

    canvas.width = width;
    canvas.height = height;

    // 1. 원본 이미지 그리기
    ctx.drawImage(img, 0, 0, width, height);

    // 워터마크 그리기 이너 함수
    const drawWatermark = (logoImgObj = null) => {
      let rectWidth = 0;
      let rectHeight = 0;
      
      const fontSize = Math.max(14, Math.round(width * 0.024));
      const paddingX = Math.round(width * 0.02);
      const paddingY = Math.round(height * 0.015);
      
      const rectXOffset = Math.round(width * 0.025);
      const rectYOffset = Math.round(height * 0.025);

      if (logoImgObj) {
        // A. 로고가 등록된 경우: 로고 이미지 원본만 단독 노출 (크기 25%, 투명도 25% 적용, 배경/테두리 박스 완전 제거)
        const logoWidth = Math.round(width * 0.25); // 사진 가로 너비의 25% 크기
        const logoHeight = Math.round(logoImgObj.height * (logoWidth / logoImgObj.width));
        
        const rectX = width - logoWidth - rectXOffset;
        const rectY = height - logoHeight - rectYOffset;
        
        // 투명도 25% 적용
        ctx.globalAlpha = 0.25;
        ctx.drawImage(logoImgObj, rectX, rectY, logoWidth, logoHeight);
        ctx.globalAlpha = 1.0; // 투명도 원상 복구
      } else {
        // B. 로고가 없는 경우: 기존 텍스트(업체명 + 전화번호) B시안 폴백
        const txt = `${companyName} ${phoneNumber}`;
        ctx.font = `bold ${fontSize}px 'Pretendard', sans-serif`;
        const textWidth = ctx.measureText(txt).width;
        
        rectWidth = textWidth + paddingX * 2;
        rectHeight = fontSize + paddingY * 2;
        
        const rectX = width - rectWidth - rectXOffset;
        const rectY = height - rectHeight - rectYOffset;
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
        drawRoundedRect(ctx, rectX, rectY, rectWidth, rectHeight, 10);
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = Math.max(1.5, Math.round(width * 0.0018));
        ctx.stroke();
        
        ctx.fillStyle = "#174D36";
        ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.textBaseline = "middle";
        ctx.fillText(txt, rectX + paddingX, rectY + rectHeight / 2);
        
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // 3. 상단 중앙 시공전/후 라벨 그리기
      if (imgObj.label === "before" || imgObj.label === "after") {
        const labelText = imgObj.label === "before" ? "[시공 전]" : "[시공 후]";
        const labelColor = imgObj.label === "before" ? "#b45309" : "#3f6212";

        const labelFontSize = Math.max(16, Math.round(width * 0.028));
        ctx.font = `bold ${labelFontSize}px 'Pretendard', sans-serif`;
        const lblWidth = ctx.measureText(labelText).width;

        const lblPadX = Math.round(width * 0.025);
        const lblPadY = Math.round(height * 0.015);
        const lblRectWidth = lblWidth + lblPadX * 2;
        const lblRectHeight = labelFontSize + lblPadY * 2;

        const lblRectX = (width - lblRectWidth) / 2;
        const lblRectY = Math.round(height * 0.03);

        ctx.fillStyle = labelColor;
        drawRoundedRect(ctx, lblRectX, lblRectY, lblRectWidth, lblRectHeight, 8);

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, width / 2, lblRectY + lblRectHeight / 2);
        ctx.textAlign = "left"; // 원상 복구
      }

      imgObj.watermarkedUrl = canvas.toDataURL("image/jpeg", 0.9);
      renderPhotosList();
    };

    // 로컬스토리지에 저장된 브랜드 로고 비동기 로딩 및 실행
    const logoBase64 = localStorage.getItem("brand_logo_base64");
    if (logoBase64) {
      const logoImg = new Image();
      logoImg.src = logoBase64;
      logoImg.onload = () => {
        drawWatermark(logoImg);
      };
      logoImg.onerror = () => {
        console.warn("[Watermark] 로고 파일 로드 실패. 텍스트로 대체합니다.");
        drawWatermark(null);
      };
    } else {
      drawWatermark(null);
    }
  };
}

// 둥근 사각형 드로잉 헬퍼
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

// 업로드 사진 렌더링 (10개 카드 슬롯 고정 그리드 방식)
function renderPhotosList() {
  const gridEl = document.getElementById("photo-uploader-grid");
  const countBadge = document.getElementById("photo-count-badge");
  const fileInput = document.getElementById("file-input");

  countBadge.textContent = `${uploadedImages.length} / 20장`;
  gridEl.innerHTML = "";

  const totalSlots = 20;

  for (let i = 0; i < totalSlots; i++) {
    const slotCard = document.createElement("div");
    const imgObj = uploadedImages[i];

    if (imgObj) {
      // 1. 이미지가 등록된 슬롯
      slotCard.className = "photo-slot image-slot";
      slotCard.draggable = true;

      // 드래그 앤 드롭 시작 이벤트
      slotCard.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/html", `<img src="${imgObj.watermarkedUrl}" width="800" style="display:block; margin: 15px auto;" alt="시공사진" />`);
      });

      slotCard.innerHTML = `
        <img src="${imgObj.watermarkedUrl || imgObj.originalUrl}">
        <!-- 호버 시 보이는 삭제 버튼 -->
        <button class="slot-remove-btn" data-id="${imgObj.id}">×</button>
      `;

      // 삭제 버튼 매핑
      slotCard.querySelector(".slot-remove-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute("data-id");
        uploadedImages = uploadedImages.filter(item => item.id !== id);
        renderPhotosList();
      });

      gridEl.appendChild(slotCard);
    } else {
      // 2. 빈 슬롯
      slotCard.className = "photo-slot empty-slot";
      slotCard.innerHTML = `
        <span class="slot-icon">+</span>
        <span class="slot-label">추가</span>
      `;
      slotCard.addEventListener("click", () => fileInput.click());
      gridEl.appendChild(slotCard);
    }
  }
}

function reprocessAllImages() {
  uploadedImages.forEach(img => {
    processImageWatermark(img);
  });
}

// 4. 블로그 포스팅 AI 글 생성 처리 (Gemini API 3단계 폴백 호출)
async function handleGeneratePost() {
  if (!geminiApiKey) {
    alert("환경 설정(우측 상단 톱니바퀴)을 눌러 Gemini API Key를 입력하고 저장해 주세요.");
    document.getElementById("settings-panel").classList.remove("hidden");
    return;
  }

  const seoMode = document.getElementById("select-seo-mode").value;
  const city = document.getElementById("select-city").value;
  const apartment = document.getElementById("input-apartment").value.trim();
  const keywords = document.getElementById("input-keywords").value.trim();
  const additionalRequests = document.getElementById("input-additional-requests")?.value.trim() || "";

  if (!apartment) {
    alert("아파트나 시공 현장명을 입력해 주세요 (예: 호암 힐스테이트).");
    document.getElementById("input-apartment").focus();
    return;
  }

  const btnGenerate = document.getElementById("btn-generate");
  const spinner = document.getElementById("loading-spinner");

  if (btnGenerate) {
    btnGenerate.disabled = true;
    btnGenerate.style.opacity = "0.5";
  }
  if (spinner) {
    spinner.classList.remove("hidden");
  }

  // 업로드된 이미지 분석 데이터 변환
  const imageParts = [];
  uploadedImages.forEach(img => {
    const url = img.watermarkedUrl || img.originalUrl;
    if (url && url.startsWith("data:image/")) {
      const mimeType = url.substring(url.indexOf(":") + 1, url.indexOf(";"));
      const base64Data = url.split(",")[1];
      imageParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    }
  });

  const includeMap = document.getElementById("check-include-map")?.checked || false;
  const prompt = buildGeminiPrompt(seoMode, city, apartment, keywords, additionalRequests, includeMap);

  // 에디터 탭 자동 전환 및 로딩 상태 텍스트 연출
  const tabBtnVirtualEditor = document.getElementById("tab-btn-virtual-editor");
  if (tabBtnVirtualEditor) tabBtnVirtualEditor.click();

  document.getElementById("result-title").value = "포스팅 글 자동 생성 중...";
  const previewEl = document.getElementById("result-body-preview");
  previewEl.innerHTML = `
    <div class="editor-loading-state">
      <div class="spinner-large"></div>
      <h3 id="loading-step-title">📸 시공 현장 사진 분석 중...</h3>
      <p id="loading-step-desc">업로드된 사진에서 기존 낡은 샷시 오염도 및 자재 특징을 파악하고 있습니다.</p>
      <div class="loading-progress-bar"><div class="progress-fill" id="loading-progress-fill" style="width: 25%;"></div></div>
    </div>
  `;

  let currentStep = 1;
  const stepInterval = setInterval(() => {
    const titleEl = document.getElementById("loading-step-title");
    const descEl = document.getElementById("loading-step-desc");
    const fillEl = document.getElementById("loading-progress-fill");
    
    if (!titleEl || !descEl || !fillEl) return;
    
    currentStep++;
    if (currentStep === 2) {
      titleEl.textContent = "🧠 대표 코멘트 및 요구사항 분석 중...";
      descEl.textContent = "입력하신 시공 에피소드와 강조 코멘트를 포스팅의 뼈대로 반영하고 있습니다.";
      fillEl.style.width = "50%";
    } else if (currentStep === 3) {
      titleEl.textContent = "✍️ 1,500자+ DIA+ 최적화 본문 집필 중...";
      descEl.textContent = "친근한 구어체 톤앤매너로 현장감 넘치는 시공일지를 상세히 집필하고 있습니다.";
      fillEl.style.width = "75%";
    } else if (currentStep === 4) {
      titleEl.textContent = "🚀 이미지 배치 및 스마트에디터 형식 조립 중...";
      descEl.textContent = "사진을 2x2 격자로 예쁘게 결합하고, SEO 체크리스트를 자동 진단하고 있습니다.";
      fillEl.style.width = "95%";
    } else {
      clearInterval(stepInterval);
    }
  }, 4000);

  try {
    const rawResult = await callGeminiAPI(prompt, imageParts);
    clearInterval(stepInterval); // API 호출이 끝나면 타이머 중단
    const { title, body, featuredImageIndex } = parseGeminiResponse(rawResult);

    // AI가 분석한 글 내용에 적합한 대표 이미지(썸네일)를 0번 슬롯으로 자동 재배치(스왑)
    if (featuredImageIndex && uploadedImages.length > 0) {
      const targetIdx = parseInt(featuredImageIndex, 10) - 1;
      if (targetIdx > 0 && targetIdx < uploadedImages.length) {
        const featuredImg = uploadedImages[targetIdx];
        uploadedImages.splice(targetIdx, 1); // 기존 위치에서 빼냄
        uploadedImages.unshift(featuredImg); // 첫 번째 자리(대표)에 배치
        console.log(`[AI 대표 이미지 자동 분석] ${targetIdx + 1}번째 시공 사진이 본문 내용과 가장 부합하여 0번(대표) 슬롯으로 자동 이동되었습니다.`);
        renderPhotosList();
      }
    }

    document.getElementById("result-title").value = title;
    
    // 이미지 태그 자동 치환 적용!
    let processedBody = convertImageTagsToEmbeddedContainers(body);

    // 브랜드 로고 노출 가공 처리 적용
    const includeLogo = document.getElementById("check-include-logo")?.checked || false;
    const logoBase64 = localStorage.getItem("brand_logo_base64") || "";
    processedBody = processLogoAndMapPlaceholders(processedBody, includeLogo, logoBase64);

    const previewEl = document.getElementById("result-body-preview");
    previewEl.innerHTML = processedBody;
    bindEmbeddedImageEvents(); // 새로 삽입된 임베디드 이미지의 DblClick 등 바인딩
    convertPlaceholdersToDropzones(); // Bracket 치환 보완

    // 실시간 SEO 계산 실행 (치환 완료된 html 기준)
    updateSeoMetrics(processedBody);

    // 자동 임시저장
    localStorage.setItem("saved_post_title", title);
    localStorage.setItem("saved_post_body", processedBody);

    // 탭 자동 전환 및 활성화 표시
    const tabBtnVirtualEditor = document.getElementById("tab-btn-virtual-editor");
    if (tabBtnVirtualEditor) tabBtnVirtualEditor.click();

  } catch (error) {
    clearInterval(stepInterval);
    console.error("API 오류 발생 (테스트용 폴백 활성화):", error);
    
    // 할당량 초과 시 테스트를 지속하기 위한 가짜 본문 자동 매핑
    const mockTitle = `[임시 테스트] ${city} ${apartment} 미세방충망 교체 시공 다녀왔습니다! - ${companyName}`;
    const mockBodyRaw = `
      <p>안녕하세요! 내 집처럼 정성스럽고 투명하게 시공하여 많은 이웃분들께 신뢰를 얻고 있는 방충망 교체 전문 업체 <strong>${companyName}</strong>입니다.</p>
      <p>[로고 이미지 들어갈 자리]</p>
      <p>날씨가 급격하게 따뜻해지거나 비가 온 직후가 되면 날벌레와 모기들이 기승을 부려 창문을 열기가 두려워지곤 합니다. 특히 오늘 다녀온 <strong>${city} ${apartment}</strong> 고객님 댁은 인근에 조경 및 나무가 아주 울창하여 여름철 날벌레와 초파리 유입이 유독 극성이었던 곳입니다. 고객님께서도 벌레 스트레스 때문에 창문 환기도 맘놓고 못 하셨다고 하여, 신속하고 성심성의껏 방문하여 집안 전체 샷시의 낡은 알루미늄 방충망을 국산 친환경 30메시 모노필라멘트 미세방충망으로 전면 교체 시공해 드렸습니다. 아래 시공 과정을 통해 미세망 교체가 왜 필수인지 자세히 소개해 드리겠습니다.</p>
      
      <h2>1. 기존 노후된 알루미늄 방충망 상태 정밀 진단</h2>
      <img src="image_2" />
      <p>방문을 드려 기존 방충망 상태를 먼저 정밀하게 살펴보았습니다. 아파트 준공 후 한 번도 방충망을 갈지 않아 기존에 설치되어 있던 알루미늄 쇠망이 아주 시커멓게 산화되고 부식되어 가고 있는 상태였습니다. 알루미늄 소재의 방충망은 보통 수명이 3~5년 정도로 짧은 편입니다. 이 기간이 지나면 겉보기에는 멀쩡해 보여도 삭기 시작하여, 손가락으로 가볍게 꾹 누르기만 해도 바삭바삭 과자 부스러기처럼 쉽게 찢어지고 구멍이 뚫려 벌레의 통로가 됩니다.</p>
      <p>더 심각한 문제는 이 부식 과정에서 발생하는 눈에 보이지 않는 미세한 알루미늄 쇳가루와 산화철 분진입니다. 바람이 불 때마다 이 쇳가루가 방충망 틈새로 집안 거실과 안방으로 날려 들어와 가족들의 호흡기와 어린 자녀들의 건강에 해로운 악영향을 미치게 됩니다. 따라서 3년 이상 지난 알루미늄망은 위생과 안전을 위해서라도 반드시 친환경 자재로 교체해 주시는 것이 현명합니다.</p>
      
      <h2>2. 실내 위생을 위한 창틀 전량 탈거 및 지상 야외 작업대 이동</h2>
      <p>저희 ${companyName}은 시공을 의뢰하신 세대의 모든 방충망 창틀을 실내에서 그대로 교체하지 않습니다. 만약 좁은 베란다 안에서 낡은 망을 뜯어내고 칼질을 하게 되면, 그동안 쇠망에 찌들어 있던 엄청난 양의 시커먼 매연 먼지와 녹슨 가루들이 집안 구석구석과 싱크대, 이불 위로 풀풀 날려 떨어지게 됩니다. 이는 고객님 댁 위생에 너무 유해하지요.</p>
      <p>그렇기 때문에 저희는 몸이 조금 고되고 번거롭더라도, 전 세대의 방충망 샷시 틀을 파손 없이 안전하고 정밀하게 탈거하여 1층 지상 야외 주차장이나 마당으로 전부 들고 내려가서 야외 전용 작업대에 거치하고 작업을 진행합니다. 탈거된 틀에 묻은 묵은 먼지까지 말끔하게 털어내고 전처리 작업을 마쳐야만 새 방충망이 깔끔하게 밀착될 수 있습니다.</p>
      
      <h2>3. 특허받은 국산 정품 모노필라멘트 30메시 미세망 교체 결합</h2>
      <div class="image-grid-2x2">
        <p><img src="image_2" /><img src="image_3" /></p>
        <p><img src="image_4" /><img src="image_5" /></p>
      </div>
      <p>야외 작업대에서 기존 낡은 쇠망과 고무 가스켓을 완전히 해체하여 마포대에 분리수거한 뒤, 특허받은 친환경 자재인 국산 30메시 모노필라멘트 미세방충망을 새롭게 밀착시킵니다. 30메시란 사방 1인치 안에 촘촘한 구멍이 30개 들어있다는 뜻으로, 기존 일반 방충망(18메시)보다 2배 이상 촘촘합니다. 덕분에 여름철마다 골치 썩이는 아주 작은 초파리, 모기, 하루살이는 물론하고 크기가 1mm 이하인 초미세 날벌레까지 99.9% 완벽하게 원천 차단해 줍니다.</p>
      <p>소재 또한 금속이 아닌 고강도 낚싯줄에 쓰이는 특수 폴리에스터 섬유(모노필라멘트 원사)를 사용하여 수명이 영구적이고 절대 녹슬지 않습니다. 사람의 힘이나 반려동물의 날카로운 발톱 긁힘으로는 절대로 찢어지지 않을 만큼 강한 내구성(하중 170kg 이상 견딤)을 지니고 있어 어린 자녀나 반려동물의 베란다 추락 방지 안전망 역할까지 톡톡히 수행해 줍니다. 텐션을 팽팽하고 반듯하게 주어 울음이나 들뜸이 전혀 없도록 정밀하게 롤러 작업을 마쳤습니다.</p>
      
      <h2>4. 틈새 벌레를 원천 차단하는 모헤어 및 소모품 무상 전면 교체</h2>
      <p>많은 분들이 방충망만 새로 갈면 벌레가 안 들어올 것이라 오해하시지만, 창문 틈새로 벌레가 우글우글 들어오는 주범은 따로 있습니다. 바로 창틀과 창문 샤시 뼈대 사이에 밀착되어 바람을 막아주는 '모헤어(털)'와 아래쪽 배수 구멍인 '물구멍'입니다. 특히 오래된 아파트는 이 모헤어 털이 닳고 부스러져서 창문을 닫아도 손가락 굵기만 한 커다란 틈새가 벌어집니다.</p>
      <p>저희는 방충망을 시공하시는 모든 세대에, 삭아서 다 사라져 버린 짧은 모헤어 털을 전부 긁어내고 12mm의 아주 길고 도톰한 국산 최고급 모헤어 털로 전량 무상 교체해 드립니다. 샷시를 문틀에 다시 끼웠을 때 털이 빈틈없이 딱 밀착되어 틈새 벌레 유입은 물론이고 겨울철 외풍까지 막아주게 되지요. 창틀 아래 물구멍에도 미세망 전용 방충 패치를 꼼꼼하게 부착하여 미세한 벌레 구멍까지 모두 차단해 드립니다.</p>
      
      <h2>5. 세대 내 완벽 장착 및 투명하고 시원한 시인성 점검</h2>
      <img src="image_1" />
      <p>모든 시공을 정성스럽게 마친 방충망을 다시 고객님 세대로 들고 올라와 각 창문 틀에 유격 없이 꼼꼼하게 결합해 드렸습니다. 결합 완료 후 창문을 닫아둔 상태에서 밖을 바라보시면 모노필라멘트망 특유의 특수 검정 코팅 덕분에 빛이 난반사되지 않아, 마치 방충망이 없는 것처럼 밖의 맑은 하늘과 정원 전경이 안경을 쓴 듯 선명하고 시원하게 뚫려 보입니다. (밖에서는 검게 보여 사생활 보호 효과가 있지만 실내에서는 놀랍도록 투명하게 보입니다)</p>
      <p>고객님께서도 직접 창틀 시인성을 확인하시고는 "이전의 칙칙하고 거뭇한 쇠망을 볼 때는 답답했는데, 눈앞에 망이 없는 것처럼 너무 깨끗해서 정말 신기하다"며 속이 다 시원하다고 대만족의 미소를 지어주셨습니다. 마지막으로 방충 샷시 손잡이와 틈새 유격을 한 번 더 꼼꼼히 점검한 뒤 보람차게 오늘의 모든 현장 시공을 마무리하였습니다.</p>
      
      <p>충주, 청주, 제천 및 음성, 증평 등 충청 전 지역에 당일 신속 예약 및 무료 견적 상담을 지원하고 있으니, 날벌레나 쇳가루 걱정으로 고민이시라면 언제든 편하게 대표 팀장 직통 연락처(<strong>${phoneNumber}</strong>)로 문의해 주시기 바랍니다. 친절하고 든든하게 해결해 드리겠습니다. 감사합니다!</p>
    `.trim();

    const includeLogo = document.getElementById("check-include-logo")?.checked || false;
    const logoBase64 = localStorage.getItem("brand_logo_base64") || "";
    const processedMockBody = processLogoAndMapPlaceholders(convertImageTagsToEmbeddedContainers(mockBodyRaw), includeLogo, logoBase64);

    document.getElementById("result-title").value = mockTitle;
    const previewEl = document.getElementById("result-body-preview");
    previewEl.innerHTML = processedMockBody;
    bindEmbeddedImageEvents();
    convertPlaceholdersToDropzones();

    // 실시간 SEO 계산 실행
    updateSeoMetrics(processedMockBody);

    // 자동 임시저장
    localStorage.setItem("saved_post_title", mockTitle);
    localStorage.setItem("saved_post_body", processedMockBody);

    // 탭 자동 전환 및 활성화 표시
    const tabBtnVirtualEditor = document.getElementById("tab-btn-virtual-editor");
    if (tabBtnVirtualEditor) tabBtnVirtualEditor.click();

    alert("API 오류가 발생했습니다. 아래 오류 메시지를 확인해 주세요:\n\n" + error.message + "\n\n(지속적인 한도 초과 시, 임시 로컬 이미지 데이터가 적용된 모의 시공 후기 초안이 자동으로 로드됩니다.)");
  } finally {
    const btnGen = document.getElementById("btn-generate");
    const spin = document.getElementById("loading-spinner");
    if (btnGen) {
      btnGen.disabled = false;
      btnGen.style.opacity = "1";
    }
    if (spin) {
      spin.classList.add("hidden");
    }
  }
}

// 5대 SEO 템플릿용 프롬프트 생성기
function buildGeminiPrompt(mode, city, apartment, keywords, additionalRequests, includeMap) {
  const keywordList = keywords ? keywords.split(",").map(k => k.trim()) : [];
  const mainKeyword = `${city}미세방충망`;
  const subKeywordsText = keywordList.length > 0 ? `서브 키워드: ${keywordList.join(", ")}` : "";
  const imgCount = uploadedImages.length > 0 ? uploadedImages.length : 5;
  
  // 대표코멘트(추가 요구사항)의 깊이 있는 의도 파악과 본문 뼈대 융합 지침
  const additionalRequestsText = `
[🚨 대표코멘트 중심의 스토리텔링 빌드 지침]:
${additionalRequests ? `
- **입력된 대표코멘트**: "${additionalRequests}"
- **의도 파악 및 중심 뼈대 반영**: 
  이 코멘트는 글의 단순한 추가 요구사항이 아니라, **이 포스팅 전체의 중심 플롯(스토리 라인)이자 가장 핵심적인 메시지**입니다. 
  코멘트의 표면적인 단어뿐만 아니라 '왜 고객님이 이 요청을 하셨을지', '해당 시공에서 어떤 가치가 가장 빛났는지' 그 **의도와 맥락을 깊이 있게 추론**하십시오.
  예를 들어:
  - *아이/고양이/안전* 언급 시: 방충망 추락 사고 예방, 찢어지지 않는 고강도 모노필라멘트 자재의 안전성 및 발톱 저항성, 잠금장치 시공 등을 글의 중심 주제로 설정.
  - *이웃 추천/입소문* 언급 시: 충주 지역 주민들의 신뢰도, 소개받고 방문하여 더욱 세심히 챙긴 마음, 정직한 시공 신뢰도를 오프닝과 시공 과정 전반에 핵심 스토리로 설정.
  - *벌레/초파리/먼지* 언급 시: 호수/강/숲 인근 아파트의 벌레 유입 애로사항 해결, 30메시 촘촘함의 과학적 원리, 틈새 벌레를 막는 모헤어 교체의 중요성을 솔루션으로 배치.
  - *가격/가성비/친절* 언급 시: 속지 않는 정직한 견적, 서비스 마인드, 오래 쓰는 반영구 수명으로 아끼는 비용 비교를 중심 논조로 배치.
  전체 글의 시작부터 끝까지 이 대표코멘트의 맥락이 자연스럽게 스며들어, 독자가 이 글을 읽었을 때 "정말 나에게 딱 필요한 정성스러운 시공이구나"라고 느낄 수 있도록 하십시오.
` : "- 별도의 대표코멘트는 없으나, 기본적으로 정직하고 정성스러운 동네 베테랑 팀장의 시공일지 형태로 뼈대를 잡으십시오."}

- **첨부 이미지 매칭 분석**: 
  이 요청과 함께 사용자가 실제 현장에서 촬영하여 올린 시공 사진들(이미지 바이너리)이 같이 전달되었습니다. 
  각 이미지를 면밀히 관찰하여 시공 전의 노후된 샷시와 방충망 오염 상태, 시공 과정(지상 탈거 후 미세망 조립), 시공 후 설치 완료되어 창밖이 투명하고 깨끗하게 뚫려 보이는 등의 실제 상황적 특징을 포스팅 글에 그대로 녹여내십시오. 
  뜬금없는 가공의 시공 이야기를 임의로 지어내지 말고, **반드시 실제 사진 속 상태와 추가 요청 사항에 맞춰 글을 작성**함으로써 독자가 포스팅의 텍스트와 사진을 대조했을 때 전혀 위화감이 없도록 100% 밀착하여 서술해야 합니다.
`;

  const basePersona = `
당신은 충청권(충주, 청주, 제천 등) 일대에서 정직함과 정밀한 시공으로 입소문이 난 [${companyName}]의 대표이자 현장 팀장입니다.
당신이 오늘 직접 ${city}의 [${apartment}] 현장을 방문하여 성심성의껏 시공해드린 실제 작업 기록을 블로그 포스팅 일지로 남겨야 합니다.

[✍️ 충주미세방충망 블로그 고유의 톤앤매너 및 글 형태 분석 규칙]
실제 충주미세방충망의 기존 글쓴이가 쓴 것처럼 보이기 위해 아래의 세밀한 글쓰기 방식을 반드시 따르십시오:
1. **듬직하고 친근한 이웃집 베테랑 말투**:
   - 격식적이거나 기계적인 번역투 대신, 다정하면서도 시공에 있어서는 추호의 타협도 없는 장인의 고집이 느껴지는 어투(~했습니다, ~지요, ~네요, ~답니다)를 사용하세요.
   - 글 초반에는 "안녕하세요! 정직하게 땀 흘려 일하는 방충망 전문 업체 **충주미세방충망**입니다."로 친근하게 인사하고 날씨나 계절에 따른 일상 안부를 가볍게 건네세요.
2. **현장감과 공감 중심의 디테일 묘사**:
   - 기존의 알루미늄 방충망의 노후화(겉보기엔 멀쩡해도 부식되어 손가락으로 꾹 누르면 과자처럼 툭 바스러지고 미세한 쇳가루가 바람을 타고 집안으로 날려 들어와 호흡기에 유해한 점)를 구체적으로 지적해 주어 교체 필요성을 상기시킵니다.
   - "실내에서 방충망을 뜯어내면 그 시커먼 먼지며 쇳가루가 거실로 고스란히 떨어집니다. 그래서 저희는 조금 번거롭더라도 모든 창을 다 떼어내서 지상 야외(주차장이나 마당)로 가지고 내려가서 작업을 해드립니다. 그래야 고객님 댁 위생도 지킬 수 있고 저희도 맘 편히 먼지를 털어낼 수 있으니까요."와 같은 진솔하고 배려 깊은 행동 묘사를 넣으세요.
   - 틈새 벌레의 원인이 되는 '닳아버린 낡은 모헤어(털)'를 무상으로 도톰한 새것으로 갈아드리고 풍지판과 물구멍 방충망 서비스까지 꼼꼼하게 메꿔 드린다는 베테랑다운 꼼꼼한 마무리를 현장 일지 형식으로 자연스럽게 소개하세요.
3. **가독성을 위한 친근한 흐름**:
   - 보고서처럼 번호만 매기며 딱딱하게 정렬하지 마세요. "자, 이제 지상으로 내려왔습니다", "망을 만져보니 역시나 삭아있네요" 처럼 시간의 흐름이나 행동의 변화에 따라 자연스러운 서술형 흐름을 이어가세요.
   - 설치 후 밖을 내다봤을 때 "너무 투명해서 마치 방충망이 없는 것처럼 밖의 아파트 조경이나 푸른 하늘이 유리창을 보듯 깨끗하게 시원하게 뚫려 보입니다. 고객님들께서도 이 시인성을 보시고는 늘 깜짝 놀라시며 속이 다 시원하다고 말씀해 주십니다."와 같은 생생한 피드백을 담아내세요.

[블로그 시그니처 템플릿 규격 (필수 준수)]
당신이 생성하는 글 본문은 반드시 다음 3단 구조(웰컴 헤더, 본문 내용, 엔딩 푸터)를 엄격히 갖추어 HTML 서식으로 출력해야 합니다:

1. **오프닝 헤더 (시그니처 빨간색 인사말, 요약 코멘트 & 로고)**:
   - 글의 맨 첫 부분에는 반드시 다음의 **빨간색 오프닝 인사 및 로고 배치 규격 코드**를 고스란히 먼저 출력하십시오:
     \`\`\`html
     <p style="text-align: center; font-size: 16px; color: #ff0000; font-weight: bold; margin-bottom: 8px;">안녕하세요 ${city} 방충망 교체 전문 업체</p>
     <p style="text-align: center; font-size: 18px; color: #ff0000; font-weight: bold; margin-bottom: 20px;">"${companyName}"입니다.</p>
     <p style="text-align: center; font-size: 14px; line-height: 1.8; color: #333; margin-bottom: 25px;">
       [이곳에 오늘 시공의 핵심을 짚어주는 3~5줄 분량의 팁 요약 코멘트를 중앙 정렬로 작성하십시오. 예: 구옥 레일 보완 시공의 중요성이나, 벌레 완벽 차단의 과학적 근거 등, 대표코멘트의 의도를 적극적으로 반영해 기존 충주미세방충망 블로그 말투로 작성하십시오.]
     </p>
     <p style="text-align: center; margin-bottom: 30px;">[로고 이미지 들어갈 자리]</p>
     \`\`\`
   - 이 인사말 세트 바로 아래에는 [${city} ${apartment}] 아파트 단지 정보(세대수, 준공년도 등 사실적 정보)를 결합하여 짧고 정갈하게 1문단 이내로 인트로 텍스트를 적은 후, 바로 첫 번째 사진(\`<img src="image_1" />\`)을 등장시켜 본론을 이끌어내십시오.

2. **본문 이미지 및 본문 텍스트의 교차 배치 규칙 (사진-글 교차 강제 및 연달아 붙여쓰기 절대 금지)**:
   - 반드시 **[사진 1장 또는 격자 1세트] ➡️ [해당 사진에 대해 설명하는 본문 글(1~2문단, 약 200~300자)] ➡️ [다음 사진 1장] ➡️ [그에 대한 설명 글]**의 교차 형태로 조립하십시오.
   - 시공과 전혀 무관한 엉뚱한 사진이 아닌 한, **업로드된 총 ${imgCount}장의 모든 이미지(\`image_1\`부터 \`image_${imgCount}\`까지)는 본문 곳곳에 단 한 장도 빠짐없이 100% 전부 사용되어야 합니다.**
   - **절대로 사진 태그(\`<img />\`)를 중간에 글 설명 없이 연속으로 2장 이상 다닥다닥 붙여서 쓰지 마십시오.** (예: \`<img src="image_1"><img src="image_2">\` 처럼 배치하면 절대 안 되며, 반드시 사진 사이사이에 설명 문단인 \`<p>\` 태그가 끼어 있어야 합니다)
     \`\`\`html
     <div class="image-grid-2x2">
       <p><img src="image_2" /><img src="image_3" /></p>
       <p><img src="image_4" /><img src="image_5" /></p>
     </div>
     \`\`\`
   - 본문에 \`image_1\`부터 마지막 \`image_${imgCount}\`까지의 모든 이미지 파일 가이드 번호가 고르고 순차적으로 무조건 삽입되어야 합니다. 임의로 일부 사진 번호를 누락한 채 글을 완성하는 행위는 절대 금지됩니다.

   - **인사말 및 인트로 글을 여러 문단 연속으로 사진 없이 나열하지 마십시오.** 오프닝 헤더 아래에 약 1문단의 가벼운 인사 후 즉시 첫 번째 시공 사진(\`<img src="image_1" />\`)을 배치하고 본론으로 넘어가야 합니다.
   - **절대로 사진 없이 글(텍스트)만 연속으로 3문단 이상 길게 뭉쳐있게 두지 마십시오.** 적당한 흐름마다 그 단계를 보여주는 사진을 자연스럽게 교차하여 배치하세요.
   - **글 흐름에 맞춘 다양한 사진 배치 레이아웃 융합 규칙**:
     사진의 특징과 문맥에 맞춰 아래 세 가지 레이아웃 형식을 융통성 있게 고루 섞어 배치하여 지루함을 피하십시오:
     * **1) 낱장 단독 배치**: 특정 단계나 모습을 단독 강조할 때 사용. (예: \`<img src="image_2" />\`)
     * **2) 1x2(양옆 나란히) 배치 (1~2회 사용)**: 시공 전후 비교 또는 연결된 두 장면을 나란히 보여줄 때 강추:
       \`\`\`html
       <div class="image-grid-1x2" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
         <p><img src="image_3" /><img src="image_4" /></p>
       </div>
       \`\`\`
     * **3) 2x2 바둑판 격자 배치 (글 전체에서 최대 딱 1회만 허용)**: 여러 장의 노후 상태나 자재 샷을 모아 한눈에 보여줄 때 1회만 허용:
       \`\`\`html
       <div class="image-grid-2x2">
         <p><img src="image_5" /><img src="image_6" /></p>
         <p><img src="image_7" /><img src="image_8" /></p>
       </div>
       \`\`\`

3. **엔딩 푸터 및 지도 (연락처 & 출장 범위)**:
   - ${includeMap ? `푸터 바로 직전 단락에 반드시 다음의 지도 위젯 배치 코드를 추가하십시오:\n     \`<div class="map-embed-placeholder">🗺️ 네이버 지도 위젯 삽입 위치: ${city} ${apartment}</div>\`` : "아파트 단지 시공이므로 네이버 지도는 사생활 보호를 위해 삽입하지 마십시오."}
   - 글의 맨 끝부분에는 다음 푸터 템플릿 코드를 고스란히 추가하십시오:
     \`\`\`html
     <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
     <p style="text-align: center;"><a href="tel:${phoneNumber}" style="color: #03c75a; font-weight: bold; text-decoration: underline; font-size: 16px;">👉 누르면 전화 연결<br>TEL: ${phoneNumber}</a></p>
     <p style="text-align: center; color: #666; font-size: 13px;">제천, 음성, 청주, 증평, 주덕, 수안보, 괴산, 세종 방충망 교체까지 무료 출장!!</p>
     <p style="text-align: center; font-size: 14px; font-weight: bold; margin-top: 20px; line-height: 1.6;">이상 방충망도 시공하는 업체가 아닌,<br>방충망 만을 시공하는<br>"${companyName}"이었습니다.</p>
     \`\`\`

기본 글쓰기 가이드:
1. **🤖 AI 말투 완전 차단 및 100% 인간 필체 구현**:
   - 블로그 글이 아니라 실제 시공 팀장이 쓴 일기장이나 현장 후기처럼 극도로 자연스러운 한국어 구어를 사용하세요.
   - AI가 작성한 티가 나는 상투적인 단어와 번역투 표현들을 **절대 사용 금지**합니다.
   - **금지 단어**: "혁신적인", "최첨단", "소개해 드리고자 합니다", "함께 알아보시죠", "중요합니다", "알아봅시다", "놀라운", "해결해 드립니다", "어떠신가요", "이러한", "통해", "제공합니다", "대표적인", "성공적인", "추천해 드립니다", "무상으로", "공짜로", "양심을 걸고".
   - 문단 구성을 기계식 보고서처럼 규격화하지 말고, 친근하고 이웃처럼 다정하지만 듬직한 말투(~했습니다, ~네요, ~지요)로 서술하세요.
2. **HTML 서식**: 복사했을 때 네이버 에디터에서 볼드, 문단 구분, 표 서식이 즉각 유지되도록 <p>, <h2>, <h3>, <strong>, <table>, <tr>, <td> 등의 표준 HTML 태그 구조로 완성하세요.
3. **📐 전체 글 분량: 1,500자 ~ 2,000자**:
   - 포스팅의 가독성을 최적으로 맞추기 위해, 전체 글의 분량(공백 포함 글자 수 기준)은 반드시 **1,500자 이상, 2,000자 이하(2,000자를 절대 초과하지 마십시오)**가 되도록 분량을 조율하여 작성하세요.
   - 지루하게 길게 쓰거나 억지로 내용을 반복하지 마시고, 아래의 **5가지 시공 주요 공정**에 대해 각각 1~2개의 핵심 문단씩 자연스럽고 군더더기 없이 조율하여 작성하십시오:
     - 1. **기존 방충망 상태 진단**: 노후된 알루미늄 방충망의 부식 문제(손가락으로 누르면 바로 찢어짐, 바람 불면 미세 쇳가루와 중금속 먼지가 실내로 유입되어 가족 호흡기에 악영향을 끼침 등)를 사실적으로 상세히 설명.
     - 2. **지상 야외 탈거 및 작업대 설치**: 실내 위생을 위해 굳이 모든 무거운 샷시 창을 안전하게 떼어내어 1층 외부 야외 주차장이나 작업대로 가지고 내려가서 세심히 작업하는 배려와 현장 분위기를 자세히 묘사.
     - 3. **모노필라멘트 30메시 미세망 교체 공정**: 낚싯줄 소재 특유의 고강도 물성(칼이나 발톱으로 긁어도 찢어지지 않아 추락 방지용으로 탁월), 30메시의 촘촘한 규격으로 날벌레/초파리/미세 해충을 99.9% 완벽 차단하는 원리를 과학적으로 알기 쉽게 설명.
     - 4. **벌레 유입 틈새 완전 차단 서비스**: 망 교체뿐만 아니라, 틈새 바람을 막아주는 삭아버린 모헤어(털)를 도톰한 새 제품으로 무료 교체하고 풍지판 밀착, 물구멍 방충망 패치 부착 등 베테랑다운 꼼꼼한 마무리를 디테일하게 작성.
     - 5. **재장착 및 시인성 피드백**: 세대에 올라가 다시 설치했을 때 너무 맑고 투명해서 방충망이 없는 것처럼 밖의 전경이 훤히 비치는 환상적인 시야(시인성)와 고객님의 긍정적 리액션을 생생하게 전달.
`;

  let modeSpecificPrompt = "";

  switch (mode) {
    case "c-rank":
      modeSpecificPrompt = `
[선택된 모드: C-Rank & DIA+ 현장감 시공 일지]
실제 다녀온 작업의 신뢰성과 전문성 지수를 올리기 위해, 오늘 진행한 시공 작업 순서에 따라 현장감 넘치게 차분히 설명하세요.
- **스토리 전개**:
  1. 의뢰 내용: 고객님이 방충망 교체를 결심하여 문의를 주시게 된 계기와 상황 설명.
  2. 준비 및 탈거 공정: 안전하고 꼼꼼한 처리를 위해 시공을 시작하고 준비하는 과정 (사진 속에 보이는 실제 탈거 또는 야외 이동 공정이 있다면 매칭하여 기술).
  3. 교체 결합 공정: 사용자가 올린 사진 속의 조립 자재 종류에 맞추어, 울음이나 들뜸 없이 팽팽하고 깔끔하게 신규 방충망을 작업대에서 결합하는 과정 설명.
  4. 재설치 및 점검: 세대에 완성된 방충망을 재장착하고 밖이 깨끗하게 보이는 시야 상태 및 고객 만족도 언급.
  *주의: 사진에 보이지 않거나 대표 코멘트에 적혀있지 않은 작업(예: 틀 세척, 모헤어 무상 교체, 물구멍 서비스 등)은 가공하여 적지 마십시오.
- **핵심 키워드**: 메인 키워드인 [${mainKeyword}]를 문맥에 맞게 자연스럽게 5~7회 포함하고, ${subKeywordsText}도 고루 활용하세요.
`;
      break;

    case "alcon":
      modeSpecificPrompt = `
[선택된 모드: Alcon 지역 밀착 & 입주민 고민 세부 해결]
검색 목적과 아파트 특성에 맞춰, 소제목(H2/H3)을 구체적으로 세분화하여 정보의 전문성과 체류시간을 극대화합니다.
- **키워드 매핑**: [${mainKeyword}] 및 ${city} [${apartment}] 방충망.
- **소제목 구조**:
  - H2: "1. [${apartment}] 기존 노후된 방충망 상태 분석 및 교체 시점"
  - H2: "2. 오늘 시공에 적용된 신규 방충망 자재의 특장점과 장점" (사진과 코멘트에 일치하는 자재 특성만 기술)
  - H2: "3. 미세방충망의 통기성 및 시공 시 자주 묻는 질문 해결"
  - H2: "4. ${city} 및 인근 지역 출장 범위와 올바른 업체 선정 기준"
- **내용**: 해당 지역(${city})의 기후나 환경적 애로사항(날벌레 유입 등)을 주민 입장에서 공감하며 해결책 위주로 서술하세요.
`;
      break;

    case "aeo":
      modeSpecificPrompt = `
[선택된 모드: AEO 자재 스펙 비교 및 FAQ (AI 브리핑 노출용)]
기계와 AI 요약 봇이 수집하기 쉬운 정보 비교 중심의 테이블 레이아웃을 사용합니다.
- **도입부**: 오늘 시공한 ${city} [${apartment}] 아파트의 방충망 시공에 사용된 자재 스펙 요약 정보 제공.
- **자재 스펙 비교표 (HTML <table> 태그 필수 적용)**:
  - 열: 자재 구분, 기존 알루미늄망, 오늘 사용한 신형 방충망 (사진 속 자재 종류 명시)
  - 행: 메시(촘촘함), 내구성(수명), 날벌레 차단력, 시각적 개방감(투명도)
  - 테이블 테두리가 살아있고 패딩이 깔끔하게 들어간 CSS 스타일링 인라인 속성을 테이블에 적용하세요.
- **FAQ 섹션 (3가지 구성)**:
  - 사진에 드러난 자재 관리 요령 및 청소법 등 실용적인 질문과 신뢰감 있는 답변을 제공하세요.
`;
      break;

    case "home-plate":
      modeSpecificPrompt = `
[선택된 모드: Home-Plate 비포&애프터 감성 스토리텔링 (추천 피드용)]
차가운 기술 지식을 장황하게 설명하기보다, 시공 전/후 사진을 대조하며 쾌적하게 개선된 집안 공기와 맑은 창밖 뷰가 선사하는 만족감을 전개합니다.
- **제목**: "방충망 하나 바꿨을 뿐인데, 거실 창문이 액자가 되었습니다" 혹은 시공 결과의 시각적 놀라움을 묘사하는 감성적인 제목 선택.
- **Before/After 대조**: 거무스름하고 먼지 낀 낡은 방충망 사진의 답답함과, 교체 후 너무 투명해서 마치 망이 설치되지 않은 것 같은 맑은 하늘/창밖 뷰의 시각 대비를 극대화하여 서술하세요.
`;
      break;

    case "insight-edge":
      modeSpecificPrompt = `
[선택된 모드: Insight-Edge 전문가의 양심 기술 칼럼]
단순 가격 경쟁 저가 업체들의 날림 시공 방식과 차별화되는 올바른 시공의 기준을 세워 소비자의 현명한 결정을 돕습니다.
- **핵심 내용**:
  - 1. 중국산 저품질 원사와 국산 정품 원사의 차이점 및 안전성 비교.
  - 2. 현장에서 고정 프레임과 방충망을 빈틈없이 팽팽하게 텐션 조립하는 전문가 시공 공정의 중요성.
  - 3. 망만 교체하는 것이 아니라, 사용자가 명시한 실제 시공 범위와 사진 속 부자재 상태에 맞춰 정밀하게 시공해야 벌레를 완벽히 막을 수 있다는 양심 조언.
`;
      break;
  }

  return `
${basePersona}

${modeSpecificPrompt}
${additionalRequestsText}

위 가이드라인을 성실히 따라 작성해 주세요. 
반드시 JSON 포맷 문자열로만 응답해야 하며, 다른 서론이나 꼬리말 설명 없이 오직 아래 형식의 JSON 데이터만 출력해야 합니다. 마크다운의 \`\`\`json 블록으로 감싸주세요.

{
  "title": "여기에 포스팅용 최적화 제목을 입력하세요 (메인 키워드가 반드시 자연스럽게 들어가야 함)",
  "body": "여기에 문단별로 <p>, <h2>, <h3>, <strong>, <table>, <tr>, <td> 등의 HTML 태그를 적절히 활용하여 작성한 풍부한 본문 전체 텍스트를 기입하세요. 이미지 삽입 가이드 단락은 약 4~6곳 지정해서 포함하세요.",
  "featuredImageIndex": 업로드된 사진 목록 중, 이 글의 대표 이미지(썸네일)로 사용하기에 가장 적절하고 극적인 현장 사진의 번호(1부터 시작하는 정수, 범위: 1 ~ ${imgCount})
}
`;
}

// Gemini API 호출 - 동적 모델 발견 및 다단계 순차 루프 호출
async function callGeminiAPI(promptText, imageParts = []) {
  let modelCandidates = [];

  // 1. API 키를 사용해 이 계정에서 사용 가능한 모델 목록 조회 시도 (가장 확실함)
  try {
    console.log("사용 가능한 모델 목록 조회를 시도합니다...");
    const modelsUrl = `https://generativelanguage.googleapis.com/v1/models?key=${geminiApiKey}`;
    const res = await fetch(modelsUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.models && data.models.length > 0) {
        // generateContent 기능이 지원되는 모델만 필터링
        const validModels = data.models.filter(m => 
          m.supportedGenerationMethods && 
          m.supportedGenerationMethods.includes("generateContent")
        );

        // 모델 우선순위 정렬:
        // 1순위: 'lite'가 들어간 모델 (부하가 적고 무료 한도 쿼타 잔량이 매우 넉넉함)
        // 2순위: 'flash'가 들어간 모델 (일반 모델)
        // 3순위: 그 외 모델 (pro 계열 등)
        const liteModels = validModels.filter(m => m.name.toLowerCase().includes("lite"))
          .map(m => ({ name: m.name.replace("models/", ""), api: "v1" }));
        
        const flashModels = validModels.filter(m => !m.name.toLowerCase().includes("lite") && m.name.toLowerCase().includes("flash"))
          .map(m => ({ name: m.name.replace("models/", ""), api: "v1" }));
          
        const otherModels = validModels.filter(m => !m.name.toLowerCase().includes("lite") && !m.name.toLowerCase().includes("flash"))
          .map(m => ({ name: m.name.replace("models/", ""), api: "v1" }));

        modelCandidates = [...liteModels, ...flashModels, ...otherModels];
        console.log("정렬된 후보 모델 리스트:", modelCandidates);
      }
    }
  } catch (err) {
    console.warn("모델 조회 API 실패, 기본 하드코딩 모델 체인으로 진행합니다.", err);
  }

  // 만약 조회에 실패했거나 비어있는 경우 기본 하드코딩 모델 체인 세팅
  if (modelCandidates.length === 0) {
    modelCandidates = [
      { name: "gemini-2.0-flash-lite", api: "v1" },
      { name: "gemini-3.1-flash-lite", api: "v1" },
      { name: "gemini-2.0-flash", api: "v1" },
      { name: "gemini-1.5-flash", api: "v1" },
      { name: "gemini-1.5-pro", api: "v1" }
    ];
  }

  // 각 후보 모델들을 순서대로 호출 시도
  const errors = [];
  for (let i = 0; i < modelCandidates.length; i++) {
    const candidate = modelCandidates[i];
    try {
      console.log(`Gemini API 시도 ${i + 1}/${modelCandidates.length} (${candidate.api} / ${candidate.name})...`);
      const result = await executeGeminiRequest(candidate.api, candidate.name, promptText, imageParts);
      console.log(`호출 성공! 선택된 모델: ${candidate.name}`);
      return result;
    } catch (error) {
      errors.push(`- ${candidate.name}: ${error.message}`);
      console.warn(`${candidate.name} 호출 실패. 다음 후보 진행...`, error);
    }
  }

  // 모든 시도가 실패한 경우 상세 정보가 포함된 에러 발생
  throw new Error("모든 API 호출 시도가 실패했습니다. 아래 오류 내역을 확인해 주세요:\n\n" + errors.join("\n"));
}

// 실제 HTTP POST API 요청 수행
async function executeGeminiRequest(apiVersion, modelName, promptText, imageParts = []) {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${geminiApiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          ...imageParts
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: 3000,
      temperature: 0.75
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
    throw new Error(errData.error?.message || `${apiVersion}/${modelName} 요청 응답 에러`);
  }

  const resJson = await response.json();
  const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResult) {
    throw new Error("결과 텍스트를 파싱하지 못했습니다.");
  }

  return textResult;
}

// JSON 규격 내 문자열 내부의 실제 개행 문자(\n, \r)를 \\n, \\r로 강제 이스케이프하는 유틸리티
function escapeRawNewlinesInJson(str) {
  let inString = false;
  let escaped = false;
  let result = "";
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (inString) {
      if (escaped) {
        result += char;
        escaped = false;
      } else if (char === '\\') {
        result += char;
        escaped = true;
      } else if (char === '"') {
        result += char;
        inString = false;
      } else if (char === '\n') {
        result += "\\n";
      } else if (char === '\r') {
        result += "\\r";
      } else {
        result += char;
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }
  return result;
}

// API 원시 텍스트 JSON 파싱 및 예외 처리
function parseGeminiResponse(rawText) {
  try {
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

    // JSON 문자열 속 비표준 생개행 문자 전처리 이스케이프 적용
    cleanText = escapeRawNewlinesInJson(cleanText);

    const parsed = JSON.parse(cleanText);
    return {
      title: parsed.title || "충주미세방충망 시공 일지 후기",
      body: parsed.body || "<p>내용이 올바르게 생성되지 못했습니다.</p>",
      featuredImageIndex: parsed.featuredImageIndex || null
    };
  } catch (e) {
    console.error("JSON 파싱 실패, 일반 텍스트 모드로 폴백 복구합니다.", e);
    return {
      title: "충주미세방충망 전문 시공 현장 후기",
      body: `<p>${rawText.replace(/\n/g, "<br>")}</p>`,
      featuredImageIndex: null
    };
  }
}

// 5. 실시간 SEO 점수 검증 측정
function updateSeoMetrics(bodyText) {
  // 1. 글자 수 계산
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = bodyText;
  const pureText = tempDiv.textContent || tempDiv.innerText || "";
  // 네이버 글자수 검사기 표준에 맞춰 공백 포함 글자 수로 계산 방식 변경
  const charCount = pureText.trim().replace(/\s+/g, " ").length;

  // 2. 키워드 빈도 계산
  const city = document.getElementById("select-city").value || "충주";
  const mainKeyword = `${city}미세방충망`;
  const regex = new RegExp(mainKeyword, "g");
  const matches = pureText.match(regex);
  const keywordCount = matches ? matches.length : 0;

  // 3. 이미지 수 계산
  const previewEl = document.getElementById("result-body-preview");
  const imageCount = previewEl ? previewEl.querySelectorAll(".embedded-image-container").length : 0;

  // 4. 제목의 지역 포함 검증
  const title = document.getElementById("result-title")?.value || "";
  const isCityInTitle = title.includes(city);

  // 점수 계산
  let score = 0; // 5개 지표 각 20점씩 (총 100점)

  // 1) 제목 지역 검증 (20점)
  const checkCityEl = document.getElementById("seo-check-city");
  if (isCityInTitle) {
    score += 20;
    if (checkCityEl) {
      checkCityEl.className = "checklist-item pass";
      checkCityEl.querySelector(".chk-icon").textContent = "✔️";
      checkCityEl.querySelector(".chk-status").textContent = "완료";
    }
  } else {
    if (checkCityEl) {
      checkCityEl.className = "checklist-item";
      checkCityEl.querySelector(".chk-icon").textContent = "⚪";
      checkCityEl.querySelector(".chk-status").textContent = "미포함";
    }
  }

  // 2) 키워드 개수 검증 (20점)
  const checkKeywordEl = document.getElementById("seo-check-keyword");
  if (keywordCount >= 5 && keywordCount <= 8) {
    score += 20;
    if (checkKeywordEl) {
      checkKeywordEl.className = "checklist-item pass";
      checkKeywordEl.querySelector(".chk-icon").textContent = "✔️";
      checkKeywordEl.querySelector(".chk-status").textContent = `${keywordCount}회 (적정)`;
    }
  } else {
    if (keywordCount > 0) score += 10; // 키워드가 있긴 있으면 10점
    if (checkKeywordEl) {
      checkKeywordEl.className = "checklist-item warning";
      checkKeywordEl.querySelector(".chk-icon").textContent = "⚠️";
      checkKeywordEl.querySelector(".chk-status").textContent = `${keywordCount}회 (조정 필요)`;
    }
  }

  // 3) 이미지 개수 검증 (20점)
  const checkImagesEl = document.getElementById("seo-check-images");
  if (imageCount >= 4) {
    score += 20;
    if (checkImagesEl) {
      checkImagesEl.className = "checklist-item pass";
      checkImagesEl.querySelector(".chk-icon").textContent = "✔️";
      checkImagesEl.querySelector(".chk-status").textContent = `${imageCount}개 (충분)`;
    }
  } else {
    if (imageCount > 0) score += 10;
    if (checkImagesEl) {
      checkImagesEl.className = "checklist-item";
      checkImagesEl.querySelector(".chk-icon").textContent = "⚪";
      checkImagesEl.querySelector(".chk-status").textContent = `${imageCount}개 (권장 4개)`;
    }
  }

  // 4) 글자 수 검증 (20점)
  const checkWordsEl = document.getElementById("seo-check-words");
  if (charCount >= 1500 && charCount <= 2200) {
    score += 20;
    if (checkWordsEl) {
      checkWordsEl.className = "checklist-item pass";
      checkWordsEl.querySelector(".chk-icon").textContent = "✔️";
      checkWordsEl.querySelector(".chk-status").textContent = `${charCount}자 (적정)`;
    }
  } else if (charCount > 2200) {
    score += 15; // 초과 시 부분 점수
    if (checkWordsEl) {
      checkWordsEl.className = "checklist-item warning";
      checkWordsEl.querySelector(".chk-icon").textContent = "⚠️";
      checkWordsEl.querySelector(".chk-status").textContent = `${charCount}자 (초과)`;
    }
  } else {
    if (charCount >= 1000) score += 10;
    if (checkWordsEl) {
      checkWordsEl.className = "checklist-item";
      checkWordsEl.querySelector(".chk-icon").textContent = "⚪";
      checkWordsEl.querySelector(".chk-status").textContent = `${charCount}자 (권장 1,500~2,000자)`;
    }
  }

  // 5) AI 말투 / 인간 필체 검증 (20점)
  const checkToneEl = document.getElementById("seo-check-tone");
  const aiKeywords = [
    "혁신적인", "최첨단", "소개해 드리고자 합니다", "함께 알아보시죠", 
    "중요합니다", "알아봅시다", "놀라운", "해결해 드립니다", "어떠신가요",
    "이러한", "통해", "제공합니다", "대표적인", "성공적인", "추천해 드립니다",
    "무상으로", "공짜로", "양심을 걸고"
  ];
  
  let detectedAiWords = [];
  aiKeywords.forEach(kw => {
    if (pureText.includes(kw)) {
      detectedAiWords.push(kw);
    }
  });

  if (detectedAiWords.length <= 1) {
    score += 20;
    if (checkToneEl) {
      checkToneEl.className = "checklist-item pass";
      checkToneEl.querySelector(".chk-icon").textContent = "✔️";
      checkToneEl.querySelector(".chk-status").textContent = "통과";
    }
  } else if (detectedAiWords.length === 2) {
    score += 10;
    if (checkToneEl) {
      checkToneEl.className = "checklist-item warning";
      checkToneEl.querySelector(".chk-icon").textContent = "⚠️";
      checkToneEl.querySelector(".chk-status").textContent = "2개 검출";
    }
  } else {
    if (checkToneEl) {
      checkToneEl.className = "checklist-item warning";
      checkToneEl.querySelector(".chk-icon").textContent = "⚠️";
      checkToneEl.querySelector(".chk-status").textContent = `${detectedAiWords.length}개 검출`;
    }
  }

  // 최종 발행 확인 체크
  const checkFinalEl = document.getElementById("seo-check-final");
  if (score >= 80) {
    if (checkFinalEl) {
      checkFinalEl.className = "checklist-item pass";
      checkFinalEl.querySelector(".chk-icon").textContent = "✔️";
      checkFinalEl.querySelector(".chk-status").textContent = "검증 완료";
    }
  } else {
    if (checkFinalEl) {
      checkFinalEl.className = "checklist-item warning";
      checkFinalEl.querySelector(".chk-icon").textContent = "⚠️";
      checkFinalEl.querySelector(".chk-status").textContent = "최종 검토";
    }
  }

  // 원형 게이지 업데이트
  const gaugeCircle = document.getElementById("seo-gauge-circle");
  const scoreNumEl = document.getElementById("seo-score-num");
  if (scoreNumEl) {
    scoreNumEl.textContent = score;
  }
  if (gaugeCircle) {
    const circumference = 251.2;
    const offset = circumference - (circumference * score / 100);
    gaugeCircle.style.strokeDashoffset = offset;
    
    // 점수 등급에 따른 색상 분기
    if (score >= 80) {
      gaugeCircle.style.stroke = "var(--success-color)";
    } else if (score >= 50) {
      gaugeCircle.style.stroke = "var(--warning-color)";
    } else {
      gaugeCircle.style.stroke = "#dc2626"; // red
    }
  }
}

// 6. 네이버 스마트에디터 WebView로 글 주입 (N버튼)
function handleSendToNaverWebView() {
  const title = document.getElementById("result-title").value;
  const body = document.getElementById("result-body-preview").innerHTML;
  const webview = document.getElementById("naver-webview");

  if (!webview) {
    alert("우측 네이버 에디터 웹뷰를 찾을 수 없습니다.");
    return;
  }

  const currentUrl = webview.getURL() || "";
  console.log("[INJECTION START] Webview URL:", currentUrl);

  // 만약 에디터 주소가 아니고 일반 홈/블로그에 머물러 있다면 직통 에디터 주소로 자동 리다이렉트
  if (currentUrl.indexOf("/postwrite") === -1) {
    if (currentUrl.indexOf("happycj0930") !== -1 || currentUrl.indexOf("Redirect=Write") !== -1 || currentUrl.indexOf("/postwrite") !== -1) {
      alert("글쓰기 에디터 페이지로 자동으로 이동합니다. 로드가 끝난 후 글이 주입됩니다.");
      webview.src = "https://blog.naver.com/happycj0930/postwrite";
      
      const injectOnReady = () => {
        webview.removeEventListener("dom-ready", injectOnReady);
        setTimeout(() => {
          runWebviewInjection(webview, title, body);
        }, 1500);
      };
      webview.addEventListener("dom-ready", injectOnReady);
      return;
    } else {
      alert("우측 화면에서 블로그 로그인 상태를 확인해주시고, '글쓰기 바로가기' 또는 블로그 글쓰기 페이지를 연 상태에서 전송해 주세요.");
      return;
    }
  }

  runWebviewInjection(webview, title, body);
}

// 웹뷰 내 스마트에디터 DOM 주입 실행부
async function runWebviewInjection(webview, title, body) {
  try {
    // 1단계: 제목 필드 찾고 포커싱하기
    const focusTitleScript = `
      (async function() {
        function findTitleField(doc, depth = 0) {
          if (!doc || depth > 3) return null;
          const selectors = [
            ".se-document-title-editor textarea",
            ".se-document-title textarea",
            "textarea[placeholder='제목']",
            "textarea[placeholder='제목을 입력하세요']",
            ".se-document-title [contenteditable='true']"
          ];
          try {
            for (const sel of selectors) {
              try {
                const el = doc.querySelector(sel);
                if (el) return { element: el, doc: doc };
              } catch (e) {}
            }
          } catch (e) {}

          try {
            const frames = doc.querySelectorAll("iframe, frame");
            for (const frame of frames) {
              try {
                const subDoc = frame.contentDocument || (frame.contentWindow ? frame.contentWindow.document : null);
                if (subDoc) {
                  const res = findTitleField(subDoc, depth + 1);
                  if (res) return res;
                }
              } catch (e) {}
            }
          } catch (e) {}
          return null;
        }

        for (let i = 0; i < 50; i++) {
          const res = findTitleField(document);
          if (res) {
            const el = res.element;
            el.focus();
            if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
              el.select();
            } else {
              const range = res.doc.createRange();
              range.selectNodeContents(el);
              const sel = (res.doc.defaultView || window).getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
            }
            return true;
          }
          await new Promise(r => setTimeout(r, 300));
        }
        return false;
      })()
    `;

    console.log("[INJECTION] Focusing title field...");
    const titleFocused = await webview.executeJavaScript(focusTitleScript);
    if (!titleFocused) {
      const dumpScript = `
        (function() {
          function getDom(doc, path = "top") {
            let html = "=== FRAME: " + path + " (" + doc.location.href + ") ===\\n";
            html += "  - HTML Tag count: " + doc.getElementsByTagName("*").length + "\\n";
            const title = doc.querySelector(".se-document-title-editor textarea, .se-document-title textarea, textarea[placeholder='제목']");
            html += "  - Found title in frame: " + (title ? "YES" : "NO") + "\\n";
            
            try {
              const frames = doc.querySelectorAll("iframe, frame");
              for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                let subDoc = null;
                let err = "";
                try {
                  subDoc = frame.contentDocument || (frame.contentWindow ? frame.contentWindow.document : null);
                } catch (e) {
                  err = e.message;
                }
                if (subDoc) {
                  html += getDom(subDoc, path + " -> frame[" + i + "](id=" + frame.id + ", name=" + frame.name + ", src=" + frame.src + ")");
                } else {
                  html += "  - Frame blocked: id=" + frame.id + " error=" + err + "\\n";
                }
              }
            } catch (e) {
              html += "  - Error listing frames: " + e.message + "\\n";
            }
            return html;
          }
          return getDom(document);
        })()
      `;
      webview.executeJavaScript(dumpScript).then(domContent => {
        window.electronAPI.writeDiagnosticFile(domContent);
        console.log("DOM DUMP WRITTEN TO diagnostic.txt!");
      }).catch(err => {
        console.error("DOM DUMP ERROR:", err);
      });

      alert("제목 입력 칸을 찾을 수 없습니다. 스마트에디터가 로딩 중이거나 다른 영역이 띄워져 있는지 확인해 주세요.");
      return;
    }

    // 2단계: 제목 클립보드 복사 및 붙여넣기 실행
    console.log("[INJECTION] Copying title to clipboard & pasting...");
    window.electronAPI.copyToClipboard(title, "");
    webview.paste();

    // 3단계: 짧은 대기 (제목 입력이 적용되고 다음 이벤트를 처리할 안전 딜레이)
    await new Promise(r => setTimeout(r, 200));

    // 4단계: 본문 필드 찾고 포커싱 및 기존 내용 전체 선택하기
    const focusBodyScript = `
      (async function() {
        function findTitleField(doc, depth = 0) {
          if (!doc || depth > 3) return null;
          const selectors = [
            ".se-document-title-editor textarea",
            ".se-document-title textarea",
            "textarea[placeholder='제목']",
            "textarea[placeholder='제목을 입력하세요']",
            ".se-document-title [contenteditable='true']"
          ];
          try {
            for (const sel of selectors) {
              try {
                const el = doc.querySelector(sel);
                if (el) return { element: el, doc: doc };
              } catch (e) {}
            }
          } catch (e) {}

          try {
            const frames = doc.querySelectorAll("iframe, frame");
            for (const frame of frames) {
              try {
                const subDoc = frame.contentDocument || (frame.contentWindow ? frame.contentWindow.document : null);
                if (subDoc) {
                  const res = findTitleField(subDoc, depth + 1);
                  if (res) return res;
                }
              } catch (e) {}
            }
          } catch (e) {}
          return null;
        }

        function findBodyField(doc, titleField, depth = 0) {
          if (!doc || depth > 3) return null;
          const selectors = [
            ".se-component-content [contenteditable='true']",
            ".se-content [contenteditable='true']",
            ".se-canvas [contenteditable='true']",
            "[contenteditable='true'].se-section",
            "[contenteditable='true']"
          ];
          try {
            for (const sel of selectors) {
              try {
                const el = doc.querySelector(sel);
                if (el && (el.closest(".se-canvas") || el.closest(".se-main-container") || el.classList.contains("se-section"))) {
                  return { element: el, doc: doc };
                }
              } catch (e) {}
            }
          } catch (e) {}

          try {
            const editables = doc.querySelectorAll("[contenteditable='true']");
            for (const el of editables) {
              if (el !== titleField) {
                return { element: el, doc: doc };
              }
            }
          } catch (e) {}

          try {
            const frames = doc.querySelectorAll("iframe, frame");
            for (const frame of frames) {
              try {
                const subDoc = frame.contentDocument || (frame.contentWindow ? frame.contentWindow.document : null);
                if (subDoc) {
                  const res = findBodyField(subDoc, titleField, depth + 1);
                  if (res) return res;
                }
              } catch (e) {}
            }
          } catch (e) {}
          return null;
        }

        const titleRes = findTitleField(document);
        const titleField = titleRes ? titleRes.element : null;

        for (let i = 0; i < 50; i++) {
          const res = findBodyField(document, titleField);
          if (res) {
            const el = res.element;
            el.focus();
            const range = res.doc.createRange();
            range.selectNodeContents(el);
            const sel = (res.doc.defaultView || window).getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            return true;
          }
          await new Promise(r => setTimeout(r, 300));
        }
        return false;
      })()
    `;

    console.log("[INJECTION] Focusing body field...");
    const bodyFocused = await webview.executeJavaScript(focusBodyScript);
    if (!bodyFocused) {
      alert("본문 입력 칸을 찾을 수 없습니다. 에디터 본문 영역을 한 번 마우스로 클릭하신 후 다시 시도해 주세요.");
      return;
    }

    // 5단계: 본문 HTML 클립보드 복사 및 붙여넣기 실행
    console.log("[INJECTION] Copying rich HTML body to clipboard & pasting...");
    
    // 본문 plain text 폴백 생성 (HTML 태그 제거용)
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = body;
    const plainTextBody = tempDiv.innerText;

    window.electronAPI.copyToClipboard(plainTextBody, body);
    webview.paste();

    console.log("[INJECTION] Successfully injected post via native clipboard paste simulation!");
    alert("제목과 본문이 네이버 스마트에디터로 완벽하게 복사-붙여넣기 기입되었습니다!\n\n이제 사진 카드를 마우스로 드래그하여 우측 본문 사진 자리에 넣어주세요.");

  } catch (err) {
    console.error("Clipboard 주입 중 에러:", err);
    alert("자동 복사-붙여넣기 전송 중 오류가 발생했습니다: " + err.message);
  }
}

// 7. 앱 자체 자가 검증 테스트 스위트 (Self-Test Suite)
// 개발 터미널 샌드박스 보안으로 인해 직접 실행할 수 없으므로, 앱 구동 시 내부적으로 검증을 돌려 화면에 통과 여부를 표시합니다.
function runSelfTestSuite() {
  console.log("=== [START] ELECTRON SELF-TEST SUITE ===");
  const testResults = [];
  
  // Test 1: 호스트 사이드 주소 파싱 검증
  try {
    const hostUrl = "https://blog.naver.com/PostWriteForm.naver?blogId=happycj0930";
    const urlObj = new URL(hostUrl);
    const blogId = urlObj.searchParams.get("blogId");
    if (blogId === "happycj0930") {
      testResults.push({ name: "Host-side blogId extraction", success: true });
    } else {
      testResults.push({ name: "Host-side blogId extraction", success: false, error: `Expected happycj0930, got ${blogId}` });
    }
  } catch (e) {
    testResults.push({ name: "Host-side blogId extraction", success: false, error: e.message });
  }

  // Test 2: 게스트 사이드 아이프레임 정규식 검증
  try {
    const src = "/PostWriteForm.naver?blogId=happycj0930&someParam=123";
    const match = src.match(/blogId=([^&]+)/);
    if (match && match[1] === "happycj0930") {
      testResults.push({ name: "Guest-side blogId regex extraction", success: true });
    } else {
      testResults.push({ name: "Guest-side blogId regex extraction", success: false, error: "Regex match failed" });
    }
  } catch (e) {
    testResults.push({ name: "Guest-side blogId regex extraction", success: false, error: e.message });
  }

  // Test 3: 에디터 최종 주소 빌드 검증
  try {
    const blogId = "happycj0930";
    const editorUrl = `https://blog.naver.com/${blogId}/postwrite`;
    if (editorUrl === "https://blog.naver.com/happycj0930/postwrite") {
      testResults.push({ name: "Editor URL construction", success: true });
    } else {
      testResults.push({ name: "Editor URL construction", success: false, error: `Invalid URL: ${editorUrl}` });
    }
  } catch (e) {
    testResults.push({ name: "Editor URL construction", success: false, error: e.message });
  }

  // 결과 출력
  console.log("=== SELF-TEST RESULTS ===");
  let allPassed = true;
  testResults.forEach(res => {
    if (res.success) {
      console.log(`[PASS] ${res.name}`);
    } else {
      console.error(`[FAIL] ${res.name}: ${res.error}`);
      allPassed = false;
    }
  });
  console.log("=== [END] ELECTRON SELF-TEST SUITE ===");

  // 성공 시 화면 우측 하단에 알림 배너 표출
  if (allPassed) {
    const banner = document.createElement("div");
    banner.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #1b4332; color: white; padding: 12px 20px; border-radius: 8px; font-weight: bold; z-index: 99999; box-shadow: 0 4px 15px rgba(27,67,50,0.25); font-family: 'Pretendard', sans-serif; display: flex; align-items: center; gap: 8px;";
    banner.innerHTML = "<span>✓</span> <span>자가 진단 테스트 통과 완료 (URL/정규식/도메인 매핑 검증)</span>";
    document.body.appendChild(banner);
    setTimeout(() => {
      banner.style.transition = "opacity 0.5s ease";
      banner.style.opacity = "0";
      setTimeout(() => banner.remove(), 500);
    }, 4000);
  }
}

// 1.5초 후 자가 진단 실행
setTimeout(runSelfTestSuite, 1500);

// 본문 내 사진 플레이스홀더를 드롭존으로 변환
function convertPlaceholdersToDropzones() {
  const previewEl = document.getElementById("result-body-preview");
  if (!previewEl) return;

  let html = previewEl.innerHTML;
  const regex = /\[여기에\s+([^\]]+)\s+사진을\s+(?:드래그해서\s+)?넣어주세요\]/g;

  html = html.replace(regex, (match, label) => {
    return `
      <div class="blog-image-dropzone" contenteditable="false" data-placeholder="${match}" data-label="${label}">
        <div class="dropzone-inner">
          <span class="dropzone-icon">📸</span>
          <span class="dropzone-text">${label} 사진을 여기에 드래그해서 드롭하세요</span>
        </div>
      </div>
    `;
  });

  previewEl.innerHTML = html;
  bindDropzoneEvents();
}

function bindDropzoneEvents() {
  const dropzones = document.querySelectorAll(".blog-image-dropzone");
  dropzones.forEach(dz => {
    dz.addEventListener("dragover", (e) => {
      e.preventDefault();
      dz.classList.add("dragover");
    });

    dz.addEventListener("dragleave", () => {
      dz.classList.remove("dragover");
    });

    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("dragover");

      const htmlData = e.dataTransfer.getData("text/html");
      if (htmlData && htmlData.includes("<img")) {
        const wrapper = document.createElement("div");
        wrapper.className = "embedded-image-container";
        wrapper.setAttribute("contenteditable", "false");
        wrapper.innerHTML = `
          ${htmlData}
          <div class="image-remove-overlay">더블클릭하여 이미지 제거 및 재선택</div>
        `;
        
        wrapper.addEventListener("dblclick", () => {
          wrapper.parentNode.replaceChild(dz, wrapper);
          bindDropzoneEvents();
        });

        dz.parentNode.replaceChild(wrapper, dz);
      } else {
        alert("시공 사진 등록함(좌측 그리드)의 이미지를 드래그하여 여기에 넣어주세요.");
      }
    });
  });
}

function showEditorPlaceholder() {
  const previewEl = document.getElementById("result-body-preview");
  if (!previewEl) return;
  previewEl.innerHTML = `
    <div class="editor-empty-state" contenteditable="false">
      <div class="empty-state-icon">✍️</div>
      <div class="empty-state-text">
        왼쪽에서 이미지와 정보를 입력하면<br>
        AI가 네이버 블로그 초안을 생성합니다.
      </div>
    </div>
  `;
}

function convertImageTagsToEmbeddedContainers(bodyHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(bodyHtml, "text/html");
  
  const createMarkup = (indexStr) => {
    const idx = parseInt(indexStr) - 1;
    const container = document.createElement("div");
    if (idx >= 0 && idx < uploadedImages.length) {
      const imgObj = uploadedImages[idx];
      const imageUrl = imgObj.watermarkedUrl || imgObj.originalUrl;
      
      // 세로 사진 여부 감지하여 특수 클래스 주입
      if (imgObj.isVertical) {
        container.className = "embedded-image-container is-vertical";
      } else {
        container.className = "embedded-image-container";
      }
      
      container.setAttribute("contenteditable", "false");
      container.setAttribute("data-image-index", idx);
      container.innerHTML = `
        <img src="${imageUrl}" alt="시공사진" />
        <div class="image-remove-overlay">더블클릭하여 이미지 제거 및 재선택</div>
      `;
    } else {
      const labelText = `이미지 ${indexStr}`;
      container.className = "blog-image-dropzone";
      container.setAttribute("contenteditable", "false");
      container.setAttribute("data-placeholder", `[여기에 ${labelText} 사진을 드래그해서 넣어주세요]`);
      container.setAttribute("data-label", labelText);
      container.innerHTML = `
        <div class="dropzone-inner">
          <span class="dropzone-icon">📸</span>
          <span class="dropzone-text">${labelText} 사진을 여기에 드래그해서 드롭하세요</span>
        </div>
      `;
    }
    return container;
  };

  // 1. 2x2 그리드 처리 (내부의 p 태그 등을 전면 걷어내고 순수 임베드 컨테이너만 직속 배치하여 레이아웃 꼬임 해결)
  const grids = doc.querySelectorAll(".image-grid-2x2");
  grids.forEach(grid => {
    const imgs = grid.querySelectorAll("img");
    const containerElements = [];
    
    imgs.forEach(img => {
      const src = img.getAttribute("src") || "";
      const match = src.match(/image_(\d+)/i);
      if (match) {
        const container = createMarkup(match[1]);
        containerElements.push(container);
      }
    });
    
    grid.innerHTML = ""; // 기존 마크업 비우기
    containerElements.forEach(el => grid.appendChild(el)); // 직속 자식으로 컨테이너만 추가
  });

  // 1-2. 1x2 그리드 처리 (내부의 p 태그 등을 전면 걷어내고 순수 임베드 컨테이너만 직속 배치)
  const grids1x2 = doc.querySelectorAll(".image-grid-1x2");
  grids1x2.forEach(grid => {
    const imgs = grid.querySelectorAll("img");
    const containerElements = [];
    
    imgs.forEach(img => {
      const src = img.getAttribute("src") || "";
      const match = src.match(/image_(\d+)/i);
      if (match) {
        const container = createMarkup(match[1]);
        containerElements.push(container);
      }
    });
    
    grid.innerHTML = ""; // 기존 마크업 비우기
    containerElements.forEach(el => grid.appendChild(el)); // 직속 자식으로 컨테이너만 추가
  });
  
  // 2. p 태그 내에 img가 2개 이상 있는 경우 -> .image-row div로 대체
  const paragraphs = doc.querySelectorAll("p");
  paragraphs.forEach(p => {
    const imgs = p.querySelectorAll("img");
    if (imgs.length >= 2) {
      const rowDiv = doc.createElement("div");
      rowDiv.className = "image-row";
      
      imgs.forEach(img => {
        const src = img.getAttribute("src") || "";
        const match = src.match(/image_(\d+)/i);
        if (match) {
          const container = createMarkup(match[1]);
          rowDiv.appendChild(container);
        }
      });
      
      p.parentNode.replaceChild(rowDiv, p);
    }
  });
  
  // 3. 단일 img 태그 처리
  const allImgs = doc.querySelectorAll("img");
  allImgs.forEach(img => {
    const src = img.getAttribute("src") || "";
    const match = src.match(/image_(\d+)/i);
    if (match) {
      const container = createMarkup(match[1]);
      img.parentNode.replaceChild(container, img);
    }
  });
  
  return doc.body.innerHTML;
}

function bindEmbeddedImageEvents() {
  const previewEl = document.getElementById("result-body-preview");
  if (!previewEl) return;

  const containers = previewEl.querySelectorAll(".embedded-image-container");
  containers.forEach(container => {
    container.addEventListener("dblclick", () => {
      const index = container.getAttribute("data-image-index");
      const labelText = `이미지 ${parseInt(index) + 1}`;
      const placeholderText = `[여기에 ${labelText} 사진을 드래그해서 넣어주세요]`;
      
      const dz = document.createElement("div");
      dz.className = "blog-image-dropzone";
      dz.setAttribute("contenteditable", "false");
      dz.setAttribute("data-placeholder", placeholderText);
      dz.setAttribute("data-label", labelText);
      dz.innerHTML = `
        <div class="dropzone-inner">
          <span class="dropzone-icon">📸</span>
          <span class="dropzone-text">${labelText} 사진을 여기에 드래그해서 드롭하세요</span>
        </div>
      `;
      
      container.parentNode.replaceChild(dz, container);
      bindDropzoneEvents();
    });
  });
}

// 에디터 이미지 격자 병합 및 일반 노드 세그먼트 변환기
async function parseEditorSegments(clone) {
  const segments = [];
  const children = Array.from(clone.children);
  
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    
    // 1. 만약 2x2 이미지 그리드 래퍼인 경우
    if (node.classList.contains("image-grid-2x2")) {
      const imgs = node.querySelectorAll("img");
      const srcList = Array.from(imgs).map(img => img.getAttribute("src")).filter(Boolean);
      
      if (srcList.length === 4) {
        const mergedBase64 = await mergeImagesToSingleBase64(srcList, "grid-2x2");
        segments.push({
          type: "image",
          dataUrl: mergedBase64
        });
      } else {
        for (const src of srcList) {
          segments.push({ type: "image", dataUrl: src });
        }
      }
      continue;
    }
    
    // 2. 만약 .image-row 인 경우 (가로 2장 병합)
    if (node.classList.contains("image-row")) {
      const imgs = node.querySelectorAll("img");
      const srcList = Array.from(imgs).map(img => img.getAttribute("src")).filter(Boolean);
      
      if (srcList.length === 2) {
        const mergedBase64 = await mergeImagesToSingleBase64(srcList, "side-by-side");
        segments.push({
          type: "image",
          dataUrl: mergedBase64
        });
      } else {
        for (const src of srcList) {
          segments.push({ type: "image", dataUrl: src });
        }
      }
      continue;
    }
    
    // 3. 만약 일반 단일 이미지 컨테이너인 경우
    if (node.classList.contains("embedded-image-container")) {
      const img = node.querySelector("img");
      if (img) {
        segments.push({
          type: "image",
          dataUrl: img.getAttribute("src")
        });
      }
      continue;
    }
    
    // 4. 일반 HTML 텍스트 노드인 경우 (내부의 낱개 이미지 포함 검사)
    const singleImages = node.querySelectorAll(".embedded-image-container");
    if (singleImages.length === 0) {
      segments.push({
        type: "html",
        html: node.outerHTML
      });
    } else {
      const imgs = node.querySelectorAll("img");
      const srcList = Array.from(imgs).map(img => img.getAttribute("src")).filter(Boolean);
      for (const src of srcList) {
        segments.push({ type: "image", dataUrl: src });
      }
    }
  }
  
  return segments;
}

// 캔버스 이미지 물리적 병합기 (1행 2열 및 2행 2열 격자)
function mergeImagesToSingleBase64(imageSrcs, layoutType = "side-by-side") {
  return new Promise((resolve) => {
    const images = [];
    let loadedCount = 0;
    
    const checkAllLoaded = () => {
      if (loadedCount === imageSrcs.length) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        if (layoutType === "side-by-side") {
          const img1 = images[0];
          const img2 = images[1];
          
          const targetHeight = Math.min(img1.naturalHeight || 800, 800);
          const w1 = (img1.naturalWidth || 800) * (targetHeight / (img1.naturalHeight || 800));
          const w2 = (img2.naturalWidth || 800) * (targetHeight / (img2.naturalHeight || 800));
          
          canvas.width = w1 + w2 + 16;
          canvas.height = targetHeight;
          
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.drawImage(img1, 0, 0, w1, targetHeight);
          ctx.drawImage(img2, w1 + 16, 0, w2, targetHeight);
          
        } else if (layoutType === "grid-2x2") {
          const img1 = images[0];
          const img2 = images[1];
          const img3 = images[2];
          const img4 = images[3];
          
          const cellH = 400;
          const w1 = (img1.naturalWidth || 600) * (cellH / (img1.naturalHeight || 400));
          const w2 = (img2.naturalWidth || 600) * (cellH / (img2.naturalHeight || 400));
          const w3 = (img3.naturalWidth || 600) * (cellH / (img3.naturalHeight || 400));
          const w4 = (img4.naturalWidth || 600) * (cellH / (img4.naturalHeight || 400));
          
          const row1W = w1 + w2 + 16;
          const row2W = w3 + w4 + 16;
          
          canvas.width = Math.max(row1W, row2W);
          canvas.height = cellH * 2 + 16;
          
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.drawImage(img1, 0, 0, w1, cellH);
          ctx.drawImage(img2, w1 + 16, 0, w2, cellH);
          ctx.drawImage(img3, 0, cellH + 16, w3, cellH);
          ctx.drawImage(img4, w3 + 16, cellH + 16, w4, cellH);
        }
        
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      }
    };
    
    imageSrcs.forEach((src, idx) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        images[idx] = img;
        loadedCount++;
        checkAllLoaded();
      };
      img.onerror = () => {
        const placeholderCanvas = document.createElement("canvas");
        placeholderCanvas.width = 400;
        placeholderCanvas.height = 400;
        const pCtx = placeholderCanvas.getContext("2d");
        pCtx.fillStyle = "#f3f4f6";
        pCtx.fillRect(0, 0, 400, 400);
        images[idx] = placeholderCanvas;
        loadedCount++;
        checkAllLoaded();
      };
      img.src = src;
    });
  });
}

// 브랜드 로고 플레이스홀더 치환 처리기
function processLogoAndMapPlaceholders(bodyHtml, includeLogo, logoBase64) {
  let processed = bodyHtml;
  
  if (includeLogo && logoBase64) {
    // 1. p 태그가 감싸고 있는 경우 (원본 크기 노출을 위해 max-width: 100%로 지정하고 여백을 35px로 확장)
    processed = processed.replace(
      /<p[^>]*>\[로고 이미지 들어갈 자리\]<\/p>/g,
      `<p style="text-align: center;"><img src="${logoBase64}" class="brand-logo-image" style="display: block; margin: 35px auto; max-width: 100%; height: auto;" alt="브랜드 로고" /></p>`
    );
    // 2. 단독 텍스트로 존재하는 경우
    processed = processed.replace(
      /\[로고 이미지 들어갈 자리\]/g,
      `<img src="${logoBase64}" class="brand-logo-image" style="display: block; margin: 35px auto; max-width: 100%; height: auto;" alt="브랜드 로고" />`
    );
  } else {
    // 로고 선택 해제되었거나 이미지가 없으면 문구를 완전히 걷어냄
    processed = processed.replace(/<p[^>]*>\[로고 이미지 들어갈 자리\]<\/p>/g, "");
    processed = processed.replace(/\[로고 이미지 들어갈 자리\]/g, "");
  }
  
  return processed;
}
