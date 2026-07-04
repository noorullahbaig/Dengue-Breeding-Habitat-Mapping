import { ChevronLeft, ChevronRight, ImageIcon, Navigation, X } from "lucide-react";
import { useEffect, useRef, useState, useCallback, type UIEvent } from "react";
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
import { PredictionEvidencePanel } from "@/pages/components/PredictionEvidencePanel";
import {
	PublicReportsMap,
	type PublicReportGroupSelection,
} from "@/pages/components/PublicReportsMap";
import type {
	HabitatClass,
	PublicHotspot,
	PublicMapReport,
} from "@/types/report";

type HabitatFilter = HabitatClass | "all";

function reportGroupHeading(group: PublicReportGroupSelection) {
	if (group.totalReportCount <= 1) {
		return "Report detail";
	}

	return `${group.totalReportCount} reports ${
		group.isExactStack ? "at this public location" : "in this area"
	}`;
}

function reportLocationCountLabel(reportCount: number) {
	if (reportCount <= 1) {
		return null;
	}

	return "Observations at this location";
}

export function PublicMapExperience() {
	const { mapService } = useServices();
	const [reports, setReports] = useState<PublicMapReport[]>([]);
	const [hotspots, setHotspots] = useState<PublicHotspot[]>([]);
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
	const [selectedReportGroup, setSelectedReportGroup] = useState<
		PublicReportGroupSelection | undefined
	>(undefined);
	const [activeReportIndex, setActiveReportIndex] = useState(0);
	const reportStackCarouselRef = useRef<HTMLDivElement | null>(null);
	const suppressCarouselScrollRef = useRef(false);
	const carouselScrollTimerRef = useRef<number | undefined>(undefined);
	const [showReportEvidence, setShowReportEvidence] = useState(false);

	const mapSignature =
		[
			reports.map((report) => report.id).join(":"),
			hotspots.map((hotspot) => hotspot.id).join(":"),
			hotspotError,
		]
			.filter(Boolean)
			.join("|") || `${habitatFilter}:empty`;

	const selectedReports = selectedReportGroup?.reports ?? [];
	const activeReport =
		selectedReports[
			Math.min(activeReportIndex, Math.max(selectedReports.length - 1, 0))
		];
	const activeReportHasEvidence = Boolean(
		activeReport?.imageUrl || activeReport?.thumbnailUrl,
	);
	const selectedReportGroupHeading = selectedReportGroup
		? reportGroupHeading(selectedReportGroup)
		: "";

	const clearSelectedReportGroup = useCallback(() => {
		setSelectedReportGroup(undefined);
		setActiveReportIndex(0);
		setShowReportEvidence(false);
	}, []);

	useEffect(() => {
		let isMounted = true;
		const reportsPromise = mapService.listPublicReports(undefined, {
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
	}, [habitatFilter, mapService]);

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

	useEffect(() => {
		if (!selectedReportGroup) return;
		if (activeReportIndex < selectedReportGroup.reports.length) return;

		setActiveReportIndex(0);
	}, [activeReportIndex, selectedReportGroup]);

	useEffect(() => {
		if (!selectedReportGroup) return;

		setShowReportEvidence(false);
		const carousel = reportStackCarouselRef.current;
		if (carousel && carousel.clientWidth > 0) {
			const left = activeReportIndex * carousel.clientWidth;
			if (typeof carousel.scrollTo === "function") {
				carousel.scrollTo({ left, behavior: "smooth" });
			} else {
				carousel.scrollLeft = left;
			}
			return;
		}

		const activeSlide = reportStackCarouselRef.current?.children[
			activeReportIndex
		] as HTMLElement | undefined;

		if (typeof activeSlide?.scrollIntoView === "function") {
			activeSlide.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
				inline: "start",
			});
		}
	}, [activeReportIndex, selectedReportGroup]);

	useEffect(() => {
		return () => {
			if (carouselScrollTimerRef.current !== undefined) {
				window.clearTimeout(carouselScrollTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!selectedHotspotId && !selectedReportGroup) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== "Escape") {
				return;
			}

			setSelectedHotspotId(undefined);
			clearSelectedReportGroup();
		}

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [selectedHotspotId, selectedReportGroup, clearSelectedReportGroup]);

	function handleHabitatFilterChange(nextHabitat: HabitatFilter) {
		if (habitatFilter === nextHabitat) return;
		setIsReportsLoading(true);
		setHabitatFilter(nextHabitat);
		setCenterOverride(undefined);
		setSelectedHotspotId(undefined);
		setSelectedReportGroup(undefined);
		setActiveReportIndex(0);
		setShowReportEvidence(false);
	}

	function handleHotspotClick(hotspot: PublicHotspot) {
		const coords = toLeafletPosition(hotspot.center);
		setCenterOverride(coords);
		setSelectedHotspotId(hotspot.id);
		setSelectedReportGroup(undefined);
		setActiveReportIndex(0);
		setShowReportEvidence(false);
	}

	function handleReportGroupClick(group: PublicReportGroupSelection) {
		setCenterOverride(group.center);
		setSelectedReportGroup(group);
		setActiveReportIndex(0);
		setSelectedHotspotId(undefined);
		setShowReportEvidence(false);
	}

	function suppressCarouselScrollSync() {
		if (carouselScrollTimerRef.current !== undefined) {
			window.clearTimeout(carouselScrollTimerRef.current);
		}

		suppressCarouselScrollRef.current = true;
		carouselScrollTimerRef.current = window.setTimeout(() => {
			suppressCarouselScrollRef.current = false;
		}, 420);
	}

	function goToReportIndex(nextIndex: number) {
		if (selectedReports.length === 0) return;
		const clampedIndex = Math.min(
			Math.max(nextIndex, 0),
			selectedReports.length - 1,
		);

		suppressCarouselScrollSync();
		setShowReportEvidence(false);
		setActiveReportIndex(clampedIndex);
	}

	function handleReportStackScroll(event: UIEvent<HTMLDivElement>) {
		if (suppressCarouselScrollRef.current) return;

		const carousel = event.currentTarget;
		if (carousel.clientWidth <= 0) return;

		const nextIndex = Math.round(carousel.scrollLeft / carousel.clientWidth);
		if (nextIndex < 0 || nextIndex >= selectedReports.length) return;
		if (nextIndex === activeReportIndex) return;

		setActiveReportIndex(nextIndex);
	}

	return (
		<div className="page page--map-fullscreen">
			{/* Background Interactive Map */}
			<div className="map-fullscreen-container">
				{!isReportsLoading ? (
						<PublicReportsMap
							key={mapSignature}
							reports={reports}
							hotspots={hotspots}
							showHotspots={showHotspots}
							centerOverride={centerOverride}
							onSelectHotspot={handleHotspotClick}
							onSelectReportGroup={handleReportGroupClick}
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
				<div className="map-mobile-sheet map-mobile-sheet--hotspot">
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
			{selectedReportGroup && activeReport ? (
				<div className="map-mobile-sheet map-mobile-sheet--report report-stack-container">
					<Surface
						as="section"
						className="hotspot-detail-card report-detail-card report-stack-sheet"
						aria-labelledby="report-stack-sheet-title"
					>
						<IconButton
							onClick={clearSelectedReportGroup}
							className="hotspot-detail-card__close"
							aria-label="Close report details"
						>
							<X size={18} />
						</IconButton>

						<header className="report-stack-sheet__header">
							<div className="report-stack-sheet__meta-row">
								<div className="report-stack-sheet__badge">
									{selectedReportGroup.isExactStack
										? "Public location stack"
										: "Nearby reports"}
								</div>
								{selectedReports.length > 1 ? (
									<span
										className="report-stack-sheet__counter"
										aria-live="polite"
									>
										{activeReportIndex + 1} / {selectedReports.length}
									</span>
								) : null}
							</div>

							<h3
								id="report-stack-sheet-title"
								className="report-stack-sheet__title"
							>
								{selectedReportGroupHeading}
							</h3>

							{selectedReports.length > 1 ? (
								<div className="report-stack-sheet__controls">
									<IconButton
										onClick={() => {
											goToReportIndex(activeReportIndex - 1);
										}}
										disabled={activeReportIndex === 0}
										aria-label="Previous report"
										className="report-stack-sheet__nav-button"
									>
										<ChevronLeft size={18} />
									</IconButton>
									<fieldset
										className="report-stack-sheet__dots"
										aria-label="Report stack position"
									>
										{selectedReports.map((report, index) => (
											<button
												key={report.id}
												type="button"
												className={`report-stack-sheet__dot ${
													activeReportIndex === index
														? "report-stack-sheet__dot--active"
														: ""
												}`}
												aria-label={`Show report ${index + 1}`}
												aria-current={
													activeReportIndex === index ? "true" : undefined
												}
												onClick={() => {
													goToReportIndex(index);
												}}
											/>
										))}
									</fieldset>
									<IconButton
										onClick={() => {
											goToReportIndex(activeReportIndex + 1);
										}}
										disabled={activeReportIndex === selectedReports.length - 1}
										aria-label="Next report"
										className="report-stack-sheet__nav-button"
									>
										<ChevronRight size={18} />
									</IconButton>
								</div>
							) : null}
						</header>

						<div className="report-stack-sheet__body">
							<div
								className="report-stack-sheet__carousel"
								ref={reportStackCarouselRef}
								onScroll={handleReportStackScroll}
							>
								{selectedReports.map((report, index) => {
									const isActiveReport = activeReportIndex === index;
									const locationCountLabel = reportLocationCountLabel(
										report.reportCount,
									);

									return (
										<article
											key={report.id}
											className={`report-stack-sheet__slide ${
												isActiveReport
													? "report-stack-sheet__slide--active"
													: ""
											}`}
											aria-hidden={!isActiveReport}
										>
											<div className="report-detail-card__status-row">
												<div
													className="report-detail-card__status"
													data-status={report.status}
												>
													{formatStatusLabel(report.status)}
												</div>
											</div>

											<h4 className="hotspot-detail-card__locality report-stack-sheet__locality">
												{report.neighborhood}
											</h4>
											<span className="hotspot-detail-card__district">
												{formatHabitatLabel(report.prediction.label)} • Confidence:{" "}
												{formatConfidenceScore(report.prediction.confidence)}
											</span>

											{showReportEvidence && isActiveReport && activeReportHasEvidence ? (
												<div className="report-detail-card__evidence-wrapper report-detail-card__evidence-wrapper--interactive">
													<PredictionEvidencePanel
														prediction={report.prediction}
														imageUrl={report.imageUrl || report.thumbnailUrl}
														imageAlt="AI computer-vision bounding boxes for public evidence"
														compact
														showDetections
													/>
												</div>
											) : (
												<div
													className={`hotspot-detail-card__metrics ${
														locationCountLabel
															? ""
															: "hotspot-detail-card__metrics--single"
													}`}
												>
													{locationCountLabel ? (
														<div className="hotspot-detail-card__metric-item">
															<span className="hotspot-detail-card__metric-label">
																{locationCountLabel}
															</span>
															<span className="hotspot-detail-card__metric-value">
																{report.reportCount}
															</span>
														</div>
													) : null}
													<div className="hotspot-detail-card__metric-item hotspot-detail-card__metric-item--wide">
														<span className="hotspot-detail-card__metric-label">
															Latest update
														</span>
														<span className="hotspot-detail-card__metric-value hotspot-detail-card__metric-value--compact">
															{formatCalendarDate(report.latestReportedAt)}
														</span>
													</div>
												</div>
											)}
										</article>
									);
								})}
							</div>
						</div>

						<footer className="report-stack-sheet__footer">
							{activeReportHasEvidence ? (
								<Button
									variant={showReportEvidence ? "ghost" : "secondary"}
									className="report-detail-card__action-btn"
									onClick={() => setShowReportEvidence((current) => !current)}
								>
									<ImageIcon size={16} />
									{showReportEvidence ? "Back to summary" : "View Evidence"}
								</Button>
							) : null}
							<ButtonLink
								to={`/map/reports/${activeReport.reference}`}
								variant="primary"
								className={`report-detail-card__action-btn ${
									activeReportHasEvidence
										? ""
										: "report-detail-card__action-btn--full"
								}`}
							>
								<Navigation size={16} /> View Details
							</ButtonLink>
						</footer>
					</Surface>
				</div>
			) : null}
		</div>
	);
}
