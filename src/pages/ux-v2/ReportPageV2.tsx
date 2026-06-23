import {
	useEffect,
	useRef,
	useState,
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
import { LocationCapturePanel } from "@/features/report/LocationCapturePanel";
import { LocationReviewMapV2 } from "@/pages/ux-v2/components/LocationReviewMapV2";
import { MobileLocationConfirmation } from "@/pages/ux-v2/components/MobileLocationConfirmation";
import { NearbyReportPromptV2 } from "@/pages/ux-v2/components/NearbyReportPromptV2";
import { PredictionEvidencePanelV2 } from "@/pages/ux-v2/components/PredictionEvidencePanelV2";
import { ReportWizardChrome } from "@/pages/ux-v2/components/ReportWizardChrome";
import { StaticReceiptMap } from "@/pages/ux-v2/components/StaticReceiptMap";
import {
	canOpenReportStep,
	getReportStepBlockedReason,
	isReportStepComplete,
	reportSteps,
} from "@/pages/ux-v2/reportWizard";
import { PUBLIC_REPORT_CONSENT_TEXT, KL_CENTER } from "@/lib/constants";
import { formatCoordinate, formatTimestamp } from "@/lib/formatters";
import {
	getGeolocationFallbackMessage,
	requestCurrentPosition,
} from "@/lib/geolocation";
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
	requestCameraStream,
	stopCameraStream,
	captureFrameAsFile,
	readFileAsDataUrl,
} from "@/lib/camera";
import type {
	LocationPoint,
	NearbyReportCandidate,
	ReportPrecheck,
} from "@/types/report";

function locationSignature(location?: LocationPoint | null) {
	return location
		? `${location.latitude.toFixed(5)}:${location.longitude.toFixed(5)}`
		: "";
}

function precheckFailureCopy(error: AppApiError) {
	switch (error.kind) {
		case "network":
			return {
				title:
					"Could not reach the local backend. Start or reconnect the API server at localhost:8000.",
				helper:
					"Submission stays blocked until the API can be reached and returns an advisory result. If the backend is already running, check for a CORS mismatch between this frontend origin and backend CORS_ORIGINS.",
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

interface ReportPageV2Props {
	onRequestClose?: () => void;
	isOverlay?: boolean;
}

export function ReportPageV2({
	onRequestClose,
	isOverlay = false,
}: ReportPageV2Props = {}) {
	const navigate = useNavigate();
	const { reportsService } = useServices();
	const { draft, setLastSubmittedReference, updateDraft } = useReportDraft();
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
	const [precheck, setPrecheck] = useState<ReportPrecheck | null>(null);
	const [precheckSignature, setPrecheckSignature] = useState("");
	const [isPrecheckLoading, setIsPrecheckLoading] = useState(false);
	const [precheckError, setPrecheckError] = useState<AppApiError | null>(null);
	const [nearbyCandidates, setNearbyCandidates] = useState<
		NearbyReportCandidate[]
	>([]);
	const [isNearbyPromptOpen, setIsNearbyPromptOpen] = useState(false);
	const [selectedStackReference, setSelectedStackReference] = useState("");
	const [decisionLocationSignature, setDecisionLocationSignature] =
		useState("");
	const [submitError, setSubmitError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLocating, setIsLocating] = useState(false);
	const [locationRequestError, setLocationRequestError] = useState("");

	const isMobile = useMobileViewport();

	// Live camera stream state (Desktop only)
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [cameraError, setCameraError] = useState("");
	const [isCameraBusy, setIsCameraBusy] = useState(false);
	const videoRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		if (stream) {
			video.srcObject = stream;
			void video.play().catch(() => {
				setCameraError(
					"The live preview could not start. Use the file selector instead.",
				);
			});
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
	const precheckReady = Boolean(
		precheck && precheckSignature === activePrecheckSignature,
	);
	const selectedStack = nearbyCandidates.find(
		(candidate) => candidate.reference === selectedStackReference,
	);
	const precheckImageUrl = precheck?.imageUrl ?? draft.photoPreviewUrl;
	const needsStackDecision =
		nearbyCandidates.length > 0 &&
		decisionLocationSignature !== activeLocationSignature;
	const hasChosenSeparateReport =
		nearbyCandidates.length > 0 &&
		decisionLocationSignature === activeLocationSignature &&
		!selectedStackReference;
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
			setPrecheck(null);
			setPrecheckError(null);
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

		if (consentAdvanceTimerRef.current !== null) {
			window.clearTimeout(consentAdvanceTimerRef.current);
			consentAdvanceTimerRef.current = null;
		}
		setHasScrolledConsentToEnd(draft.hasPublicConsent ?? false);

		const consentBody = consentBodyRef.current;
		if (consentBody) {
			consentBody.scrollTop = 0;
		}
		return () => {
			if (consentAdvanceTimerRef.current !== null) {
				window.clearTimeout(consentAdvanceTimerRef.current);
				consentAdvanceTimerRef.current = null;
			}
		};
	}, [draft.hasPublicConsent, isMobileConsentStep]);

	useEffect(() => {
		return () => {
			if (consentAdvanceTimerRef.current !== null) {
				window.clearTimeout(consentAdvanceTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (
			currentStep < 3 ||
			!photoReady ||
			!pinReady ||
			!finalLocation ||
			!activePrecheckSignature ||
			precheckSignature === activePrecheckSignature
		) {
			return;
		}

		let isMounted = true;
		setIsPrecheckLoading(true);
		setPrecheckError(null);

		reportsService
			.precheckReport({
				...draft,
				correctedLocation: finalLocation,
			})
			.then((result) => {
				if (!isMounted) return;

				setPrecheck(result);
				setPrecheckSignature(activePrecheckSignature);
				setNearbyCandidates(result.candidates);
			})
			.catch((error) => {
				if (isMounted) {
					setPrecheck(null);
					setPrecheckError(
						error instanceof AppApiError
							? error
							: new AppApiError({
									kind: "server_error",
									message:
										"The backend returned an unexpected error during AI pre-check.",
									detail:
										error instanceof Error ? error.message : String(error),
									transport: "http",
								}),
					);
				}
			})
			.finally(() => {
				if (isMounted) {
					setIsPrecheckLoading(false);
				}
			});

		return () => {
			isMounted = false;
		};
	}, [
		activePrecheckSignature,
		currentStep,
		draft,
		finalLocation,
		photoReady,
		pinReady,
		precheckSignature,
		reportsService,
	]);

	function retryPrecheck() {
		setPrecheck(null);
		setPrecheckError(null);
		setNearbyCandidates([]);
		setSelectedStackReference("");
		setDecisionLocationSignature("");
		setPrecheckSignature(`${activePrecheckSignature}:retry`);
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
			const nextStream = await requestCameraStream();
			stopCameraStream(stream);
			setStream(nextStream);
		} catch (cameraError) {
			setCameraError(
				cameraError instanceof Error
					? cameraError.message
					: "Camera access failed.",
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
		setPrecheck(null);
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
		setPrecheck(null);
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
		setPrecheck(null);
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

	async function handleRefreshLocation() {
		setIsLocating(true);
		setPinWarning("");
		setLocationRequestError("");

		try {
			handleGuideLocation(await requestCurrentPosition());
		} catch (error) {
			setLocationRequestError(
				error instanceof Error
					? error.message
					: getGeolocationFallbackMessage(),
			);
		} finally {
			setIsLocating(false);
		}
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: Refresh is intentionally gated by stable location state to avoid retry loops after denied geolocation.
	useEffect(() => {
		if (currentStep === 1 && !guideLocation && !isLocating) {
			void handleRefreshLocation();
		}
	}, [currentStep, guideLocation, isLocating]);

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
			navigate(`/report/success?ref=${submitted.reference}`);
		} catch (error) {
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
		<div className={`page page--report-v2${isOverlay ? " page--report-overlay" : ""}`}>
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
											<>
												<div className="report-photo-stage__preview">
													<img
														src={draft.photoPreviewUrl}
														alt="Captured preview"
														className="report-photo-stage__image"
													/>
												</div>
												<div className="report-photo-stage__actions">
													<label className="ui-button ui-button--secondary report-photo-stage__retake">
														<span>Retake photo</span>
														<input
															type="file"
															accept="image/*"
															capture="environment"
															aria-label="Retake photo"
															className="u-static-5790ffba"
															onChange={handleFileSelection}
														/>
													</label>
													<Button variant="primary" className="report-photo-stage__continue" onClick={() => setCurrentStep(1)}>
														Use photo &amp; continue
													</Button>
												</div>
											</>
										) : (
											<Surface className="premium-upload-card">
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
																onChange={handleFileSelection}
															/>
														</label>
														<label className="premium-upload-btn premium-upload-btn--gallery">
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
																<rect
																	x="3"
																	y="3"
																	width="18"
																	height="18"
																	rx="2"
																	ry="2"
																/>
																<circle cx="8.5" cy="8.5" r="1.5" />
																<polyline points="21 15 16 10 5 21" />
															</svg>
															<span>Choose from Gallery</span>
																<input
																	type="file"
																	accept="image/*"
																	aria-label="Upload a photo instead"
																	className="u-static-5790ffba"
																	onChange={handleFileSelection}
																/>
															</label>
														</div>
													</Surface>
											)}
										{cameraError ? (
											<Notice tone="warning">
												{cameraError}
											</Notice>
										) : null}
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
														<Notice tone="warning">
															{cameraError}
														</Notice>
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
																	Capture a clear photo of the suspected
																	habitat.
																</p>
																<p>
																	Focus on the container or drain opening, not
																	people or house numbers.
																</p>
															</div>
														)}
													</div>

													<label className="upload-tile">
														<MetaLabel className="upload-tile__eyebrow">
															Upload option
														</MetaLabel>
														<strong>Upload an existing photo</strong>
														<span className="caption-text">
															Use this if camera access is blocked or the
															evidence image is already saved.
														</span>
														<span className="upload-tile__action">
															Choose photo
														</span>
														<input
															className="upload-tile__input"
															type="file"
															accept="image/*"
															aria-label="Upload a photo instead"
															onChange={handleFileSelection}
														/>
													</label>
													{draft.photoEvidence ? (
														<p className="caption-text">
															Selected: {draft.photoEvidence.name}
														</p>
													) : null}
												</Surface>
											</div>

											<div className="stack-md">
												<Notice>
													A close, well-lit photo helps classification.
													Low-confidence model results will not block
													submission.
												</Notice>
												<Surface className="u-static-20a69043">
													<MetaLabel>Guidance</MetaLabel>
													<h2>Show the object and its water-holding area.</h2>
													<p>
														Tires, drain inlets, buckets, and containers are
														most useful when the image includes enough
														surrounding context for officers to recognize and
														locate the site.
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

					{/* Slide 1: Location */}
					<div className="report-slide report-slide--map">
						{currentStep === 1 && (
							isMobile ? (
									<>
										<div className="report-slide__content report-location-stage">
											<div className="report-location-stage__surface">
												<LocationReviewMapV2
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
														disabled={isLocating}
														onClick={handleRefreshLocation}
														aria-label="Use current location again"
														aria-busy={isLocating}
														title={
															isLocating
																? "Refreshing location"
																: "Use current location again"
														}
													>
														<LocateFixed
															aria-hidden="true"
															size={19}
															strokeWidth={2.25}
															className={
																isLocating
																	? "report-location-map-control__icon--spinning"
																	: ""
															}
														/>
													</button>
													</div>
												</div>
										</div>

										<MobileLocationConfirmation
											status={pinWarning || mobileLocationStatus}
											tone={mobileLocationStatusTone}
											disabled={
												!finalLocation ||
												!finalLocationIsInServiceArea ||
												!hasTrustedGuideLocation ||
												!finalLocationWithinAllowedRadius ||
												isLocating
											}
											onConfirm={handleConfirmPin}
										/>
									</>
							) : (
									<div className="report-step-layout report-step-layout--map u-static-4d5d3982">
										<div className="report-slide__content u-static-ac0d4af5">
											<div className="u-static-9d025315">
												<LocationReviewMapV2
													location={mapLocation}
													detectedLocation={guideLocation}
													allowedRadiusMeters={allowedCorrectionRadius}
													onLocationChange={handlePinMove}
												/>
											</div>
											<div className="u-static-b0825967">
												<p className="caption-text u-static-2a0ca835">
													The blue ring is the approximate device guide. The
													dashed teal ring is the allowed correction area for
													the final report pin.
													</p>
												</div>
										</div>

										<div className="report-slide__content u-static-ac0d4af5">
											<div className="u-static-42034aae">
												<LocationCapturePanel
													location={guideLocation}
													onLocationChange={handleGuideLocation}
												/>
												{pinWarning ? (
													<Notice tone="warning">
														{pinWarning}
													</Notice>
												) : null}
												{finalLocation ? (
													<Surface className="detail-grid u-static-ea0024e5">
														<div>
															<MetaLabel>
																Selected Pin Latitude
															</MetaLabel>
															<strong>
																{formatCoordinate(finalLocation.latitude)}
															</strong>
														</div>
														<div>
															<MetaLabel>
																Selected Pin Longitude
															</MetaLabel>
															<strong>
																{formatCoordinate(finalLocation.longitude)}
															</strong>
														</div>
														<div>
															<MetaLabel>Status</MetaLabel>
															<strong
																style={{
																	color: hasConfirmedPin
																		? "var(--color-accent)"
																		: "inherit",
																}}
															>
																{hasConfirmedPin
																	? "✓ Confirmed"
																	: "Needs confirmation"}
															</strong>
														</div>
													</Surface>
												) : (
													<Notice>
														We can start at the KL service area. Drag the report
														pin, click/tap the map, or use nudge controls to set
														the exact site.
													</Notice>
												)}
											</div>

											<div className="report-location-desktop-actions">
												<Button
													variant="primary"
													className="u-static-e65121df"
													disabled={
														!finalLocation ||
														!finalLocationIsInServiceArea ||
														!hasTrustedGuideLocation ||
														!finalLocationWithinAllowedRadius
													}
													onClick={handleConfirmPin}
												>
													Confirm this exact pin
												</Button>
											</div>
										</div>
									</div>
								)
						)}
					</div>

					{/* Slide 2: Details & Consent */}
					<div
						className={`report-slide${isMobileConsentStep ? " report-slide--consent-mobile" : ""}`}
					>
						{currentStep === 2 && (
							isMobileConsentStep ? (
									<div className="report-slide__content report-consent-stage">
										<div className="report-consent-stage__surface">
											<Surface className="report-consent-panel report-consent-panel--immersive">
												<MetaLabel>
													Privacy policy
												</MetaLabel>
												<section
													ref={consentBodyRef}
													className="report-consent-panel__body"
													aria-label="Public consent text"
													onScroll={handleConsentScroll}
												>
													<p>{PUBLIC_REPORT_CONSENT_TEXT}</p>
													<p>
														This prototype publishes the exact pin, photo, and
														AI evidence together so residents and officers can
														review the same report context.
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
												<MetaLabel>
													Privacy policy
												</MetaLabel>
												<section
													className="report-consent-panel__body"
													aria-label="Public consent text"
												>
													<p>{PUBLIC_REPORT_CONSENT_TEXT}</p>
													<p>
														This prototype publishes the exact pin, photo, and
														AI evidence together so residents and officers can
														review the same report context.
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
								)
						)}
					</div>

					{/* Slide 3: AI Review & Stacking */}
					<div className="report-slide">
						{currentStep === 3 && (
							<div className="report-slide__content">
									{isPrecheckLoading ? (
										<div
											className="scanning-image-container"
											role="status"
											aria-live="polite"
										>
											{precheckImageUrl ? (
												<img
													src={precheckImageUrl}
													alt="Scanning evidence..."
												/>
											) : null}
											<div className="scanning-image-overlay" />
											<div className="scan-line" />
												<div className="u-static-457dd306">
													<div className="glass-panel u-static-760bbe82">
														<span className="u-static-5f9a40ab">
															Running AI habitat scan...
														</span>
													</div>
												</div>
										</div>
									) : null}

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
															{precheckError.health.database ? "ready" : "down"}
															, model{" "}
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
											<Button
												variant="secondary"
												onClick={retryPrecheck}
											>
												Retry backend pre-check
											</Button>
										</div>
									) : null}

									{precheckReady && precheck ? (
										<PredictionEvidencePanelV2
											prediction={precheck.prediction}
											title="AI pre-check result"
											imageUrl={precheckImageUrl}
											imageAlt="Submitted evidence preview"
											showDetections
										/>
									) : null}

									{precheckReady && precheck ? (
										(precheck.prediction.detections?.filter(d => d.bboxNormalized?.length === 4 || d.bbox.length >= 4).length ?? 0) > 0 ? (
											<Notice tone="info">
												<strong>ℹ️ AI Analysis:</strong> Breeding habitat detected.
											</Notice>
										) : (
											<Notice tone="neutral">
												<strong>AI Analysis:</strong> No visible habitats detected.
											</Notice>
										)
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

									{precheckReady && needsStackDecision ? (
										<div className="stack-md">
											<NearbyReportPromptV2
												variant="inline"
												candidates={nearbyCandidates}
												onStack={handleStackDecision}
												onCreateSeparate={handleSeparateDecision}
											/>
										</div>
									) : null}

									{precheckReady && precheck ? (
										<Surface className="u-static-80af9120">
											<p className="u-static-a6e880eb">
												<strong>Note:</strong>{" "}
												{precheck.prediction.advisoryText} AI results are
												advisory.
											</p>
										</Surface>
									) : null}

										<div className="stack-sm report-ai-actions">
										<Button
											variant="primary"
											className="u-static-16000cc0"
											disabled={!precheckReady || needsStackDecision}
											onClick={() => setCurrentStep(4)}
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
												<PredictionEvidencePanelV2
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
												<MetaLabel>
													Submission summary
												</MetaLabel>
												<h2>Final confirmation</h2>
											</div>

											{finalLocation ? (
												<StaticReceiptMap location={finalLocation} />
											) : null}

											<div className="detail-grid">
												<div>
													<MetaLabel>
														Captured timestamp
													</MetaLabel>
													<strong>
														{draft.capturedAt
															? formatTimestamp(draft.capturedAt)
															: "Now"}
													</strong>
												</div>
												<div>
													<MetaLabel>
														Latitude
													</MetaLabel>
													<strong>
														{finalLocation
															? formatCoordinate(finalLocation.latitude)
															: "Missing"}
													</strong>
												</div>
												<div>
													<MetaLabel>
														Longitude
													</MetaLabel>
													<strong>
														{finalLocation
															? formatCoordinate(finalLocation.longitude)
															: "Missing"}
													</strong>
												</div>
											</div>

											{submitError ? (
												<Notice tone="warning">
													{submitError}
												</Notice>
											) : null}

												<div className="stack-sm report-submit-actions">
												<Button
													variant="primary"
													disabled={isSubmitting}
													onClick={handleSubmit}
													fullWidth
												>
													{isSubmitting ? (
														"Submitting..."
													) : selectedStackReference ? (
														"Submit Stacked Report"
													) : (
														"Submit Report"
													)}
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
				<NearbyReportPromptV2
					variant="modal"
					candidates={nearbyCandidates}
					onStack={handleStackDecision}
					onCreateSeparate={handleSeparateDecision}
				/>
			) : null}
		</div>
	);
}
