import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
	detectionHabitatClass,
	formatHabitatLabel,
	formatHabitatPluralLabel,
} from "@/lib/formatters";
import type {
	DetectionSummary,
	PredictionSummary,
	TargetHabitatClass,
} from "@/types/report";

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

interface RecognizedDetection {
	detection: DetectionSummary;
	label: TargetHabitatClass;
}

interface DetectionGroup {
	label: TargetHabitatClass;
	count: number;
	strongestConfidence: number;
}

function recognizedDetection(detection: DetectionSummary): RecognizedDetection | null {
	const label = detection.label ?? detectionHabitatClass(detection.rawLabel);
	return label ? { detection, label } : null;
}

function groupDetections(
	detections: RecognizedDetection[],
	primaryLabel: PredictionSummary["label"],
) {
	const groups = new Map<TargetHabitatClass, DetectionGroup>();

	for (const { detection, label } of detections) {
		const current = groups.get(label);
		groups.set(label, {
			label,
			count: (current?.count ?? 0) + 1,
			strongestConfidence: Math.max(
				current?.strongestConfidence ?? Number.NEGATIVE_INFINITY,
				detection.confidence,
			),
		});
	}

	return [...groups.values()].sort((left, right) => {
		if (left.label === primaryLabel) return -1;
		if (right.label === primaryLabel) return 1;
		return (
			right.strongestConfidence - left.strongestConfidence ||
			left.label.localeCompare(right.label)
		);
	});
}

function primaryOutcomeHeading(
	label: TargetHabitatClass,
	count: number | undefined,
	isStrongerEvidence: boolean,
) {
	const singularLabel = formatHabitatLabel(label).toLowerCase();
	const evidenceQualifier = isStrongerEvidence ? "potential" : "possible";
	const subject =
		count && count > 1
			? `${count} ${evidenceQualifier} ${formatHabitatPluralLabel(label).toLowerCase()}`
			: `${evidenceQualifier} ${singularLabel}`;
	const heading = `${subject.charAt(0).toUpperCase()}${subject.slice(1)} detected.`;

	return isStrongerEvidence ? heading : `${heading} Review needed.`;
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
	const recognizedDetections = detections
		.map(recognizedDetection)
		.filter((detection): detection is RecognizedDetection => detection !== null);
	const primaryLabel =
		prediction.label === "unclassified" ? null : prediction.label;
	const hasTargetDetection = primaryLabel !== null;
	const visibleDetections = hasTargetDetection ? recognizedDetections : [];
	const validDetections = visibleDetections.filter(
		({ detection }) =>
			detection.bboxNormalized?.length === 4 || detection.bbox.length >= 4,
	);
	const hasInvalidDetections = validDetections.length !== visibleDetections.length;
	const detectionGroups = hasTargetDetection
		? groupDetections(recognizedDetections, primaryLabel)
		: [];
	const primaryGroup = detectionGroups.find(
		(group) => group.label === primaryLabel,
	);
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
	const outcomeHeading = hasTargetDetection
		? primaryOutcomeHeading(
				primaryLabel,
				primaryGroup?.count,
				outcome === "detected",
			)
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
							? validDetections.map(({ detection, label }) => (
									<span
										key={detectionKey(detection)}
										className="prediction-evidence__box"
										style={{
											...boxStyle(detection, imageSize),
										}}
										title={formatHabitatLabel(label)}
									>
										<span>{formatHabitatLabel(label)}</span>
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
				{detectionGroups.length > 0 ? (
					<section
						className="prediction-evidence__detection-summary"
						aria-label="Detection summary"
					>
						<div className="prediction-evidence__detection-summary-header">
							<span className="eyebrow">Detection summary</span>
							<span>{recognizedDetections.length} total</span>
						</div>
						<ul>
							{detectionGroups.map((group) => (
								<li key={group.label}>
									<span>{formatHabitatPluralLabel(group.label)}</span>
									<strong>{group.count}</strong>
								</li>
							))}
						</ul>
					</section>
				) : null}
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
