import base64
import requests
import sys
import os

def test_inference(image_path):
    if not os.path.exists(image_path):
        print(f"Error: File {image_path} not found.")
        return

    with open(image_path, "rb") as f:
        img_base64 = base64.b64encode(f.read()).decode("utf-8")

    url = "http://localhost:8001/predict"
    payload = {"imageBase64": img_base64}

    try:
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code == 200:
            result = response.json()
            print("\n--- Prediction Results ---")
            print(f"Plate: {result.get('plate')}")
            print(f"Score: {result.get('score', 0):.4f}")
            print(f"Source: {result.get('source')}")
            print(f"BBox: {result.get('bbox')}")
        else:
            print(f"Error: Service returned status {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Connection Error: {e}")
        print("Make sure the ML service is running (python ml/service/app.py)")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ml/test_inference.py <path_to_image>")
    else:
        test_inference(sys.argv[1])
