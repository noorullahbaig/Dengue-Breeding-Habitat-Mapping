import { useEffect, useState } from "react";
import { formatConfidenceScore, formatHabitatLabel } from "@/lib/formatters";
import type { DetectionSummary, PredictionSummary } from "@/types/report";

interface PredictionEvidencePanelProps {
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

export function PredictionEvidencePanel({
	prediction,
	title,
	imageUrl,
	imageAlt = "Evidence image with computer-vision detections",
	showDetections = false,
	compact = false,
}: PredictionEvidencePanelProps) {
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

	return (
		<section
			className={`prediction-evidence prediction-evidence--${prediction.confidenceBand}${compact ? " prediction-evidence--compact" : ""}`}
			aria-label={title ?? "AI evidence analysis"}
		>
			{imageUrl ? (
				<div className="prediction-evidence__media">
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
									className="prediction-evidence__box"
									style={{
										...boxStyle(detection, imageSize),
									}}
									title={`${formatHabitatLabel(detection.rawLabel)} ${formatConfidenceScore(detection.confidence)}`}
								>
									<span>
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
