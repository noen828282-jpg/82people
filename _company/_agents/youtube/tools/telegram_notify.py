#!/usr/bin/env python3
"""Telegram Notify — small wrapper that sends a message to your Telegram bot.

Two modes:
  1. No CLI arg → sends a connectivity test ("✅ 텔레그램 연결 정상").
  2. With CLI arg(s) → sends those as the message body. Other tools can call
     this script to push their summaries.

telegram_v3 — Secretary's tools/telegram_setup.json is the canonical
UI-managed home (input via Skills ⚙️). Falls back to legacy config.md
and finally to youtube_account.json so older setups keep working."""

import sys
import os, json, time, re

# Windows 환경에서 유니코드(이모지 등) 출력 시 cp949 코덱 에러 방지
if sys.platform.startswith("win"):
    try:
        if hasattr(sys.stdout, "reconfigure"):
            getattr(sys.stdout, "reconfigure")(encoding="utf-8")
        if hasattr(sys.stderr, "reconfigure"):
            getattr(sys.stderr, "reconfigure")(encoding="utf-8")
    except AttributeError:
        import io
        stdout_buffer = getattr(sys.stdout, "buffer", None)
        stderr_buffer = getattr(sys.stderr, "buffer", None)
        if stdout_buffer:
            setattr(sys, "stdout", io.TextIOWrapper(stdout_buffer, encoding="utf-8"))
        if stderr_buffer:
            setattr(sys, "stderr", io.TextIOWrapper(stderr_buffer, encoding="utf-8"))

HERE = os.path.dirname(os.path.abspath(__file__))
ACCOUNT = os.path.join(HERE, "youtube_account.json")
# tools/ → youtube/ → _agents/ → brain root
BRAIN_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SECRETARY_TOOL_JSON = os.path.join(BRAIN_ROOT, "_agents", "secretary", "tools", "telegram_setup.json")
SECRETARY_CFG = os.path.join(BRAIN_ROOT, "_agents", "secretary", "config.md")

def _resolve_telegram():
    """Secretary tool JSON > Secretary legacy md > youtube_account.json."""
    token, chat = "", ""
    if os.path.exists(SECRETARY_TOOL_JSON):
        try:
            with open(SECRETARY_TOOL_JSON, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            token = (cfg.get("TELEGRAM_BOT_TOKEN") or "").strip()
            chat  = (cfg.get("TELEGRAM_CHAT_ID") or "").strip()
        except Exception:
            pass
    if (not token or not chat) and os.path.exists(SECRETARY_CFG):
        try:
            with open(SECRETARY_CFG, "r", encoding="utf-8") as f:
                txt = f.read()
            if not token:
                m = re.search(r"TELEGRAM_BOT_TOKEN\s*[:：=]\s*([A-Za-z0-9:_\-]+)", txt)
                if m: token = m.group(1).strip()
            if not chat:
                m = re.search(r"TELEGRAM_CHAT_ID\s*[:：=]\s*(-?\d+)", txt)
                if m: chat = m.group(1).strip()
        except Exception:
            pass
    if (not token or not chat) and os.path.exists(ACCOUNT):
        try:
            with open(ACCOUNT, "r", encoding="utf-8") as f:
                acct = json.load(f)
            if not token: token = (acct.get("TELEGRAM_BOT_TOKEN") or "").strip()
            if not chat:  chat  = (acct.get("TELEGRAM_CHAT_ID") or "").strip()
        except Exception:
            pass
    return token, chat

def clean_message(text):
    if not text:
        return ""
    # Remove thought block with various opening/closing tags
    text = re.sub(r'<(?:/)?(?:\|)?channel(?:\|)?>thought.*?</?channel(?:\|)?>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<\|channel\|?>thought.*?(?:<channel\|?>|</channel\|?>)', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<(?:/)?(?:\|)?channel(?:\|)?>thought.*', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = text.replace("<|channel>thought", "").replace("</channel>thought", "").replace("<channel>", "").replace("</channel>", "").replace("<|channel|>", "").replace("<channel|>", "")
    
    # Remove evaluation and next step lines
    text = re.sub(r'(?:📊\s*)?평가\s*:\s*[^\n]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'(?:📝\s*)?다음\s*단계\s*:\s*[^\n]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'자가검증:\s*사실\s*\d+개\s*/\s*추측\s*\d+개', '', text, flags=re.IGNORECASE)
    
    # Remove system status analysis blocks
    system_patterns = [
        r'현재\s*상황\s*분석:.*?(?=\n\n|\Z)',
        r'실행\s*계획:.*?(?=\n\n|\Z)',
        r'검토할\s*자료:.*?(?=\n\n|\Z)',
        r'실행:.*?(?=\n\n|\Z)',
        r'자가검증\s*프로토콜\s*적용:.*?(?=\n\n|\Z)',
        r'사용자는\s*현재\s*\'?📱\s*미향\'?\s*에이전트의\s*역할을\s*수행하고\s*있으며.*?(?=\n\n|\Z)'
    ]
    for pattern in system_patterns:
        text = re.sub(pattern, '', text, flags=re.DOTALL | re.IGNORECASE)

    # Clean intermediate status text from block
    text = re.sub(r'^[ \t]*(?:계획\s*수립\s*중|계획\s*수립|진행\s*중|대기)[ \t]*$', '', text, flags=re.MULTILINE | re.IGNORECASE)

    # Normalize newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def main():
    token, chat = _resolve_telegram()
    if not token or not chat:
        print("❌ TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID를 못 찾았어요.")
        print("   권장: 비서(Secretary) 클릭 → Skills → 📨 텔레그램 연결 ⚙️ → 폼에 입력")
        print("   봇 만들기: Telegram → @BotFather → /newbot")
        print("   chat_id: 봇에 메시지 1회 → https://api.telegram.org/bot<TOKEN>/getUpdates 에서 chat.id 확인")
        sys.exit(1)

    if len(sys.argv) > 1:
        body = " ".join(sys.argv[1:])
    else:
        body = f"✅ 텔레그램 연결 정상 — {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n비서(Secretary) 또는 YouTube 도구가 이 채널로 보고를 보낼 수 있습니다."

    is_test_msg = "텔레그램 연결 정상" in body
    body = clean_message(body)

    # If the message is empty or contains intermediate status text, skip sending
    skip_keywords = ["계획 수립", "계획수립", "진행중", "진행 중", "대기", "작업 시작", "작업 분배", "전달했어요", "전달 완료"]
    is_report = body.count("\n") > 5 and ("###" in body or "- " in body or "1." in body)
    
    should_skip = False
    matched_kw = ""
    if not is_test_msg:
        if not body.strip():
            should_skip = True
        else:
            for kw in skip_keywords:
                if kw in body:
                    if not is_report or len(body) < 200:
                        should_skip = True
                        matched_kw = kw
                        break

    if should_skip:
        print(f"ℹ️ Message filtered out (intermediate status or skip keyword '{matched_kw}' found). Skipping Telegram push.")
        sys.exit(0)

    try:
        import requests
    except ImportError:
        print("❌ pip install requests")
        sys.exit(1)
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat, "text": body, "parse_mode": "Markdown"},
            timeout=15,
        )
        r.raise_for_status()
        print(f"✅ 전송 OK ({len(body)}자)")
    except Exception as e:
        print(f"❌ 전송 실패: {e}")
        if "Bad Request" in str(e):
            print("   chat_id가 정확한지, 봇과 한 번이라도 대화를 시작했는지 확인하세요.")
        sys.exit(1)

if __name__ == "__main__":
    main()
