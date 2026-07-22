#!/usr/bin/env python3
"""DuckDuckGo Web Search Tool for Researcher Agent.
Usage:
    python web_search.py "search query"
"""
import os
import sys
import json
import urllib.request
import urllib.parse
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
CONFIG_PATH = os.path.join(HERE, "web_search.json")
OUTPUT_PATH = os.path.join(HERE, "web_search_results.md")

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def search_ddg(query):
    print(f"🔍 Searching DuckDuckGo for: '{query}'...", file=sys.stderr)
    data = urllib.parse.urlencode({'q': query}).encode()
    req = urllib.request.Request(
        'https://lite.duckduckgo.com/lite/',
        data=data,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    try:
        html_content = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
        
        results = []
        lines = html_content.split('\n')
        for idx, line in enumerate(lines):
            if "class='result-link'" in line:
                match = re.search(r'href="([^"]+)"[^>]* class=\'result-link\'>(.*?)</a>', line)
                if match:
                    url = match.group(1)
                    title = html.unescape(re.sub(r'<[^>]+>', '', match.group(2)))
                    
                    # Look for the snippet which follows a few lines later
                    snippet = ""
                    for offset in range(1, 20):
                        if idx + offset < len(lines):
                            next_line = lines[idx+offset]
                            if "class='result-snippet'" in next_line:
                                raw_snippet = lines[idx+offset+1].strip()
                                snippet = html.unescape(re.sub(r'<[^>]+>', '', raw_snippet))
                                break
                    results.append({
                        'title': title,
                        'url': url,
                        'snippet': snippet
                    })
        return results
    except Exception as e:
        print(f"Error fetching search results: {e}", file=sys.stderr)
        return []

def main():
    query = ""
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    else:
        cfg = load_config()
        query = cfg.get("QUERY", "")

    if not query:
        print("⚠️ No search query provided. Using default fallback query: '글로벌 비즈니스 트렌드'")
        query = "글로벌 비즈니스 트렌드"
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump({"QUERY": "글로벌 비즈니스 트렌드"}, f, indent=2, ensure_ascii=False)
            print(f"ℹ️ Created default web_search.json with fallback QUERY.")
        except Exception as e:
            print(f"Failed to create web_search.json: {e}", file=sys.stderr)

    results = search_ddg(query)
    
    if not results:
        print(f"❌ No search results found for query: '{query}'")
        sys.exit(1)

    # Format output as Markdown
    md_lines = []
    md_lines.append(f"# 🔍 Web Search Results for: '{query}'")
    md_lines.append(f"_Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_\n")
    
    for idx, r in enumerate(results[:8]):
        md_lines.append(f"### {idx+1}. {r['title']}")
        md_lines.append(f"- **URL**: {r['url']}")
        md_lines.append(f"- **Description**: {r['snippet']}\n")
    
    report = "\n".join(md_lines)
    print(report)
    
    # Save output to file as well
    try:
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            f.write(report)
    except Exception:
        pass

if __name__ == "__main__":
    main()
