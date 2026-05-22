import base64
import itertools
import os
from typing import Optional, Tuple

import cv2
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from ultralytics import YOLO

# EasyOCR — works on Python 3.14, no GPU required
try:
    import easyocr
    _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    print("[ANPR] EasyOCR initialized successfully.")
except Exception as _e:
    _reader = None
    print(f"[ANPR] EasyOCR not available: {_e}")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def normalize_plate(s: str) -> str:
    s = (s or "").upper()
    return "".join(ch for ch in s if ("A" <= ch <= "Z") or ("0" <= ch <= "9"))


class PredictRequest(BaseModel):
    imageBase64: str  # raw base64 or data URL


class PredictResponse(BaseModel):
    plate: str
    score: float
    bbox: Optional[Tuple[int, int, int, int]] = None
    source: str
    candidates: Optional[list] = []


app = FastAPI(title="Kerala AI Police - ANPR Service")

WEIGHTS = os.environ.get("PLATE_DETECTOR_WEIGHTS", "")
detector = YOLO(WEIGHTS) if WEIGHTS else None
if not WEIGHTS:
    print("[ANPR] WARNING: PLATE_DETECTOR_WEIGHTS not set. Detector disabled.")


def decode_image(b64: str) -> np.ndarray:
    if "," in b64 and b64.strip().lower().startswith("data:"):
        b64 = b64.split(",", 1)[1]
    data = base64.b64decode(b64)
    arr = np.frombuffer(data, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def best_plate_bbox(img: np.ndarray) -> Optional[Tuple[int, int, int, int, float]]:
    if detector is None:
        raise RuntimeError("PLATE_DETECTOR_WEIGHTS not set; cannot run detector")

    for conf_thresh, iou_thresh in [(0.1, 0.45), (0.05, 0.3)]:
        res = detector.predict(img, conf=conf_thresh, iou=iou_thresh, verbose=False)[0]
        if res.boxes is not None and len(res.boxes) > 0:
            break
    else:
        print("[Detector] No boxes found.")
        return None

    boxes = res.boxes
    confs = boxes.conf.cpu().numpy()
    xyxy = boxes.xyxy.cpu().numpy().astype(int)
    idx = int(np.argmax(confs))
    x1, y1, x2, y2 = xyxy[idx].tolist()
    conf = float(confs[idx])

    h, w = img.shape[:2]
    pad_w = int((x2 - x1) * 0.10)
    pad_h = int((y2 - y1) * 0.10)
    x1 = max(0, x1 - pad_w)
    x2 = min(w - 1, x2 + pad_w)
    y1 = max(0, y1 - pad_h)
    y2 = min(h - 1, y2 + pad_h)

    if x2 <= x1 or y2 <= y1:
        return None

    return x1, y1, x2, y2, conf


def run_easyocr(img_bgr: np.ndarray):
    """Run EasyOCR on an image, return (plate_text, confidence)."""
    if _reader is None:
        return None, 0.0
    try:
        results = _reader.readtext(img_bgr, detail=1, paragraph=False)
        if not results:
            return None, 0.0
        texts, confs = [], []
        for (_bbox, text, conf) in results:
            if text and conf > 0.1:
                texts.append(text)
                confs.append(conf)
        plate = normalize_plate("".join(texts))
        score = float(np.mean(confs)) if confs else 0.0
        return plate, score
    except Exception as e:
        print(f"[EasyOCR] Error: {e}")
        return None, 0.0


def preprocess_for_ocr(crop: np.ndarray) -> np.ndarray:
    """Enhance license plate crop for better OCR."""
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    gray = cv2.bilateralFilter(gray, 7, 50, 50)
    gray = cv2.resize(gray, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return cv2.cvtColor(th, cv2.COLOR_GRAY2BGR)


def ocr_plate(crop: np.ndarray):
    """Run multiple OCR passes and return (best_plate, best_score, candidates_list)."""
    candidates_map: dict = {}

    def add(plate, score):
        if plate and plate not in ("Unknown", "LOCAL_OCR_REQUIRED", ""):
            candidates_map[plate] = max(candidates_map.get(plate, 0.0), score)

    if _reader is None:
        print("[OCR] EasyOCR not available — returning unknown")
        return "Unknown", 0.0, []

    # Pass 1: enhanced preprocessed image
    enhanced = preprocess_for_ocr(crop)
    p1, s1 = run_easyocr(enhanced)
    add(p1, s1)

    # Pass 2: raw crop
    p2, s2 = run_easyocr(crop)
    add(p2, s2)

    # Pass 3: negated image (handles dark-on-light plates)
    neg = cv2.bitwise_not(crop)
    p3, s3 = run_easyocr(neg)
    add(p3, s3)

    # Pass 4: grayscale upscaled
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    gray_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    p4, s4 = run_easyocr(gray_bgr)
    add(p4, s4)

    candidates = sorted(
        [{"plate": p, "score": s} for p, s in candidates_map.items()],
        key=lambda x: x["score"],
        reverse=True,
    )

    # Generate confusion-based permutations to enrich candidates to ≥5
    CONFUSIONS = {
        "8": ["B"], "B": ["8"],
        "0": ["O", "D"], "O": ["0", "D"], "D": ["0", "O"],
        "1": ["I", "T", "L"], "I": ["1", "T"], "T": ["1", "I"], "L": ["1"],
        "5": ["S"], "S": ["5"],
        "2": ["Z"], "Z": ["2"],
        "A": ["4"], "4": ["A"],
        "G": ["6", "C"], "6": ["G"], "C": ["G"],
        "P": ["R", "F"], "R": ["P"], "F": ["P"],
        "E": ["F"], "X": ["K"], "K": ["X"], "Q": ["O", "0"],
    }

    if len(candidates) > 0:
        base = candidates[0]["plate"]
        base_score = candidates[0]["score"]
        subs = [[ch] + CONFUSIONS.get(ch, []) for ch in base]
        penalty = 0.05
        for combo in itertools.product(*subs):
            alt = "".join(combo)
            if alt != base and alt not in candidates_map:
                candidates_map[alt] = max(0.01, base_score - penalty)
                penalty += 0.02
            if len(candidates_map) >= 8:
                break

        candidates = sorted(
            [{"plate": p, "score": s} for p, s in candidates_map.items()],
            key=lambda x: x["score"],
            reverse=True,
        )

    print(f"[OCR] Candidates found: {len(candidates)}")

    if not candidates:
        return "Unknown", 0.0, []

    best = candidates[0]
    return best["plate"], best["score"], candidates


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    img = decode_image(req.imageBase64)
    if img is None:
        return PredictResponse(plate="Unknown", score=0.0, bbox=None, source="service", candidates=[])

    bbox = best_plate_bbox(img)
    if bbox is None:
        return PredictResponse(plate="Unknown", score=0.0, bbox=None, source="service", candidates=[])

    x1, y1, x2, y2, det_conf = bbox
    crop = img[y1:y2, x1:x2]
    plate, ocr_conf, candidates = ocr_plate(crop)

    final = float(0.4 * det_conf + 0.6 * ocr_conf)

    final_candidates = [
        {"plate": c["plate"], "score": round(float(0.4 * det_conf + 0.6 * c["score"]), 4)}
        for c in candidates
    ]

    return PredictResponse(
        plate=plate,
        score=round(final, 4),
        bbox=(x1, y1, x2, y2),
        source="service",
        candidates=final_candidates,
    )
