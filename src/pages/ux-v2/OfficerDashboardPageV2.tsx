import { useEffect, useState } from "react";
import { Notice, PageHeader, Surface, MetaLabel, Button, FormField } from "@/components/ui";
import { useServices } from "@/app/useServices";
import { PredictionEvidencePanelV2 } from "@/pages/ux-v2/components/PredictionEvidencePanelV2";
import { StatusBadge } from "@/features/shared/StatusBadge";
import {
	formatCoordinate,
	formatHabitatLabel,
	formatStatusLabel,
	formatTimestamp,
	formatConfidenceScore,
} from "@/lib/formatters";
import {
	MapContainer,
	Marker,
	Circle,
	TileLayer,
	useMap,
	Popup,
} from "react-leaflet";
import { toLeafletPosition, residentMarkerIcon } from "@/lib/map";
import {
	REVIEW_MAP_ZOOM,
	HOTSPOT_WARNING_RADIUS_METERS,
} from "@/lib/constants";
import type {
	HotspotMirrorStatus,
	OfficerReport,
	SubmissionStatus,
	LocationPoint,
} from "@/types/report";

const statusOptions: SubmissionStatus[] = [
	"submitted",
	"under_review",
	"prioritized",
	"action_recorded",
	"closed",
];

function priorityLabel(level: string) {
	const labels: Record<string, string> = {
		core: "Core Hotspot Zone (0-200m)",
		warning: "Warning Buffer Zone (200-400m)",
		routine: "Routine Context (>400m)",
		unavailable: "Hotspot Context Unavailable",
		unassessed: "Not Assessed",
	};
	return labels[level] ?? level;
}

type SortOption = "priority" | "newest" | "neighborhood";
type StatusFilter = SubmissionStatus | "all";
type HabitatFilter = string | "all";

function RecenterMap({ location }: { location: LocationPoint }) {
	const map = useMap();
	useEffect(() => {
		map.setView(toLeafletPosition(location), REVIEW_MAP_ZOOM);
	}, [location, map]);
	return null;
}

export function OfficerDashboardPageV2() {
	const { officerService } = useServices();
	const [reports, setReports] = useState<OfficerReport[]>([]);
	const [selectedReference, setSelectedReference] = useState("");
	const [selectedStatus, setSelectedStatus] =
		useState<SubmissionStatus>("under_review");
	const [officerNotes, setOfficerNotes] = useState("");
	const [followUpAction, setFollowUpAction] = useState("");
	const [hotspotStatus, setHotspotStatus] =
		useState<HotspotMirrorStatus | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isSyncingHotspots, setIsSyncingHotspots] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	// Queue Sort & Filter State
	const [sortBy, setSortBy] = useState<SortOption>("priority");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [habitatFilter, setHabitatFilter] = useState<HabitatFilter>("all");

	// Stacking Side-by-side view toggle
	const [showStackCompare, setShowStackCompare] = useState(false);

	const selectedReport =
		reports.find((report) => report.reference === selectedReference) ??
		reports[0] ??
		null;

	useEffect(() => {
		let isMounted = true;
		setIsLoading(true);
		setError("");

		Promise.all([
			officerService.listReports(),
			officerService.getHotspotStatus(),
		])
			.then(([nextReports, nextHotspotStatus]) => {
				if (!isMounted) return;

				setHotspotStatus(nextHotspotStatus);
				setReports(nextReports);
				const firstReport = nextReports[0];
				if (firstReport) {
					setSelectedReference(firstReport.reference);
					setSelectedStatus(firstReport.status);
					setOfficerNotes(firstReport.officerNotes ?? "");
					setFollowUpAction(firstReport.followUpAction ?? "");
				}
			})
			.catch(() => {
				if (isMounted) {
					setError(
						"Officer reports are unavailable. Check that the local backend is running.",
					);
				}
			})
			.finally(() => {
				if (isMounted) {
					setIsLoading(false);
				}
			});

		return () => {
			isMounted = false;
		};
	}, [officerService]);

	function handleSelectReport(report: OfficerReport) {
		setSelectedReference(report.reference);
		setSelectedStatus(report.status);
		setOfficerNotes(report.officerNotes ?? "");
		setFollowUpAction(report.followUpAction ?? "");
		setMessage("");
		setError("");
		setShowStackCompare(false);
	}

	async function handleSaveReview() {
		if (!selectedReport) return;

		setIsSaving(true);
		setMessage("");
		setError("");

		try {
			const updatedReport = await officerService.updateReport(
				selectedReport.reference,
				{
					status: selectedStatus,
					officerNotes,
					followUpAction,
					reviewedBy: "Local officer demo v2",
				},
			);

			setReports((currentReports) =>
				currentReports.map((report) =>
					report.reference === updatedReport.reference ? updatedReport : report,
				),
			);
			setMessage(`Saved review update for ${updatedReport.reference}.`);
		} catch (saveError) {
			setError(
				saveError instanceof Error
					? saveError.message
					: "The officer review update could not be saved.",
			);
		} finally {
			setIsSaving(false);
		}
	}

	async function handleSyncHotspots() {
		setIsSyncingHotspots(true);
		setMessage("");
		setError("");

		try {
			const syncResult = await officerService.syncHotspots();
			setHotspotStatus({
				hotspotCount: syncResult.syncedCount,
				latestSnapshotDate: syncResult.snapshotDate,
				lastSyncedAt: syncResult.syncedAt,
				sourceLabel: syncResult.sourceLabel,
			});
			setMessage(
				`Synced ${syncResult.syncedCount} current hotspot row(s) from iDengue.`,
			);
		} catch (syncError) {
			setError(
				syncError instanceof Error
					? syncError.message
					: "The hotspot mirror could not be synced.",
			);
		} finally {
			setIsSyncingHotspots(false);
		}
	}

	// Filter and Sort Queue list
	const filteredReports = reports
		.filter((r) => {
			if (statusFilter !== "all" && r.status !== statusFilter) return false;
			if (habitatFilter !== "all" && r.prediction.label !== habitatFilter)
				return false;
			return true;
		})
		.sort((a, b) => {
			if (sortBy === "priority") {
				const priorityOrder: Record<string, number> = {
					core: 1,
					warning: 2,
					routine: 3,
					unassessed: 4,
				};
				const aOrder = priorityOrder[a.hotspotPriority.priorityLevel] ?? 99;
				const bOrder = priorityOrder[b.hotspotPriority.priorityLevel] ?? 99;
				if (aOrder !== bOrder) return aOrder - bOrder;
				return (
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
			}
			if (sortBy === "newest") {
				return (
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
			}
			if (sortBy === "neighborhood") {
				return a.neighborhood.localeCompare(b.neighborhood);
			}
			return 0;
		});

	return (
		<div className="page page--officer stack-md">
			<PageHeader
				compact
				eyebrow="Verification Dashboard"
				title="Officer Triage & Review Console"
				description="Review resident evidence, hotspot priority, and follow-up actions."
			/>

			{isLoading ? (
				<div className="panel panel--muted u-static-26d3a779">
					Loading officer triage queue...
				</div>
			) : null}
			{error ? <Notice tone="warning">{error}</Notice> : null}
			{message ? <Notice tone="success">{message}</Notice> : null}

			{/* PostGIS sync console panel */}
			<Surface as="section" className="officer-hotspot-sync">
				<div>
					<MetaLabel>
						PostGIS iDengue Hotspots Mirror
					</MetaLabel>
					<h2 className="u-static-38030128">
						{hotspotStatus?.hotspotCount ?? 0} hotspot rows synced
					</h2>
					<p className="caption-text">
						{hotspotStatus?.latestSnapshotDate
							? `Latest Ministry of Health (MOH) snapshot: ${formatTimestamp(hotspotStatus.latestSnapshotDate)}.`
							: "No outbreak snapshot dataset mirrored yet."}
					</p>
					<p className="caption-text">
						{hotspotStatus?.lastSyncedAt
							? `Last synced: ${formatTimestamp(hotspotStatus.lastSyncedAt)}.`
							: "Sync mirrors iDengue active clusters for spatial priority indexing."}
					</p>
				</div>
				<Button
					variant="secondary"
					onClick={handleSyncHotspots}
					disabled={isSyncingHotspots}
				>
					{isSyncingHotspots
						? "Mirroring registry..."
						: "Sync iDengue Hotspots Registry"}
				</Button>
			</Surface>

			{!isLoading && reports.length === 0 ? (
				<div className="panel panel--muted u-static-26d3a779">
					Triage queue is empty. Submit a citizen report first, then return here
					to review.
				</div>
			) : null}

			{selectedReport ? (
				<div className="officer-layout">
					{/* QUEUE SIDEBAR WITH FILTERS */}
					<Surface as="section" className="officer-queue stack-md">
						<div className="cluster-row cluster-row--between u-static-63a3b173">
							<h2 className="u-static-56190b7d">Triage Queue</h2>
							<span className="caption-text u-static-21a1be8a">
								{filteredReports.length} listed
							</span>
						</div>

						{/* Filter and Sort Tools */}
						<div className="u-static-8a61b9b0">
							<FormField label="Sort Queue">
								<select
									className="ui-select"
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value as SortOption)}
								>
									<option value="priority">Hotspot Priority</option>
									<option value="newest">Newest Submitted</option>
									<option value="neighborhood">Neighborhood (A-Z)</option>
								</select>
							</FormField>

							<FormField label="Status Filter">
								<select
									className="ui-select"
									value={statusFilter}
									onChange={(e) =>
										setStatusFilter(e.target.value as StatusFilter)
									}
								>
									<option value="all">All Statuses</option>
									{statusOptions.map((o) => (
										<option key={o} value={o}>
											{formatStatusLabel(o)}
										</option>
									))}
								</select>
							</FormField>

							<FormField label="Habitat Filter">
								<select
									className="ui-select"
									value={habitatFilter}
									onChange={(e) =>
										setHabitatFilter(e.target.value as HabitatFilter)
									}
								>
									<option value="all">All Classes</option>
									<option value="tire">Tire</option>
									<option value="drain_inlet">Drain Inlet</option>
									<option value="artificial_container">
										Artificial Container
									</option>
									<option value="unclassified">Unclassified</option>
								</select>
							</FormField>
						</div>

						{/* Queue List */}
						<div className="officer-queue__list u-static-7fd651cb">
							{filteredReports.map((report) => {
								const isActive = report.reference === selectedReport.reference;
								const isCore = report.hotspotPriority.priorityLevel === "core";
								const isWarning =
									report.hotspotPriority.priorityLevel === "warning";
								const priorityLevel = isCore
									? "core"
									: isWarning
										? "warning"
										: "routine";

								return (
									<button
										key={report.id}
										type="button"
										className={`officer-queue__item${isActive ? " officer-queue__item--active" : ""}`}
										data-priority={priorityLevel}
										onClick={() => handleSelectReport(report)}
									>
										<div className="u-static-63a3b173">
											<strong>{report.reference}</strong>
											<StatusBadge status={report.status} />
										</div>
										<div className="u-static-5adb5949">
											<span>{report.neighborhood}</span>
											<span className="u-static-21a1be8a">
												{formatHabitatLabel(report.prediction.label)}
											</span>
										</div>
										{isCore || isWarning ? (
											<span className="officer-queue__priority-flag">
												⚠ Hotspot Outbreak Zone
											</span>
										) : null}
									</button>
								);
							})}
							{filteredReports.length === 0 ? (
								<p className="caption-text u-static-ef254c78">
									No reports match active filters.
								</p>
							) : null}
						</div>
					</Surface>

					{/* REPORT DETAILS PANEL */}
					<Surface as="section" className="officer-detail stack-md">
						<div className="officer-detail__header u-static-99c9a2a0">
							<div>
								<MetaLabel>Triage verification</MetaLabel>
								<h2 className="u-static-9aa40667">
									Report {selectedReport.reference}
								</h2>
							</div>
							<StatusBadge status={selectedReport.status} />
						</div>

						{/* Redesigned colorful Triage Signal Cards */}
						<section
							className="officer-triage u-static-c8931efe"
							aria-label="Triage metrics"
						>
							{/* Card 1: AI Result */}
							<Surface className="u-static-9f10e421">
								<MetaLabel>AI Class Label</MetaLabel>
								<strong className="u-static-5f2d1fec">
									{formatHabitatLabel(selectedReport.prediction.label)}
								</strong>
								<span className="caption-text u-static-75ac91c9">
									{formatConfidenceScore(selectedReport.prediction.confidence)}{" "}
									({selectedReport.prediction.confidenceBand})
								</span>
							</Surface>

							{/* Card 2: Hotspot Proximity */}
							<Surface
								className="officer-triage-card officer-triage-card--priority"
								data-priority={selectedReport.hotspotPriority.priorityLevel}
							>
								<MetaLabel>Hotspot priority</MetaLabel>
								<strong className="u-static-611f5fca">
									{selectedReport.hotspotPriority.priorityLevel === "core"
										? "Core hotspot"
										: selectedReport.hotspotPriority.priorityLevel === "warning"
											? "Warning buffer"
											: "Routine"}
								</strong>
								<span className="caption-text u-static-f24ba68e">
									{selectedReport.hotspotPriority.priorityReason}
								</span>
							</Surface>

							{/* Card 3: Consent status */}
							<Surface
								className="officer-triage-card officer-triage-card--consent"
								data-consent={
									selectedReport.publicConsent.accepted ? "accepted" : "missing"
								}
							>
								<MetaLabel>Consent Stored</MetaLabel>
								<strong className="u-static-611f5fca">
									{selectedReport.publicConsent.accepted
										? "Accepted ✓"
										: "Missing ⚠"}
								</strong>
								<span className="caption-text u-static-5b817689">
									Image & confirmed pin map visibility.
								</span>
							</Surface>
						</section>

						{/* Geographical map overlay for officer */}
						<Surface className="u-static-0a625e61">
							<MetaLabel>Report coordinates map</MetaLabel>
							<div className="u-static-ef8a6c7e">
								<MapContainer
									center={toLeafletPosition(selectedReport.reportLocation)}
									zoom={REVIEW_MAP_ZOOM}
									scrollWheelZoom={false}
									attributionControl={false}
									className="map-frame__canvas"
								>
									<TileLayer
										attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
										url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
									/>
									<RecenterMap location={selectedReport.reportLocation} />

									{/* Highlight nearby Hotspot circles if core or warning */}
									{selectedReport.hotspotPriority
										.nearestHotspotDistanceMeters ? (
										<>
											{/* Outbreak warning circle center */}
											<Circle
												center={[
													selectedReport.reportLocation.latitude +
														(selectedReport.hotspotPriority
															.nearestHotspotDistanceMeters /
															111000) *
															0.7, // simulated offset back to center
													selectedReport.reportLocation.longitude,
												]}
												radius={HOTSPOT_WARNING_RADIUS_METERS}
												pathOptions={{
													color: "#d08a47",
													fillColor: "#d08a47",
													fillOpacity: 0.05,
													weight: 1,
												}}
											/>
										</>
									) : null}

									{/* Marker for report location */}
									<Marker
										position={toLeafletPosition(selectedReport.reportLocation)}
										icon={residentMarkerIcon}
									>
										<Popup>Confirmed report location</Popup>
									</Marker>
								</MapContainer>
							</div>
						</Surface>

						{/* Stacked comparison view trigger */}
						{selectedReport.stackParent ? (
							<div className="panel panel--muted stack-md u-static-ef4f8c41">
								<div className="u-static-63a3b173">
									<div>
										<strong>Stacked Observation Context</strong>
										<p className="caption-text u-static-2a0ca835">
											This report is stacked on existing parent report:{" "}
											{selectedReport.stackedOnReference}
										</p>
									</div>
									<Button
										variant="secondary"
										onClick={() => setShowStackCompare(!showStackCompare)}
									>
										{showStackCompare
											? "Hide Comparison"
											: "Compare Photos Side-by-Side"}
									</Button>
								</div>

								{showStackCompare ? (
									<div className="u-static-d19ea63b">
										<div>
												<MetaLabel>
													Stacked Parent Image (
													{selectedReport.stackedOnReference})
												</MetaLabel>
											<img
												src={selectedReport.stackParent.imageUrl}
												alt={`Parent report ${selectedReport.stackedOnReference}`}
												className="u-static-0a630a29"
											/>
										</div>
										<div>
											<MetaLabel>
												Current Submission Image ({selectedReport.reference})
											</MetaLabel>
											<img
												src={selectedReport.imageUrl}
												alt={`Current submission ${selectedReport.reference}`}
												className="u-static-0a630a29"
											/>
										</div>
									</div>
								) : null}
							</div>
						) : null}

						{/* EVIDENCES & METADATA GRID */}
						<div className="officer-detail__grid u-static-64fe16d9">
							<div className="officer-evidence-column">
								<PredictionEvidencePanelV2
									prediction={selectedReport.prediction}
									title="Officer model evidence"
									imageUrl={selectedReport.imageUrl}
									imageAlt={`Evidence photo for ${selectedReport.reference}`}
									showDetections
								/>
							</div>

							<div className="stack-md">
								<Surface className="detail-grid u-static-9f10e421">
									<div>
										<MetaLabel>
											Received Timestamp
										</MetaLabel>
										<strong>{formatTimestamp(selectedReport.createdAt)}</strong>
									</div>
									<div>
										<MetaLabel>Reported Class</MetaLabel>
										<strong>
											{formatHabitatLabel(selectedReport.prediction.label)}
										</strong>
									</div>
									<div>
										<MetaLabel>Exact Latitude</MetaLabel>
										<strong>
											{formatCoordinate(selectedReport.reportLocation.latitude)}
										</strong>
									</div>
									<div>
										<MetaLabel>Exact Longitude</MetaLabel>
										<strong>
											{formatCoordinate(
												selectedReport.reportLocation.longitude,
											)}
										</strong>
									</div>
								</Surface>

								<div className="u-static-9a317354">
									<Notice
										tone={
											selectedReport.hotspotPriority.priorityLevel === "core" ||
											selectedReport.hotspotPriority.priorityLevel === "warning"
												? "warning"
												: "neutral"
										}
									>
										<strong>Priority Triage:</strong>{" "}
										{priorityLabel(
											selectedReport.hotspotPriority.priorityLevel,
										)}
										. {selectedReport.hotspotPriority.priorityReason}
									</Notice>

									<Notice>
										<strong>Model Advisory Note:</strong>{" "}
										{selectedReport.prediction.advisoryText}
									</Notice>
								</div>

								{selectedReport.notes ? (
									<div className="panel panel--muted u-static-affe5002">
										<MetaLabel>
											Citizen description (officer-only)
										</MetaLabel>
										<p className="u-static-7d0483e3">
											"{selectedReport.notes}"
										</p>
									</div>
								) : null}
							</div>
						</div>

						{/* REVIEW UPDATE FORM */}
						<div className="officer-review-form u-static-9841d32d">
							<h3 className="u-static-864fa7ab">Record review triage</h3>

							<div className="u-static-1a5debf7">
								<FormField label="Review status">
									<select
										className="ui-select"
										value={selectedStatus}
										onChange={(event) =>
											setSelectedStatus(event.target.value as SubmissionStatus)
										}
									>
										{statusOptions.map((option) => (
											<option key={option} value={option}>
												{formatStatusLabel(option)}
											</option>
										))}
									</select>
								</FormField>

								<FormField label="Internal officer notes (kept private)">
									<textarea
										className="ui-input"
										value={officerNotes}
										onChange={(event) => setOfficerNotes(event.target.value)}
										placeholder="Internal coordinates checking details, vector team updates, etc. Not visible on public map."
									/>
								</FormField>

								<FormField label="Vector follow-up action">
									<textarea
										className="ui-input"
										value={followUpAction}
										onChange={(event) => setFollowUpAction(event.target.value)}
										placeholder="Example: chemical fogging scheduled, site cleared, duplicate stack confirmed."
									/>
								</FormField>
							</div>

							<div className="cluster-row cluster-row--end u-static-4b74966c">
								<Button
									variant="primary"
									onClick={handleSaveReview}
									disabled={isSaving}
								>
									{isSaving ? "Saving review..." : "Save review update"}
								</Button>
							</div>
						</div>
					</Surface>
				</div>
			) : null}
		</div>
	);
}
