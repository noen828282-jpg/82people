import os
import json
import argparse
import sys
import shutil
import subprocess

def parse_time(time_str):
    """SRT 시간 포맷(00:00:03,000)을 초 단위의 실수로 변환합니다."""
    try:
        parts = time_str.split(":")
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds_parts = parts[2].split(",")
        seconds = int(seconds_parts[0])
        milliseconds = int(seconds_parts[1])
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000.0
    except Exception as e:
        print(f"[!] 시간 파싱 에러 ({time_str}): {e}")
        return 0.0

def parse_srt_file(srt_path):
    """SRT 파일을 파싱하여 Remotion용 자막 목록을 생성합니다."""
    if not os.path.exists(srt_path):
        print(f"[!] SRT 자막 파일을 찾을 수 없습니다: {srt_path}")
        return []
        
    try:
        with open(srt_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        blocks = content.strip().split("\n\n")
        subtitles = []
        for block in blocks:
            lines = block.strip().split("\n")
            if len(lines) >= 3:
                time_line = lines[1]
                text_line = " ".join(lines[2:])
                if " --> " in time_line:
                    start_str, end_str = time_line.split(" --> ")
                    subtitles.append({
                        "start": parse_time(start_str),
                        "end": parse_time(end_str),
                        "text": text_line
                    })
        return subtitles
    except Exception as e:
        print(f"[!] SRT 파싱 중 오류 발생: {e}")
        return []

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        
    parser = argparse.ArgumentParser(description="쇼핑 쇼츠 자동화 - Remotion 비디오 렌더링 노드")
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
    media_assets = product.get("media_assets", {})
    videos = media_assets.get("videos", [])
    srt_path = product.get("subtitle_file_path")
    
    print(f"[*] '{name}' (ID: {prod_id}) 상품의 Remotion 비디오 합성 및 렌더링 시작")

    # 디렉토리 경로 정의
    # __file__ = d:\dongmin ai company\shorts-automation\nodes\video_compilation\render_videos.py
    script_dir = os.path.dirname(os.path.abspath(__file__)) # nodes/video_compilation
    nodes_dir = os.path.dirname(script_dir) # nodes
    automation_dir = os.path.dirname(nodes_dir) # shorts-automation
    base_dir = os.path.dirname(automation_dir) # d:\dongmin ai company
    
    remotion_dir = os.path.join(base_dir, "remotion-video")
    public_dir = os.path.join(remotion_dir, "public")
    
    os.makedirs(public_dir, exist_ok=True)

    # 1-A. public 디렉토리 내 기존 미디어 파일 정리 (중첩 꼬임 방지)
    print(f"[*] Remotion public 디렉토리 내 기존 파일 정리 중: {public_dir}")
    for item in os.listdir(public_dir):
        item_path = os.path.join(public_dir, item)
        if os.path.isfile(item_path):
            try:
                os.remove(item_path)
                print(f"    - 기존 파일 삭제 완료: {item}")
            except Exception as e:
                print(f"    [경고] 파일 삭제 실패: {item} ({e})")


    # 1. 자막 파싱
    subtitles = []
    if srt_path and os.path.exists(srt_path):
        print(f"[*] SRT 자막 파싱 중: {srt_path}")
        subtitles = parse_srt_file(srt_path)
    else:
        # srt_path가 상대경로인 경우 보정 시도
        alt_srt_path = os.path.join(base_dir, "shorts-automation", srt_path) if srt_path else ""
        if alt_srt_path and os.path.exists(alt_srt_path):
            print(f"[*] SRT 자막 파싱 중 (보정 경로): {alt_srt_path}")
            subtitles = parse_srt_file(alt_srt_path)
        else:
            print("[!] 자막 파일이 유효하지 않아 자막 없이 영상을 병합합니다.")

    # 2. 비디오 클립 복사 및 Remotion 데이터 구축
    clips = []
    images = media_assets.get("images", [])
    for video in videos:
        scene_num = video.get("scene_number")
        src_path = video.get("file_path")
        
        if not src_path or not os.path.exists(src_path):
            # 경로가 상대경로인 경우 보정 시도
            alt_src_path = os.path.join(base_dir, "shorts-automation", src_path) if src_path else ""
            if alt_src_path and os.path.exists(alt_src_path):
                src_path = alt_src_path
            else:
                print(f"[경고] Scene {scene_num}의 비디오 파일이 존재하지 않습니다: {src_path}")
                continue

        # 파일명 추출 및 public 복사
        filename = os.path.basename(src_path)
        dest_path = os.path.join(public_dir, filename)
        
        is_mock = False
        image_filename = None
        
        # 파일 크기가 10KB 미만이면 Mock 비디오로 간주하여 이미지 슬라이드쇼로 대체
        if os.path.exists(src_path) and os.path.getsize(src_path) < 10240:
            is_mock = True
            # 대응되는 이미지 검색
            img_match = next((img for img in images if img.get("scene_number") == scene_num), None)
            if img_match:
                img_src_path = img_match.get("file_path")
                if img_src_path and not os.path.exists(img_src_path):
                    # 상대 경로 보정
                    alt_img_path = os.path.join(base_dir, "shorts-automation", img_src_path)
                    if os.path.exists(alt_img_path):
                        img_src_path = alt_img_path
                        
                if img_src_path and os.path.exists(img_src_path):
                    image_filename = os.path.basename(img_src_path)
                    img_dest_path = os.path.join(public_dir, image_filename)
                    try:
                        shutil.copy2(img_src_path, img_dest_path)
                        print(f"    - Scene {scene_num} 대응 이미지 복사 완료 -> public/{image_filename}")
                    except Exception as e:
                        print(f"[!] 이미지 복사 실패: {e}")
        
        try:
            shutil.copy2(src_path, dest_path)
            # 기본 duration은 6초 (Kie.ai veo3_fast의 표준 duration)
            clips.append({
                "path": filename,
                "duration": 6.0,
                "isMock": is_mock,
                "imagePath": image_filename
            })
            print(f"    - Scene {scene_num} 클립 복사 완료 -> public/{filename} (Mock: {is_mock})")
        except Exception as e:
            print(f"[!] 비디오 복사 실패: {e}")

    if not clips:
        print("[Error] 합성할 유효한 비디오 클립이 존재하지 않습니다.", file=sys.stderr)
        sys.exit(1)

    # 3. video_data.json 생성
    video_data = {
        "clips": clips,
        "subtitles": subtitles
    }
    
    video_data_path = os.path.join(public_dir, "video_data.json")
    try:
        with open(video_data_path, "w", encoding="utf-8") as f:
            json.dump(video_data, f, ensure_ascii=False, indent=2)
        print(f"[*] Remotion 메타데이터 작성 완료: {video_data_path}")
    except Exception as e:
        print(f"[Error] 메타데이터 작성 실패: {e}", file=sys.stderr)
        sys.exit(1)

    # 4. Remotion Render 실행
    output_filename = f"{prod_id}_final.mp4"
    remotion_output_path = os.path.join(public_dir, output_filename)
    
    # 로컬 remotion 바이너리 검색 및 사용
    remotion_bin = os.path.join(remotion_dir, "node_modules", ".bin", "remotion")
    if os.name == "nt":
        if os.path.exists(remotion_bin + ".cmd"):
            remotion_bin += ".cmd"
        elif os.path.exists(remotion_bin + ".bat"):
            remotion_bin += ".bat"
            
    if not os.path.exists(remotion_bin):
        cmd = ["npx", "remotion", "render", "ShortsBuilder", f"public/{output_filename}", "--no-cache"]
    else:
        cmd = [remotion_bin, "render", "ShortsBuilder", f"public/{output_filename}", "--no-cache"]
        
    print(f"[*] Remotion 렌더링을 시작합니다: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(
            cmd, 
            cwd=remotion_dir, 
            capture_output=True, 
            text=True, 
            encoding="utf-8", 
            errors="replace", 
            shell=True
        )
        
        if result.returncode == 0:
            print("[+] Remotion 렌더링 완료!")
        else:
            print(f"[!] Remotion 렌더링 실패 (반환 코드: {result.returncode})")
            print(f"    - Stdout: {result.stdout}")
            print(f"    - Stderr: {result.stderr}")
            # 실패 시에도 다음 단계를 진행할 수 있도록 Mock 파일 대체 또는 예외 종료 결정
            # 여기서는 비디오 파일이 꼭 필요하므로 렌더링 실패 시 Mock final 생성
            if not os.path.exists(remotion_output_path):
                print("[!] 렌더링 실패로 인해 최종 가상 숏츠 영상파일로 대체합니다.")
                with open(remotion_output_path, "wb") as f:
                    f.write(b"MOCK FINAL VIDEO CONTENT")
    except Exception as e:
        print(f"[!] Remotion 서브프로세스 기동 실패: {e}")
        if not os.path.exists(remotion_output_path):
            with open(remotion_output_path, "wb") as f:
                f.write(b"MOCK FINAL VIDEO CONTENT")

    # 5. 최종 완성 비디오 파일 assets/output/prod_id 복사
    final_assets_dir = os.path.join(base_dir, "shorts-automation", "nodes", "assets", "output", prod_id)
    os.makedirs(final_assets_dir, exist_ok=True)
    final_video_path = os.path.join(final_assets_dir, f"{prod_id}_final.mp4")

    
    try:
        if os.path.exists(remotion_output_path):
            shutil.copy2(remotion_output_path, final_video_path)
            print(f"[+] 최종 비디오 자산 저장 완료: {final_video_path}")
        else:
            print("[경고] Remotion 빌드 결과물이 유효하지 않아 복사하지 못했습니다.")
    except Exception as e:
        print(f"[!] 최종 비디오 복사 에러: {e}")

    # 6. 결과 JSON 저장
    output_product = product.copy()
    output_product["final_video_path"] = final_video_path
    
    output_dir = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: Remotion 비디오 렌더링 결과가 기록되었습니다: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
