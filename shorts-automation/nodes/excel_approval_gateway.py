import os
import json
import argparse
import pandas as pd

def parse_args():
    parser = argparse.ArgumentParser(description="Shorts Production Excel Archiver")
    parser.add_argument("--mode", required=True, choices=["write_plan", "write_performance"], help="작동 모드")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--excel", default="nodes/assets/output/shorts_production_sheet.xlsx", help="출력 엑셀 파일 경로")
    return parser.parse_args()

def write_plan_to_excel(input_path, excel_path):
    print(f"[*] 엑셀 저장기: 기획 데이터 로드 및 엑셀 아카이빙 시작... ({input_path})")
    if not os.path.exists(input_path):
        print(f"[!] 에러: 입력 기획 JSON 파일이 존재하지 않습니다: {input_path}")
        return False

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[!] 에러: JSON 파싱 실패: {e}")
        return False

    prod_id = data.get("id", "N/A")
    prod_name = data.get("name", "N/A")
    category = data.get("category", "N/A")

    # 1. 진식_기획 탭 구성
    scene_briefs = data.get("scene_briefs", [])
    jinsik_rows = []
    for sb in scene_briefs:
        jinsik_rows.append({
            "상품ID": prod_id,
            "상품명": prod_name,
            "장면번호": sb.get("scene_number"),
            "러닝타임(초)": sb.get("duration_seconds"),
            "화면 연출 지침": sb.get("visual_description"),
            "음향/내레이션 지침": sb.get("audio_direction")
        })
    df_jinsik = pd.DataFrame(jinsik_rows)

    # 2. 설아_대본 탭 구성
    scenes_script = data.get("scenes_script", [])
    seola_rows = []
    for ss in scenes_script:
        seola_rows.append({
            "상품ID": prod_id,
            "상품명": prod_name,
            "장면번호": ss.get("scene_number"),
            "성우 대본 및 효과음": ss.get("narration")
        })
    df_seola = pd.DataFrame(seola_rows)

    # 3. 병길_연출 탭 구성
    media_prompts = data.get("media_prompts", [])
    byunggil_rows = []
    for mp in media_prompts:
        byunggil_rows.append({
            "상품ID": prod_id,
            "상품명": prod_name,
            "장면번호": mp.get("scene_number"),
            "AI 이미지 영문 프롬프트": mp.get("image_prompt"),
            "AI 비디오 영문 프롬프트": mp.get("video_prompt")
        })
    df_byunggil = pd.DataFrame(byunggil_rows)

    # 폴더 자동 생성
    excel_dir = os.path.dirname(os.path.abspath(excel_path))
    os.makedirs(excel_dir, exist_ok=True)

    # Excel 파일에 각 탭으로 저장
    try:
        with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
            df_jinsik.to_excel(writer, sheet_name="1_진식_리서치기획", index=False)
            df_seola.to_excel(writer, sheet_name="2_설아_대본카피", index=False)
            df_byunggil.to_excel(writer, sheet_name="3_병길_영상연출", index=False)
        print(f"[+] 성공: 엑셀 기획서 저장이 완료되었습니다: {excel_path}")
        return True
    except Exception as e:
        print(f"[!] 에러: 엑셀 쓰기 중 실패: {e}")
        return False

def write_performance_to_excel(input_path, excel_path):
    print(f"[*] 엑셀 저장기: 성과 지표 로드 및 엑셀 아카이빙 시작... ({input_path})")
    if not os.path.exists(input_path):
        print(f"[!] 에러: 입력 성과 JSON 파일이 존재하지 않습니다: {input_path}")
        return False

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[!] 에러: JSON 파싱 실패: {e}")
        return False

    prod_id = data.get("id", "N/A")
    prod_name = data.get("name", "N/A")
    
    # 성과 지표 로딩
    metrics = data.get("metrics", {})
    performance_rows = [{
        "상품ID": prod_id,
        "상품명": prod_name,
        "예상 조회수": metrics.get("views", 0),
        "예상 제휴수익": metrics.get("revenue_krw", 0),
        "종합 스코어": data.get("score", 0.0),
        "AI 성과 진단": data.get("performance_evaluation", "N/A"),
        "최적 카테고리": data.get("best_performing_category", "N/A"),
        "차기 추천 키워드": ", ".join(data.get("recommended_keywords", [])),
        "A/B 테스트 전략": data.get("ab_test_strategy", "N/A"),
        "피드백 근거": data.get("experiment_rationale", "N/A")
    }]
    df_sungmu = pd.DataFrame(performance_rows)

    # 엑셀 파일이 이미 있다면 기존 시트를 보존하면서 성무 탭만 추가/오버라이트
    try:
        if os.path.exists(excel_path):
            with pd.ExcelWriter(excel_path, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
                df_sungmu.to_excel(writer, sheet_name="4_성무_성과최적화", index=False)
        else:
            with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
                df_sungmu.to_excel(writer, sheet_name="4_성무_성과최적화", index=False)
        print(f"[+] 성공: 엑셀 성과 지표 저장이 완료되었습니다: {excel_path}")
        return True
    except Exception as e:
        print(f"[!] 에러: 엑셀 성과 쓰기 중 실패: {e}")
        return False

def main():
    args = parse_args()
    if args.mode == "write_plan":
        success = write_plan_to_excel(args.input, args.excel)
    elif args.mode == "write_performance":
        success = write_performance_to_excel(args.input, args.excel)
        
    if not success:
        os._exit(1)

if __name__ == "__main__":
    main()
