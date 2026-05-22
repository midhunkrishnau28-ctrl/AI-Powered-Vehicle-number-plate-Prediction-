import base64
import json
import urllib.request
import sys

def test_api():
    # create a dummy image (1x1 transparent png)
    img_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    
    url = "http://localhost:8003/predict"
    req_data = json.dumps({"imageBase64": f"data:image/png;base64,{img_b64}"}).encode('utf-8')
    
    req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read()
            print("Response:", res_data.decode('utf-8'))
    except Exception as e:
        print("Error:", e)

test_api()
