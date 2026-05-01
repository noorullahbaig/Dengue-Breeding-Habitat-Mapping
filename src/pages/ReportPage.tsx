import { useNavigate } from 'react-router-dom'
import { InlineNotice } from '@/components/InlineNotice'
import { SectionHeading } from '@/components/SectionHeading'
import { useReportDraft } from '@/app/useReportDraft'
import { CameraCapture } from '@/features/report/CameraCapture'
import { LocationCapturePanel } from '@/features/report/LocationCapturePanel'
import { StepHeader } from '@/features/report/StepHeader'
import { isWithinServiceArea, SERVICE_AREA_ERROR } from '@/lib/serviceArea'

export function ReportPage() {
  const navigate = useNavigate()
  const { draft, updateDraft } = useReportDraft()
  const selectedLocation = draft.correctedLocation ?? draft.detectedLocation
  const locationIsInServiceArea = selectedLocation ? isWithinServiceArea(selectedLocation) : false
  const readyForReview = Boolean(draft.photoEvidence && selectedLocation && locationIsInServiceArea)
  const readinessItems = [
    {
      label: 'Photo evidence added',
      complete: Boolean(draft.photoEvidence),
    },
    {
      label: 'Location is within Kuala Lumpur',
      complete: Boolean(selectedLocation && locationIsInServiceArea),
    },
    {
      label: 'Optional note can stay blank in this demo',
      complete: true,
    },
  ]
  const remainingItems = readinessItems.filter((item) => !item.complete).map((item) => item.label)

  return (
    <div className="page page--report">
      <SectionHeading
        variant="compact"
        eyebrow="Resident report"
        title="Report a suspected site in three short steps."
        description="Add one photo, confirm one location, then review before you submit. This flow stays anonymous and keeps the map context in the background."
      />

      <div className="report-layout">
        <div className="stack-lg">
          <div className="flow-card flow-card--bare">
            <StepHeader
              currentStep={1}
              totalSteps={3}
              title="Add one clear photo"
              description="Use the browser camera when possible, or upload one photo from the device fallback."
            />
            <CameraCapture
              previewUrl={draft.photoPreviewUrl}
              photoName={draft.photoEvidence?.name}
              onFileReady={(file, previewUrl) => {
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
              }}
            />
          </div>

          <div className="flow-card flow-card--bare">
            <StepHeader
              currentStep={2}
              totalSteps={3}
              title="Confirm the location"
              description="Location is requested so the report can be reviewed on the map. You will confirm before the exact public pin is published."
            />
            <LocationCapturePanel
              location={selectedLocation}
              onLocationChange={(location) => {
                updateDraft({
                  detectedLocation: location,
                  correctedLocation: null,
                })
              }}
            />
          </div>

          <div className="flow-card flow-card--bare">
            <span className="step-header__eyebrow">Optional context</span>
            <h2 className="step-header__title">Add a short note only if it helps.</h2>
            <p className="caption-text">
              Most residents can leave this blank in the current prototype.
            </p>
            <label className="field">
              <span className="field__label">Optional note</span>
              <textarea
                className="field__input field__input--textarea"
                placeholder="Example: drain inlet outside Block C, stagnant water after rain."
                value={draft.notes ?? ''}
                onChange={(event) => updateDraft({ notes: event.target.value })}
              />
            </label>
          </div>

          <InlineNotice>
            No identity is required in this version. Photos and exact pins become public only after confirmation on the review screen.
          </InlineNotice>
        </div>

        <aside className="flow-card report-summary">
          <span className="step-header__eyebrow">Step 3</span>
          <h2 className="step-header__title">Review and submit on the next screen.</h2>
          <InlineNotice tone={readyForReview ? 'success' : 'neutral'}>
            {readyForReview
              ? 'Ready for final review. You will confirm public image and exact-pin publication before submission.'
              : `Still needed: ${remainingItems.join(' and ')}.`}
          </InlineNotice>
          {selectedLocation && !locationIsInServiceArea ? (
            <InlineNotice tone="warning">{SERVICE_AREA_ERROR}</InlineNotice>
          ) : null}
          <div className="readiness-list">
            {readinessItems.map((item) => (
              <div
                key={item.label}
                className={`readiness-item${item.complete ? ' readiness-item--done' : ''}`}
              >
                <strong>{item.label}</strong>
              </div>
            ))}
          </div>
          <p className="caption-text">
            New submissions publish through the local backend when it is running.
          </p>
          <button
            type="button"
            className="button"
            disabled={!readyForReview}
            onClick={() => navigate('/report/review')}
          >
            Continue to review
          </button>
        </aside>
      </div>
    </div>
  )
}
