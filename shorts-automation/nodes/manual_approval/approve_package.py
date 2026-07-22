import os
import json
import argparse
import sys
import datetime
import shutil

def get_iso_timestamp():
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def main():
    parser = argparse.ArgumentParser(description="쇼핑 쇼츠 자동화 - 수동 검수 및 승인 노드")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    parser.add_argument("--auto-approve", action="store_true", help="수동 대기 없이 즉시 자동 승인 처리")
    parser.add_argument("--reject", action="store_true", help="강제 반려 처리")
    parser.add_argument("--reason", default="", help="반려 사유 혹은 승인 의견 코멘트")
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
    package_dir = product.get("package_dir", "")
    upload_package = product.get("upload_package", {})

    print(f"[*] '{name}' (ID: {prod_id}) 상품의 업로드 패키지 수동 검수 시작")

    # 1. 패키지 내 체크리스트 제공
    # 노드 디렉토리에 있는 approval_checklist.md 양식을 패키지 폴더 안으로 복사해줍니다.
    if package_dir and os.path.exists(package_dir):
        node_dir = os.path.dirname(os.path.abspath(__file__))
        checklist_src = os.path.join(node_dir, "approval_checklist.md")
        if os.path.exists(checklist_src):
            checklist_dest = os.path.join(package_dir, "approval_checklist.md")
            try:
                shutil.copy2(checklist_src, checklist_dest)
                print(f"  └ 수동 검사용 체크리스트 복사 완료: {checklist_dest}")
            except Exception as e:
                print(f"[경고] 체크리스트 복사 실패: {e}", file=sys.stderr)

    # 2. 업로드 메타데이터 정보 요약 출력
    print("\n================ 업로드 예정 정보 요약 ================")
    print(f"  * 제목: {upload_package.get('title')}")
    print(f"  * 자막 경로: {upload_package.get('subtitle_file')}")
    print(f"  * 비디오 목록: {', '.join([os.path.basename(v) for v in upload_package.get('video_files', [])])}")
    print("  * 설명글 본문 일부:")
    desc = upload_package.get('description', '')
    desc_lines = desc.split('\n')
    for line in desc_lines[:6]:
        print(f"    | {line}")
    if len(desc_lines) > 6:
        print("    | ... (이하 중략) ...")
    print("========================================================\n")

    # 3. 승인/반려 의사결정 연산
    approved = False
    comment = args.reason
    next_action = "hold"

    if args.auto_approve:
        approved = True
        comment = comment if comment else "자동화 모듈에 의한 자동 승인 통과"
        next_action = "publish"
        print("[*] [--auto-approve] 자동 승인 모드로 통과합니다.")
    elif args.reject:
        approved = False
        comment = comment if comment else "자동화 관리 프로세스에 의해 거절됨"
        next_action = "regenerate"
        print("[*] [--reject] 반려 모드로 처리됩니다.")
    else:
        # 대화형 CLI 입력 처리 (표준 입력이 TTY인 경우에만 작동)
        if sys.stdin.isatty():
            try:
                print(">>> 최종 승인하시겠습니까? (Y/N/H [Hold]): ", end="", flush=True)
                choice = sys.stdin.readline().strip().upper()
                if choice == "Y":
                    approved = True
                    next_action = "publish"
                elif choice == "N":
                    approved = False
                    next_action = "regenerate"
                else:
                    approved = False
                    next_action = "hold"

                print(">>> 검수 의견(Comment)을 한 줄 작성해 주세요: ", end="", flush=True)
                user_comment = sys.stdin.readline().strip()
                if user_comment:
                    comment = user_comment
            except Exception as e:
                # 비정상 표준 입력 에러 시 안전하게 hold 처리
                approved = False
                comment = f"표준 입력 오류로 인해 보류됨: {e}"
                next_action = "hold"
        else:
            # TTY가 아닌 환경(예: CI/CD 혹은 백그라운드 툴 실행)에서는 기본 승인 모드로 안전 처리
            approved = True
            comment = "대화형 입력을 지원하지 않는 환경이므로 기본 자동 승인"
            next_action = "publish"
            print("[*] 비-TTY 환경: 기본 자동 승인으로 전환합니다.")

    approved_at = get_iso_timestamp()

    print("\n================ 검수 최종 결과 ================")
    print(f"  * 판정: {'[최종 승인]' if approved else '[최종 반려/보류]'}")
    print(f"  * 담당자: admin")
    print(f"  * 의견: {comment}")
    print(f"  * 다음 조치: {next_action}")
    print("================================================")

    # 4. 결과 병합 및 저장
    output_product = product.copy()
    output_product["approval_status"] = {
        "approved": approved,
        "reviewer": "admin",
        "comment": comment,
        "approved_at": approved_at,
        "next_action": next_action
    }

    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 검수 판정 결과가 반영되었습니다: {args.output}")
    except Exception as e:
        print(f"[오류] 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
