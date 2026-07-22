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

print(f"Using API Key: {api_key[:15]}...")

url = "https://api.openai.com/v1/images/generations"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}"
}

# DALL-E 3, 1024x1024 규격으로 테스트
data = {
    "model": "dall-e-3",
    "prompt": "a simple tech desk setup, flat design icon, vector style",
    "n": 1,
    "size": "1024x1024"
}

req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")

try:
    with urllib.request.urlopen(req, timeout=30) as response:
        res = json.loads(response.read().decode("utf-8"))
        print("Success! Image URL:", res["data"][0]["url"])
except urllib.error.HTTPError as e:
    print(f"Error {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print("Error:", e)
