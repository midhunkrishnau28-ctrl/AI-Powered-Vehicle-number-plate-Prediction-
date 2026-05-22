import os
import cv2
from ultralytics import YOLO
try:
    from paddleocr import PaddleOCR
except ImportError:
    PaddleOCR = None

WEIGHTS = "runs/detect/runs/plate-detector2/weights/best.pt"
IMAGE_PATH = "uploads/b722fc22cbadbfe017e35cd82a200120-bi.jpeg"

def test():
    if not os.path.exists(WEIGHTS):
        print(f"ERROR: Weights not found at {WEIGHTS}")
        return

    print(f"Loading YOLO model from {WEIGHTS}...")
    model = YOLO(WEIGHTS)
    
    if not os.path.exists(IMAGE_PATH):
        print(f"ERROR: Image not found at {IMAGE_PATH}")
        return

    print(f"Running detection on {IMAGE_PATH}...")
    img = cv2.imread(IMAGE_PATH)
    results = model.predict(img, conf=0.25)
    
    if not results[0].boxes:
        print("No plate detected by YOLO.")
    else:
        for box in results[0].boxes:
            print(f"Detected box: {box.xyxy} conf: {box.conf}")
            
    if PaddleOCR:
        print("Initializing PaddleOCR...")
        ocr = PaddleOCR(use_angle_cls=False, lang="en", show_log=False)
        print("Running OCR...")
        # Just a simple test on the full image for now
        res = ocr.ocr(img)
        print(f"OCR result: {res}")
    else:
        print("PaddleOCR not available.")

if __name__ == "__main__":
    test()
