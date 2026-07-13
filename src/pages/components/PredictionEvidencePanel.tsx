import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
	formatDetectionLabel,
	formatHabitatLabel,
} from "@/lib/formatters";
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
	const [imageFailed, setImageFailed] = useState(false);

	useEffect(() => {
		if (imageUrl !== undefined) {
			setImageSize(null);
			setImageFailed(false);
		}
	}, [imageUrl]);

	const detections = prediction.detections ?? [];
	const validDetections = detections.filter(
		(detection) =>
			detection.bboxNormalized?.length === 4 || detection.bbox.length >= 4,
	);
	const hasInvalidDetections = validDetections.length !== detections.length;
	const resultLabel = formatHabitatLabel(prediction.label);
	const hasTargetDetection = prediction.label !== "unclassified" && validDetections.length > 0;
	const outcome = !hasTargetDetection
		? "not-detected"
		: prediction.confidenceBand === "high"
			? "detected"
			: "review";
	const outcomeLabel = outcome === "detected" ? "Detected" : outcome === "review" ? "Review needed" : "Not detected";
	const outcomeHeading = outcome === "detected"
		? `Potential ${resultLabel.toLowerCase()} detected.`
		: outcome === "review"
			? `Possible ${resultLabel.toLowerCase()}. Review needed.`
			: "No target habitat detected.";

	return (
		<section
			className={`prediction-evidence prediction-evidence--${outcome}${compact ? " prediction-evidence--compact" : ""}`}
			data-outcome={outcome}
			aria-label={title ?? "AI evidence analysis"}
		>
			{imageUrl ? (
				<div className="prediction-evidence__media">
					<div
						className={`prediction-evidence__media-frame${imageFailed ? " prediction-evidence__media-frame--failed" : ""}`}
						style={
							imageSize
								? ({
										"--prediction-media-ratio": `${imageSize.width} / ${imageSize.height}`,
									} as CSSProperties)
								: undefined
						}
					>
						<img
							src={imageUrl}
							alt={imageAlt}
							onLoad={(event) => {
								const image = event.currentTarget;
								setImageFailed(false);
								setImageSize({
									width: image.naturalWidth,
									height: image.naturalHeight,
								});
							}}
							onError={() => {
								setImageSize(null);
								setImageFailed(true);
							}}
						/>
						{showDetections && imageSize && !imageFailed
							? validDetections.map((detection) => (
									<span
										key={detectionKey(detection)}
										className="prediction-evidence__box"
										style={{
											...boxStyle(detection, imageSize),
										}}
																				 title={formatDetectionLabel(detection.rawLabel)}
										>
											<span>
												{formatDetectionLabel(detection.rawLabel)}
											</span>
									</span>
								))
							: null}
						{imageFailed ? (
							<div className="prediction-evidence__image-error" role="status" aria-live="polite">
								<strong>Photo preview unavailable</strong>
								<span>The image could not be loaded. You can still review the AI result below.</span>
							</div>
						) : null}
					</div>
				</div>
			) : null}
			<div className="prediction-evidence__body">
				<div className="prediction-evidence__header">
					<div>
									<span className="eyebrow">AI evidence review</span>
									<h2>{outcomeHeading}</h2>
								</div>
								<span className="prediction-evidence__status">{outcomeLabel}</span>
							</div>
				<p className="prediction-evidence__empty">
					{outcome === "detected" ? "The photo shows visual cues worth following up." : outcome === "review" ? "The result is uncertain. Please review the photo before taking action." : "No target habitat was identified in this photo."}
				</p>
				{hasInvalidDetections ? (
					<p className="prediction-evidence__warning" role="status">
						Some detections could not be displayed because their bounding boxes were invalid.
					</p>
				) : null}
				<p className="prediction-evidence__explain">{prediction.advisoryText} AI results are advisory.</p>
			</div>
		</section>
	);
}
