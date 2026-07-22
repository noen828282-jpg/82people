import os
import json
import urllib.request
import urllib.error
import sys

def load_dotenv():
    """현재 작업 디렉토리 및 스크립트 디렉토리 기준으로 상위 폴더들을 탐색하며 .env 파일을 로딩합니다."""
    search_dirs = []
    
    # 1. 스크립트 파일 위치 기준
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        search_dirs.append(script_dir)
    except:
        pass
        
    # 2. 현재 작업 디렉토리 기준
    try:
        cwd_dir = os.path.abspath(os.getcwd())
        search_dirs.append(cwd_dir)
    except:
        pass
        
    loaded_file = None
    for start_dir in search_dirs:
        current = start_dir
        # 최대 4단계 부모 디렉토리까지 상향 탐색
        for _ in range(4):
            env_path = os.path.join(current, ".env")
            if os.path.isfile(env_path):
                try:
                    with open(env_path, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if not line or line.startswith("#"):
                                continue
                            if "=" in line:
                                key, val = line.split("=", 1)
                                key = key.strip()
                                val = val.strip().strip("'\"")
                                os.environ[key] = val
                    loaded_file = env_path
                    break
                except:
                    pass
            parent = os.path.dirname(current)
            if parent == current:
                break
            current = parent
        if loaded_file:
            break
            
    # 디버깅 출력 (터미널용)
    if loaded_file:
        # API 키가 환경변수에 올바르게 주입되었는지 임시 확인용 로그
        has_key = "Yes" if os.environ.get("OPENAI_API_KEY") else "No"
        # print(f"[*] [공통 API] 로컬 .env 파일 발견 및 로드 완료 ({loaded_file}), API Key 존재 여부: {has_key}")
        pass

# 모듈 로드 시 자동으로 .env 파일 탐색 수행
load_dotenv()

def get_api_key():
    """환경 변수에서 OpenAI API 키를 획득합니다."""
    return os.environ.get("OPENAI_API_KEY", "").strip()

def get_org_id():
    """환경 변수에서 OpenAI 조직 ID를 획득합니다."""
    return os.environ.get("OPENAI_ORG_ID", "").strip()

def call_gpt(system_prompt: str, user_prompt: str, json_mode: bool = True, fallback_data: dict = None) -> dict:
    """urllib를 사용하여 OpenAI API(gpt-4o-mini)를 호출합니다.
    API 키가 없거나 장애가 생기면 fallback_data를 반환합니다.
    """
    api_key = get_api_key()
    org_id = get_org_id()
    
    if not api_key:
        print("[!] [공통 API] OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다. 가상 데이터(Fallback)로 대체 진행합니다.")
        return fallback_data if fallback_data is not None else {}

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    if org_id:
        headers["OpenAI-Organization"] = org_id

    # gpt-4o-mini 파라미터 구성 (Structured Output 또는 JSON Mode 지원)
    data = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.2
    }

    if json_mode:
        data["response_format"] = {"type": "json_object"}

    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")

    try:
        # 타임아웃 15초 설정
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            content = res_json["choices"][0]["message"]["content"]
            
            if json_mode:
                return json.loads(content)
            return {"text": content}
            
    except urllib.error.HTTPError as e:
        print(f"[!] [공통 API] OpenAI GPT API HTTP 에러 발생: {e.code} {e.reason}", file=sys.stderr)
        try:
            error_msg = e.read().decode("utf-8")
            print(f"    └ 상세 내용: {error_msg}", file=sys.stderr)
        except:
            pass
        return fallback_data if fallback_data is not None else {}
    except Exception as e:
        print(f"[!] [공통 API] OpenAI GPT API 호출 오류: {e}", file=sys.stderr)
        return fallback_data if fallback_data is not None else {}

def call_dalle(prompt: str, size: str = "1024x1792") -> str:
    """urllib를 사용하여 OpenAI gpt-image-2 API를 호출하고 생성된 이미지 URL 또는 base64 텍스트를 반환합니다.
    규격은 쇼츠 세로 규격인 1024x1792를 기본값으로 채택하며, 타임아웃을 90초로 넉넉하게 설정합니다.
    실패 시 빈 문자열을 반환합니다.
    """
    api_key = get_api_key()
    org_id = get_org_id()
    
    if not api_key:
        print("[!] [공통 API] OPENAI_API_KEY 환경변수가 설정되어 있지 않아 이미지 생성을 진행할 수 없습니다.")
        return ""

    url = "https://api.openai.com/v1/images/generations"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    if org_id:
        headers["OpenAI-Organization"] = org_id

    # 최신 이미지 생성 전용 모델 gpt-image-2 호출
    data = {
        "model": "gpt-image-2",
        "prompt": prompt,
        "n": 1,
        "size": size
    }

    try:
        print(f"[*] [공통 API] gpt-image-2 이미지 생성을 요청 중입니다... (규격: {size})")
        req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=90) as response:
            res_json = json.loads(response.read().decode("utf-8"))
            
            # API가 b64_json을 주는 경우와 url을 주는 경우를 모두 대응
            item = res_json["data"][0]
            if "b64_json" in item:
                return item["b64_json"]
            elif "url" in item:
                return item["url"]
                
    except urllib.error.HTTPError as e:
        error_msg = ""
        try:
            error_msg = e.read().decode("utf-8")
            print(f"[!] [공통 API] gpt-image-2 이미지 생성 실패 HTTP 에러: {e.code} {error_msg}", file=sys.stderr)
        except:
            pass
    except Exception as e:
        print(f"[!] [공통 API] gpt-image-2 API 호출 오류: {e}", file=sys.stderr)
        
    return ""



