import { ArrowLeft, ChevronRight, Navigation, X } from "lucide-react";
import { ButtonLink, IconButton, Surface } from "@/components/ui";
import {
	formatCalendarDate,
	formatCompactCalendarDate,
	formatConfidenceScore,
	formatHabitatLabel,
	formatStatusLabel,
} from "@/lib/formatters";
import type { PublicReportGroupSelection } from "@/pages/components/PublicReportsMap";
import type { PublicHotspot, PublicMapReport } from "@/types/report";

interface MapHotspotSheetProps {
	hotspot: PublicHotspot;
	onClose: () => void;
}

export function MapHotspotSheet({ hotspot, onClose }: MapHotspotSheetProps) {
	return (
		<div className="map-mobile-sheet map-mobile-sheet--hotspot">
			<Surface
				as="section"
				className="map-detail-sheet hotspot-detail-card"
				aria-labelledby="hotspot-sheet-title"
			>
				<div className="map-detail-sheet__handle" aria-hidden="true" />
				<IconButton
					onClick={onClose}
					className="map-detail-sheet__close"
					aria-label="Close hotspot details"
				>
					<X size={20} />
				</IconButton>
				<div className="hotspot-detail-card__badge">
					<span className="hotspot-detail-card__badge-dot" />
					Active hotspot
				</div>
				<h2 id="hotspot-sheet-title" className="map-detail-sheet__title">
					{hotspot.locality}
				</h2>
				<p className="map-detail-sheet__subtitle">{hotspot.district}</p>
				<dl className="map-detail-facts map-detail-facts--three">
					<div>
						<dt>Cases</dt>
						<dd className="map-detail-facts__danger">
							{hotspot.cumulativeCases ?? "N/A"}
						</dd>
					</div>
					<div>
						<dt>Duration</dt>
						<dd>
							{hotspot.outbreakDurationDays === null
								? "N/A"
								: `${hotspot.outbreakDurationDays}d`}
						</dd>
					</div>
					<div>
						<dt>Start date</dt>
						<dd>{formatCompactCalendarDate(hotspot.outbreakStartDate)}</dd>
					</div>
				</dl>
			</Surface>
		</div>
	);
}

interface MapReportSheetProps {
	group: PublicReportGroupSelection;
	selectedReport?: PublicMapReport;
	onSelectReport: (report: PublicMapReport) => void;
	onBack: () => void;
	onClose: () => void;
}

function observationLabel(count: number) {
	return `${count} ${count === 1 ? "observation" : "observations"}`;
}

function ReportSummary({ report }: { report: PublicMapReport }) {
	return (
		<>
			<div className="report-sheet__status-row">
				<span
					className="report-detail-card__status"
					data-status={report.status}
				>
					{formatStatusLabel(report.status)}
				</span>
			</div>
			<h3 className="map-detail-sheet__location">{report.neighborhood}</h3>
			<dl className="map-detail-facts map-detail-facts--report">
				<div>
					<dt>Habitat</dt>
					<dd>{formatHabitatLabel(report.prediction.label)}</dd>
				</div>
				<div>
					<dt>Confidence</dt>
					<dd>{formatConfidenceScore(report.prediction.confidence)}</dd>
				</div>
				<div>
					<dt>Latest update</dt>
					<dd>{formatCalendarDate(report.latestReportedAt)}</dd>
				</div>
				{report.reportCount > 1 ? (
					<div>
						<dt>At this location</dt>
						<dd>{observationLabel(report.reportCount)}</dd>
					</div>
				) : null}
			</dl>
		</>
	);
}

export function MapReportSheet({
	group,
	selectedReport,
	onSelectReport,
	onBack,
	onClose,
}: MapReportSheetProps) {
	const isCluster = group.reports.length > 1;
	const title = selectedReport
		? "Report"
		: `${group.totalReportCount} reports ${group.isExactStack ? "at this location" : "in this area"}`;

	return (
		<div className="map-mobile-sheet map-mobile-sheet--report">
			<Surface
				as="section"
				className="map-detail-sheet report-sheet"
				aria-labelledby="report-sheet-title"
			>
				<div className="map-detail-sheet__handle" aria-hidden="true" />
				{selectedReport && isCluster ? (
					<IconButton
						onClick={onBack}
						className="map-detail-sheet__back"
						aria-label="Back to report list"
					>
						<ArrowLeft size={20} />
					</IconButton>
				) : null}
				<IconButton
					onClick={onClose}
					className="map-detail-sheet__close"
					aria-label="Close report details"
				>
					<X size={20} />
				</IconButton>
				<header
					className={`map-detail-sheet__header ${selectedReport && isCluster ? "map-detail-sheet__header--with-back" : ""}`}
				>
					<h2 id="report-sheet-title" className="map-detail-sheet__title">
						{title}
					</h2>
					{!selectedReport ? (
						<p className="map-detail-sheet__subtitle">
							Select a report to view its summary.
						</p>
					) : null}
				</header>

				{selectedReport ? (
					<>
						<div className="report-sheet__summary">
							<ReportSummary report={selectedReport} />
						</div>
						<footer className="map-detail-sheet__footer">
							<ButtonLink
								to={`/map/reports/${selectedReport.reference}`}
								variant="primary"
								className="map-detail-sheet__primary-action"
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									width: "100%",
									gap: "8px"
								}}
							>
								<Navigation size={17} /> View report details
							</ButtonLink>
						</footer>
					</>
				) : (
					<ul className="report-cluster-list">
						{group.reports.map((report) => (
							<li key={report.id}>
								<button
									type="button"
									className="report-cluster-row"
									aria-label={`Open report for ${report.neighborhood}`}
									onClick={() => onSelectReport(report)}
								>
									<span className="report-cluster-row__main">
										<span className="report-cluster-row__topline">
											<strong>{report.neighborhood}</strong>
											<span
												className="report-detail-card__status"
												data-status={report.status}
											>
												{formatStatusLabel(report.status)}
											</span>
										</span>
										<span className="report-cluster-row__meta">
											{formatHabitatLabel(report.prediction.label)} ·{" "}
											{formatConfidenceScore(report.prediction.confidence)}
										</span>
										<span className="report-cluster-row__date">
											{formatCalendarDate(report.latestReportedAt)}
											{report.reportCount > 1
												? ` · ${observationLabel(report.reportCount)}`
												: ""}
										</span>
									</span>
									<ChevronRight size={20} aria-hidden="true" />
								</button>
							</li>
						))}
					</ul>
				)}
			</Surface>
		</div>
	);
}
