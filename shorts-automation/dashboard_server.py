import os
import json
import sys
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

# 전역 노드 설정 정의 (1~18번 단계)
# 전역 노드 설정 정의 (10대 캐릭터 핵심 노드로 간소화)
NODES_CONFIG = [
    {
        "id": "collect_products",
        "name": "1. 펫 트렌드 및 에피소드 소재 수집",
        "script": "nodes/product_candidate_collection/collect_products.py",
        "input_file": "nodes/product_candidate_collection/sample_input.json",
        "output_file": "nodes/product_candidate_collection/output.json",
        "args": ["--input", "nodes/product_candidate_collection/sample_input.json", "--output", "nodes/product_candidate_collection/output.json"],
        "status": "idle",
        "log": ""
    },
    {
        "id": "score_products",
        "name": "2. 에피소드 소재 바이럴 채점 [진식]",
        "script": "nodes/product_scoring/score_products.py",
        "input_file": "nodes/product_candidate_collection/output.json",
        "output_file": "nodes/product_scoring/output.json",
        "args": ["--input", "nodes/product_candidate_collection/output.json", "--output", "nodes/product_scoring/output.json"],
        "status": "idle",
        "log": ""
    },
    {
        "id": "classify_patterns",
        "name": "3. 1인칭 강아지(호야) 대본 작성 [설아]",
        "script": "nodes/competitor_pattern/classify_patterns.py",
        "input_file": "nodes/competitor_pattern/input.json",
        "output_file": "nodes/competitor_pattern/output.json",
        "args": ["--input", "nodes/competitor_pattern/input.json", "--output", "nodes/competitor_pattern/output.json"],
        "status": "idle",
        "log": ""
    },
    {
        "id": "create_scene_brief",
        "name": "4. 장면별 착장 및 연출 기획 [병길]",
        "script": "nodes/scene_brief/create_scene_brief.py",
        "input_file": "nodes/competitor_pattern/output.json",
        "output_file": "nodes/scene_brief/output.json",
        "args": ["--input", "nodes/competitor_pattern/output.json", "--output", "nodes/scene_brief/output.json"],
        "status": "idle",
        "log": ""
    },
    {
        "id": "generate_script",
        "name": "5. DALL-E 3 호야 캐릭터 이미지 생성",
        "script": "nodes/script_generation/generate_script.py",
        "input_file": "nodes/scene_brief/output.json",
        "output_file": "nodes/script_generation/output.json",
        "args": ["--input", "nodes/scene_brief/output.json", "--output", "nodes/script_generation/output.json"],
        "status": "idle",
        "log": ""
    },
    {
        "id": "create_media_prompts",
        "name": "6. 비디오 연출용 영문 프롬프트 생성",
        "script": "nodes/media_prompt/create_media_prompts.py",
        "input_file": "nodes/script_generation/output.json",
        "output_file": "nodes/media_prompt/output.json",
        "args": ["--input", "nodes/script_generation/output.json", "--output", "nodes/media_prompt/output.json"],
        "status": "idle",
        "log": ""
    },
    {
        "id": "create_upload_package",
        "name": "7. 최종 에셋 패키징 & 다운로드 빌드",
        "script": "nodes/upload_package/create_upload_package.py",
        "input_file": "nodes/media_prompt/output.json",
        "output_file": "nodes/upload_package/output.json",
        "args": ["--input", "nodes/media_prompt/output.json", "--output", "nodes/upload_package/output.json"],
        "status": "idle",
        "log": ""
    },
    {
        "id": "collect_performance",
        "name": "8. 유튜브 업로드 성과 로깅",
        "script": "nodes/performance_logging/collect_performance.py",
        "input_file": "nodes/upload_package/output.json",
        "output_file": "nodes/performance_logging/output.json",
        "args": ["--input", "nodes/upload_package/output.json", "--output", "nodes/performance_logging/output.json"],
        "status": "idle",
        "log": ""
    },
    {
        "id": "recommend_next",
        "name": "9. 피드백 루프 다음 에피소드 추천",
        "script": "nodes/next_experiment/recommend_next.py",
        "input_file": "nodes/performance_logging/output.json",
        "output_file": "nodes/next_experiment/output.json",
        "args": ["--input", "nodes/performance_logging/output.json", "--output", "nodes/next_experiment/output.json"],
        "status": "idle",
        "log": ""
    }
]

# 전체 파이프라인 비동기 기동 상태용
pipeline_running = False
pipeline_stop_requested = False
current_subprocess = None

def update_node_status(node_id, status, log_text=None):
    for node in NODES_CONFIG:
        if node["id"] == node_id:
            node["status"] = status
            if log_text is not None:
                node["log"] = log_text
            break

def trigger_bridge_logic(base_dir):
    """2단계 상품 스코어링 통과 결과에서 최상위 상품 1종을 추출해 3단계 입력으로 넣어주는 브릿지 연산"""
    score_out = os.path.join(base_dir, "nodes", "product_scoring", "output.json")
    single_input_path = os.path.join(base_dir, "nodes", "competitor_pattern", "input.json")
    
    if os.path.exists(score_out):
        try:
            with open(score_out, "r", encoding="utf-8") as f:
                audited_products = json.load(f)
            if audited_products:
                selected_prod = audited_products[0]
                with open(single_input_path, "w", encoding="utf-8") as f:
                    json.dump(selected_prod, f, ensure_ascii=False, indent=2)
                return True, f"스코어링 통과 상품 '{selected_prod.get('name')}'을 Node 3 입력으로 분기 완료"
        except Exception as e:
            return False, f"브릿지 파일 복사 중 오류: {e}"
    return False, "Node 2 결과 파일(output.json)을 찾을 수 없습니다."

def validate_sourcing_result(base_dir):
    """1단계 상품 수집 결과가 실제 소싱된 상품인지 검증합니다. 가짜/가상 상품을 차단합니다."""
    output_path = os.path.join(base_dir, "nodes", "product_candidate_collection", "output.json")
    
    if not os.path.exists(output_path):
        return False, "⚠️ 1단계 상품 수집 결과 파일(output.json)이 존재하지 않습니다. 먼저 상품 소싱을 실행해주세요."
    
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            products = json.load(f)
    except Exception as e:
        return False, f"⚠️ 1단계 결과 파일 파싱 오류: {e}"
    
    if not isinstance(products, list) or len(products) == 0:
        return False, "⚠️ 소싱된 상품이 0건입니다. 검색 키워드를 변경하고 다시 시도해주세요."
    
    # 가짜 상품(dyn_ 접두사) 감지 및 차단
    fake_count = sum(1 for p in products if p.get("id", "").startswith("dyn_"))
    real_count = len(products) - fake_count
    
    if real_count == 0:
        return False, f"⚠️ 실제 소싱된 상품이 없습니다 (가상 데이터 {fake_count}건만 존재). 검색 키워드를 변경해주세요. 가짜 상품으로는 연출/대본 기획을 진행하지 않습니다."
    
    if fake_count > 0:
        # 가짜 상품이 섞여있으면 제거하고 실제 상품만 유지
        real_products = [p for p in products if not p.get("id", "").startswith("dyn_")]
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(real_products, f, ensure_ascii=False, indent=2)
        return True, f"✅ 실제 소싱 상품 {real_count}건 검증 통과 (가상 데이터 {fake_count}건 자동 제거됨)"
    
    return True, f"✅ 실제 소싱 상품 {real_count}건 검증 통과"

def run_single_node(node, base_dir):
    """특정 노드를 subprocess로 직접 실행합니다."""
    global current_subprocess
    
    if pipeline_stop_requested:
        update_node_status(node["id"], "idle", "사용자에 의해 취소되었습니다.")
        return False, "중단됨"
        
    node_id = node["id"]
    update_node_status(node_id, "running", "실행 중...")

    # 3단계 패턴 분류 실행 전, 브릿지 로직 자동 가동
    if node_id == "classify_patterns":
        success, msg = trigger_bridge_logic(base_dir)
        print(f"[*] [대시보드 브릿지] {msg}")

    # 실행할 서브 스크립트 리스트 정의
    sub_runs = []
    if node_id == "media_generation":
        sub_runs = [
            ("nodes/media_generation_queue/media_queue.py", ["--input", "nodes/media_prompt/output.json", "--output", "nodes/media_generation_queue/output.json"]),
            ("nodes/media_generation_queue/generate_videos.py", ["--input", "nodes/media_generation_queue/output.json", "--output", "nodes/media_generation_queue/video_output.json"]),
            ("nodes/media_inspection/inspect_media.py", ["--input", "nodes/media_generation_queue/video_output.json", "--output", "nodes/media_inspection/output.json"])
        ]
    elif node_id == "create_upload_package":
        sub_runs = [
            ("nodes/subtitle_cta/generate_subtitles_cta.py", ["--input", "nodes/media_inspection/output.json", "--output", "nodes/subtitle_cta/output.json"]),
            ("nodes/upload_package/create_upload_package.py", ["--input", "nodes/subtitle_cta/output.json", "--output", "nodes/upload_package/output.json"])
        ]
    else:
        # 단일 노드 구동
        sub_runs = [(node["script"], node["args"])]

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"

    combined_log = ""
    for idx, (script, raw_args) in enumerate(sub_runs):
        if pipeline_stop_requested:
            update_node_status(node_id, "idle", "사용자에 의해 실행이 중단되었습니다.")
            return False, "중단됨"
            
        script_path = os.path.join(base_dir, script)
        args = [sys.executable, script_path]
        for arg in raw_args:
            if arg.startswith("nodes/"):
                args.append(os.path.join(base_dir, arg))
            else:
                args.append(arg)

        print(f"[*] [대시보드 백엔드] 실행 서브스크립트 ({idx+1}/{len(sub_runs)}): {' '.join(args)}")
        try:
            current_subprocess = subprocess.Popen(
                args, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE, 
                text=True, 
                encoding="utf-8", 
                errors="replace", 
                env=env
            )
            stdout, stderr = current_subprocess.communicate()
            return_code = current_subprocess.returncode
            current_subprocess = None

            combined_log += f"--- Sub-step {idx+1}: {os.path.basename(script)} ---\n"
            combined_log += (stdout or "") + "\n" + (stderr or "") + "\n"

            if return_code != 0:
                update_node_status(node_id, "error", combined_log)
                return False, combined_log

        except Exception as e:
            current_subprocess = None
            err_msg = f"실행 중 예외 발생: {e}\n" + combined_log
            update_node_status(node_id, "error", err_msg)
            return False, err_msg

    # 전체 서브 스텝이 성공적으로 완료됨
    update_node_status(node_id, "success", combined_log)
    
    # 6단계 기획 프롬프트 구성 완료 시 엑셀 기획서 탭 자동 기록
    if node_id == "create_media_prompts":
        try:
            gateway_script = os.path.join(base_dir, "nodes", "excel_approval_gateway.py")
            prompt_out = os.path.join(base_dir, "nodes", "media_prompt", "output.json")
            subprocess.run([sys.executable, gateway_script, "--mode", "write_plan", "--input", prompt_out], check=True)
            print("[*] [대시보드 백엔드] 6단계 기획 완료 ➔ 엑셀 시트 자동 기록 성공")
        except Exception as e:
            print(f"[!] [대시보드 백엔드] 엑셀 기획 저장 실패: {e}")
    # 10단계 최종 피드백 루프 완료 시 엑셀 성과 지표 탭 자동 기록
    elif node_id == "recommend_next":
        try:
            gateway_script = os.path.join(base_dir, "nodes", "excel_approval_gateway.py")
            next_out = os.path.join(base_dir, "nodes", "next_experiment", "output.json")
            subprocess.run([sys.executable, gateway_script, "--mode", "write_performance", "--input", next_out], check=True)
            print("[*] [대시보드 백엔드] 10단계 E2E 완료 ➔ 엑셀 성과 지표 자동 기록 성공")
        except Exception as e:
            print(f"[!] [대시보드 백엔드] 엑셀 성과 저장 실패: {e}")

    return True, combined_log

# 수동 기획 승인 상태용 플래그
approval_pending = False

def run_entire_pipeline_thread(base_dir, end_node_id=None, resume=False):
    """1번부터 지정된 노드(기본 전체)까지 순차 실행하는 스레드 (Resume 재생 기능 지원)"""
    global pipeline_running, pipeline_stop_requested, approval_pending
    pipeline_running = True
    pipeline_stop_requested = False
    print(f"[*] [대시보드 백엔드] 파이프라인 기동 시작 (Resume={resume}, 종료 타겟={end_node_id or '전체'})")
    
    if not resume:
        # 모든 노드를 idle 상태로 초기화
        for node in NODES_CONFIG:
            node["status"] = "idle"
            node["log"] = ""
        
    for node in NODES_CONFIG:
        if pipeline_stop_requested:
            print("[*] [대시보드 백엔드] 파이프라인 구동 중단 요청으로 취소됨")
            break
            
        # 만약 resume(이어하기) 모드이고 해당 노드가 이미 성공 상태이면 패스
        if resume and node["status"] == "success":
            print(f"[*] [대시보드 백엔드] {node['name']} 이미 성공하여 스킵 (Resume 모드)")
            continue
            
        # [수동 승인 게이트웨이 추가] 7단계(create_upload_package) 진입 직전 기획 검수 및 수동 편집본 영상 업로드 대기 모드 활성화
        if node["id"] == "create_upload_package":
            approval_pending = True
            update_node_status("create_upload_package", "pending", "대본 및 이미지 프롬프트 기획이 완료되었습니다. 사장님 최종 편집 완료 영상을 대시보드에 업로드하시고 승인을 진행해주세요.")
            print("[*] [대시보드 백엔드] 6단계 기획 완료 ➔ 대시보드 수동 비디오 업로드 및 승인 대기 홀딩")
            while approval_pending:
                if pipeline_stop_requested:
                    break
                time.sleep(1)
            
            if pipeline_stop_requested:
                print("[*] [대시보드 백엔드] 대기 중 정지 요청으로 중단")
                break
            print("[*] [대시보드 백엔드] 대시보드 기획 승인 및 수동 비디오 업로드 확인 완료! 자막 및 유튜브 SEO 패키징 단계를 속개합니다.")
            
        print(f"[*] [대시보드 백엔드] {node['name']} 실행 기동")
        success, log = run_single_node(node, base_dir)
        if not success:
            print(f"[!] [대시보드 백엔드] {node['name']} 에러 발생으로 인해 전체 파이프라인 구동 중지")
            break
        
        # [소싱 검증 게이트] 1단계 상품 수집 완료 후, 실제 소싱된 상품인지 이중 검증
        # 가짜 상품(dyn_ 접두사)이 섞여있으면 파이프라인 진행을 차단합니다.
        if node["id"] == "collect_products":
            gate_ok, gate_msg = validate_sourcing_result(base_dir)
            if not gate_ok:
                update_node_status("collect_products", "error", gate_msg)
                print(f"[!] [소싱 게이트] {gate_msg}")
                break
            print(f"[*] [소싱 게이트] {gate_msg}")
        
        # 지정한 타겟 노드 완료 시 순차 중단
        if end_node_id and node["id"] == end_node_id:
            print(f"[*] [대시보드 백엔드] 목표 노드 '{node['id']}' 완료로 순차 구동을 안전 종료합니다.")
            break
            
    pipeline_running = False
    pipeline_stop_requested = False
    print("[*] [대시보드 백엔드] 파이프라인 구동 스레드 완료")

class DashboardRESTHandler(BaseHTTPRequestHandler):
    
    def do_GET(self):
        url = urlparse(self.path)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 1. 메인 대시보드 페이지 서빙
        if url.path == "/" or url.path == "/index.html":
            html_path = os.path.join(base_dir, "nodes", "assets", "dashboard.html")
            if os.path.exists(html_path):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                with open(html_path, "r", encoding="utf-8") as f:
                    self.wfile.write(f.read().encode("utf-8"))
            else:
                self.send_error(404, "dashboard.html not found")
            return
            
        # 2. 노드들의 현재 상태 정보 및 설정 조회 API
        elif url.path == "/api/nodes":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"pipeline_running": pipeline_running, "nodes": NODES_CONFIG}, ensure_ascii=False).encode("utf-8"))
            return
            
        # 3. 특정 노드의 로컬 입출력 JSON 파일 로드 API
        elif url.path == "/api/node/data":
            params = parse_qs(url.query)
            node_id = params.get("node_id", [""])[0]
            data_type = params.get("type", ["input"])[0] # input or output
            
            node = next((n for n in NODES_CONFIG if n["id"] == node_id), None)
            if not node:
                self.send_error(404, "Node not found")
                return
                
            file_key = "input_file" if data_type == "input" else "output_file"
            file_path = os.path.join(base_dir, node[file_key])
            
            content = {}
            exists = False
            if os.path.exists(file_path):
                exists = True
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = json.load(f)
                except Exception as e:
                    content = {"error": f"JSON 파싱 에러: {e}"}
            else:
                content = {"message": "해당 로컬 결과 파일이 아직 생성되지 않았습니다."}
                
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"node_id": node_id, "type": data_type, "exists": exists, "file_path": file_path, "content": content}, ensure_ascii=False).encode("utf-8"))
            return
            
        # 4. 정적 파일 및 에셋 서빙 (이미지 및 ZIP 파일 다운로드)
        elif url.path.startswith("/nodes/assets/") or url.path.endswith(".jpg") or url.path.endswith(".png") or url.path.endswith(".zip"):
            file_name = os.path.basename(url.path)
            # 만약 ZIP 파일 요청이면 nodes/assets/output/ 폴더에서 찾고, 아니면 nodes/assets/ 에서 찾음
            if url.path.endswith(".zip"):
                file_path = os.path.join(base_dir, "nodes", "assets", "output", file_name)
            else:
                file_path = os.path.join(base_dir, "nodes", "assets", file_name)
                
            if os.path.exists(file_path):
                self.send_response(200)
                ext = os.path.splitext(file_name)[1].lower()
                if ext in [".jpg", ".jpeg"]:
                    mime = "image/jpeg"
                elif ext == ".png":
                    mime = "image/png"
                elif ext == ".zip":
                    mime = "application/zip"
                    self.send_header("Content-Disposition", f"attachment; filename={file_name}")
                else:
                    mime = "application/octet-stream"
                    
                self.send_header("Content-Type", mime)
                self.end_headers()
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, f"Asset not found: {file_path}")
            return
            
        else:
            # 기본 정적 자산 및 404
            self.send_error(404, "Not Found")

    def do_POST(self):
        global pipeline_running, pipeline_stop_requested, current_subprocess
        url = urlparse(self.path)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 0-0. 최종 완성 비디오 파일 업로드 API (rfile 소비 전 가로채기)
        if url.path == "/api/pipeline/upload_video":
            try:
                import cgi
                ctype, pdict = cgi.parse_header(self.headers.get('Content-Type', ''))
                if ctype == 'multipart/form-data':
                    if 'boundary' in pdict:
                        # string boundary to bytes for Python 3 cgi parse
                        pdict['boundary'] = bytes(pdict['boundary'], "utf-8")
                    
                    fields = cgi.FieldStorage(
                        fp=self.rfile,
                        headers=self.headers,
                        environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers.get('Content-Type')}
                    )
                    
                    if 'video' in fields:
                        fileitem = fields['video']
                        if fileitem.filename:
                            # 저장할 경로 설정: nodes/upload_package/final_video.mp4
                            dest_dir = os.path.join(base_dir, "nodes", "upload_package")
                            os.makedirs(dest_dir, exist_ok=True)
                            dest_path = os.path.join(dest_dir, "final_video.mp4")
                            with open(dest_path, 'wb') as f:
                                f.write(fileitem.file.read())
                            
                            # 후속 노드들의 안정적인 실행을 위해 검수 output.json 임시 매핑
                            inspect_dir = os.path.join(base_dir, "nodes", "media_inspection")
                            os.makedirs(inspect_dir, exist_ok=True)
                            inspect_json = os.path.join(inspect_dir, "output.json")
                            inspect_data = {
                                "video_path": dest_path,
                                "status": "success",
                                "message": "사장님 수동 편집 완성본 영상 업로드 완료"
                            }
                            with open(inspect_json, "w", encoding="utf-8") as f:
                                json.dump(inspect_data, f, ensure_ascii=False, indent=2)
                            
                            self.send_response(200)
                            self.send_header("Content-Type", "application/json; charset=utf-8")
                            self.end_headers()
                            self.wfile.write(json.dumps({"success": True, "message": "최종 완성 영상(final_video.mp4)을 대시보드에 성공적으로 업로드 완료했습니다!"}, ensure_ascii=False).encode("utf-8"))
                            return
                
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Invalid multipart upload")
                return
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"Upload Failed: {e}".encode("utf-8"))
                return

        # POST 바디 데이터 파싱
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        body = {}
        if post_data:
            try:
                body = json.loads(post_data)
            except:
                pass

        # 0. 기획안 수동 승인 API
        if url.path == "/api/pipeline/approve":
            global approval_pending
            approval_pending = False
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "사장님 승인이 완료되었습니다. 자막 합성 및 유튜브 SEO 패키징(7단계) 단계를 재개합니다!"}, ensure_ascii=False).encode("utf-8"))
            return

        # 1. 인스펙터 편집기 입력 데이터 로컬 JSON 저장 API
        elif url.path == "/api/node/save":
            node_id = body.get("node_id")
            content = body.get("content")
            
            node = next((n for n in NODES_CONFIG if n["id"] == node_id), None)
            if not node or content is None:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Invalid Parameters")
                return
                
            file_path = os.path.join(base_dir, node["input_file"])
            try:
                # 안전한 상위 폴더 생성
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(content, f, ensure_ascii=False, indent=2)
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "message": "로컬 JSON 파일이 성공적으로 갱신되었습니다."}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"Save Failed: {e}".encode("utf-8"))
            return
            
        # 2. 특정 노드 단독 기동 실행 API
        elif url.path == "/api/node/run":
            node_id = body.get("node_id")
            node = next((n for n in NODES_CONFIG if n["id"] == node_id), None)
            if not node:
                self.send_error(404, "Node not found")
                return
                
            # 실행을 별도 스레드로 기동하여 요청 즉시 status 갱신
            def run_wrapper():
                run_single_node(node, base_dir)
                
            threading.Thread(target=run_wrapper).start()
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "노드 단독 기동이 성공적으로 호출되었습니다."}).encode("utf-8"))
            return
            
        elif url.path == "/api/pipeline/reset_nodes":
            node_ids = body.get("node_ids", [])
            for nid in node_ids:
                update_node_status(nid, "idle", "사용자 재기획 요청으로 대기 상태로 초기화되었습니다.")
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "지정한 노드 상태가 초기화되었습니다."}).encode("utf-8"))
            return
            
        elif url.path == "/api/pipeline/run":
            if pipeline_running:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Pipeline is already running.")
                return
                
            end_node_id = body.get("end_node_id") # 종료 제한 노드ID
            resume = body.get("resume", False)
            keywords = body.get("keywords")
            
            # keywords가 들어왔다면 1단계 노드 입력 파일인 sample_input.json 에 덮어씁니다.
            if keywords and isinstance(keywords, list):
                try:
                    input_file_path = os.path.join(base_dir, "nodes", "product_candidate_collection", "sample_input.json")
                    input_data = {}
                    if os.path.exists(input_file_path):
                        with open(input_file_path, "r", encoding="utf-8") as f:
                            input_data = json.load(f)
                    
                    input_data["keywords"] = keywords
                    if "limit" not in input_data:
                        input_data["limit"] = 3
                        
                    with open(input_file_path, "w", encoding="utf-8") as f:
                        json.dump(input_data, f, ensure_ascii=False, indent=2)
                    print(f"[*] [대시보드 백엔드] 1단계 입력 키워드를 동적으로 업데이트했습니다: {keywords}")
                except Exception as e:
                    print(f"[!] [대시보드 백엔드] 1단계 입력 파일 키워드 업데이트 실패: {e}")
            
            pipeline_stop_requested = False
            threading.Thread(target=run_entire_pipeline_thread, args=(base_dir, end_node_id, resume)).start()
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            msg = f"1번부터 '{end_node_id}' 노드까지 순차 기동이 시작되었습니다." if end_node_id else "전체 파이프라인 순차 기동이 시작되었습니다."
            if resume:
                msg = "파이프라인이 이어서 재생(재개)되었습니다."
            self.wfile.write(json.dumps({"success": True, "message": msg}, ensure_ascii=False).encode("utf-8"))
            return
            
        # 4. 파이프라인 구동 강제 정지 API
        elif url.path == "/api/pipeline/stop":
            pipeline_stop_requested = True
            
            # 현재 실행 중인 서브프로세스가 있다면 강제 종료
            if current_subprocess:
                try:
                    current_subprocess.terminate()
                    print("[*] [대시보드 백엔드] 실행 중인 노드 서브프로세스를 종료했습니다.")
                except Exception as e:
                    print(f"[!] [대시보드 백엔드] 서브프로세스 종료 오류: {e}")
                    
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "파이프라인 정지 명령이 발송되었습니다."}).encode("utf-8"))
            return
            
        # 5. 파이프라인 상태 리셋 API
        elif url.path == "/api/pipeline/reset":
            
            # 실행 중이면 중지 요청부터 수행
            pipeline_stop_requested = True
            if current_subprocess:
                try:
                    current_subprocess.terminate()
                except:
                    pass
            
            # 모든 노드 상태 초기화
            for node in NODES_CONFIG:
                node["status"] = "idle"
                node["log"] = ""
                
            pipeline_running = False
            pipeline_stop_requested = False
            current_subprocess = None
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "모든 노드 상태가 초기화(리셋)되었습니다."}).encode("utf-8"))
            return
            
        else:
            self.send_error(404, "Not Found")

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        
    port = 8080
    server_address = ('127.0.0.1', port)
    
    # 윈도우 환경 주소 바인딩 오류 방지
    HTTPServer.allow_reuse_address = True
    httpd = HTTPServer(server_address, DashboardRESTHandler)
    
    print("======================================================================")
    print(f"      🚀 쇼핑 쇼츠 자동화 n8n 스타일 로컬 웹 서버 구동 성공 (포트: {port}) ")
    print(f"         브라우저 주소창에 http://localhost:{port} 를 입력해 접속하세요. ")
    print("======================================================================")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] 서버 종료 요청이 수신되어 로컬 웹 서버를 중단합니다.")
        httpd.server_close()
        sys.exit(0)

if __name__ == "__main__":
    main()
