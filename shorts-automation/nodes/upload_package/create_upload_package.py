import os
import json
import argparse
import sys
import shutil

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_gpt


def generate_youtube_metadata_with_gpt(product, category_tags):
    """OpenAI API를 사용하여 유튜브 SEO 최적화 메타데이터(제목 3종, 태그, 본문 설명글)를 생성합니다."""
    name = product.get("name", "")
    description_text = product.get("description", "")
    sourcing_method = product.get("sourcing_method", "")
    
    fallback_tags = ["호야STUDIO", "말하는강아지", "리트리버호야", "강아지브이로그", "댕댕이쇼츠"]
    fallback_data = {
        "title_suggestions": [
            f"주인 잔소리 회피하는 천재 강아지 호야의 비법 ㅋㅋㅋ",
            f"말하는 리트리버 호야: 대표님, 내 밥그릇 왜 비었죠?",
            f"주인이 홈트할 때 리트리버 호야의 귀여운 훼방 공작"
        ],
        "tags": fallback_tags,
        "rich_description": f"{description_text}\n\n#호야STUDIO #말하는강아지 #리트리버 #강아지브이로그"
    }

    if sourcing_method != "hoya_studio_concept":
        # 기존 쇼핑 몰백 유지
        affiliate_url = product.get("affiliate_url", "")
        disclosure = product.get("disclosure", "본 영상은 쿠팡 파트너스 활동의 일환으로...")
        return {
            "title_suggestions": [f"인생 꿀템! {name}", f"가성비 대박 {name}"],
            "tags": ["쇼츠꿀템", "내돈내산"],
            "rich_description": f"{description_text}\n\n구매링크: {affiliate_url}\n\n{disclosure}"
        }

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return fallback_data

    system_prompt = (
        "You are an expert YouTube SEO optimizer and metadata writer for the pet/dog channel 호야STUDIO (@호야STUDIO).\n"
        "Your task is to write high-CTR title suggestions, description content, and tags for a dog vlog short-form video.\n\n"
        "Guidelines:\n"
        "1. Write the titles and description strictly in Korean.\n"
        "2. Suggest exactly 3 clickable, funny titles (high CTR, less than 50 characters each, using cute/witty hooks).\n"
        "3. Provide a natural description that introduces the vlog story, includes HoyaSTUDIO social handles, and asks viewers to subscribe.\n"
        "4. Include 5 to 7 relevant tags/hashtags (without '#' prefix).\n"
        "5. Output a JSON object with exactly the following keys:\n"
        "   - \"title_suggestions\": A list of 3 strings for video title candidates.\n"
        "   - \"tags\": A list of 5-8 strings representing target keywords.\n"
        "   - \"rich_description\": The complete description text block ready for YouTube upload.\n\n"
        "Only return JSON."
    )

    user_prompt = json.dumps({
        "vlog_title": name,
        "description": description_text,
        "script": product.get("script", {}).get("overall_script", "")
    }, ensure_ascii=False)

    try:
        result = call_gpt(system_prompt, user_prompt, json_mode=True, fallback_data=fallback_data)
        return result
    except Exception as e:
        print(f"[!] GPT 유튜브 메타데이터 생성 실패: {e}")
        return fallback_data


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description="호야STUDIO 쇼츠 자동화 - 업로드 패키지 및 ZIP 파일 빌드 노드")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"[오류] 입력 파일을 찾을 수 없습니다: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            product = json.load(f)
    except Exception as e:
        print(f"[오류] JSON 입력 파일 파싱 실패: {e}", file=sys.stderr)
        sys.exit(1)

    prod_id = product.get("id")
    name = product.get("name", "")
    sourcing_method = product.get("sourcing_method", "")
    subtitle_path = product.get("subtitle_file_path", "")
    scene_briefs = product.get("scene_briefs", [])

    print(f"[*] '{name}' (ID: {prod_id}) 에피소드 최종 업로드 패키지 빌드 시작")

    # 1. 패키지 디렉토리 정의 및 생성 (assets/output/<prod_id>_package)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(args.output)))
    package_dir = os.path.join(base_dir, "assets", "output", f"{prod_id}_package")
    os.makedirs(package_dir, exist_ok=True)
    print(f"  └ 패키지 디렉토리 확보: {package_dir}")

    copied_images = []
    copied_subtitle = ""

    # 2. 호야STUDIO 전용 자산 파일 복사 (자막 복사만 남겨두고 이미지 복사는 스킵)
    if sourcing_method == "hoya_studio_concept":
        print("  └ [알림] 대표님 수동 이미지 생성 설정에 따라 ZIP 패키지에 물리 이미지를 포함시키지 않고 가이드 텍스트로 대체합니다.")

    # 자막 파일 복사
    if subtitle_path and os.path.exists(subtitle_path):
        sub_basename = os.path.basename(subtitle_path)
        dest_sub_path = os.path.join(package_dir, sub_basename)
        shutil.copy2(subtitle_path, dest_sub_path)
        copied_subtitle = dest_sub_path
        print(f"  └ 자막 파일 복사 완료: {sub_basename}")

    # 3. 대표님 수동 편집 가이드 텍스트 파일(vlog_script_and_prompts.txt) 빌드
    guide_file_path = os.path.join(package_dir, "vlog_script_and_prompts.txt")
    try:
        script_data = product.get("script_data", {})
        with open(guide_file_path, "w", encoding="utf-8") as f:
            f.write(f"============================================================\n")
            f.write(f"🎬 호야STUDIO 에피소드 편집 가이드북\n")
            f.write(f"============================================================\n\n")
            f.write(f"📌 [에피소드 기획명]: {name}\n")
            f.write(f"📌 [BGM 분위기]: {script_data.get('bgm_mood', 'N/A')}\n")
            f.write(f"📌 [추천 효과음]: {', '.join(script_data.get('sound_effects', []))}\n\n")
            f.write(f"------------------------------------------------------------\n")
            f.write(f"🎤 [전체 오디오 내레이션 대본] (더빙/TTS용)\n")
            f.write(f"------------------------------------------------------------\n")
            f.write(f"\"{script_data.get('narration', '')}\"\n\n")
            f.write(f"------------------------------------------------------------\n")
            f.write(f"🎥 [씬별 비디오 연출용 AI 프롬프트 목록] (Kling/Runway 입력용)\n")
            f.write(f"------------------------------------------------------------\n")
            for sb in scene_briefs:
                f.write(f"▶ 씬 {sb['scene_number']} ({sb.get('duration_seconds', 3.0)}초):\n")
                f.write(f"   - 이미지 소스: scene_{sb['scene_number']}.png (동봉됨)\n")
                f.write(f"   - 비디오 모션 프롬프트:\n     {sb.get('video_prompt', '')}\n\n")
            f.write(f"============================================================\n")
        print(f"  └ [가이드북 생성 완료] vlog_script_and_prompts.txt")
    except Exception as e:
        print(f"[경고] 가이드북 텍스트 파일 생성 실패: {e}")

    # 4. GPT 기반 유튜브 업로드 메타데이터 빌드
    meta_package = generate_youtube_metadata_with_gpt(product, [])
    
    youtube_metadata = {
        "categoryId": "15",  # 15: Pets & Animals
        "privacyStatus": "public",
        "selfDeclaredMadeForKids": False,
        "title": meta_package["title_suggestions"][0],
        "description": meta_package["rich_description"],
        "tags": meta_package["tags"]
    }

    # 5. 매니페스트 구성 및 저장
    manifest_data = {
        "prod_id": prod_id,
        "title": youtube_metadata["title"],
        "title_suggestions": meta_package["title_suggestions"],
        "description": youtube_metadata["description"],
        "tags": youtube_metadata["tags"],
        "image_files": copied_images,
        "subtitle_file": copied_subtitle,
        "guide_file": guide_file_path,
        "youtube_metadata": youtube_metadata
    }

    manifest_file_path = os.path.join(package_dir, "manifest.json")
    with open(manifest_file_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, ensure_ascii=False, indent=2)

    # 6. 최종 릴리즈 패키지 ZIP 압축 아카이빙
    # 패키지 디렉토리를 ZIP 파일로 압축하여 assets/output/<prod_id>_package.zip 파일 생성
    zip_base_name = os.path.join(base_dir, "assets", "output", f"{prod_id}_package")
    try:
        print(f"[*] 패키지 ZIP 압축 생성 중: {zip_base_name}.zip")
        shutil.make_archive(zip_base_name, 'zip', package_dir)
        print(f"  └ [압축 완료] 패키지 ZIP 파일이 물리적으로 아카이빙되었습니다.")
    except Exception as e:
        print(f"[오류] ZIP 압축 파일 아카이빙 실패: {e}", file=sys.stderr)
        sys.exit(1)

    print("\n================ 유튜브 업로드 패키지 빌드 완료 ================")
    print(f"  * 1순위 적용 제목: {youtube_metadata['title']}")
    print(f"  * 태그 목록: {', '.join(youtube_metadata['tags'])}")
    print(f"  * 패키지 ZIP 경로: {zip_base_name}.zip")
    print("==============================================================\n")

    # 7. 최종 결과 결합 및 저장
    output_product = product.copy()
    output_product["package_dir"] = package_dir
    output_product["manifest_file"] = manifest_file_path
    output_product["package_zip_path"] = f"{zip_base_name}.zip"
    output_product["upload_package"] = manifest_data

    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 업로드 패키지 빌드가 완료되었습니다: {args.output}")
    except Exception as e:
        print(f"[오류] 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
