import os
import json
import sys
import subprocess

def run_step(step_name, command_args):
    """지정된 스텝의 Python 스크립트를 실행합니다."""
    print(f"\n================ [Step: {step_name}] 실행 시작 ================")
    cmd = [sys.executable] + command_args
    print(f"[*] 실행 커맨드: {' '.join(cmd)}")
    
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    
    result = subprocess.run(cmd, capture_output=False, text=True, env=env)
    if result.returncode != 0:
        print(f"[오류] Step '{step_name}' 실행 중 치명적인 에러 발생 (리턴코드: {result.returncode})", file=sys.stderr)
        sys.exit(result.returncode)
        
    print(f"================ [Step: {step_name}] 실행 완료 ================\n")

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        
    print("==========================================================================")
    print("         쇼핑 쇼츠 자동화 파이프라인 10대 캐릭터 노드 통합 오케스트레이터         ")
    print("==========================================================================\n")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    excel_script = os.path.join(base_dir, "nodes", "excel_approval_gateway.py")
    
    # 1. [진식] 상품 정보 수집 및 필터링 (collect_products)
    collect_script = os.path.join(base_dir, "nodes", "product_candidate_collection", "collect_products.py")
    collect_in = os.path.join(base_dir, "nodes", "product_candidate_collection", "sample_input.json")
    collect_out = os.path.join(base_dir, "nodes", "product_candidate_collection", "output.json")
    run_step("1. [진식] 상품 후보군 수집 및 정제", [collect_script, "--input", collect_in, "--output", collect_out])

    # 2. [진식] 상품 마진 및 규정 스코어 채점 (score_products)
    score_script = os.path.join(base_dir, "nodes", "product_scoring", "score_products.py")
    score_out = os.path.join(base_dir, "nodes", "product_scoring", "output.json")
    run_step("2. [진식] 상품 가치 및 법적 리스크 스코어링", [score_script, "--input", collect_out, "--output", score_out])

    # [브리지] 단일 상품 분기 처리
    print("[*] E2E 데이터 흐름 제어: 감사 통과 상품 목록에서 최상위 상품 1종을 분기하여 콘텐츠 기획에 진입합니다.")
    try:
        with open(score_out, "r", encoding="utf-8") as f:
            audited_products = json.load(f)
            
        if not audited_products:
            print("[오류] 스코어링을 통과한 활성 상품이 없습니다. 파이프라인을 종료합니다.", file=sys.stderr)
            sys.exit(1)
            
        selected_prod = audited_products[0]
        selected_prod_name = selected_prod.get("name")
        print(f"  └> 선정 상품: {selected_prod_name}")
        
        single_input_path = os.path.join(base_dir, "nodes", "competitor_pattern", "input.json")
        with open(single_input_path, "w", encoding="utf-8") as f:
            json.dump(selected_prod, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[오류] 단일 상품 분기 데이터 변환 중 오류 발생: {e}", file=sys.stderr)
        sys.exit(1)

    # 3. [진식] 소비자 Pain-Point ToT 행동 분류 (classify_patterns)
    pattern_script = os.path.join(base_dir, "nodes", "competitor_pattern", "classify_patterns.py")
    pattern_out = os.path.join(base_dir, "nodes", "competitor_pattern", "output.json")
    run_step("3. [진식] 소비자 행동 패턴 및 소구점 분류", [pattern_script, "--input", single_input_path, "--output", pattern_out])

    # 4. [진식] 장면 연출 가이드 빌드 (create_scene_brief)
    scene_script = os.path.join(base_dir, "nodes", "scene_brief", "create_scene_brief.py")
    scene_out = os.path.join(base_dir, "nodes", "scene_brief", "output.json")
    run_step("4. [진식] 장면 타임라인 연출 기획", [scene_script, "--input", pattern_out, "--output", scene_out])

    # 5. [설아] 도파민 대본 및 카피라이팅 작성 (generate_script)
    script_script = os.path.join(base_dir, "nodes", "script_generation", "generate_script.py")
    script_out = os.path.join(base_dir, "nodes", "script_generation", "output.json")
    run_step("5. [설아] 쇼츠 성우 도파민 대본 작성", [script_script, "--input", scene_out, "--output", script_out])

    # 6. [병길] AI 이미지 & 비디오 영문 프롬프트 디렉팅 (create_media_prompts)
    prompt_script = os.path.join(base_dir, "nodes", "media_prompt", "create_media_prompts.py")
    prompt_out = os.path.join(base_dir, "nodes", "media_prompt", "output.json")
    run_step("6. [병길] AI 영문 프롬프트 디렉팅 구성", [prompt_script, "--input", script_out, "--output", prompt_out])

    # [엑셀 백업] 기획 결과물 엑셀 저장
    run_step("엑셀 저장기: 기획안 엑셀 탭별 기록", [excel_script, "--mode", "write_plan", "--input", prompt_out])

    # 7. [병길] 자막 카피 및 유튜브 업로드 SEO 패키징 (create_upload_package)
    sub_script = os.path.join(base_dir, "nodes", "subtitle_cta", "generate_subtitles_cta.py")
    sub_out = os.path.join(base_dir, "nodes", "subtitle_cta", "output.json")
    run_step("7-1. SRT 자막 및 CTA 카피 빌드", [sub_script, "--input", prompt_out, "--output", sub_out])

    package_script = os.path.join(base_dir, "nodes", "upload_package", "create_upload_package.py")
    package_out = os.path.join(base_dir, "nodes", "upload_package", "output.json")
    run_step("7-2. 유튜브 SEO 해시태그 패키징", [package_script, "--input", sub_out, "--output", package_out])

    # 8. [성무] 성과 지표 로깅 및 AI 수치 진단 (collect_performance)
    perf_script = os.path.join(base_dir, "nodes", "performance_logging", "collect_performance.py")
    perf_out = os.path.join(base_dir, "nodes", "performance_logging", "output.json")
    run_step("8. [성무] 성과 지표 수집 및 AI 수치 진단", [perf_script, "--input", package_out, "--output", perf_out])

    # 9. [성무] 차기 추천 및 A/B 테스트 전략 피벗 (recommend_next)
    next_script = os.path.join(base_dir, "nodes", "next_experiment", "recommend_next.py")
    next_out = os.path.join(base_dir, "nodes", "next_experiment", "output.json")
    run_step("9. [성무] AI 추천 롱테일 피벗 및 A/B 기획", [next_script, "--input", perf_out, "--output", next_out])

    # [엑셀 백업] 최종 성과 지표 엑셀 저장
    run_step("엑셀 저장기: 성과 지표 엑셀 탭 기록", [excel_script, "--mode", "write_performance", "--input", next_out])

    print("\n" + "="*80)
    print("      🎉 축하합니다! 쇼핑 쇼츠 자동화 파이프라인 E2E 9대 노드 구동이 완료되었습니다. 🎉")
    print("="*80)
    
    try:
        with open(next_out, "r", encoding="utf-8") as f:
            final_data = json.load(f)
        print(f"\n[최종 생성 요약]")
        print(f" - 대상 상품 : {final_data.get('name')}")
        print(f" - 종합 점수 : {final_data.get('score')}점")
        print(f" - 예상 조회수: {final_data.get('performance_log', {}).get('metrics', {}).get('views', 0):,}회")
        print(f" - 예상 제휴수익: {final_data.get('performance_log', {}).get('metrics', {}).get('revenue_krw', 0):,}원")
        print(f" - 차기 추천 키워드: {', '.join(final_data.get('next_experiment', {}).get('recommended_keywords', []))}")
    except Exception as e:
        print(f"[경고] 최종 브리핑 리포트 출력 실패: {e}")
    print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    main()
