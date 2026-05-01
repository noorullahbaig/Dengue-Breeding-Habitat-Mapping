import { SectionHeading } from '@/components/SectionHeading'

export function OfficerPlaceholderPage() {
  return (
    <div className="page">
      <SectionHeading
        variant="compact"
        eyebrow="Reserved for iteration two"
        title="Officer review is marked coming soon for this demo."
        description="The route stays in place so the app structure is future-ready, but the detailed dashboard, evidence viewer, hotspot overlays, and triage controls will land in the next cycle."
      />

      <div className="panel">
        <ul className="status-list">
          <li>Review queue with report cards and map coordination.</li>
          <li>Officer tools for private notes, stacked submissions, and follow-up decisions.</li>
          <li>Hotspot overlays and prioritization context.</li>
          <li>Status update controls and follow-up logging.</li>
        </ul>
      </div>
    </div>
  )
}
