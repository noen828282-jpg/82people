#!/usr/bin/env python3
"""Image Generator for Designer Agent via Hugging Face Inference API.
Usage:
    python image_generator.py --prompt "scenic educational theme, gold and navy, high resolution" --output "cover.png"
"""

import os
import sys
import argparse
import urllib.request
import urllib.parse
import json
import re

# Windows 환경에서 유니코드 출력 코덱 에러 방지
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
# designer/ tools/ -> designer/ -> config.md
CONFIG_MD = os.path.abspath(os.path.join(HERE, "..", "config.md"))
# 또는 editor/config.md 에 토큰이 있을 수 있으므로 탐색
EDITOR_CONFIG_MD = os.path.abspath(os.path.join(HERE, "..", "..", "editor", "config.md"))

def _resolve_hf_token():
    token = ""
    # 1. designer/config.md 에서 토큰 파싱
    if os.path.exists(CONFIG_MD):
        try:
            with open(CONFIG_MD, "r", encoding="utf-8") as f:
                txt = f.read()
            m = re.search(r"HUGGING_FACE_HUB_TOKEN\s*[:：=]\s*(hf_[A-Za-z0-9_\-]+)", txt)
            if m: token = m.group(1).strip()
        except Exception:
            pass
            
    # 2. editor/config.md 에서 토큰 파싱 (비서/루나와 토큰 공유)
    if not token and os.path.exists(EDITOR_CONFIG_MD):
        try:
            with open(EDITOR_CONFIG_MD, "r", encoding="utf-8") as f:
                txt = f.read()
            m = re.search(r"HUGGING_FACE_HUB_TOKEN\s*[:：=]\s*(hf_[A-Za-z0-9_\-]+)", txt)
            if m: token = m.group(1).strip()
        except Exception:
            pass
            
    # 3. 환경 변수에서 읽기
    if not token:
        token = os.environ.get("HUGGING_FACE_HUB_TOKEN", "")
        
    return token

def generate_image_hf(prompt, token, model_id="black-forest-labs/FLUX.1-schnell"):
    api_url = f"https://api-inference.huggingface.co/models/{model_id}"
    print(f"🎨 Sending request to Hugging Face model '{model_id}'...", file=sys.stderr)
    print(f"💬 Prompt: '{prompt}'", file=sys.stderr)

    headers = {
        "Content-Type": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        print("ℹ️ Hugging Face Access Token detected and attached.", file=sys.stderr)
    else:
        print("⚠️ Warning: No HF Token found. Using public rate-limit route.", file=sys.stderr)

    payload = {
        "inputs": prompt,
    }
    
    req = urllib.request.Request(
        api_url, 
        data=json.dumps(payload).encode('utf-8'), 
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            image_data = response.read()
            return image_data, None
    except Exception as e:
        error_msg = str(e)
        if hasattr(e, "read"):
            try:
                error_msg += f" - {e.read().decode('utf-8')}"
            except Exception:
                pass
        return None, error_msg

def main():
    parser = argparse.ArgumentParser(description="AI Image Generator for Designer")
    parser.add_argument("--prompt", required=True, help="Text description of the image")
    parser.add_argument("--output", required=True, help="Output image file path (e.g. cover.png)")
    parser.add_argument("--model", default="black-forest-labs/FLUX.1-schnell", help="HuggingFace model ID")
    args = parser.parse_args()

    token = _resolve_hf_token()
    
    # 디렉토리 생성
    out_dir = os.path.dirname(os.path.abspath(args.output))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    img_data, err = generate_image_hf(args.prompt, token, args.model)
    
    if err:
        print(f"❌ 이미지 생성 실패: {err}")
        # Gated Model 에러인 경우에 대한 안내
        if "gated" in err.lower() or "authorization" in err.lower() or "401" in err:
            print("💡 HuggingFace Access Token이 비어있거나, 해당 모델에 대한 동의(gated access approval)가 필요합니다.")
            print("   해결방법: https://huggingface.co/ 에서 'Request Access'를 클릭하고 승인을 받거나,")
            print("   무료 퍼블릭 모델인 'stabilityai/stable-diffusion-xl-base-1.0' 으로 모델을 변경해 다시 시도하세요.")
        sys.exit(1)

    try:
        with open(args.output, "wb") as f:
            f.write(img_data)
        print(f"✅ 이미지 생성 및 저장 완료: {args.output}")
    except Exception as e:
        print(f"❌ 파일 저장 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
