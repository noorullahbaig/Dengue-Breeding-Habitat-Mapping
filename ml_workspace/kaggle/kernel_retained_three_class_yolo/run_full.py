from train_retained_three_class_yolo import main


if __name__ == "__main__":
    import sys

    sys.argv = [
        "train_retained_three_class_yolo.py",
        "--run-name",
        "yolov8n_retained_three_class_v1",
        "--base-model",
        "yolov8n.pt",
        "--epochs",
        "100",
        "--patience",
        "20",
        "--imgsz",
        "640",
        "--batch",
        "16",
        "--seed",
        "42",
    ]
    main()
