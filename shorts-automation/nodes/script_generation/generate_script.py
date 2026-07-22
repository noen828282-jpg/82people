import os
import json
import argparse
import sys

# stdout 인코딩 강제 설정 (Windows cp949 깨짐 방지)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description="호야STUDIO 쇼츠 자동화 - 이미지 프롬프트 패스스루 노드 (DALL-E 생성 스킵)")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    args = parser.parse_args()

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
        print("ValidationError: 입력 데이터는 객체(Dict) 형태여야 합니다.", file=sys.stderr)
        sys.exit(1)

    scene_briefs = product.get("scene_briefs", [])
    name = product.get("name", "호야의 일상")

    print(f"[*] 호야 프롬프트 가공 프로세스 가동 (에피소드: {name})")
    print(f"[*] [알림] 대표님 수동 이미지 생성을 위해 DALL-E 3 API 호출을 스킵하고 프롬프트만 대시보드에 연출합니다.")

    updated_briefs = []
    for scene in scene_briefs:
        scene_num = scene["scene_number"]
        
        # 썸네일 깨짐 방지용으로 설아/진식/병길 이미지를 번갈아 플레이스홀더 서빙 (로컬 에셋)
        avatars = {
            1: "seola.jpg",
            2: "jinsik.jpg",
            3: "byunggil.jpg"
        }
        filename = avatars.get(scene_num, "sungmu.jpg")
        
        scene_copy = scene.copy()
        scene_copy["image_path"] = f"/nodes/assets/{filename}"
        updated_briefs.append(scene_copy)

    # 대본 정보 구성 및 결과 병합
    output_product = product.copy()
    output_product["scene_briefs"] = updated_briefs

    # 기존 대본 정보 필드 추가 (호환성)
    script_data = product.get("script_data", {})
    output_product["script"] = {
        "overall_script": script_data.get("narration", "아기 포메라니안 호야의 일상"),
        "scenes_script": [
            {"scene_number": sb["scene_number"], "narration": sb["audio_direction"]}
            for sb in updated_briefs
        ]
    }

    # 결과 파일 저장
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"\n[+] 성공: 프롬프트 구성 및 로컬 썸네일 연결 완료: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
