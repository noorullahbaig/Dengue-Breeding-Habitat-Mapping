import { StatusBadge } from '@/features/shared/StatusBadge'
import {
  formatHabitatLabel,
  formatTimestamp,
} from '@/lib/formatters'
import type { NearbyReportCandidate } from '@/types/report'

interface NearbyReportPromptProps {
  candidates: NearbyReportCandidate[]
  onStack: (reference: string) => void
  onCreateSeparate: () => void
}

export function NearbyReportPrompt({
  candidates,
  onStack,
  onCreateSeparate,
}: NearbyReportPromptProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="nearby-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nearby-report-title"
      >
        <div className="stack-md">
          <div>
            <span className="step-header__eyebrow">Nearby report found</span>
            <h2 id="nearby-report-title">Is this the same breeding site?</h2>
            <p>
              These reports are nearby and have the same predicted habitat class. Add your photo to
              the same public report if it is the same physical drain, tire, container, or site.
            </p>
          </div>

          <div className="nearby-list">
            {candidates.map((candidate) => (
              <article className="nearby-card" key={candidate.reference}>
                <img
                  src={candidate.thumbnailUrl}
                  alt=""
                  className="nearby-card__image"
                />
                <div className="nearby-card__body">
                  <div className="cluster-row cluster-row--between">
                    <strong>{candidate.reference}</strong>
                    <StatusBadge status={candidate.status} />
                  </div>
                  <div className="nearby-card__meta">
                    <span>{formatHabitatLabel(candidate.habitatClass)}</span>
                    <span>{candidate.neighborhood}</span>
                    <span>Nearby match</span>
                    <span>
                      {candidate.reportCount === 1
                        ? '1 report'
                        : `${candidate.reportCount} reports`}
                    </span>
                    <span>Latest {formatTimestamp(candidate.latestReportedAt)}</span>
                  </div>
                  <button
                    type="button"
                    className="button"
                    onClick={() => onStack(candidate.reference)}
                  >
                    Add to this report
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="cluster-row cluster-row--between">
            <p className="caption-text">
              Choose separate report if your photo is a different nearby object.
            </p>
            <button
              type="button"
              className="button button--secondary"
              onClick={onCreateSeparate}
            >
              Create separate report
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
