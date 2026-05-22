# ANPR (Number Plate) Trainable Model

This folder adds a **trainable AI model** for number-plate prediction:

- **Plate detection** (bounding box): YOLO (Ultralytics)
- **Plate text recognition**: PaddleOCR (pretrained) and can be fine-tuned later
- **Inference**: local FastAPI service that your Node server can call

> Reality check: there is no “perfect” model. Accuracy depends mostly on **dataset quality**, camera angle, blur, night/IR lighting, and Indian plate style variance. This pipeline is the standard way to get high accuracy.

## 1) Setup (Windows)

Create a venv and install:

```powershell
cd ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Install Paddle CPU:

```powershell
pip install paddlepaddle
```

## 2) Dataset (recommended)

You need a dataset with **license-plate bounding boxes**.

Good public datasets (plates vary by country; mix + add Indian/Kerala data if possible):
- CCPD (large, Chinese-style but good for detector pretrain)
- UFPR-ALPR (Brazil)
- AOLP (Taiwan)
- Any Roboflow “license plate” datasets with permissive licenses

### Best for your project (Kerala/India)

Create your own:
- Collect CCTV frames / mobile photos (day/night/rain/angles)
- Label **plate bounding boxes** using `labelImg` / Roboflow / CVAT
- Export to YOLO format:

```
dataset/
  images/train/*.jpg
  images/val/*.jpg
  labels/train/*.txt
  labels/val/*.txt
```

Each label file is:
`class x_center y_center width height` (normalized 0..1)

Use a dataset YAML like:

```yaml
path: C:/path/to/dataset
train: images/train
val: images/val
names:
  0: plate
```

## 3) Train plate detector

From `ml/`:

```powershell
python train_detector.py --data C:\path\to\dataset.yaml --epochs 80 --imgsz 960 --model yolov8n.pt
```

The best weights will be under `runs/detect/train/weights/best.pt`.

## 4) Run the local ANPR service (detector + OCR)

```powershell
python -m uvicorn service.app:app --host 127.0.0.1 --port 8001
```

Environment variables the service understands:
- `PLATE_DETECTOR_WEIGHTS` (default: `best.pt` path you trained)

## 5) Connect Node server to the trained model

In your root `.env` add:

```
ANPR_SERVICE_URL=http://127.0.0.1:8001/predict
```

Now the backend will use:
1) **Local trained model** (service) result first
2) If it fails, fall back to Gemini + local OCR hybrid

