import { ImageIcon, Navigation, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useServices } from "@/app/useServices";
import { InlineNotice } from "@/components/InlineNotice";
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
	const [showHotspots, setShowHotspots] = useState(true);

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
					<div
						className="loading-state"
						style={{
							height: "100%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							background: "#cbdce6",
							color: "var(--color-ink-soft)",
							fontWeight: 600,
						}}
					>
						Updating report markers...
					</div>
				)}
			</div>

			{/* Floating Header Panel */}
			<div className="floating-header-panel floating-glass">
				<span
					className="section-heading__eyebrow"
					style={{ fontSize: "0.62rem", letterSpacing: "0.06em", margin: 0 }}
				>
					Public Awareness Map
				</span>
				<h1 className="floating-header-panel__title">Kuala Lumpur Hotspots</h1>
				<ul className="floating-header-panel__trust">
					<li>Active outbreak zones updated real-time (iDengue)</li>
					<li>Resident reporting points with privacy consent</li>
				</ul>
			</div>

			{/* Floating Filters (Scrolling Pills) */}
			<div className="floating-filter-container">
				{/* Status Filter */}
				<div className="filter-pill-group">
					<span className="filter-pill-label">Status</span>
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
					<span className="filter-pill-label">Habitat</span>
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

				{/* Hotspots Toggle */}
				<div className="filter-pill-group">
					<span className="filter-pill-label">Overlay</span>
					<div className="filter-pills-list">
						<button
							type="button"
							className={`filter-pill-button ${showHotspots ? "filter-pill-button--active" : ""}`}
							onClick={() => setShowHotspots(!showHotspots)}
						>
							Outbreak Zones
						</button>
					</div>
				</div>
			</div>

			{/* Inline Errors if hotspots fail to load */}
			{hotspotError ? (
				<div
					style={{
						position: "absolute",
						top: "130px",
						left: "16px",
						zIndex: 100,
						maxWidth: "300px",
					}}
				>
					<InlineNotice tone="warning">{hotspotError}</InlineNotice>
				</div>
			) : null}

			{/* Floating Action Buttons Removed */}

			{/* Detail Hotspot View (Shown only when selected) */}
			{selectedHotspotId && (
				<div
					className="hotspot-carousel-container hotspot-detail-container"
					style={{ paddingBottom: "16px", pointerEvents: "none" }}
				>
					{(() => {
						const hotspot = hotspots.find((h) => h.id === selectedHotspotId);
						if (!hotspot) return null;
						return (
							<div className="hotspot-detail-card">
								<button
									type="button"
									onClick={() => setSelectedHotspotId(undefined)}
									className="hotspot-detail-card__close"
									aria-label="Close hotspot details"
								>
									<X size={18} />
								</button>

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
										<span
											className="hotspot-detail-card__metric-value"
											style={{ fontSize: "0.9rem" }}
										>
											{formatCompactCalendarDate(hotspot.outbreakStartDate)}
										</span>
									</div>
								</div>
							</div>
						);
					})()}
				</div>
			)}

			{/* Detail Report View (Shown only when selected) */}
			{selectedReportId && (
				<div
					className="hotspot-carousel-container hotspot-detail-container"
					style={{ paddingBottom: "16px", pointerEvents: "none" }}
				>
					{(() => {
						const report = reports.find((r) => r.id === selectedReportId);
						if (!report) return null;
						return (
							<div className="hotspot-detail-card report-detail-card">
								<button
									type="button"
									onClick={() => setSelectedReportId(undefined)}
									className="hotspot-detail-card__close"
									aria-label="Close report details"
								>
									<X size={18} />
								</button>

								<div
									style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
								>
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
									<div
										className="report-detail-card__evidence-wrapper"
										style={{ pointerEvents: "auto" }}
									>
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
										<div
											className="hotspot-detail-card__metric-item"
											style={{ gridColumn: "span 2" }}
										>
											<span className="hotspot-detail-card__metric-label">
												Latest Update
											</span>
											<span
												className="hotspot-detail-card__metric-value"
												style={{ fontSize: "0.9rem" }}
											>
												{formatCalendarDate(report.latestReportedAt)}
											</span>
										</div>
									</div>
								)}

								{!showReportEvidence && (
									<div className="report-detail-card__actions">
										<button
											type="button"
											className="button button--secondary report-detail-card__action-btn"
											onClick={() => setShowReportEvidence(true)}
										>
											<ImageIcon size={16} /> View Evidence
										</button>
										<Link
											to={`/map/reports/${report.reference}`}
											className="button button--primary report-detail-card__action-btn"
										>
											<Navigation size={16} /> View Details
										</Link>
									</div>
								)}
							</div>
						);
					})()}
				</div>
			)}
		</div>
	);
}
