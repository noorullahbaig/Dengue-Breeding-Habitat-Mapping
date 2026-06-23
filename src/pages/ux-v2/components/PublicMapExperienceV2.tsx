import { ImageIcon, Navigation, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useServices } from "@/app/useServices";
import { Notice, Surface, Button, ButtonLink, IconButton } from "@/components/ui";
import {
	formatCalendarDate,
	formatCompactCalendarDate,
	formatConfidenceScore,
	formatHabitatLabel,
	formatStatusLabel,
} from "@/lib/formatters";
import { toLeafletPosition } from "@/lib/map";
import { PredictionEvidencePanelV2 } from "@/pages/ux-v2/components/PredictionEvidencePanelV2";
import { PublicReportsMapV2 } from "@/pages/ux-v2/components/PublicReportsMapV2";
import type {
	HabitatClass,
	PublicHotspot,
	PublicMapReport,
	SubmissionStatus,
} from "@/types/report";

type StatusFilter = SubmissionStatus | "all";
type HabitatFilter = HabitatClass | "all";

export function PublicMapExperienceV2() {
	const { mapService } = useServices();
	const [reports, setReports] = useState<PublicMapReport[]>([]);
	const [hotspots, setHotspots] = useState<PublicHotspot[]>([]);
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [habitatFilter, setHabitatFilter] = useState<HabitatFilter>("all");
	const [isReportsLoading, setIsReportsLoading] = useState(true);
	const [hotspotError, setHotspotError] = useState("");
	const [showHotspots, _setShowHotspots] = useState(true);

	const [centerOverride, setCenterOverride] = useState<
		[number, number] | undefined
	>(undefined);
	const [selectedHotspotId, setSelectedHotspotId] = useState<
		string | undefined
	>(undefined);
	const [selectedReportId, setSelectedReportId] = useState<string | undefined>(
		undefined,
	);
	const [showReportEvidence, setShowReportEvidence] = useState(false);

	const mapSignature =
		[
			reports.map((report) => report.id).join(":"),
			hotspots.map((hotspot) => hotspot.id).join(":"),
			hotspotError,
			centerOverride ? `${centerOverride[0]}:${centerOverride[1]}` : "",
		]
			.filter(Boolean)
			.join("|") || `${statusFilter}:${habitatFilter}:empty`;

	useEffect(() => {
		let isMounted = true;
		const reportsPromise = mapService.listPublicReports(undefined, {
			status: statusFilter,
			habitatClass: habitatFilter,
		});

		reportsPromise
			.then((nextReports) => {
				if (isMounted) {
					setReports(nextReports);
				}
			})
			.catch(() => {
				if (isMounted) {
					setReports([]);
				}
			})
			.finally(() => {
				if (isMounted) {
					setIsReportsLoading(false);
				}
			});

		return () => {
			isMounted = false;
		};
	}, [habitatFilter, mapService, statusFilter]);

	useEffect(() => {
		let isMounted = true;
		const hotspotsPromise = mapService.listHotspots();

		hotspotsPromise
			.then((nextHotspots) => {
				if (isMounted) {
					setHotspots(nextHotspots);
					setHotspotError("");
				}
			})
			.catch(() => {
				if (isMounted) {
					setHotspots([]);
					setHotspotError("Hotspot context is temporarily unavailable.");
				}
			});

		return () => {
			isMounted = false;
		};
	}, [mapService]);

	function handleStatusFilterChange(nextStatus: StatusFilter) {
		if (statusFilter === nextStatus) return;
		setIsReportsLoading(true);
		setStatusFilter(nextStatus);
		setCenterOverride(undefined);
		setSelectedHotspotId(undefined);
		setSelectedReportId(undefined);
		setShowReportEvidence(false);
	}

	function handleHabitatFilterChange(nextHabitat: HabitatFilter) {
		if (habitatFilter === nextHabitat) return;
		setIsReportsLoading(true);
		setHabitatFilter(nextHabitat);
		setCenterOverride(undefined);
		setSelectedHotspotId(undefined);
		setSelectedReportId(undefined);
		setShowReportEvidence(false);
	}

	function handleHotspotClick(hotspot: PublicHotspot) {
		const coords = toLeafletPosition(hotspot.center);
		setCenterOverride(coords);
		setSelectedHotspotId(hotspot.id);
		setSelectedReportId(undefined);
		setShowReportEvidence(false);
	}

	function handleReportClick(report: PublicMapReport) {
		const coords = toLeafletPosition(report.publicLocation);
		setCenterOverride(coords);
		setSelectedReportId(report.id);
		setSelectedHotspotId(undefined);
		setShowReportEvidence(false);
	}

	return (
		<div className="page page--map-fullscreen">
			{/* Background Interactive Map */}
			<div className="map-fullscreen-container">
				{!isReportsLoading ? (
					<PublicReportsMapV2
						key={mapSignature}
						reports={reports}
						hotspots={hotspots}
						showHotspots={showHotspots}
						hotspotError={hotspotError}
						centerOverride={centerOverride}
						onSelectHotspot={handleHotspotClick}
						onSelectReport={handleReportClick}
					/>
				) : (
					<div className="loading-state map-fullscreen-loading">
						Updating report markers...
					</div>
				)}
			</div>

			{/* Compact Floating Header Chip */}
			<div className="floating-header-chip floating-glass">
				<span className="floating-header-chip__eyebrow">LIVE MAP</span>
				<div className="floating-header-chip__title-row">
					<h1 className="floating-header-chip__title">KL Dengue Hotspots</h1>
				</div>
			</div>

			{/* Floating Filters (Scrolling Pills) */}
			<div className="floating-filter-container">
				{/* Status Filter */}
				<div className="filter-pill-group">
					<span className="filter-pill-label">STATUS</span>
					<div className="filter-pills-list">
						{(
							[
								"all",
								"submitted",
								"under_review",
								"prioritized",
								"action_recorded",
								"closed",
							] as StatusFilter[]
						).map((status) => (
							<button
								key={status}
								type="button"
								className={`filter-pill-button ${statusFilter === status ? "filter-pill-button--active" : ""}`}
								onClick={() => handleStatusFilterChange(status)}
							>
								{status === "all" ? "All" : formatStatusLabel(status)}
							</button>
						))}
					</div>
				</div>

				{/* Habitat Class Filter */}
				<div className="filter-pill-group">
					<span className="filter-pill-label">TYPE</span>
					<div className="filter-pills-list">
						{(
							[
								"all",
								"tire",
								"drain_inlet",
								"artificial_container",
								"unclassified",
							] as HabitatFilter[]
						).map((habitat) => (
							<button
								key={habitat}
								type="button"
								className={`filter-pill-button ${habitatFilter === habitat ? "filter-pill-button--active" : ""}`}
								onClick={() => handleHabitatFilterChange(habitat)}
							>
								{habitat === "all" ? "All" : formatHabitatLabel(habitat)}
							</button>
						))}
					</div>
				</div>


			</div>

			{/* Inline Errors if hotspots fail to load */}
			{hotspotError ? (
				<div className="map-inline-error">
					<Notice tone="warning">{hotspotError}</Notice>
				</div>
			) : null}

			{/* Floating Action Buttons Removed */}

			{/* Detail Hotspot View (Shown only when selected) */}
			{selectedHotspotId && (
				<div className="hotspot-carousel-container hotspot-detail-container">
					{(() => {
						const hotspot = hotspots.find((h) => h.id === selectedHotspotId);
						if (!hotspot) return null;
						return (
							<Surface className="hotspot-detail-card">
								<IconButton
									onClick={() => setSelectedHotspotId(undefined)}
									className="hotspot-detail-card__close"
									aria-label="Close hotspot details"
								>
									<X size={18} />
								</IconButton>

								<div className="hotspot-detail-card__badge">
									<span className="hotspot-detail-card__badge-dot" />
									Active Outbreak
								</div>

								<h3 className="hotspot-detail-card__locality">
									{hotspot.locality}
								</h3>
								<span className="hotspot-detail-card__district">
									{hotspot.district}
								</span>

								<div className="hotspot-detail-card__metrics">
									<div className="hotspot-detail-card__metric-item">
										<span className="hotspot-detail-card__metric-label">
											Cases
										</span>
										<span className="hotspot-detail-card__metric-value hotspot-detail-card__metric-value--danger">
											{hotspot.cumulativeCases ?? "N/A"}
										</span>
									</div>
									<div className="hotspot-detail-card__metric-item">
										<span className="hotspot-detail-card__metric-label">
											Duration
										</span>
										<span className="hotspot-detail-card__metric-value">
											{hotspot.outbreakDurationDays === null
												? "N/A"
												: `${hotspot.outbreakDurationDays}d`}
										</span>
									</div>
									<div className="hotspot-detail-card__metric-item">
										<span className="hotspot-detail-card__metric-label">
											Start Date
										</span>
									<span className="hotspot-detail-card__metric-value hotspot-detail-card__metric-value--compact">
											{formatCompactCalendarDate(hotspot.outbreakStartDate)}
										</span>
									</div>
								</div>
							</Surface>
						);
					})()}
				</div>
			)}

			{/* Detail Report View (Shown only when selected) */}
			{selectedReportId && (
				<div className="hotspot-carousel-container hotspot-detail-container">
					{(() => {
						const report = reports.find((r) => r.id === selectedReportId);
						if (!report) return null;
						return (
							<Surface className="hotspot-detail-card report-detail-card">
								<IconButton
									onClick={() => setSelectedReportId(undefined)}
									className="hotspot-detail-card__close"
									aria-label="Close report details"
								>
									<X size={18} />
								</IconButton>

								<div className="report-detail-card__status-row">
									<div
										className="report-detail-card__status"
										data-status={report.status}
									>
										{formatStatusLabel(report.status)}
									</div>
								</div>

								<h3 className="hotspot-detail-card__locality">
									{report.neighborhood}
								</h3>
								<span className="hotspot-detail-card__district">
									{formatHabitatLabel(report.prediction.label)} • Confidence:{" "}
									{formatConfidenceScore(report.prediction.confidence)}
								</span>

								{showReportEvidence && report.thumbnailUrl ? (
									<div className="report-detail-card__evidence-wrapper report-detail-card__evidence-wrapper--interactive">
										<PredictionEvidencePanelV2
											prediction={report.prediction}
											imageUrl={report.imageUrl || report.thumbnailUrl}
											imageAlt="AI computer-vision bounding boxes for public evidence"
											compact
											showDetections
										/>
										<button
											type="button"
											className="report-detail-card__evidence-close"
											onClick={() => setShowReportEvidence(false)}
										>
											Hide Image
										</button>
									</div>
								) : (
									<div className="hotspot-detail-card__metrics">
										<div className="hotspot-detail-card__metric-item">
											<span className="hotspot-detail-card__metric-label">
												Reports Here
											</span>
											<span className="hotspot-detail-card__metric-value">
												{report.reportCount}
											</span>
										</div>
										<div className="hotspot-detail-card__metric-item hotspot-detail-card__metric-item--wide">
											<span className="hotspot-detail-card__metric-label">
												Latest Update
											</span>
											<span className="hotspot-detail-card__metric-value hotspot-detail-card__metric-value--compact">
												{formatCalendarDate(report.latestReportedAt)}
											</span>
										</div>
									</div>
								)}

								{!showReportEvidence && (
									<div className="report-detail-card__actions">
										<Button
											variant="secondary"
											className="report-detail-card__action-btn"
											onClick={() => setShowReportEvidence(true)}
										>
											<ImageIcon size={16} /> View Evidence
										</Button>
										<ButtonLink
											to={`/map/reports/${report.reference}`}
											variant="primary"
											className="report-detail-card__action-btn"
										>
											<Navigation size={16} /> View Details
										</ButtonLink>
									</div>
								)}
							</Surface>
						);
					})()}
				</div>
			)}
		</div>
	);
}
