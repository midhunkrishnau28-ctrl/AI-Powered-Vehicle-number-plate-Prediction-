import argparse
from ultralytics import YOLO


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="Path to YOLO dataset YAML")
    ap.add_argument("--model", default="yolov8s.pt", help="Base model checkpoint (s/m/l)")
    ap.add_argument("--epochs", type=int, default=100)
    ap.add_argument("--imgsz", type=int, default=960)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--device", default=None, help="cuda / 0 / cpu")
    args = ap.parse_args()

    model = YOLO(args.model)
    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        project="runs",
        name="plate-detector",
        patience=20,
        verbose=True,
        # Accuracy improvements:
        mosaic=1.0,      # Better for small objects
        mixup=0.1,       # Improves robustness
        augment=True,    # Enable online augmentation
        degrees=10.0,    # Rotation for angled plates
        scale=0.5,       # Scale augmentation
    )


if __name__ == "__main__":
    main()

