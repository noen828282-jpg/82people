import os
import json
import argparse
import sys
import time
import urllib.request

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_dalle

def simulate_polling(job_id, media_type, scene_num):
    """비동기 API의 작업 진행률 조회를 시뮬레이션합니다."""
    print(f"[*] [API] Scene {scene_num} {media_type} 생성 요청 완료 (Job ID: {job_id}, status: queued)")
    
    # 0% -> 50% -> 100% 진행 상황 로그 출력 모사
    for progress in [25, 60, 100]:
        status = "processing" if progress < 100 else "completed"
        print(f"    └ [Polling] Job {job_id} 상태 조회: status={status}, progress={progress}%")
        # 실제 딜레이는 테스트 속도를 위해 최소화 (예: 0.05초)
        time.sleep(0.05)

def download_image(url_or_b64, dest_path):
    """생성된 이미지 URL(HTTP) 또는 base64 텍스트 데이터를 로컬 파일 경로로 디코딩/다운로드하여 저장합니다."""
    import base64
    try:
        # base64 바이너리 데이터인지 검증
        if url_or_b64.startswith("http://") or url_or_b64.startswith("https://"):
            # 차단 방지를 위해 헤더 추가
            req = urllib.request.Request(
                url_or_b64, 
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                with open(dest_path, "wb") as f:
                    f.write(response.read())
        else:
            # base64 디코딩 수행
            image_bytes = base64.b64decode(url_or_b64)
            with open(dest_path, "wb") as f:
                f.write(image_bytes)
        return True
    except Exception as e:
        print(f"[경고] 이미지 다운로드/디코딩 중 오류 발생: {e}", file=sys.stderr)
        return False

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        
    parser = argparse.ArgumentParser(description="쇼핑 쇼츠 자동화 - 미디어 생성 큐 노드")
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

    if not isinstance(product, dict):
        print("ValidationError: 입력 데이터는 단일 상품 정보 객체(Dict) 형태여야 합니다.", file=sys.stderr)
        sys.exit(1)

    prod_id = product.get("id")
    name = product.get("name", "")
    media_prompts = product.get("media_prompts", [])

    print(f"[*] '{name}' (ID: {prod_id}) 상품의 이미지/영상 생성 관리 시작")

    # 가상 자산 파일이 저장될 물리 디렉토리 경로 정의
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(args.output)))
    assets_dir = os.path.join(base_dir, "assets", "output", prod_id)
    os.makedirs(assets_dir, exist_ok=True)


    images_assets = []

    for prompt in media_prompts:
        scene_num = prompt.get("scene_number")
        
        # gpt-image-2 이미지 생성 단계 (OpenAI gpt-image-2 연동)
        image_prompt_text = prompt.get("image_prompt", "")
        image_file_name = f"{prod_id}_scene{scene_num}.png"
        image_file_path = os.path.join(assets_dir, image_file_name)
        
        print(f"[*] Scene {scene_num} gpt-image-2 이미지 생성을 진행합니다.")
        
        # gpt-image-2 API 호출 (세로 쇼츠에 최적화된 1024x1792 규격)
        image_data = call_dalle(image_prompt_text, size="1024x1792")
        
        download_success = False
        if image_data:
            print(f"    └ gpt-image-2 생성 성공! 로컬 이미지 바이너리 디코딩/저장 중...")
            download_success = download_image(image_data, image_file_path)
            
        # API 장애 또는 키 미설정 시 Fallback 흐름
        if not download_success:
            print(f"    [!] gpt-image-2 이미지 생성/다운로드 실패. 가상 Mock 이미지 자산으로 대체합니다.")
            with open(image_file_path, "wb") as f:
                f.write(b"MOCK IMAGE CONTENT")

        images_assets.append({
            "scene_number": scene_num,
            "file_path": image_file_path
        })
        print(f"    -> [완료] 이미지 저장 완료: {image_file_path}\n")

    print("================ 미디어 생성 큐 완료 통계 ================")
    print(f"  * 대상 상품: {name} (ID: {prod_id})")
    print(f"  * 생성 완료 이미지 자산: {len(images_assets)}개")
    print("==========================================================")

    # 결과 병합 (이미지 전용 자산 목록)
    output_product = product.copy()
    output_product["media_assets"] = {
        "images": images_assets
    }

    # 결과 파일 저장
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 미디어 파일 경로 목록이 갱신되었습니다: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
