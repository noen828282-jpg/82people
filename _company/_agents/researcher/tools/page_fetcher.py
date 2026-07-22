#!/usr/bin/env python3
"""Webpage Content Fetcher Tool for Researcher Agent.
Usage:
    python page_fetcher.py "https://example.com"
"""
import os
import sys
import json
import urllib.request
import re
import html
from datetime import datetime

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
CONFIG_PATH = os.path.join(HERE, "page_fetcher.json")
OUTPUT_PATH = os.path.join(HERE, "page_fetcher_content.txt")

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def fetch_url(url):
    print(f"📡 Fetching webpage content: {url}...", file=sys.stderr)
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    try:
        raw_html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
        
        # Strip script and style tags
        raw_html = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', raw_html, flags=re.I)
        raw_html = re.sub(r'<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>', '', raw_html, flags=re.I)
        
        # Strip comments
        raw_html = re.sub(r'<!--.*?-->', '', raw_html, flags=re.DOTALL)
        
        # Replace other tags with space
        raw_text = re.sub(r'<[^>]+>', ' ', raw_html)
        
        # Unescape HTML entities
        text = html.unescape(raw_text)
        
        # Clean up whitespaces and empty lines
        lines = [line.strip() for line in text.split('\n')]
        non_empty = [line for line in lines if line]
        
        cleaned_text = '\n'.join(non_empty)
        return cleaned_text
    except Exception as e:
        return f"Error fetching webpage: {e}"

def main():
    url = ""
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        cfg = load_config()
        url = cfg.get("URL", "")

    if not url:
        print("⚠️ No URL provided. Please pass a URL as an argument or set URL in page_fetcher.json.")
        sys.exit(1)

    content = fetch_url(url)
    
    # Format and cap text content length
    header = f"--- Content of {url} (Fetched at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}) ---\n"
    capped_content = content[:8000]
    if len(content) > 8000:
        capped_content += "\n\n...[Content truncated to 8000 characters to prevent prompt bloat]..."
        
    full_output = header + capped_content
    print(full_output)
    
    # Save output to file as well
    try:
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            f.write(full_output)
    except Exception:
        pass

if __name__ == "__main__":
    main()
