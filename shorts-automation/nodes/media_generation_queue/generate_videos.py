import os
import json
import argparse
import sys
import time
import base64
import urllib.request
from urllib.error import URLError

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_gpt

def get_kie_api_key():
    """상위 .env 등에서 로드된 환경 변수로부터 KIE_API_KEY를 탐색합니다."""
    return os.environ.get("KIE_API_KEY")

def request_kie_i2v(image_path, prompt, api_key):
    """Kie.ai API를 통해 veo-3-1-fast-video 모델로 비디오 생성을 요청합니다."""
    url = "https://api.kie.ai/api/v1/veo/generate"
    
    # 1. 로컬 이미지 파일 읽기 및 base64 인코딩
    try:
        with open(image_path, "rb") as f:
            img_data = f.read()
            img_base64 = base64.b64encode(img_data).decode("utf-8")
    except Exception as e:
        print(f"[ERROR] 이미지 파일을 base64로 로드하는 데 실패하였습니다: {e}")
        return None

    # 2. Kie.ai veo-3-1-fast-video API 규격 바디 빌드
    payload = {
        "model": "veo3_fast",
        "image": f"data:image/png;base64,{img_base64}",
        "prompt": prompt or "Create a natural shopping commercial video based on the image",
        "aspectRatio": "9:16",  # 숏폼 세로 화면 비율
        "duration": 6          # 6초 동영상 생성
    }
    
    req_body = json.dumps(payload).encode("utf-8")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    try:
        req = urllib.request.Request(url, data=req_body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=30) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            # Kie.ai 응답 규격 예: {"code": 0, "message": "success", "data": {"taskId": "xxx"}}
            if res_data.get("code") in [0, 200] and res_data.get("data", {}).get("taskId"):
                return res_data["data"]["taskId"]
            else:
                print(f"[API 경고] Kie.ai API 응답 에러 코드: {res_data}")
    except Exception as e:
        print(f"[API 경고] Kie.ai API 호출 실패: {e}")
        
    return None

def poll_kie_task(task_id, api_key):
    """Kie.ai 작업 상태(record-info)를 폴링하여 비디오 다운로드 URL을 획득합니다."""
    url = f"https://api.kie.ai/api/v1/veo/record-info?taskId={task_id}"
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    
    max_retries = 30  # 최대 약 150초 대기 (5초 간격)
    for i in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=15) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                data = res_data.get("data", {}) or {}
                success_flag = data.get("successFlag")
                error_msg = data.get("errorMessage") or data.get("errorMsg")
                
                print(f"    └ [Polling] Kie.ai Task {task_id}: successFlag={success_flag}, error={error_msg} (시도 {i+1}/{max_retries})")
                
                if success_flag == 1:
                    resp_obj = data.get("response") or {}
                    result_urls = resp_obj.get("resultUrls")
                    if result_urls and len(result_urls) > 0:
                        return result_urls[0]
                    else:
                        print("    [!] 작업은 성공하였으나 resultUrls가 누락되었습니다.")
                        return None
                elif success_flag == 2:
                    print(f"    [!] Kie.ai API 태스크 실패: {error_msg}")
                    return None
                elif error_msg and success_flag not in [0, None]:
                    print(f"    [!] Kie.ai API 태스크 에러: {error_msg}")
                    return None
                    
        except Exception as e:
            print(f"    [!] Polling 중 예외 발생: {e}")
            
        time.sleep(5)
        
    print("    [!] Kie.ai API 작업 시간 초과(Timeout)로 결과를 가져오지 못했습니다.")
    return None

def download_video(url, dest_path):
    """생성된 비디오 URL에서 로컬 파일 경로로 다운로드합니다."""
    try:
        req = urllib.request.Request(
            url, 
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=45) as response:
            with open(dest_path, "wb") as f:
                f.write(response.read())
        return True
    except Exception as e:
        print(f"[경고] 비디오 다운로드 실패: {e}")
        return False

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        
    parser = argparse.ArgumentParser(description="쇼핑 쇼츠 자동화 - Kie.ai 비디오 생성 노드")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    args = parser.parse_args()

    # 입력 파일 확인
    if not os.path.exists(args.input):
        print(f"Error: 입력 파일을 찾을 수 없습니다: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            product = json.load(f)
    except Exception as e:
        print(f"Error: JSON 입력 파일 파싱 실패: {e}", file=sys.stderr)
        sys.exit(1)

    prod_id = product.get("id")
    name = product.get("name", "")
    media_prompts = product.get("media_prompts", [])
    images_assets = product.get("media_assets", {}).get("images", [])

    print(f"[*] '{name}' (ID: {prod_id}) 상품의 Kie.ai (Veo 3.1 Fast) Image-to-Video 영상 생성 시작")

    # 물리 자산 저장 폴더 정의
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(args.output)))
    assets_dir = os.path.join(base_dir, "assets", "output", prod_id)
    os.makedirs(assets_dir, exist_ok=True)


    api_key = get_kie_api_key()
    if not api_key:
        print("[!] KIE_API_KEY 환경변수가 설정되어 있지 않습니다. 가상 Mock 영상 생성 모드(Fallback)로 진입합니다.")

    videos_assets = []

    for img_asset in images_assets:
        scene_num = img_asset.get("scene_number")
        image_file_path = img_asset.get("file_path")
        
        # 해당 씬의 비디오 프롬프트 획득
        scene_prompt = next((p for p in media_prompts if p.get("scene_number") == scene_num), {})
        video_prompt_text = scene_prompt.get("video_prompt", "A cinematic showcase of the product")

        video_file_name = f"{prod_id}_scene{scene_num}.mp4"
        video_file_path = os.path.join(assets_dir, video_file_name)

        video_downloaded = False
        
        # API 키가 있을 경우 실제 API 기동
        if api_key and image_file_path and os.path.exists(image_file_path):
            print(f"[*] Scene {scene_num} Kie.ai 비디오 요청을 발송합니다.")
            print(f"    - 이미지 경로: {image_file_path}")
            print(f"    - 프롬프트: {video_prompt_text}")
            
            task_id = request_kie_i2v(image_file_path, video_prompt_text, api_key)
            if task_id:
                video_url = poll_kie_task(task_id, api_key)
                if video_url:
                    print(f"    └ Kie.ai 비디오 생성 완료! 다운로드 중: {video_url}")
                    video_downloaded = download_video(video_url, video_file_path)
            
        # API 키가 없거나 생성이 안 되었을 경우 Fallback 연산
        if not video_downloaded:
            print(f"    [!] Kie.ai 비디오 생성/다운로드 실패. 가상 Mock 동영상 파일로 대체합니다.")
            import base64
            mock_mp4_b64 = "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAr9tZGF0AAACoAYF//+///AAAAMmF2Y0MBZAAK/+EAGWdkAAqs2V+WXAWyAAADAAIAAAMAYB4kSywBAAZo6+PLIsAAAAAYc3R0cwAAAAAAAAABAAAAAQAAAgAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAFHN0c3oAAAAAAAACtwAAAAEAAAAUc3RjbwAAAAAAAAABAAAAMAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNTQuNjMuMTA0="
            try:
                # 패딩 오류 방지를 위해 추가적인 패딩 안전 처리
                missing_padding = len(mock_mp4_b64) % 4
                if missing_padding:
                    mock_mp4_b64 += "=" * (4 - missing_padding)
                with open(video_file_path, "wb") as f:
                    f.write(base64.b64decode(mock_mp4_b64))
            except Exception as e:
                print(f"[!] 가상 비디오 생성 에러: {e}")
        
        videos_assets.append({
            "scene_number": scene_num,
            "file_path": video_file_path
        })
        print(f"    -> [완료] 동영상 저장 완료: {video_file_path}\n")

    # 결과 병합 및 결과 파일 내보내기
    output_product = product.copy()
    output_product["media_assets"] = {
        "images": images_assets,
        "videos": videos_assets
    }

    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: Kie.ai 동영상 경로 목록이 갱신되었습니다: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
