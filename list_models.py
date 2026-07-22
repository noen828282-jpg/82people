import os
import json
import urllib.request
import urllib.error

# 부모 .env에서 API 키 가져오기
api_key = ""
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.isfile(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip().startswith("OPENAI_API_KEY="):
                api_key = line.strip().split("=", 1)[1].strip().strip("'\"")

if not api_key:
    print("API Key not found in .env")
    exit(1)

url = "https://api.openai.com/v1/models"
headers = {
    "Authorization": f"Bearer {api_key}"
}

req = urllib.request.Request(url, headers=headers, method="GET")

try:
    with urllib.request.urlopen(req, timeout=30) as response:
        res = json.loads(response.read().decode("utf-8"))
        models = [m["id"] for m in res["data"]]
        models.sort()
        
        print("--- Available Models ---")
        for m in models:
            if "dall" in m or "gpt" in m or "image" in m:
                print(f" - {m}")
        print("------------------------")
        
except urllib.error.HTTPError as e:
    print(f"Error {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print("Error:", e)
