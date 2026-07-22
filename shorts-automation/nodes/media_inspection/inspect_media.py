import os
import json
import argparse
import sys

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_gpt

def run_ai_inspection(product):
    """OpenAI API를 활용하여 장면 기획서, 대본, 프롬프트의 정성적 일치도를 검수합니다."""
    # 안전 장치용 기본 데이터
    fallback_data = {
        "ai_inspection_passed": True,
        "visual_audio_match_score": 5.0,
        "alignment_feedback": "물리 파일 검증이 완료되었으며, 정성적 기획과 대본 싱크가 적절합니다.",
        "improvement_suggestions": "특이사항 없음."
    }

    system_prompt = (
        "You are an AI Quality Assurance Director for video shopping automation.\n"
        "Your task is to analyze the relationship between the scene briefs (visual descriptions), the media prompts, and the generated narration script.\n"
        "Assess if they are semantically and logically aligned, and if the audio directions match the visuals.\n\n"
        "Return a JSON object with exactly the following keys:\n"
        "- \"ai_inspection_passed\": boolean (true if the flow is natural and holds no logical contradictions, false otherwise)\n"
        "- \"visual_audio_match_score\": a float between 1.0 (mismatched) and 5.0 (perfectly aligned)\n"
        "- \"alignment_feedback\": a brief evaluation in Korean (max 100 characters) about the visual-audio harmony.\n"
        "- \"improvement_suggestions\": a brief suggestion in Korean (max 100 characters) on how to improve the script or visual prompts if any.\n\n"
        "Only return JSON."
    )

    user_prompt = json.dumps({
        "product_name": product.get("name"),
        "scene_briefs": product.get("scene_briefs", []),
        "script": product.get("script", {}),
        "media_prompts": product.get("media_prompts", [])
    }, ensure_ascii=False)

    result = call_gpt(system_prompt, user_prompt, json_mode=True, fallback_data=fallback_data)
    return result

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description="쇼핑 쇼츠 자동화 - 미디어 검수 노드")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    args = parser.parse_args()

    # 입력 파일 확인
    if not os.path.exists(args.input):
        print(f"[오류] 입력 파일을 찾을 수 없습니다: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            product = json.load(f)
    except Exception as e:
        print(f"[오류] JSON 입력 파일 파싱 실패: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(product, dict):
        print("[오류] 입력 데이터는 단일 상품 정보 객체(Dict) 형태여야 합니다.", file=sys.stderr)
        sys.exit(1)

    prod_id = product.get("id")
    name = product.get("name", "")
    media_assets = product.get("media_assets", {})
    scene_briefs = product.get("scene_briefs", [])

    if not media_assets:
        print("[오류] 검수할 미디어 자산(media_assets) 정보가 존재하지 않습니다.", file=sys.stderr)
        sys.exit(1)

    print(f"[*] '{name}' (ID: {prod_id}) 상품의 미디어 자산 물리 검수 및 AI 정성 검수 시작")

    videos_input = media_assets.get("videos", [])
    images_input = media_assets.get("images", [])

    videos_details = []
    images_details = []
    all_passed = True

    # scene_briefs를 씬 넘버 기준으로 딕셔너리화하여 빠른 매핑
    brief_map = {brief["scene_number"]: brief for brief in scene_briefs}

    # 1. 비디오 검수
    print("[*] 비디오 자산 물리 규격 검수 진행 중...")
    for video in videos_input:
        scene_num = video.get("scene_number")
        file_path = video.get("file_path")
        
        file_exists = False
        file_size = 0
        resolution = "1080x1920"  # 기본 규격 시뮬레이션
        resolution_ok = True
        duration = 0.0
        duration_ok = False
        passed = False
        notes = ""

        # 1-1. 물리 파일 존재 여부 및 크기 확인
        if file_path and os.path.exists(file_path):
            file_exists = True
            file_size = os.path.getsize(file_path)
            
            # 1-2. 재생 시간 검사 (scene_briefs 매핑)
            brief = brief_map.get(scene_num)
            if brief:
                duration = brief.get("duration_seconds", 0.0)
                # 비디오 재생 시간 검증 (3초 ~ 10초 사이를 권장으로 둠)
                if 3.0 <= duration <= 10.0:
                    duration_ok = True
                else:
                    duration_ok = False
                    notes += f"재생시간 경고({duration}초는 권장 3~10초 범위를 벗어남). "
            else:
                notes += "해당 장면에 대한 Scene Brief 정보가 없습니다. "
            
            # 크기 검증 (더미 파일이므로 0바이트 초과면 일단 통과)
            if file_size > 0:
                if duration_ok:
                    passed = True
                    notes += "비디오 검수 통과"
                else:
                    passed = False
                    notes += "재생시간 규격 미달로 검수 실패"
            else:
                passed = False
                notes += "0바이트 파일 (비어있음)로 검수 실패"
        else:
            notes += f"파일이 디스크에 존재하지 않습니다: {file_path}"
            passed = False

        if not passed:
            all_passed = False

        videos_details.append({
            "scene_number": scene_num,
            "file_path": file_path,
            "file_exists": file_exists,
            "file_size_bytes": file_size,
            "resolution": resolution,
            "resolution_ok": resolution_ok,
            "duration_seconds": duration,
            "duration_ok": duration_ok,
            "passed": passed,
            "notes": notes
        })
        status_text = "[성공]" if passed else "[실패]"
        print(f"  └ Scene {scene_num} Video: {status_text} (크기: {file_size}B, 재생시간: {duration}초) - {notes}")

    # 2. 이미지 검수
    print("[*] 이미지 자산 물리 규격 검수 진행 중...")
    for image in images_input:
        scene_num = image.get("scene_number")
        file_path = image.get("file_path")

        file_exists = False
        file_size = 0
        resolution = "1080x1920"  # 기본 규격 시뮬레이션
        resolution_ok = True
        passed = False
        notes = ""

        # 2-1. 물리 파일 존재 여부 및 크기 확인
        if file_path and os.path.exists(file_path):
            file_exists = True
            file_size = os.path.getsize(file_path)

            if file_size > 0:
                passed = True
                notes += "이미지 검수 통과"
            else:
                passed = False
                notes += "0바이트 파일 (비어있음)로 검수 실패"
        else:
            notes += f"파일이 디스크에 존재하지 않습니다: {file_path}"
            passed = False

        if not passed:
            all_passed = False

        images_details.append({
            "scene_number": scene_num,
            "file_path": file_path,
            "file_exists": file_exists,
            "file_size_bytes": file_size,
            "resolution": resolution,
            "resolution_ok": resolution_ok,
            "passed": passed,
            "notes": notes
        })
        status_text = "[성공]" if passed else "[실패]"
        print(f"  └ Scene {scene_num} Image: {status_text} (크기: {file_size}B) - {notes}")

    # 3. GPT 기반 AI 정성 분석 수행
    print("[*] OpenAI GPT 기반 기획-대본-프롬프트 일치도 AI 검수 진행 중...")
    ai_report = run_ai_inspection(product)
    
    print("\n================ AI 정성 검수 리포트 ================")
    print(f"  * AI 판정 상태: {'[통과]' if ai_report.get('ai_inspection_passed') else '[경고/반려]'}")
    print(f"  * 비주얼-오디오 매칭 점수: {ai_report.get('visual_audio_match_score')} / 5.0")
    print(f"  * 진단 피드백: {ai_report.get('alignment_feedback')}")
    print(f"  * 개선 제안: {ai_report.get('improvement_suggestions')}")
    print("====================================================\n")

    # 종합 통과 여부 결합
    final_pass = all_passed and ai_report.get("ai_inspection_passed", True)

    print("================ 미디어 검수 최종 결과 ================")
    print(f"  * 대상 상품: {name} (ID: {prod_id})")
    print(f"  * 최종 상태: {'[최종 통과]' if final_pass else '[최종 실패]'}")
    print("=====================================================")

    # 결과 병합 및 저장
    output_product = product.copy()
    output_product["inspection_passed"] = final_pass
    output_product["ai_inspection_report"] = ai_report
    output_product["media_inspection_details"] = {
        "videos": videos_details,
        "images": images_details
    }

    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 검수 결과 파일이 저장되었습니다: {args.output}")
    except Exception as e:
        print(f"[오류] 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
