import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { InlineNotice } from '@/components/InlineNotice'
import { SectionHeading } from '@/components/SectionHeading'
import { useReportDraft } from '@/app/useReportDraft'
import { useServices } from '@/app/useServices'
import { StepHeader } from '@/features/report/StepHeader'
import { LocationReviewMap } from '@/features/report/LocationReviewMap'
import { NearbyReportPrompt } from '@/features/report/NearbyReportPrompt'
import { formatCoordinate, formatTimestamp } from '@/lib/formatters'
import { predictHabitatForDraft } from '@/lib/prediction'
import { isWithinServiceArea, SERVICE_AREA_ERROR } from '@/lib/serviceArea'
import type { NearbyReportCandidate, PredictionSummary } from '@/types/report'

export function ReportReviewPage() {
  const navigate = useNavigate()
  const { reportsService } = useServices()
  const { draft, setLastSubmittedReference, updateDraft } = useReportDraft()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [hasPublicConsent, setHasPublicConsent] = useState(false)
  const [nearbyPrediction, setNearbyPrediction] = useState<PredictionSummary | null>(null)
  const [nearbyCandidates, setNearbyCandidates] = useState<NearbyReportCandidate[]>([])
  const [isNearbyLoading, setIsNearbyLoading] = useState(false)
  const [nearbyError, setNearbyError] = useState('')
  const [isNearbyPromptOpen, setIsNearbyPromptOpen] = useState(false)
  const [selectedStackReference, setSelectedStackReference] = useState('')
  const [decisionLocationSignature, setDecisionLocationSignature] = useState('')

  const activeLocation = draft.correctedLocation ?? draft.detectedLocation
  const activeLocationIsInServiceArea = activeLocation ? isWithinServiceArea(activeLocation) : false
  const locationSignature = activeLocation
    ? `${activeLocation.latitude.toFixed(5)}:${activeLocation.longitude.toFixed(5)}`
    : ''
  const selectedStack = nearbyCandidates.find(
    (candidate) => candidate.reference === selectedStackReference,
  )

  useEffect(() => {
    if (!activeLocation || !locationSignature || !draft.photoFile) {
      return
    }

    if (!activeLocationIsInServiceArea) {
      setNearbyPrediction(null)
      setNearbyCandidates([])
      setSelectedStackReference('')
      setNearbyError('')
      setIsNearbyLoading(false)
      return
    }

    let isMounted = true
    setIsNearbyLoading(true)
    setNearbyError('')

    if (decisionLocationSignature !== locationSignature) {
      setSelectedStackReference('')
    }

    reportsService
      .findNearbyReportCandidates({
        ...draft,
        correctedLocation: activeLocation,
      })
      .then((result) => {
        if (!isMounted) {
          return
        }

        setNearbyPrediction(result.prediction)
        setNearbyCandidates(result.candidates)
        if (result.candidates.length > 0 && decisionLocationSignature !== locationSignature) {
          setIsNearbyPromptOpen(true)
        }
      })
      .catch(() => {
        if (isMounted) {
          setNearbyPrediction(null)
          setNearbyCandidates([])
          setNearbyError('Nearby report matching is unavailable, but you can still submit.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsNearbyLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [
    activeLocation,
    activeLocationIsInServiceArea,
    decisionLocationSignature,
    draft,
    locationSignature,
    reportsService,
  ])

  if (
    !draft.photoFile ||
    !draft.photoPreviewUrl ||
    !draft.photoEvidence ||
    !draft.capturedAt ||
    !activeLocation
  ) {
    return <Navigate to="/report" replace />
  }

  const previewPrediction = nearbyPrediction ?? predictHabitatForDraft(draft)

  async function handleSubmit() {
    if (!hasPublicConsent) {
      setSubmitError('Confirm that the image and exact pin can be public before submitting.')
      return
    }

    if (!activeLocationIsInServiceArea) {
      setSubmitError(SERVICE_AREA_ERROR)
      return
    }

    if (nearbyCandidates.length > 0 && decisionLocationSignature !== locationSignature) {
      setIsNearbyPromptOpen(true)
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const submitted = await reportsService.createReport({
        ...draft,
        correctedLocation: activeLocation,
      }, {
        stackParentReference: selectedStackReference || undefined,
      })
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

  return (
    <div className="page">
      <SectionHeading
        variant="compact"
        eyebrow="Final review"
        title="Confirm the pin and image before submission."
        description="This last step keeps the resident in control before publication: the submitted image and exact pin will become visible on the public map."
      />

      <div className="flow-card">
        <StepHeader
          currentStep={3}
          totalSteps={3}
          title="Review and submit"
          description="If the browser-captured location is slightly off, move it before you publish the report."
        />

        <div className="review-layout">
          <div className="stack-md">
            <img
              src={draft.photoPreviewUrl}
              alt="Evidence selected for submission"
              className="evidence-preview"
            />

            <div className="detail-grid">
              <div>
                <span className="detail-grid__label">Captured</span>
                <strong>{formatTimestamp(draft.capturedAt)}</strong>
              </div>
              <div>
                <span className="detail-grid__label">Latitude</span>
                <strong>{formatCoordinate(activeLocation.latitude)}</strong>
              </div>
              <div>
                <span className="detail-grid__label">Longitude</span>
                <strong>{formatCoordinate(activeLocation.longitude)}</strong>
              </div>
              <div>
                <span className="detail-grid__label">Photo name</span>
                <strong>{draft.photoEvidence.name}</strong>
              </div>
            </div>

            <InlineNotice>
              {previewPrediction.advisoryText} Officers review the report; the system does not make the final determination.
            </InlineNotice>

            <label className="consent-box">
              <input
                type="checkbox"
                checked={hasPublicConsent}
                onChange={(event) => setHasPublicConsent(event.target.checked)}
              />
              <span>
                I confirm this image and exact pin can be shown publicly as crowdsourced dengue
                habitat evidence. My optional note stays private for officer review.
              </span>
            </label>

            {selectedStack ? (
              <InlineNotice tone="success">
                Your image will be added to existing public report {selectedStack.reference}.
              </InlineNotice>
            ) : null}

            {!activeLocationIsInServiceArea ? (
              <InlineNotice tone="warning">
                {SERVICE_AREA_ERROR} Drag the pin inside the Kuala Lumpur boundary before submitting.
              </InlineNotice>
            ) : null}

            {isNearbyLoading ? (
              <InlineNotice>
                Checking for nearby reports with the same predicted habitat class...
              </InlineNotice>
            ) : null}

            {nearbyError ? <InlineNotice tone="warning">{nearbyError}</InlineNotice> : null}

            {draft.notes ? (
              <div className="panel panel--muted">
                <span className="detail-grid__label">Resident note</span>
                <p>{draft.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="stack-md">
            <LocationReviewMap
              location={activeLocation}
              onLocationChange={(location) => updateDraft({ correctedLocation: location })}
            />
            <p className="caption-text">
              The public map will show this exact pin with a public thumbnail after submission. The
              blue outline marks the Kuala Lumpur service area.
            </p>
          </div>
        </div>
      </div>

      {submitError ? <InlineNotice tone="warning">{submitError}</InlineNotice> : null}

      <div className="cluster-row cluster-row--between">
        <Link to="/report" className="button button--ghost">
          Back to editing
        </Link>
        <button
          type="button"
          className="button"
          onClick={handleSubmit}
          disabled={
            isSubmitting || isNearbyLoading || !hasPublicConsent || !activeLocationIsInServiceArea
          }
        >
          {isSubmitting ? 'Submitting...' : selectedStackReference ? 'Submit stacked report' : 'Submit public report'}
        </button>
      </div>

      {isNearbyPromptOpen && nearbyCandidates.length > 0 ? (
        <NearbyReportPrompt
          candidates={nearbyCandidates}
          onStack={(reference) => {
            setSelectedStackReference(reference)
            setDecisionLocationSignature(locationSignature)
            setIsNearbyPromptOpen(false)
          }}
          onCreateSeparate={() => {
            setSelectedStackReference('')
            setDecisionLocationSignature(locationSignature)
            setIsNearbyPromptOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
