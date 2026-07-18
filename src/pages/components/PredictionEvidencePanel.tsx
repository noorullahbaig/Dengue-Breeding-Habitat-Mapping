import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { formatDetectionLabel, formatHabitatLabel } from "@/lib/formatters";
import type { DetectionSummary, PredictionSummary } from "@/types/report";

interface PredictionEvidencePanelProps {
	prediction: PredictionSummary;
	decision?:
		| { kind: "stack"; reference: string }
		| { kind: "separate" };
	title?: string;
	imageUrl?: string;
	imageUnavailable?: boolean;
	imageAlt?: string;
	showDetections?: boolean;
	compact?: boolean;
	isAnalyzing?: boolean;
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
	decision,
	title,
	imageUrl,
	imageUnavailable = false,
	imageAlt = "Evidence image with computer-vision detections",
	showDetections = false,
	compact = false,
	isAnalyzing = false,
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
	const hasTargetDetection =
		prediction.label !== "unclassified" && validDetections.length > 0;
	const outcome = !hasTargetDetection
		? "not-detected"
		: prediction.confidenceBand === "high"
			? "detected"
			: "review";
	const outcomeLabel =
		outcome === "detected"
			? "Detected"
			: outcome === "review"
				? "Review needed"
				: "Not detected";
	const outcomeHeading =
		outcome === "detected"
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
			{imageUrl || imageUnavailable ? (
				<div className="prediction-evidence__media">
					<div
						className={`prediction-evidence__media-frame${imageFailed || imageUnavailable ? " prediction-evidence__media-frame--failed" : ""}${imageSize ? " prediction-evidence__media-frame--measured" : ""}${isAnalyzing ? " prediction-evidence__media-frame--analyzing" : ""}`}
						style={
							imageSize
								? ({
										aspectRatio: `${imageSize.width} / ${imageSize.height}`,
									} as CSSProperties)
								: undefined
						}
					>
						{imageUrl ? <img
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
						/> : null}
						{isAnalyzing ? (
							<div
								className="prediction-evidence__scan-state"
								role="status"
								aria-live="polite"
							>
								<strong>Analyzing evidence</strong>
								<span>Looking for habitat cues in the photo</span>
							</div>
						) : null}
						{showDetections && imageSize && !imageFailed && !isAnalyzing
							? validDetections.map((detection) => (
									<span
										key={detectionKey(detection)}
										className="prediction-evidence__box"
										style={{
											...boxStyle(detection, imageSize),
										}}
										title={formatDetectionLabel(detection.rawLabel)}
									>
										<span>{formatDetectionLabel(detection.rawLabel)}</span>
									</span>
								))
							: null}
						{imageFailed || imageUnavailable ? (
							<div
								className="prediction-evidence__image-error"
								role="status"
								aria-live="polite"
							>
								<strong>Photo preview unavailable</strong>
								<span>
									The image could not be loaded. You can still review the AI
									result below.
								</span>
							</div>
						) : null}
						{!isAnalyzing && !imageFailed ? (
							<div className="prediction-evidence__result-rail">
								<div>
									<span className="eyebrow">AI evidence</span>
									<h2>{outcomeHeading}</h2>
								</div>
								<span className="prediction-evidence__status">
									{outcomeLabel}
								</span>
							</div>
						) : null}
					</div>
				</div>
			) : null}
			<div className="prediction-evidence__body">
				{!imageUrl ? (
					<div className="prediction-evidence__result-rail prediction-evidence__result-rail--standalone">
						<div>
							<span className="eyebrow">AI evidence</span>
							<h2>{outcomeHeading}</h2>
						</div>
						<span className="prediction-evidence__status">{outcomeLabel}</span>
					</div>
				) : null}
				{decision ? (
					<div
						className={`prediction-evidence__decision prediction-evidence__decision--${decision.kind}`}
						data-decision={decision.kind}
					>
						<div className="prediction-evidence__decision-copy">
							<span className="eyebrow">Report path</span>
							<strong>
								{decision.kind === "stack"
									? "Added to nearby report"
									: "Separate report selected"}
							</strong>
							<span>
								{decision.kind === "stack"
									? `This photo will be added to ${decision.reference}.`
									: "This photo will be submitted as a new report."}
							</span>
						</div>
						<span className="prediction-evidence__decision-status">
							{decision.kind === "stack" ? decision.reference : "Ready"}
						</span>
					</div>
				) : null}
				<p className="prediction-evidence__empty">
					{outcome === "detected"
						? "The photo shows visual cues worth following up."
						: outcome === "review"
							? "The result is uncertain. Please review the photo before taking action."
							: "No target habitat was identified in this photo."}
				</p>
				{hasInvalidDetections ? (
					<p className="prediction-evidence__warning" role="status">
						Some detections could not be displayed because their bounding boxes
						were invalid.
					</p>
				) : null}
				<p className="prediction-evidence__explain">
					{prediction.advisoryText} AI results are advisory.
				</p>
			</div>
		</section>
	);
}
