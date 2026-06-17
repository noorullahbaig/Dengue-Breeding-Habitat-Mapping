from train_retained_three_class_yolo import main


if __name__ == "__main__":
    import sys

    sys.argv = [
        "train_retained_three_class_yolo.py",
        "--run-name",
        "smoke_retained_three_class",
        "--base-model",
        "yolov8n.pt",
        "--epochs",
        "1",
        "--patience",
        "1",
        "--imgsz",
        "640",
        "--batch",
        "16",
        "--seed",
        "42",
    ]
    main()
