import {
	useState,
	useEffect,
	useRef,
	type ChangeEvent,
	type UIEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { LocateFixed } from "lucide-react";
import { Notice, Surface, Button, MetaLabel } from "@/components/ui";
import { useAuth } from "@/app/useAuth";
import { useReportDraft } from "@/app/useReportDraft";
import { useServices } from "@/app/useServices";
import { useMobileViewport } from "@/app/useMobileViewport";
import { LocationPermissionGate } from "@/features/report/LocationPermissionGate";
import { LocationReviewMap } from "@/pages/components/LocationReviewMap";
import { MobileLocationConfirmation } from "@/pages/components/MobileLocationConfirmation";
import { LowConfidenceWarningSheet } from "@/pages/components/LowConfidenceWarningSheet";
import { NearbyReportPrompt } from "@/pages/components/NearbyReportPrompt";
import { PredictionEvidencePanel } from "@/pages/components/PredictionEvidencePanel";
import { ReportWizardChrome } from "@/pages/components/ReportWizardChrome";
import { StaticReceiptMap } from "@/pages/components/StaticReceiptMap";
import {
	canOpenReportStep,
	getReportStepBlockedReason,
	isReportStepComplete,
	reportSteps,
} from "@/pages/reportWizard";
import { PUBLIC_REPORT_CONSENT_TEXT, KL_CENTER } from "@/lib/constants";
import { storePendingReportClaim } from "@/lib/pendingReportClaim";
import { formatCoordinate, formatTimestamp } from "@/lib/formatters";
import {
	MAX_DETECTED_ACCURACY_METERS,
	allowedCorrectionRadiusMeters,
	distanceMetersBetween,
	hasTrustedDetectedLocation,
	isWithinAllowedCorrectionRadius,
} from "@/lib/locationTrust";
import { isWithinServiceArea, SERVICE_AREA_ERROR } from "@/lib/serviceArea";
import { AppApiError } from "@/services/apiServices";
import {
	stopCameraStream,
	captureFrameAsFile,
	readFileAsDataUrl,
} from "@/lib/camera";
import type {
	LocationPoint,
	NearbyReportCandidate,
} from "@/types/report";
import { useReportPrecheck } from "@/pages/useReportPrecheck";

function locationSignature(location?: LocationPoint | null) {
	return location
		? `${location.latitude.toFixed(5)}:${location.longitude.toFixed(5)}`
		: "";
}

function precheckFailureCopy(error: AppApiError) {
	switch (error.kind) {
		case "timeout":
			return {
				title: "The AI check took too long.",
				helper: "Retry the check, or choose a clearer, smaller photo before submitting.",
			};
		case "network":
			return {
				title: "Could not reach the backend API server.",
				helper:
					"Submission stays blocked until the API can be reached and returns an advisory result. If the backend is already running, check for a network issue or CORS mismatch.",
			};
		case "model_not_ready":
			return {
				title: "Backend is reachable, but the detection model is not ready.",
				helper:
					"Submission stays blocked until the backend model finishes loading and returns an advisory result.",
			};
		case "model_processing_failed":
			return {
				title:
					"Backend is reachable, but the uploaded image could not be processed by the model.",
				helper:
					"Retry the pre-check or try a clearer image before submitting the report.",
			};
		default:
			return {
				title:
					error.detail ||
					error.message ||
					"The backend returned an unexpected error during AI pre-check.",
				helper:
					"Submission stays blocked until the API returns a valid advisory result.",
			};
	}
}

interface ReportPageProps {
	onRequestClose?: () => void;
	isOverlay?: boolean;
}

export function ReportPage({
	onRequestClose,
	isOverlay = false,
}: ReportPageProps = {}) {
	const navigate = useNavigate();
	const { reportsService } = useServices();
	const {
		draft,
		resetDraft,
		setLastSubmittedReference,
		updateDraft,
	} = useReportDraft();
	const { isAuthenticated } = useAuth();
	const stepHeadingRef = useRef<HTMLHeadingElement>(null);
	const consentBodyRef = useRef<HTMLDivElement>(null);
	const consentAdvanceTimerRef = useRef<number | null>(null);
	const [currentStep, setCurrentStep] = useState(() =>
		Math.min(Math.max(draft.wizardStep ?? 0, 0), reportSteps.length - 1),
	);
	const [hasConfirmedPin, setHasConfirmedPin] = useState(
		draft.hasConfirmedPin ?? false,
	);
	const [hasPublicConsent, setHasPublicConsent] = useState(
		draft.hasPublicConsent ?? false,
	);
	const [hasScrolledConsentToEnd, setHasScrolledConsentToEnd] = useState(false);
	const [pinWarning, setPinWarning] = useState("");
	const [precheckSignature, setPrecheckSignature] = useState("");
	const [nearbyCandidates, setNearbyCandidates] = useState<
		NearbyReportCandidate[]
	>([]);
	const [isNearbyPromptOpen, setIsNearbyPromptOpen] = useState(false);
	const [selectedStackReference, setSelectedStackReference] = useState("");
	const [decisionLocationSignature, setDecisionLocationSignature] =
		useState("");
	const [submitError, setSubmitError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [locationRequestError, setLocationRequestError] = useState("");
	const [isLowConfirmOpen, setIsLowConfirmOpen] = useState(false);

	const isMobile = useMobileViewport();

	// Live camera stream state (Desktop only) — owned by CameraPermissionGate on desktop,
	// but we keep a ref here so captureFrameAsFile can access the video element.
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [isCameraBusy, setIsCameraBusy] = useState(false);
	const [cameraError, setCameraError] = useState("");
	const videoRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		if (stream) {
			video.srcObject = stream;
			void video.play().catch(() => {});
			return;
		}
		video.srcObject = null;
	}, [stream]);

	useEffect(() => {
		return () => {
			stopCameraStream(stream);
		};
	}, [stream]);

	const guideLocation = draft.detectedLocation;
	const finalLocation = draft.correctedLocation;
	const mapLocation =
		finalLocation ??
		(guideLocation && isWithinServiceArea(guideLocation)
			? guideLocation
			: KL_CENTER);
	const finalLocationIsInServiceArea = finalLocation
		? isWithinServiceArea(finalLocation)
		: false;
	const hasTrustedGuideLocation = hasTrustedDetectedLocation(guideLocation);
	const allowedCorrectionRadius = allowedCorrectionRadiusMeters(
		guideLocation?.accuracyMeters,
	);
	const selectedLocationDistanceMeters =
		guideLocation && finalLocation
			? distanceMetersBetween(guideLocation, finalLocation)
			: null;
	const finalLocationWithinAllowedRadius = isWithinAllowedCorrectionRadius(
		guideLocation,
		finalLocation,
	);
	const photoReady = Boolean(
		draft.photoFile && draft.photoPreviewUrl && draft.photoEvidence,
	);
	const pinReady = Boolean(
		finalLocation &&
			finalLocationIsInServiceArea &&
			hasTrustedGuideLocation &&
			finalLocationWithinAllowedRadius &&
			hasConfirmedPin,
	);
	const detailsReady = hasPublicConsent;
	const activeLocationSignature = locationSignature(finalLocation);
	const activePrecheckSignature =
		photoReady && finalLocation
			? `${draft.capturedAt ?? ""}:${draft.photoEvidence?.name ?? ""}:${
					draft.photoEvidence?.size ?? 0
				}:${activeLocationSignature}`
			: "";
	const precheckRequest = useReportPrecheck({
		enabled:
			currentStep >= 3 &&
			photoReady &&
			pinReady &&
			Boolean(finalLocation) &&
			Boolean(activePrecheckSignature) &&
			precheckSignature !== activePrecheckSignature,
		requestKey: activePrecheckSignature,
		draft,
		correctedLocation: finalLocation ?? KL_CENTER,
		reportsService,
	});
	const precheck = precheckRequest.precheck;
	const isPrecheckLoading = precheckRequest.isLoading;
	const precheckError = precheckRequest.error;
	const precheckReady = Boolean(
		precheck && precheckSignature === activePrecheckSignature,
	);
	const inferenceViewState = precheckReady
		? "success"
		: isPrecheckLoading
			? "loading"
			: precheckError
				? "error"
				: "idle";
	const isLowAiConfidence =
		precheckReady &&
		precheck !== null &&
		precheck.prediction.confidenceBand === "low";
	const selectedStack = nearbyCandidates.find(
		(candidate) => candidate.reference === selectedStackReference,
	);
	const precheckImageUrl = precheck?.imageUrl ?? draft.photoPreviewUrl;
	const precheckPrediction = precheck?.prediction ?? {
		label: "unclassified" as const,
		confidence: null,
		confidenceBand: "low" as const,
		advisoryText: "",
		detections: [],
	};
	const needsStackDecision =
		nearbyCandidates.length > 0 &&
		decisionLocationSignature !== activeLocationSignature;
	const hasChosenSeparateReport =
		nearbyCandidates.length > 0 &&
		decisionLocationSignature === activeLocationSignature &&
		!selectedStackReference;

	useEffect(() => {
		if (currentStep === 3 && precheckReady && needsStackDecision) {
			setIsNearbyPromptOpen(true);
		}
	}, [currentStep, needsStackDecision, precheckReady]);

	useEffect(() => {
		if (
			precheckRequest.status === "success" &&
			precheck &&
			activePrecheckSignature &&
			precheckSignature !== activePrecheckSignature
		) {
			setPrecheckSignature(activePrecheckSignature);
			setNearbyCandidates(precheck.candidates);
		}

		if (precheckRequest.error?.kind === "stale_file") {
			alert(precheckRequest.error.message);
			updateDraft({
				photoFile: null,
				photoPreviewUrl: "",
				photoEvidence: undefined,
			});
			setCurrentStep(0);
			setPrecheckSignature("");
		}
	}, [
		activePrecheckSignature,
		precheck,
		precheckRequest.error,
		precheckRequest.status,
		precheckSignature,
		updateDraft,
	]);
	const isMobileLocationStep = isMobile && currentStep === 1;
	const isMobileConsentStep = isMobile && currentStep === 2;
	const stepState = {
		photoReady,
		pinReady,
		detailsReady,
		precheckReady,
		needsStackDecision,
	};

	useEffect(() => {
		if (precheckSignature && precheckSignature !== activePrecheckSignature) {
			setNearbyCandidates([]);
			setSelectedStackReference("");
			setDecisionLocationSignature("");
		}
	}, [activePrecheckSignature, precheckSignature]);

	useEffect(() => {
		const heading = stepHeadingRef.current;
		if (heading?.textContent === reportSteps[currentStep]?.title) {
			heading.focus({ preventScroll: true });
		}
	}, [currentStep]);

	useEffect(() => {
		if (draft.wizardStep !== currentStep) {
			updateDraft({ wizardStep: currentStep });
		}
	}, [currentStep, draft.wizardStep, updateDraft]);

	useEffect(() => {
		if (!isMobileConsentStep) {
			if (consentAdvanceTimerRef.current !== null) {
				window.clearTimeout(consentAdvanceTimerRef.current);
				consentAdvanceTimerRef.current = null;
			}
			return;
		}

		setHasScrolledConsentToEnd(draft.hasPublicConsent ?? false);

		const consentBody = consentBodyRef.current;
		if (consentBody) {
			consentBody.scrollTop = 0;
			// Auto-unlock if text doesn't overflow
			window.setTimeout(() => {
				if (consentBody.scrollHeight <= consentBody.clientHeight + 12) {
					setHasScrolledConsentToEnd(true);
				}
			}, 50);
		}
	}, [isMobileConsentStep, draft.hasPublicConsent]);

	useEffect(() => {
		return () => {
			if (consentAdvanceTimerRef.current !== null) {
				window.clearTimeout(consentAdvanceTimerRef.current);
			}
		};
	}, []);

	function retryPrecheck() {
		setNearbyCandidates([]);
		setSelectedStackReference("");
		setDecisionLocationSignature("");
		setPrecheckSignature("");
		precheckRequest.retry();
	}

	function goToStep(nextStep: number) {
		if (canOpenStep(nextStep)) {
			setCurrentStep(nextStep);
		}
	}

	function handleBack() {
		if (currentStep > 0) {
			setCurrentStep(currentStep - 1);
		}
	}

	function handleClose() {
		if (onRequestClose) {
			onRequestClose();
			return;
		}
		navigate("/");
	}

	function canOpenStep(stepIndex: number) {
		return canOpenReportStep(stepIndex, stepState);
	}

	function stepBlockedReason(stepIndex: number) {
		return getReportStepBlockedReason(stepIndex, stepState);
	}

	// Camera Handlers

	async function handleLiveCamera() {
		setIsCameraBusy(true);
		setCameraError("");
		try {
			const mediaStream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "environment" },
			});
			setStream(mediaStream);
		} catch (err) {
			setCameraError(
				err instanceof Error
					? err.message
					: "Camera permission denied or unavailable.",
			);
		} finally {
			setIsCameraBusy(false);
		}
	}

	async function handleCaptureFrame() {
		if (!videoRef.current) return;
		setIsCameraBusy(true);
		setCameraError("");
		try {
			const file = await captureFrameAsFile(videoRef.current);
			const nextPreview = await readFileAsDataUrl(file);
			handlePhotoReady(file, nextPreview);
		} catch (captureError) {
			setCameraError(
				captureError instanceof Error
					? captureError.message
					: "Frame capture failed.",
			);
		} finally {
			setIsCameraBusy(false);
		}
	}

	async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;
		setIsCameraBusy(true);
		setCameraError("");
		try {
			const nextPreview = await readFileAsDataUrl(file);
			handlePhotoReady(file, nextPreview);
		} catch (fileError) {
			setCameraError(
				fileError instanceof Error
					? fileError.message
					: "Image processing failed.",
			);
		} finally {
			setIsCameraBusy(false);
		}
	}

	function handlePhotoReady(file: File, previewUrl: string) {
		updateDraft({
			photoFile: file,
			photoPreviewUrl: previewUrl,
			photoEvidence: {
				name: file.name,
				mimeType: file.type,
				size: file.size,
			},
			capturedAt: new Date().toISOString(),
		});
		setPrecheckSignature("");
		stopCameraStream(stream);
		setStream(null);
	}

	function handleGuideLocation(location: LocationPoint) {
		const isInside = isWithinServiceArea(location);
		updateDraft({
			detectedLocation: location,
			correctedLocation: isInside ? location : null,
		});
		setHasConfirmedPin(false);
		updateDraft({ hasConfirmedPin: false });
		setLocationRequestError("");
		setPinWarning(isInside ? "" : SERVICE_AREA_ERROR);
		setPrecheckSignature("");
	}

	function handlePinMove(location: LocationPoint) {
		if (!isWithinServiceArea(location) && !isMobileLocationStep) {
			setHasConfirmedPin(false);
			setPinWarning(SERVICE_AREA_ERROR);
			return;
		}
		updateDraft({ correctedLocation: location });
		setHasConfirmedPin(false);
		updateDraft({ hasConfirmedPin: false });
		setPinWarning(isWithinServiceArea(location) ? "" : SERVICE_AREA_ERROR);
		setPrecheckSignature("");
	}

	function handleConfirmPin() {
		if (
			!guideLocation ||
			!hasTrustedGuideLocation ||
			!allowedCorrectionRadius
		) {
			setPinWarning(
				`Use a precise device location before continuing. Accuracy must be ${MAX_DETECTED_ACCURACY_METERS}m or better.`,
			);
			return;
		}
		if (!finalLocation || !finalLocationIsInServiceArea) {
			setPinWarning(SERVICE_AREA_ERROR);
			return;
		}
		if (!finalLocationWithinAllowedRadius) {
			setPinWarning(
				`Move the map back inside the ${Math.round(allowedCorrectionRadius)}m correction area.`,
			);
			return;
		}
		setPinWarning("");
		setHasConfirmedPin(true);
		updateDraft({ hasConfirmedPin: true, wizardStep: 2 });
		setCurrentStep(2);
	}

	function handleConsentScroll(event: UIEvent<HTMLElement>) {
		const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
		if (scrollTop + clientHeight >= scrollHeight - 12) {
			setHasScrolledConsentToEnd(true);
		}
	}

	function handleConsentChange(nextChecked: boolean) {
		setHasPublicConsent(nextChecked);
		updateDraft({ hasPublicConsent: nextChecked });

		if (nextChecked && isMobileConsentStep && hasScrolledConsentToEnd) {
			if (consentAdvanceTimerRef.current !== null) {
				window.clearTimeout(consentAdvanceTimerRef.current);
			}
			consentAdvanceTimerRef.current = window.setTimeout(() => {
				setCurrentStep(3);
			}, 140);
		}
	}

	// NOTE: Auto-fire on step mount is intentionally removed.
	// LocationPermissionGate now owns the initial location fetch and
	// only calls the geolocation API after permission is confirmed.

	async function handleSubmit() {
		if (
			!guideLocation ||
			!hasTrustedGuideLocation ||
			!allowedCorrectionRadius
		) {
			setSubmitError(
				`A verified device location within ${MAX_DETECTED_ACCURACY_METERS}m accuracy is required before submission.`,
			);
			setCurrentStep(1);
			return;
		}
		if (
			!finalLocation ||
			!finalLocationIsInServiceArea ||
			!finalLocationWithinAllowedRadius
		) {
			setSubmitError(SERVICE_AREA_ERROR);
			setCurrentStep(1);
			return;
		}
		if (!hasPublicConsent) {
			setSubmitError("You must confirm public consent to submit the report.");
			setCurrentStep(2);
			return;
		}
		if (!precheckReady) {
			setSubmitError("Run the computer-vision precheck before submitting.");
			setCurrentStep(3);
			return;
		}
		if (needsStackDecision) {
			setIsNearbyPromptOpen(true);
			return;
		}

		setIsSubmitting(true);
		setSubmitError("");

		try {
			const submitted = await reportsService.createReport(
				{
					...draft,
					correctedLocation: finalLocation,
				},
				{
					stackParentReference: selectedStackReference || undefined,
					publicConsentAccepted: hasPublicConsent,
					publicConsentText: PUBLIC_REPORT_CONSENT_TEXT,
				},
			);
			setLastSubmittedReference(submitted.reference);
			if (submitted.claimToken) {
				storePendingReportClaim(submitted.reference, submitted.claimToken);
			}
			navigate(`/report/success?ref=${submitted.reference}`);
		} catch (error) {
			if (error instanceof AppApiError && error.kind === "stale_file") {
				alert(error.message);
				updateDraft({
					photoFile: null,
					photoPreviewUrl: "",
					photoEvidence: undefined,
				});
				setCurrentStep(0);
				setSubmitError("");
				setIsSubmitting(false);
				return;
			}

			setSubmitError(
				error instanceof Error
					? error.message
					: "The report could not be submitted.",
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	function handleStackDecision(reference: string) {
		setSelectedStackReference(reference);
		setDecisionLocationSignature(activeLocationSignature);
		setIsNearbyPromptOpen(false);
	}

	function handleSeparateDecision() {
		setSelectedStackReference("");
		setDecisionLocationSignature(activeLocationSignature);
		setIsNearbyPromptOpen(false);
	}

	function handleLowConfidenceConfirm(note: string) {
		updateDraft({ notes: note });
		setIsLowConfirmOpen(false);
		setCurrentStep(4);
	}

	function handleLowConfidenceRetake() {
		setIsLowConfirmOpen(false);
		resetDraft();
		setCurrentStep(0);
		setHasConfirmedPin(false);
		setHasPublicConsent(false);
		setHasScrolledConsentToEnd(false);
		setPinWarning("");
		setLocationRequestError("");
		setPrecheckSignature("");
		setNearbyCandidates([]);
		setIsNearbyPromptOpen(false);
		setSelectedStackReference("");
		setDecisionLocationSignature("");
		setSubmitError("");
		setIsSubmitting(false);
	}

	function handleContinueFromAiReview() {
		if (isLowAiConfidence) {
			setIsLowConfirmOpen(true);
		} else {
			setCurrentStep(4);
		}
	}

	function stepIsComplete(stepIndex: number) {
		return isReportStepComplete(stepIndex, stepState);
	}

	const mobileLocationStatus = (() => {
		if (locationRequestError) {
			return locationRequestError;
		}

		if (!guideLocation) {
			return "Use your device location to verify this exact site.";
		}

		if (!isWithinServiceArea(guideLocation)) {
			return "Your device location is outside Kuala Lumpur.";
		}

		if (!hasTrustedGuideLocation || !allowedCorrectionRadius) {
			const measuredAccuracy =
				typeof guideLocation.accuracyMeters === "number"
					? `${Math.round(guideLocation.accuracyMeters)}m`
					: "unknown";
			return `Device location is too broad (${measuredAccuracy}). Retry for ${MAX_DETECTED_ACCURACY_METERS}m accuracy or better.`;
		}

		if (!finalLocation) {
			return "Move the map until the pin sits on the exact site.";
		}

		if (!finalLocationIsInServiceArea) {
			return "Move the map back inside Kuala Lumpur.";
		}

		if (!finalLocationWithinAllowedRadius) {
			return `Move the map back inside the ${Math.round(allowedCorrectionRadius)}m correction area.`;
		}

		if (
			selectedLocationDistanceMeters !== null &&
			selectedLocationDistanceMeters < 1
		) {
			return "At your device location.";
		}

		return `Within ${Math.max(1, Math.round(selectedLocationDistanceMeters ?? 0))}m of your device location.`;
	})();
	const mobileLocationStatusTone =
		finalLocation &&
		finalLocationIsInServiceArea &&
		hasTrustedGuideLocation &&
		finalLocationWithinAllowedRadius &&
		!locationRequestError
			? "valid"
			: pinWarning || locationRequestError
				? "warning"
				: "default";

	return (
		<div
			className={`page page--report-v2${isOverlay ? " page--report-overlay" : ""}`}
		>
			<ReportWizardChrome
				currentStep={currentStep}
				steps={reportSteps}
				titleRef={stepHeadingRef}
				onBack={handleBack}
				onClose={isOverlay ? handleClose : undefined}
				onStepSelect={goToStep}
				canOpenStep={canOpenStep}
				getStepBlockedReason={stepBlockedReason}
				isStepComplete={stepIsComplete}
			/>

			{/* Slide workspace */}
			<div className="report-slides-window">
				<div
					className="report-slides-container"
					style={{ transform: `translateX(-${currentStep * 20}%)` }}
				>
					{/* Slide 0: Photo */}
					<div className="report-slide">
						{currentStep === 0 && (
							<div className="report-slide__content">
								{isMobile ? (
									// MOBILE ONLY REDESIGNED PHOTO FLOW
									<div className="report-photo-stage">
										{draft.photoPreviewUrl ? (
											<Surface className="premium-upload-card">
												<div
													style={{
														flex: 1,
														display: "flex",
														flexDirection: "column",
														alignItems: "center",
														justifyContent: "center",
														width: "100%",
													}}
												>
													<div
														className="report-photo-stage__preview"
														style={{
															width: "100%",
															display: "flex",
															justifyContent: "center",
															padding: 0,
														}}
													>
														<img
															src={draft.photoPreviewUrl}
															alt="Captured preview"
															className="report-photo-stage__image"
														/>
													</div>
												</div>
												{cameraError ? (
													<div style={{ padding: "0 1.25rem 1rem" }}>
														<Notice tone="warning">{cameraError}</Notice>
													</div>
												) : null}
												<div className="premium-upload-card__actions">
													<button
														type="button"
														className="premium-upload-btn premium-upload-btn--camera"
														onClick={() => setCurrentStep(1)}
													>
														Use photo &amp; continue
													</button>
													<label className="premium-upload-btn premium-upload-btn--camera">
														<span>Retake photo</span>
														<input
															type="file"
															accept="image/*"
															capture="environment"
															aria-label="Retake photo"
															className="u-static-5790ffba"
															onClick={(e) => {
																e.currentTarget.value = "";
															}}
															onChange={handleFileSelection}
														/>
													</label>
												</div>
											</Surface>
										) : (
											<Surface className="premium-upload-card">
												<div
													style={{
														flex: 1,
														display: "flex",
														flexDirection: "column",
														alignItems: "center",
														justifyContent: "center",
														gap: "1.25rem",
														width: "100%",
													}}
												>
													<div className="premium-upload-card__icon-wrapper">
														<svg
															aria-hidden="true"
															className="premium-upload-card__icon"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															strokeWidth="2"
															strokeLinecap="round"
															strokeLinejoin="round"
														>
															<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
															<circle cx="12" cy="13" r="4" />
														</svg>
													</div>
													<div className="premium-upload-card__info">
														<h3 className="premium-upload-card__title">
															Capture Breeding Habitat
														</h3>
														<p className="premium-upload-card__subtitle">
															A close, well-lit photo helps classification.
															Focus on the object and its water-holding area.
														</p>
													</div>
												</div>
												{cameraError ? (
													<div style={{ padding: "0 1.25rem 1rem" }}>
														<Notice tone="warning">{cameraError}</Notice>
													</div>
												) : null}
												<div className="premium-upload-card__actions">
													<label className="premium-upload-btn premium-upload-btn--camera">
														<svg
															aria-hidden="true"
															className="btn-icon"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															strokeWidth="2.5"
															strokeLinecap="round"
															strokeLinejoin="round"
														>
															<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
															<circle cx="12" cy="13" r="4" />
														</svg>
														<span>Open Camera</span>
														<input
															type="file"
															accept="image/*"
															capture="environment"
															className="u-static-5790ffba"
															onClick={(e) => {
																e.currentTarget.value = "";
															}}
															onChange={handleFileSelection}
														/>
													</label>
												</div>
											</Surface>
										)}
									</div>
								) : (
									// DESKTOP CAMERA FLOW
									<div className="report-step-layout">
										<div className="stack-md">
											<Surface className="u-static-1a5debf7">
												<div className="cluster-row">
													<Button
														variant="secondary"
														onClick={handleLiveCamera}
														disabled={isCameraBusy}
													>
														Use webcam
													</Button>
													{stream ? (
														<>
															<Button
																variant="primary"
																onClick={handleCaptureFrame}
																disabled={isCameraBusy}
															>
																Capture frame
															</Button>
															<Button
																variant="ghost"
																onClick={() => {
																	stopCameraStream(stream);
																	setStream(null);
																}}
															>
																Stop camera
															</Button>
														</>
													) : null}
												</div>

												{cameraError ? (
													<Notice tone="warning">{cameraError}</Notice>
												) : null}

												<div className="camera-preview u-static-4dcb0817">
													{stream ? (
														<video
															ref={videoRef}
															className="camera-preview__media"
															autoPlay
															muted
															playsInline
														/>
													) : draft.photoPreviewUrl ? (
														<img
															src={draft.photoPreviewUrl}
															alt="Evidence selected"
															className="camera-preview__media u-static-71c35c12"
														/>
													) : (
														<div className="camera-preview__placeholder">
															<p>
																Capture a clear photo of the suspected habitat.
															</p>
															<p>
																Focus on the container or drain opening, not
																people or house numbers.
															</p>
														</div>
													)}
												</div>
											</Surface>
										</div>

										<div className="stack-md">
											<Notice>
												A close, well-lit photo helps classification.
												Low-confidence model results will not block submission.
											</Notice>
											<Surface className="u-static-20a69043">
												<MetaLabel>Guidance</MetaLabel>
												<h2>Show the object and its water-holding area.</h2>
												<p>
													Tires, drain inlets, buckets, and containers are most
													useful when the image includes enough surrounding
													context for people to recognize and locate the site.
												</p>
											</Surface>
											{draft.photoPreviewUrl && (
												<div className="report-slide__actions u-static-ac0d4af5">
													<Button
														variant="primary"
														className="u-static-16000cc0"
														onClick={() => setCurrentStep(1)}
													>
														Use photo &amp; continue
													</Button>
													<label className="ui-button ui-button--secondary u-static-5bdb4176">
														<span>Retake photo</span>
														<input
															className="upload-tile__input"
															type="file"
															accept="image/*"
															aria-label="Retake photo"
															onChange={handleFileSelection}
														/>
													</label>
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
					{/* Slide 1: Location — wrapped in LocationPermissionGate */}
					<div className="report-slide report-slide--map">
						{currentStep === 1 && (
							<LocationPermissionGate onLocationObtained={handleGuideLocation}>
								{({
									isLocating: gateIsLocating,
									onRetryLocation,
									locationError,
								}) =>
									isMobile ? (
										<>
											<div className="report-slide__content report-location-stage">
												<div className="report-location-stage__surface">
													<LocationReviewMap
														location={mapLocation}
														detectedLocation={guideLocation}
														allowedRadiusMeters={allowedCorrectionRadius}
														selectionMode="fixed-center"
														onLocationChange={handlePinMove}
													/>
													<div className="report-location-map-control report-location-map-control--locate">
														<button
															type="button"
															className="report-location-map-control__button"
															disabled={gateIsLocating}
															onClick={onRetryLocation}
															aria-label="Use current location again"
															aria-busy={gateIsLocating}
															title={
																gateIsLocating
																	? "Refreshing location"
																	: "Use current location again"
															}
														>
															<LocateFixed
																aria-hidden="true"
																size={19}
																strokeWidth={2.25}
																className={
																	gateIsLocating
																		? "report-location-map-control__icon--spinning"
																		: ""
																}
															/>
														</button>
													</div>
												</div>
											</div>

											{locationError ? (
												<Notice tone="warning">{locationError}</Notice>
											) : null}

											<MobileLocationConfirmation
												status={pinWarning || mobileLocationStatus}
												tone={mobileLocationStatusTone}
												disabled={
													!finalLocation ||
													!finalLocationIsInServiceArea ||
													!hasTrustedGuideLocation ||
													!finalLocationWithinAllowedRadius ||
													gateIsLocating
												}
												onConfirm={handleConfirmPin}
											/>
										</>
									) : null
								}
							</LocationPermissionGate>
						)}
					</div>
					{/* Slide 2: Details & Consent */}
					<div
						className={`report-slide${isMobileConsentStep ? " report-slide--consent-mobile" : ""}`}
					>
						{currentStep === 2 &&
							(isMobileConsentStep ? (
								<div className="report-slide__content report-consent-stage">
									<div className="report-consent-stage__surface">
										<Surface className="report-consent-panel report-consent-panel--immersive">
											<MetaLabel>Privacy policy</MetaLabel>
											<section
												ref={consentBodyRef}
												className="report-consent-panel__body"
												aria-label="Public consent text"
												onScroll={handleConsentScroll}
											>
												<p>{PUBLIC_REPORT_CONSENT_TEXT}</p>
												<p>
													This prototype publishes the exact pin, photo, and AI
													evidence together so residents can review the same
													report context.
												</p>
												<p>
													Read to the end, then accept to move on to the AI
													review.
												</p>
												<label
													className={`report-consent-panel__accept${
														!hasScrolledConsentToEnd
															? " report-consent-panel__accept--locked"
															: ""
													}`}
												>
													<input
														type="checkbox"
														checked={hasPublicConsent}
														disabled={!hasScrolledConsentToEnd}
														onChange={(event) =>
															handleConsentChange(event.target.checked)
														}
													/>
													<span>
														{hasScrolledConsentToEnd
															? "I accept this public consent."
															: "Scroll to the end to unlock acceptance."}
													</span>
												</label>
											</section>
										</Surface>
									</div>
								</div>
							) : (
								<div className="report-step-layout">
									<div className="stack-md">
										<Surface className="report-consent-panel">
											<MetaLabel>Privacy policy</MetaLabel>
											<section
												className="report-consent-panel__body"
												aria-label="Public consent text"
											>
												<p>{PUBLIC_REPORT_CONSENT_TEXT}</p>
												<p>
													This prototype publishes the exact pin, photo, and AI
													evidence together so residents can review the same
													report context.
												</p>
												<p>
													You can only continue after you accept this consent.
												</p>
											</section>
										</Surface>
									</div>

									<div className="stack-md">
										<Surface className="u-static-dbb32598">
											<label className="report-consent-panel__accept u-static-2a0ca835">
												<input
													type="checkbox"
													checked={hasPublicConsent}
													onChange={(event) =>
														handleConsentChange(event.target.checked)
													}
												/>
												<span className="u-static-21a1be8a">
													I accept this public consent.
												</span>
											</label>
										</Surface>
										<div className="report-slide__actions report-consent-desktop-actions u-static-ac0d4af5">
											<Button
												variant="primary"
												className="u-static-16000cc0"
												disabled={!hasPublicConsent}
												onClick={() => setCurrentStep(3)}
											>
												Continue to AI review
											</Button>
										</div>
									</div>
								</div>
							))}
					</div>

					{/* Slide 3: AI Review & Stacking */}
					<div className="report-slide">
						{currentStep === 3 && (
							<div
								className="report-slide__content"
								data-inference-state={inferenceViewState}
							>
								{precheckError ? (
									<div
										className="precheck-recovery u-static-1a5debf7"
										aria-live="polite"
									>
										<Notice tone="warning">
											<strong>
												{precheckFailureCopy(precheckError).title}
											</strong>{" "}
											{precheckFailureCopy(precheckError).helper}
										</Notice>
										{import.meta.env.DEV ? (
											<Surface className="u-static-46348766">
												<span className="detail-grid__label">
													Dev diagnostics
												</span>
												<span className="caption-text">
													API base URL:{" "}
													{precheckError.apiBaseUrl ?? "Unavailable"}
												</span>
												<span className="caption-text">
													Failure path:{" "}
													{precheckError.transport === "network"
														? "transport"
														: "http"}
												</span>
												{precheckError.status ? (
													<span className="caption-text">
														HTTP status: {precheckError.status}
													</span>
												) : null}
												{precheckError.health ? (
													<span className="caption-text">
														Health: database{" "}
														{precheckError.health.database ? "ready" : "down"},
														model{" "}
														{precheckError.health.model ? "ready" : "down"},
														postgis{" "}
														{precheckError.health.postgis ? "ready" : "down"}
													</span>
												) : precheckError.kind === "network" ? (
													<span className="caption-text">
														Health probe did not reach the backend.
													</span>
												) : null}
											</Surface>
										) : null}
										<Button variant="secondary" onClick={retryPrecheck}>
											Retry backend pre-check
										</Button>
									</div>
								) : null}

								{precheckImageUrl &&
								(isPrecheckLoading || (precheckReady && precheck)) ? (
									<PredictionEvidencePanel
										prediction={precheckPrediction}
										title="AI pre-check result"
										imageUrl={precheckImageUrl}
										imageAlt="Submitted evidence preview"
										showDetections
										isAnalyzing={isPrecheckLoading}
									/>
								) : null}

								{selectedStack ? (
									<Notice tone="success">
										✓ Photo will be stacked onto existing report{" "}
										{selectedStack.reference}.
									</Notice>
								) : null}
								{hasChosenSeparateReport ? (
									<Notice tone="success">
										✓ You chose to file a separate report for this nearby
										location.
									</Notice>
								) : null}

								<div className="stack-sm report-ai-actions">
									<Button
										variant="primary"
										className="u-static-16000cc0"
										disabled={!precheckReady || needsStackDecision}
										onClick={handleContinueFromAiReview}
										fullWidth
									>
										Continue to submit
									</Button>
								</div>
							</div>
						)}
					</div>

					{/* Slide 4: Submit */}
					<div className="report-slide">
						{currentStep === 4 && (
							<div className="report-slide__content">
								<div className="report-step-layout">
									<div className="stack-md">
										{precheck ? (
											<PredictionEvidencePanel
												prediction={precheck.prediction}
												title="Captured evidence photo"
												imageUrl={precheckImageUrl}
												compact
												showDetections
											/>
										) : null}
									</div>

									<Surface className="report-submit-panel stack-md">
										<div>
											<MetaLabel>Submission summary</MetaLabel>
											<h2>Final confirmation</h2>
										</div>

										{finalLocation ? (
											<StaticReceiptMap location={finalLocation} />
										) : null}

										<div className="detail-grid">
											<div>
												<MetaLabel>Captured timestamp</MetaLabel>
												<strong>
													{draft.capturedAt
														? formatTimestamp(draft.capturedAt)
														: "Now"}
												</strong>
											</div>
											<div>
												<MetaLabel>Latitude</MetaLabel>
												<strong>
													{finalLocation
														? formatCoordinate(finalLocation.latitude)
														: "Missing"}
												</strong>
											</div>
											<div>
												<MetaLabel>Longitude</MetaLabel>
												<strong>
													{finalLocation
														? formatCoordinate(finalLocation.longitude)
														: "Missing"}
												</strong>
											</div>
										</div>

										{submitError ? (
											<Notice tone="warning">{submitError}</Notice>
										) : null}

										<div className="stack-sm report-submit-actions">
											<Button
												variant="primary"
												disabled={isSubmitting}
												onClick={handleSubmit}
												fullWidth
											>
												{isSubmitting
													? "Submitting..."
													: selectedStackReference
														? "Submit Stacked Report"
														: "Submit Report"}
											</Button>
											<p className="caption-text report-submit-helper">
												{isAuthenticated
													? "This report will be linked to your account automatically."
													: "After submitting, you'll receive a Tracking ID. Sign in on the next screen to save this to your account."}
											</p>
										</div>
									</Surface>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Bottom Action Bar spacing placeholder (actual buttons are inside slides) */}

			{/* Modal matching details */}
			{isNearbyPromptOpen && precheckReady ? (
				<NearbyReportPrompt
					presentation={isOverlay ? "popup" : "dialog"}
					candidates={nearbyCandidates}
					onStack={handleStackDecision}
					onCreateSeparate={handleSeparateDecision}
				/>
			) : null}

			{/* Low AI confidence warning sheet */}
			{isLowConfirmOpen ? (
				<LowConfidenceWarningSheet
					onConfirm={handleLowConfidenceConfirm}
					onCancel={() => setIsLowConfirmOpen(false)}
					onRetake={handleLowConfidenceRetake}
				/>
			) : null}
		</div>
	);
}
