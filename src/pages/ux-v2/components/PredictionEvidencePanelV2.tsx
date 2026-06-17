import { useEffect, useState } from "react";
import { formatConfidenceScore, formatHabitatLabel } from "@/lib/formatters";
import type { DetectionSummary, PredictionSummary } from "@/types/report";

interface PredictionEvidencePanelV2Props {
	prediction: PredictionSummary;
	title?: string;
	imageUrl?: string;
	imageAlt?: string;
	showDetections?: boolean;
	compact?: boolean;
}

interface ImageSize {
	width: number;
	height: number;
}

function boxStyle(detection: DetectionSummary, imageSize: ImageSize) {
	if (detection.bboxNormalized && detection.bboxNormalized.length >= 4) {
		const [left = 0, top = 0, right = 0, bottom = 0] = detection.bboxNormalized;
		return {
			left: `${left * 100}%`,
			top: `${top * 100}%`,
			width: `${Math.max(right - left, 0) * 100}%`,
			height: `${Math.max(bottom - top, 0) * 100}%`,
		};
	}

	const [left = 0, top = 0, right = 0, bottom = 0] = detection.bbox;
	const widthBasis = detection.imageWidth ?? imageSize.width;
	const heightBasis = detection.imageHeight ?? imageSize.height;
	const width = Math.max(right - left, 0);
	const height = Math.max(bottom - top, 0);

	return {
		left: `${(left / widthBasis) * 100}%`,
		top: `${(top / heightBasis) * 100}%`,
		width: `${(width / widthBasis) * 100}%`,
		height: `${(height / heightBasis) * 100}%`,
	};
}

function detectionKey(detection: DetectionSummary) {
	return `${detection.rawLabel}-${detection.confidence}-${detection.bbox.join(":")}-${
		detection.bboxNormalized?.join(":") ?? "raw"
	}`;
}

export function PredictionEvidencePanelV2({
	prediction,
	imageUrl,
	imageAlt = "Evidence image with computer-vision detections",
	showDetections = false,
	compact = false,
}: PredictionEvidencePanelV2Props) {
	const [imageSize, setImageSize] = useState<ImageSize | null>(null);

	useEffect(() => {
		if (imageUrl !== undefined) {
			setImageSize(null);
		}
	}, [imageUrl]);

	const detections = prediction.detections ?? [];
	const validDetections = detections.filter(
		(detection) =>
			detection.bboxNormalized?.length === 4 || detection.bbox.length >= 4,
	);

	const bandColors: Record<string, string> = {
		low: "#f59e0b", // vibrant amber
		moderate: "#3b82f6", // vibrant blue
		high: "#10b981", // vibrant green
	};
	const activeColor = bandColors[prediction.confidenceBand] || "#6b7280";

	return (
		<section
			className={`prediction-evidence--premium${compact ? " compact" : ""}`}
		>
			{imageUrl ? (
				<div className="prediction-evidence__media-premium">
					<img
						src={imageUrl}
						alt={imageAlt}
						onLoad={(event) => {
							const image = event.currentTarget;
							setImageSize({
								width: image.naturalWidth,
								height: image.naturalHeight,
							});
						}}
					/>
					{showDetections && imageSize
						? validDetections.map((detection) => (
								<span
									key={detectionKey(detection)}
									className="prediction-evidence__box-premium"
									style={{
										...boxStyle(detection, imageSize),
										color: activeColor,
									}}
									title={`${formatHabitatLabel(detection.rawLabel)} ${formatConfidenceScore(detection.confidence)}`}
								>
									<span style={{ background: activeColor }}>
										{formatHabitatLabel(detection.rawLabel)}{" "}
										{formatConfidenceScore(detection.confidence)}
									</span>
								</span>
							))
						: null}
				</div>
			) : null}
		</section>
	);
}
