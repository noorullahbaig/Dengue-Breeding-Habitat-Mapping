import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LocateFixed } from 'lucide-react'
import { InlineNotice } from '@/components/InlineNotice'
import { useReportDraft } from '@/app/useReportDraft'
import { useServices } from '@/app/useServices'
import { LocationCapturePanel } from '@/features/report/LocationCapturePanel'
import { LocationReviewMapV2 } from '@/pages/ux-v2/components/LocationReviewMapV2'
import { NearbyReportPromptV2 } from '@/pages/ux-v2/components/NearbyReportPromptV2'
import { PredictionEvidencePanelV2 } from '@/pages/ux-v2/components/PredictionEvidencePanelV2'
import { StaticReceiptMap } from '@/pages/ux-v2/components/StaticReceiptMap'
import { PUBLIC_REPORT_CONSENT_TEXT, KL_CENTER } from '@/lib/constants'
import { formatCoordinate, formatTimestamp } from '@/lib/formatters'
import { getGeolocationFallbackMessage, requestCurrentPosition } from '@/lib/geolocation'
import {
  MAX_DETECTED_ACCURACY_METERS,
  allowedCorrectionRadiusMeters,
  distanceMetersBetween,
  hasTrustedDetectedLocation,
  isWithinAllowedCorrectionRadius,
} from '@/lib/locationTrust'
import { isWithinServiceArea, SERVICE_AREA_ERROR } from '@/lib/serviceArea'
import { AppApiError } from '@/services/apiServices'
import { requestCameraStream, stopCameraStream, captureFrameAsFile, readFileAsDataUrl } from '@/lib/camera'
import type { LocationPoint, NearbyReportCandidate, ReportPrecheck } from '@/types/report'

const reportSteps = [
  {
    title: 'Photo',
    description: 'Add a clear image.',
  },
  {
    title: 'Location',
    description: 'Move the pin to the exact site.',
  },
  {
    title: 'Privacy policy',
    description: 'Review and accept public consent.',
  },
  {
    title: 'AI review',
    description: 'See the model advisory.',
  },
  {
    title: 'Submit',
    description: 'Send the final evidence bundle.',
  },
]

function locationSignature(location?: LocationPoint | null) {
  return location ? `${location.latitude.toFixed(5)}:${location.longitude.toFixed(5)}` : ''
}

function precheckFailureCopy(error: AppApiError) {
  switch (error.kind) {
    case 'network':
      return {
        title:
          'Could not reach the local backend. Start or reconnect the API server at localhost:8000.',
        helper:
          'Submission stays blocked until the API can be reached and returns an advisory result. If the backend is already running, check for a CORS mismatch between this frontend origin and backend CORS_ORIGINS.',
      }
    case 'model_not_ready':
      return {
        title: 'Backend is reachable, but the detection model is not ready.',
        helper:
          'Submission stays blocked until the backend model finishes loading and returns an advisory result.',
      }
    case 'model_processing_failed':
      return {
        title:
          'Backend is reachable, but the uploaded image could not be processed by the model.',
        helper:
          'Retry the pre-check or try a clearer image before submitting the report.',
      }
    default:
      return {
        title:
          error.detail ||
          error.message ||
          'The backend returned an unexpected error during AI pre-check.',
        helper:
          'Submission stays blocked until the API returns a valid advisory result.',
      }
  }
}

export function ReportPageV2() {
  const navigate = useNavigate()
  const { reportsService } = useServices()
  const { draft, setLastSubmittedReference, updateDraft } = useReportDraft()
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const consentBodyRef = useRef<HTMLDivElement>(null)
  const consentAdvanceTimerRef = useRef<number | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasConfirmedPin, setHasConfirmedPin] = useState(false)
  const [hasPublicConsent, setHasPublicConsent] = useState(false)
  const [hasScrolledConsentToEnd, setHasScrolledConsentToEnd] = useState(false)
  const [pinWarning, setPinWarning] = useState('')
  const [precheck, setPrecheck] = useState<ReportPrecheck | null>(null)
  const [precheckSignature, setPrecheckSignature] = useState('')
  const [isPrecheckLoading, setIsPrecheckLoading] = useState(false)
  const [precheckError, setPrecheckError] = useState<AppApiError | null>(null)
  const [nearbyCandidates, setNearbyCandidates] = useState<NearbyReportCandidate[]>([])
  const [isNearbyPromptOpen, setIsNearbyPromptOpen] = useState(false)
  const [selectedStackReference, setSelectedStackReference] = useState('')
  const [decisionLocationSignature, setDecisionLocationSignature] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locationRequestError, setLocationRequestError] = useState('')

  // Mobile layout detection
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    setIsMobile(window.matchMedia('(max-width: 760px)').matches)
  }, [])

  // Live camera stream state (Desktop only)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [isCameraBusy, setIsCameraBusy] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (stream) {
      video.srcObject = stream
      void video.play().catch(() => {
        setCameraError('The live preview could not start. Use the file selector instead.')
      })
      return
    }
    video.srcObject = null
  }, [stream])

  useEffect(() => {
    return () => {
      stopCameraStream(stream)
    }
  }, [stream])

  const guideLocation = draft.detectedLocation
  const finalLocation = draft.correctedLocation
  const mapLocation =
    finalLocation ?? (guideLocation && isWithinServiceArea(guideLocation) ? guideLocation : KL_CENTER)
  const finalLocationIsInServiceArea = finalLocation ? isWithinServiceArea(finalLocation) : false
  const hasTrustedGuideLocation = hasTrustedDetectedLocation(guideLocation)
  const allowedCorrectionRadius = allowedCorrectionRadiusMeters(guideLocation?.accuracyMeters)
  const selectedLocationDistanceMeters =
    guideLocation && finalLocation ? distanceMetersBetween(guideLocation, finalLocation) : null
  const finalLocationWithinAllowedRadius = isWithinAllowedCorrectionRadius(
    guideLocation,
    finalLocation,
  )
  const photoReady = Boolean(draft.photoFile && draft.photoPreviewUrl && draft.photoEvidence)
  const pinReady = Boolean(
    finalLocation &&
      finalLocationIsInServiceArea &&
      hasTrustedGuideLocation &&
      finalLocationWithinAllowedRadius &&
      hasConfirmedPin,
  )
  const detailsReady = hasPublicConsent
  const activeLocationSignature = locationSignature(finalLocation)
  const activePrecheckSignature =
    photoReady && finalLocation
      ? `${draft.capturedAt ?? ''}:${draft.photoEvidence?.name ?? ''}:${
          draft.photoEvidence?.size ?? 0
        }:${activeLocationSignature}`
      : ''
  const precheckReady = Boolean(precheck && precheckSignature === activePrecheckSignature)
  const selectedStack = nearbyCandidates.find(
    (candidate) => candidate.reference === selectedStackReference,
  )
  const precheckImageUrl = precheck?.imageUrl ?? draft.photoPreviewUrl
  const needsStackDecision =
    nearbyCandidates.length > 0 && decisionLocationSignature !== activeLocationSignature
  const hasChosenSeparateReport =
    nearbyCandidates.length > 0 &&
    decisionLocationSignature === activeLocationSignature &&
    !selectedStackReference
  const isMobileLocationStep = isMobile && currentStep === 1
  const isMobileConsentStep = isMobile && currentStep === 2
  const showImmersiveHeader = currentStep > 0 && !(isMobileLocationStep || isMobileConsentStep || currentStep >= 3)

  useEffect(() => {
    if (precheckSignature && precheckSignature !== activePrecheckSignature) {
      setPrecheck(null)
      setPrecheckError(null)
      setNearbyCandidates([])
      setSelectedStackReference('')
      setDecisionLocationSignature('')
    }
  }, [activePrecheckSignature, precheckSignature])

  useEffect(() => {
    const heading = stepHeadingRef.current
    if (heading?.dataset.stepIndex === String(currentStep)) {
      heading.focus({ preventScroll: true })
    }
  }, [currentStep])

  useEffect(() => {
    if (!isMobileConsentStep) {
      if (consentAdvanceTimerRef.current !== null) {
        window.clearTimeout(consentAdvanceTimerRef.current)
        consentAdvanceTimerRef.current = null
      }
      return
    }

    if (consentAdvanceTimerRef.current !== null) {
      window.clearTimeout(consentAdvanceTimerRef.current)
      consentAdvanceTimerRef.current = null
    }
    setHasPublicConsent(false)
    setHasScrolledConsentToEnd(false)

    const consentBody = consentBodyRef.current
    if (consentBody) {
      consentBody.scrollTop = 0
    }
    return () => {
      if (consentAdvanceTimerRef.current !== null) {
        window.clearTimeout(consentAdvanceTimerRef.current)
        consentAdvanceTimerRef.current = null
      }
    }
  }, [isMobileConsentStep])

  useEffect(() => {
    return () => {
      if (consentAdvanceTimerRef.current !== null) {
        window.clearTimeout(consentAdvanceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (
      currentStep < 3 ||
      !photoReady ||
      !pinReady ||
      !finalLocation ||
      !activePrecheckSignature ||
      precheckSignature === activePrecheckSignature
    ) {
      return
    }

    let isMounted = true
    setIsPrecheckLoading(true)
    setPrecheckError(null)

    reportsService
      .precheckReport({
        ...draft,
        correctedLocation: finalLocation,
      })
      .then((result) => {
        if (!isMounted) return

        setPrecheck(result)
        setPrecheckSignature(activePrecheckSignature)
        setNearbyCandidates(result.candidates)
      })
      .catch((error) => {
        if (isMounted) {
          setPrecheck(null)
          setPrecheckError(
            error instanceof AppApiError
              ? error
              : new AppApiError({
                  kind: 'server_error',
                  message: 'The backend returned an unexpected error during AI pre-check.',
                  detail: error instanceof Error ? error.message : String(error),
                  transport: 'http',
                }),
          )
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsPrecheckLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [
    activePrecheckSignature,
    currentStep,
    draft,
    finalLocation,
    photoReady,
    pinReady,
    precheckSignature,
    reportsService,
  ])

  function retryPrecheck() {
    setPrecheck(null)
    setPrecheckError(null)
    setNearbyCandidates([])
    setSelectedStackReference('')
    setDecisionLocationSignature('')
    setPrecheckSignature(`${activePrecheckSignature}:retry`)
  }

  function goToStep(nextStep: number) {
    if (canOpenStep(nextStep)) {
      setCurrentStep(nextStep)
    }
  }

  function canOpenStep(stepIndex: number) {
    if (stepIndex === 0) return true
    if (stepIndex === 1) return photoReady
    if (stepIndex === 2 || stepIndex === 3) return photoReady && pinReady
    return photoReady && pinReady && detailsReady && precheckReady && !needsStackDecision
  }

  function stepBlockedReason(stepIndex: number) {
    if (canOpenStep(stepIndex)) return ''
    if (stepIndex === 1) return 'Upload or capture a photo first.'
    if (stepIndex === 2 || stepIndex === 3) return 'Confirm the report map pin location first.'
    if (!detailsReady) return 'Accept privacy consent first.'
    if (!precheckReady) return 'Run the AI classification check first.'
    if (needsStackDecision) return 'Make a stacking duplication decision.'
    return 'Complete the previous step first.'
  }

  // Camera Handlers
  async function handleLiveCamera() {
    setIsCameraBusy(true)
    setCameraError('')
    try {
      const nextStream = await requestCameraStream()
      stopCameraStream(stream)
      setStream(nextStream)
    } catch (cameraError) {
      setCameraError(cameraError instanceof Error ? cameraError.message : 'Camera access failed.')
    } finally {
      setIsCameraBusy(false)
    }
  }

  async function handleCaptureFrame() {
    if (!videoRef.current) return
    setIsCameraBusy(true)
    setCameraError('')
    try {
      const file = await captureFrameAsFile(videoRef.current)
      const nextPreview = await readFileAsDataUrl(file)
      handlePhotoReady(file, nextPreview)
    } catch (captureError) {
      setCameraError(captureError instanceof Error ? captureError.message : 'Frame capture failed.')
    } finally {
      setIsCameraBusy(false)
    }
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setIsCameraBusy(true)
    setCameraError('')
    try {
      const nextPreview = await readFileAsDataUrl(file)
      handlePhotoReady(file, nextPreview)
    } catch (fileError) {
      setCameraError(fileError instanceof Error ? fileError.message : 'Image processing failed.')
    } finally {
      setIsCameraBusy(false)
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
    })
    setPrecheck(null)
    setPrecheckSignature('')
    stopCameraStream(stream)
    setStream(null)
    setCurrentStep(1)
  }

  function handleGuideLocation(location: LocationPoint) {
    const isInside = isWithinServiceArea(location)
    updateDraft({
      detectedLocation: location,
      correctedLocation: isInside ? location : null,
    })
    setHasConfirmedPin(false)
    setLocationRequestError('')
    setPinWarning(isInside ? '' : SERVICE_AREA_ERROR)
    setPrecheck(null)
    setPrecheckSignature('')
  }

  function handlePinMove(location: LocationPoint) {
    if (!isWithinServiceArea(location) && !isMobileLocationStep) {
      setHasConfirmedPin(false)
      setPinWarning(SERVICE_AREA_ERROR)
      return
    }
    updateDraft({ correctedLocation: location })
    setHasConfirmedPin(false)
    setPinWarning(isWithinServiceArea(location) ? '' : SERVICE_AREA_ERROR)
    setPrecheck(null)
    setPrecheckSignature('')
  }

  function handleConfirmPin() {
    if (!guideLocation || !hasTrustedGuideLocation || !allowedCorrectionRadius) {
      setPinWarning(
        `Use a precise device location before continuing. Accuracy must be ${MAX_DETECTED_ACCURACY_METERS}m or better.`,
      )
      return
    }
    if (!finalLocation || !finalLocationIsInServiceArea) {
      setPinWarning(SERVICE_AREA_ERROR)
      return
    }
    if (!finalLocationWithinAllowedRadius) {
      setPinWarning(
        `Move the map back inside the ${Math.round(allowedCorrectionRadius)}m correction area.`,
      )
      return
    }
    setPinWarning('')
    setHasConfirmedPin(true)
    setCurrentStep(2)
  }

  function handleConsentScroll(event: { currentTarget: HTMLDivElement }) {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget
    if (scrollTop + clientHeight >= scrollHeight - 12) {
      setHasScrolledConsentToEnd(true)
    }
  }

  function handleConsentChange(nextChecked: boolean) {
    setHasPublicConsent(nextChecked)

    if (nextChecked && isMobileConsentStep && hasScrolledConsentToEnd) {
      if (consentAdvanceTimerRef.current !== null) {
        window.clearTimeout(consentAdvanceTimerRef.current)
      }
      consentAdvanceTimerRef.current = window.setTimeout(() => {
        setCurrentStep(3)
      }, 140)
    }
  }

  async function handleRefreshLocation() {
    setIsLocating(true)
    setPinWarning('')
    setLocationRequestError('')

    try {
      handleGuideLocation(await requestCurrentPosition())
    } catch (error) {
      setLocationRequestError(
        error instanceof Error ? error.message : getGeolocationFallbackMessage(),
      )
    } finally {
      setIsLocating(false)
    }
  }

  useEffect(() => {
    if (currentStep === 1 && !guideLocation && !isLocating) {
      void handleRefreshLocation()
    }
  }, [currentStep, guideLocation, isLocating])

  async function handleSubmit() {
    if (!guideLocation || !hasTrustedGuideLocation || !allowedCorrectionRadius) {
      setSubmitError(
        `A verified device location within ${MAX_DETECTED_ACCURACY_METERS}m accuracy is required before submission.`,
      )
      setCurrentStep(1)
      return
    }
    if (!finalLocation || !finalLocationIsInServiceArea || !finalLocationWithinAllowedRadius) {
      setSubmitError(SERVICE_AREA_ERROR)
      setCurrentStep(1)
      return
    }
    if (!hasPublicConsent) {
      setSubmitError('You must confirm public consent to submit the report.')
      setCurrentStep(2)
      return
    }
    if (!precheckReady) {
      setSubmitError('Run the computer-vision precheck before submitting.')
      setCurrentStep(3)
      return
    }
    if (needsStackDecision) {
      setIsNearbyPromptOpen(true)
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

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
      )
      setLastSubmittedReference(submitted.reference)
      navigate(`/report/success?ref=${submitted.reference}`)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'The report could not be submitted.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleStackDecision(reference: string) {
    setSelectedStackReference(reference)
    setDecisionLocationSignature(activeLocationSignature)
    setIsNearbyPromptOpen(false)
  }

  function handleSeparateDecision() {
    setSelectedStackReference('')
    setDecisionLocationSignature(activeLocationSignature)
    setIsNearbyPromptOpen(false)
  }

  function stepIsComplete(stepIndex: number) {
    if (stepIndex === 0) return photoReady
    if (stepIndex === 1) return pinReady
    if (stepIndex === 2) return detailsReady
    if (stepIndex === 3) return precheckReady
    return false
  }

  const mobileLocationStatus = (() => {
    if (locationRequestError) {
      return locationRequestError
    }

    if (!guideLocation) {
      return 'Use your device location to verify this exact site.'
    }

    if (!isWithinServiceArea(guideLocation)) {
      return 'Your device location is outside Kuala Lumpur.'
    }

    if (!hasTrustedGuideLocation || !allowedCorrectionRadius) {
      const measuredAccuracy =
        typeof guideLocation.accuracyMeters === 'number'
          ? `${Math.round(guideLocation.accuracyMeters)}m`
          : 'unknown'
      return `Device location is too broad (${measuredAccuracy}). Retry for ${MAX_DETECTED_ACCURACY_METERS}m accuracy or better.`
    }

    if (!finalLocation) {
      return 'Move the map until the pin sits on the exact site.'
    }

    if (!finalLocationIsInServiceArea) {
      return 'Move the map back inside Kuala Lumpur.'
    }

    if (!finalLocationWithinAllowedRadius) {
      return `Move the map back inside the ${Math.round(allowedCorrectionRadius)}m correction area.`
    }

    if (selectedLocationDistanceMeters !== null && selectedLocationDistanceMeters < 1) {
      return 'At your device location.'
    }

    return `Within ${Math.max(1, Math.round(selectedLocationDistanceMeters ?? 0))}m of your device location.`
  })()
  const mobileLocationStatusTone =
    finalLocation &&
    finalLocationIsInServiceArea &&
    hasTrustedGuideLocation &&
    finalLocationWithinAllowedRadius &&
    !locationRequestError
      ? ' report-location-sheet__status--valid'
      : pinWarning || locationRequestError
        ? ' report-location-sheet__status--warning'
        : ''

  const selectedStep = reportSteps[currentStep] ?? reportSteps[0]
  return (
    <div className="page page--report page--report-immersive">
      {/* Immersive Header */}
      {showImmersiveHeader && (
        <header className="report-immersive-header">
          <div className="report-immersive-header__top" style={{ justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
            <div className="report-step-info" style={{ textAlign: 'center', flex: 1, padding: '0 0.5rem' }}>
              <h1 className="report-step-info__title" ref={stepHeadingRef} tabIndex={-1} data-step-index={String(currentStep)} style={{ fontSize: '1.25rem', marginBottom: '0.15rem' }}>
                {selectedStep.title}
              </h1>
              <p className="report-step-info__description" style={{ fontSize: '0.9rem', margin: 0, color: 'var(--color-ink-soft)' }}>
                {selectedStep.description}
              </p>
            </div>
            
            <div className="report-header-right-placeholder" />
          </div>
        </header>
      )}

      {/* Slide workspace */}
      <div className="report-slides-window">
        <div
          className="report-slides-container"
          style={{ transform: `translateX(-${currentStep * 20}%)` }}
        >
          {/* Slide 0: Photo */}
          <div className="report-slide">
            {currentStep === 0 && (
              <>
                <div className="report-slide__content">
                  {isMobile ? (
                    // MOBILE ONLY REDESIGNED PHOTO FLOW
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', textAlign: 'center' }}>
                      {draft.photoPreviewUrl ? (
                        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <img
                            src={draft.photoPreviewUrl}
                            alt="Captured preview"
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'contain', 
                              borderRadius: 'var(--radius-md)'
                            }}
                          />
                        </div>
                      ) : (
                        <div className="app-card premium-upload-card">
                          <div className="premium-upload-card__icon-wrapper">
                            <svg className="premium-upload-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                          </div>
                          <div className="premium-upload-card__info">
                            <h3 className="premium-upload-card__title">Capture Breeding Habitat</h3>
                            <p className="premium-upload-card__subtitle">
                              A close, well-lit photo helps classification. Focus on the object and its water-holding area.
                            </p>
                          </div>
                          <div className="premium-upload-card__actions">
                            <label className="premium-upload-btn premium-upload-btn--camera">
                              <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                              </svg>
                              <span>Open Camera</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                style={{ display: 'none' }}
                                onChange={handleFileSelection}
                              />
                            </label>
                            <label className="premium-upload-btn premium-upload-btn--gallery">
                              <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                              <span>Choose from Gallery</span>
                              <input
                                type="file"
                                accept="image/*"
                                aria-label="Upload a photo instead"
                                style={{ display: 'none' }}
                                onChange={handleFileSelection}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                      {cameraError ? <InlineNotice tone="warning">{cameraError}</InlineNotice> : null}
                    </div>
                  ) : (
                    // DESKTOP CAMERA FLOW
                    <div className="report-step-layout">
                      <div className="stack-md">
                        <div className="app-card" style={{ display: 'grid', gap: '1rem' }}>
                          <div className="cluster-row">
                            <button
                              type="button"
                              className="button button--secondary"
                              onClick={handleLiveCamera}
                              disabled={isCameraBusy}
                            >
                              Use webcam
                            </button>
                            {stream ? (
                              <>
                                <button
                                  type="button"
                                  className="button"
                                  onClick={handleCaptureFrame}
                                  disabled={isCameraBusy}
                                >
                                  Capture frame
                                </button>
                                <button
                                  type="button"
                                  className="button button--ghost"
                                  onClick={() => {
                                    stopCameraStream(stream)
                                    setStream(null)
                                  }}
                                >
                                  Stop camera
                                </button>
                              </>
                            ) : null}
                          </div>

                          {cameraError ? <InlineNotice tone="warning">{cameraError}</InlineNotice> : null}

                          <div className="camera-preview" style={{ aspectRatio: '4/3' }}>
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
                                className="camera-preview__media"
                                style={{ objectFit: 'contain' }}
                              />
                            ) : (
                              <div className="camera-preview__placeholder">
                                <p>Capture a clear photo of the suspected habitat.</p>
                                <p>Focus on the container or drain opening, not people or house numbers.</p>
                              </div>
                            )}
                          </div>

                          <label className="upload-tile">
                            <span className="upload-tile__eyebrow">Upload option</span>
                            <strong>Upload an existing photo</strong>
                            <span className="caption-text">
                              Use this if camera access is blocked or the evidence image is already saved.
                            </span>
                            <span className="upload-tile__action">Choose photo</span>
                            <input
                              className="upload-tile__input"
                              type="file"
                              accept="image/*"
                              aria-label="Upload a photo instead"
                              onChange={handleFileSelection}
                            />
                          </label>
                          {draft.photoEvidence ? <p className="caption-text">Selected: {draft.photoEvidence.name}</p> : null}
                        </div>
                      </div>

                      <div className="stack-md">
                        <InlineNotice>
                          A close, well-lit photo helps classification. Low-confidence model results will not block submission.
                        </InlineNotice>
                        <div className="app-card" style={{ background: 'var(--color-surface-muted)' }}>
                          <span className="detail-grid__label">Guidance</span>
                          <h2>Show the object and its water-holding area.</h2>
                          <p>
                            Tires, drain inlets, buckets, and containers are most useful when the image includes enough surrounding context for officers to recognize and locate the site.
                          </p>
                        </div>
                        {draft.photoPreviewUrl && (
                          <div className="report-slide__actions" style={{ padding: 0 }}>
                            <button
                              type="button"
                              className="button button--primary"
                              style={{ width: '100%' }}
                              onClick={() => setCurrentStep(1)}
                            >
                              Next: confirm location
                            </button>
                            <button
                              type="button"
                              className="button button--secondary"
                              style={{ width: '100%', marginTop: '0.5rem' }}
                              onClick={() => updateDraft({ photoFile: null, photoPreviewUrl: '', photoEvidence: null })}
                            >
                              Choose different
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Slide 1: Location */}
          <div className="report-slide report-slide--map">
            {currentStep === 1 && (
              <>
                {isMobile ? (
                  <>
                    <div className="report-slide__content report-location-stage">
                      <h1
                        className="sr-only"
                        ref={stepHeadingRef}
                        tabIndex={-1}
                        data-step-index={String(currentStep)}
                      >
                        Confirm report location
                      </h1>
                      <div className="report-location-stage__surface">
                        <LocationReviewMapV2
                          location={mapLocation}
                          detectedLocation={guideLocation}
                          allowedRadiusMeters={allowedCorrectionRadius}
                          selectionMode="fixed-center"
                          onLocationChange={handlePinMove}
                        />
                        <div className="report-location-map-control report-location-map-control--back">
                          <button
                            type="button"
                            className="report-location-map-control__button"
                            onClick={() => goToStep(0)}
                            aria-label="Previous step"
                            title="Previous step"
                          >
                            <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.5} />
                          </button>
                        </div>
                        <div className="report-location-map-control report-location-map-control--locate">
                          <button
                            type="button"
                            className="report-location-map-control__button"
                            disabled={isLocating}
                            onClick={handleRefreshLocation}
                            aria-label="Use current location again"
                            aria-busy={isLocating}
                            title={isLocating ? 'Refreshing location' : 'Use current location again'}
                          >
                            <LocateFixed
                              aria-hidden="true"
                              size={19}
                              strokeWidth={2.25}
                              className={isLocating ? 'report-location-map-control__icon--spinning' : ''}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="report-slide__actions report-slide__actions--location-mobile">
                      <div className="report-location-sheet">
                        <p className={`report-location-sheet__status${mobileLocationStatusTone}`}>
                          {pinWarning || mobileLocationStatus}
                        </p>
                        <button
                          type="button"
                          className="button button--primary report-location-sheet__confirm"
                          disabled={
                            !finalLocation ||
                            !finalLocationIsInServiceArea ||
                            !hasTrustedGuideLocation ||
                            !finalLocationWithinAllowedRadius ||
                            isLocating
                          }
                          onClick={handleConfirmPin}
                        >
                          Confirm this exact site
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="report-step-layout report-step-layout--map" style={{ height: '100%' }}>
                    <div className="report-slide__content" style={{ padding: 0 }}>
                      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '50vh' }}>
                        <LocationReviewMapV2
                          location={mapLocation}
                          detectedLocation={guideLocation}
                          allowedRadiusMeters={allowedCorrectionRadius}
                          onLocationChange={handlePinMove}
                        />
                      </div>
                      <div style={{ padding: '0.5rem 1.5rem' }}>
                        <p className="caption-text" style={{ margin: 0 }}>
                          The blue ring is the approximate device guide. The dashed teal ring is the allowed correction area for the final report pin.
                        </p>
                      </div>
                    </div>

                    <div className="report-slide__content" style={{ padding: 0 }}>
                      <div style={{ padding: '1.5rem 1.5rem 0.5rem' }}>
                        <LocationCapturePanel
                          location={guideLocation}
                          onLocationChange={handleGuideLocation}
                        />
                        {pinWarning ? <InlineNotice tone="warning">{pinWarning}</InlineNotice> : null}
                        {finalLocation ? (
                          <div className="app-card detail-grid" style={{ padding: '0.75rem', marginTop: '0.5rem' }}>
                            <div>
                              <span className="detail-grid__label">Selected Pin Latitude</span>
                              <strong>{formatCoordinate(finalLocation.latitude)}</strong>
                            </div>
                            <div>
                              <span className="detail-grid__label">Selected Pin Longitude</span>
                              <strong>{formatCoordinate(finalLocation.longitude)}</strong>
                            </div>
                            <div>
                              <span className="detail-grid__label">Status</span>
                              <strong style={{ color: hasConfirmedPin ? 'var(--color-accent)' : 'inherit' }}>
                                {hasConfirmedPin ? '✓ Confirmed' : 'Needs confirmation'}
                              </strong>
                            </div>
                          </div>
                        ) : (
                          <InlineNotice>
                            We can start at the KL service area. Drag the report pin, click/tap the map, or use nudge controls to set the exact site.
                          </InlineNotice>
                        )}
                      </div>

                      <div className="report-slide__actions">
                        <button
                          type="button"
                          className="button button--primary"
                          style={{ width: '100%', padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                          disabled={
                            !finalLocation ||
                            !finalLocationIsInServiceArea ||
                            !hasTrustedGuideLocation ||
                            !finalLocationWithinAllowedRadius
                          }
                          onClick={handleConfirmPin}
                        >
                          Confirm this exact pin
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Slide 2: Details & Consent */}
          <div className={`report-slide${isMobileConsentStep ? ' report-slide--consent-mobile' : ''}`}>
            {currentStep === 2 && (
              <>
                {isMobileConsentStep ? (
                  <div className="report-slide__content report-consent-stage">
                    <h1
                      className="sr-only"
                      ref={stepHeadingRef}
                      tabIndex={-1}
                      data-step-index={String(currentStep)}
                    >
                      Privacy policy
                    </h1>
                    <div className="report-consent-stage__surface">
                      <div className="panel panel--muted report-consent-panel report-consent-panel--immersive">
                        <span className="detail-grid__label">Privacy policy</span>
                        <div
                          ref={consentBodyRef}
                          className="report-consent-panel__body"
                          tabIndex={0}
                          aria-label="Public consent text"
                          onScroll={handleConsentScroll}
                        >
                          <p>{PUBLIC_REPORT_CONSENT_TEXT}</p>
                          <p>
                            This prototype publishes the exact pin, photo, and AI evidence together so
                            residents and officers can review the same report context.
                          </p>
                          <p>
                            Read to the end, then accept to move on to the AI review.
                          </p>
                          <label
                            className={`report-consent-panel__accept${
                              !hasScrolledConsentToEnd ? ' report-consent-panel__accept--locked' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={hasPublicConsent}
                              disabled={!hasScrolledConsentToEnd}
                              onChange={(event) => handleConsentChange(event.target.checked)}
                            />
                            <span>
                              {hasScrolledConsentToEnd
                                ? 'I accept this public consent.'
                                : 'Scroll to the end to unlock acceptance.'}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="report-step-layout">
                    <div className="stack-md">
                      <div className="panel panel--muted report-consent-panel">
                        <span className="detail-grid__label">Privacy policy</span>
                        <div className="report-consent-panel__body" tabIndex={0} aria-label="Public consent text">
                          <p>{PUBLIC_REPORT_CONSENT_TEXT}</p>
                          <p>
                            This prototype publishes the exact pin, photo, and AI evidence together so residents and officers can review the same report context.
                          </p>
                          <p>
                            You can only continue after you accept this consent.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="stack-md">
                      <div className="app-card" style={{ padding: '1rem', background: 'var(--color-surface-muted)' }}>
                        <label className="report-consent-panel__accept" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={hasPublicConsent}
                            onChange={(event) => handleConsentChange(event.target.checked)}
                          />
                          <span style={{ fontWeight: 600 }}>I accept this public consent.</span>
                        </label>
                      </div>
                      <div className="report-slide__actions" style={{ padding: 0 }}>
                        <button
                          type="button"
                          className="button button--primary"
                          style={{ width: '100%' }}
                          disabled={!hasPublicConsent}
                          onClick={() => setCurrentStep(3)}
                        >
                          Continue to AI review
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Slide 3: AI Review & Stacking */}
          <div className="report-slide">
            {currentStep === 3 && (
              <>
                <div className="report-slide__content">
                  {isPrecheckLoading ? (
                    <div className="scanning-image-container" role="status" aria-live="polite">
                      {precheckImageUrl ? (
                        <img src={precheckImageUrl} alt="Scanning evidence..." />
                      ) : null}
                      <div className="scanning-image-overlay" />
                      <div className="scan-line" />
                      <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', textAlign: 'center', zIndex: 10 }}>
                        <div className="glass-panel" style={{ display: 'inline-block', padding: '0.5rem 1.5rem', borderRadius: '999px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-ink)' }}>Running AI habitat scan...</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {precheckError ? (
                    <div className="precheck-recovery" aria-live="polite" style={{ display: 'grid', gap: '1rem' }}>
                      <InlineNotice tone="warning">
                        <strong>{precheckFailureCopy(precheckError).title}</strong>{' '}
                        {precheckFailureCopy(precheckError).helper}
                      </InlineNotice>
                      {import.meta.env.DEV ? (
                        <div
                          className="panel panel--muted"
                          style={{
                            padding: '0.85rem 1rem',
                            display: 'grid',
                            gap: '0.35rem',
                          }}
                        >
                          <span className="detail-grid__label">Dev diagnostics</span>
                          <span className="caption-text">
                            API base URL: {precheckError.apiBaseUrl ?? 'Unavailable'}
                          </span>
                          <span className="caption-text">
                            Failure path: {precheckError.transport === 'network' ? 'transport' : 'http'}
                          </span>
                          {precheckError.status ? (
                            <span className="caption-text">HTTP status: {precheckError.status}</span>
                          ) : null}
                          {precheckError.health ? (
                            <span className="caption-text">
                              Health: database {precheckError.health.database ? 'ready' : 'down'}, model{' '}
                              {precheckError.health.model ? 'ready' : 'down'}, postgis{' '}
                              {precheckError.health.postgis ? 'ready' : 'down'}
                            </span>
                          ) : precheckError.kind === 'network' ? (
                            <span className="caption-text">
                              Health probe did not reach the backend.
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <button type="button" className="button button--secondary" onClick={retryPrecheck}>
                        Retry backend pre-check
                      </button>
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

                  {selectedStack ? (
                    <InlineNotice tone="success">
                      ✓ Photo will be stacked onto existing report {selectedStack.reference}.
                    </InlineNotice>
                  ) : null}
                  {hasChosenSeparateReport ? (
                    <InlineNotice tone="success">
                      ✓ You chose to file a separate report for this nearby location.
                    </InlineNotice>
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
                    <div className="panel panel--muted" style={{ padding: '0.5rem 0.75rem', marginTop: '0.5rem' }}>
                      <p style={{ margin: 0, color: 'var(--color-ink-soft)', lineHeight: 1.4, fontSize: '0.75rem' }}>
                        <strong>Note:</strong> {precheck.prediction.advisoryText} AI results are advisory.
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="report-slide__actions">
                  <button
                    type="button"
                    className="button button--primary"
                    style={{ width: '100%' }}
                    disabled={!precheckReady || needsStackDecision}
                    onClick={() => setCurrentStep(4)}
                  >
                    Continue to submit
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Slide 4: Submit */}
          <div className="report-slide">
            {currentStep === 4 && (
              <>
                <div className="report-slide__content">
                  <div className="report-step-layout">
                    <div className="stack-md">

                      {precheck ? (
                        <PredictionEvidencePanelV2
                          prediction={precheck.prediction}
                          title="Final AI advisory"
                          imageUrl={precheckImageUrl}
                          compact
                          showDetections
                        />
                      ) : null}
                    </div>

                    <div className="panel report-submit-panel stack-md">
                      <div>
                        <span className="detail-grid__label">Submission summary</span>
                        <h2>Final confirmation</h2>
                      </div>

                      {finalLocation ? (
                        <StaticReceiptMap location={finalLocation} />
                      ) : null}

                      <div className="detail-grid">
                        <div>
                          <span className="detail-grid__label">Captured timestamp</span>
                          <strong>{draft.capturedAt ? formatTimestamp(draft.capturedAt) : 'Now'}</strong>
                        </div>
                        <div>
                          <span className="detail-grid__label">Pin coordinates</span>
                          <strong>
                            {finalLocation ? `${formatCoordinate(finalLocation.latitude)}, ${formatCoordinate(finalLocation.longitude)}` : 'Missing'}
                          </strong>
                        </div>
                        <div>
                          <span className="detail-grid__label">Stacked group</span>
                          <strong>{selectedStackReference ? `Stacked on ${selectedStackReference}` : 'New separate report'}</strong>
                        </div>
                        <div>
                          <span className="detail-grid__label">Consent accepted</span>
                          <strong style={{ color: 'var(--color-accent)' }}>Yes (public-image-pin-ai-v2)</strong>
                        </div>
                      </div>

                      {submitError ? <InlineNotice tone="warning">{submitError}</InlineNotice> : null}
                    </div>
                  </div>
                </div>

                <div className="report-slide__actions">
                  <button
                    type="button"
                    className="button button--primary"
                    style={{ width: '100%' }}
                    disabled={isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? (
                      'Submitting...'
                    ) : selectedStackReference ? (
                      <>
                        Submit stacked report
                        <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}> Submit stacked report photo</span>
                      </>
                    ) : (
                      <>
                        Submit public report
                        <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}> Submit new public report</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Stepper Navigation */}
      <div className="report-bottom-stepper">
        <nav className="report-stepper-premium" aria-label="Progress">
          <div className="report-stepper-premium__line-bg" />
          <div
            className="report-stepper-premium__line-progress"
            style={{ width: `${(currentStep / (reportSteps.length - 1)) * 100}%` }}
          />
          {reportSteps.map((step, index) => {
            const isCompleted = stepIsComplete(index)
            const isActive = index === currentStep
            const canJump = canOpenStep(index)
            return (
              <button
                key={step.title}
                type="button"
                className={`report-stepper-premium__item${
                  isActive ? ' report-stepper-premium__item--active' : ''
                }${isCompleted ? ' report-stepper-premium__item--complete' : ''}`}
                disabled={!canJump}
                onClick={() => goToStep(index)}
                title={stepBlockedReason(index) || step.description}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${index + 1}. ${step.title}. ${
                  stepBlockedReason(index) || step.description
                }`}
              >
                <span className="report-stepper-premium__circle" />
              </button>
            )
          })}
        </nav>
        <div className="report-stepper-premium__status-text">
          Step {currentStep + 1} of {reportSteps.length} • <strong>{selectedStep.title}</strong>
        </div>
      </div>

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
  )
}
