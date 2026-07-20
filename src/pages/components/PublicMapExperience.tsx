import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, Plus, Minus } from "lucide-react";
import { useServices } from "@/app/useServices";
import { Notice } from "@/components/ui";
import { formatHabitatLabel } from "@/lib/formatters";
import {
	getLocationFailureMessage,
	requestCurrentLocation,
} from "@/lib/geolocation";
import { toLeafletPosition } from "@/lib/map";
import {
	MapHotspotSheet,
	MapReportSheet,
} from "@/pages/components/MapDetailSheets";
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

export function PublicMapExperience() {
	const { mapService } = useServices();
	const [reports, setReports] = useState<PublicMapReport[]>([]);
	const [hotspots, setHotspots] = useState<PublicHotspot[]>([]);
	const [habitatFilter, setHabitatFilter] = useState<HabitatFilter>("all");
	const [isReportsLoading, setIsReportsLoading] = useState(true);
	const [hotspotError, setHotspotError] = useState("");
	const [locationError, setLocationError] = useState("");
	const [isLocating, setIsLocating] = useState(false);
	const [showHotspots, _setShowHotspots] = useState(true);
	const isMountedRef = useRef(false);
	const locationRequestSequenceRef = useRef(0);
	const activeLocationRequestRef = useRef<number | null>(null);

	const [centerOverride, setCenterOverride] = useState<
		[number, number] | undefined
	>(undefined);
	const [selectedHotspotId, setSelectedHotspotId] = useState<
		string | undefined
	>(undefined);
	const [selectedReportGroup, setSelectedReportGroup] = useState<
		PublicReportGroupSelection | undefined
	>(undefined);
	const [selectedReport, setSelectedReport] = useState<
		PublicMapReport | undefined
	>(undefined);
	const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

	const mapSignature =
		[
			reports.map((report) => report.id).join(":"),
			hotspots.map((hotspot) => hotspot.id).join(":"),
			hotspotError,
		]
			.filter(Boolean)
			.join("|") || `${habitatFilter}:empty`;

	const clearSelectedReportGroup = useCallback(() => {
		setSelectedReportGroup(undefined);
		setSelectedReport(undefined);
	}, []);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
			activeLocationRequestRef.current = null;
		};
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
		clearSelectedReportGroup();
	}

	function handleHotspotClick(hotspot: PublicHotspot) {
		const coords = toLeafletPosition(hotspot.center);
		setCenterOverride(coords);
		setSelectedHotspotId(hotspot.id);
		clearSelectedReportGroup();
	}

	function handleReportGroupClick(group: PublicReportGroupSelection) {
		setCenterOverride(group.center);
		setSelectedReportGroup(group);
		setSelectedReport(group.reports.length <= 1 ? group.reports[0] : undefined);
		setSelectedHotspotId(undefined);
	}

	function handleLocateMe() {
		if (activeLocationRequestRef.current !== null) return;

		const requestId = ++locationRequestSequenceRef.current;
		activeLocationRequestRef.current = requestId;
		setLocationError("");
		setIsLocating(true);

		const handleUnexpectedFailure = () => {
			if (
				!isMountedRef.current ||
				activeLocationRequestRef.current !== requestId
			) {
				return;
			}

			activeLocationRequestRef.current = null;
			setIsLocating(false);
			setLocationError(getLocationFailureMessage("unavailable", "map-centering"));
		};

		let locationRequest: ReturnType<typeof requestCurrentLocation>;
		try {
			locationRequest = requestCurrentLocation({ mode: "map-centering" });
		} catch {
			handleUnexpectedFailure();
			return;
		}

		void locationRequest.then((result) => {
			if (
				!isMountedRef.current ||
				activeLocationRequestRef.current !== requestId
			) {
				return;
			}

			activeLocationRequestRef.current = null;
			setIsLocating(false);

			if (result.ok === true) {
				setCenterOverride([
					result.location.latitude,
					result.location.longitude,
				]);
				return;
			}

			setLocationError(getLocationFailureMessage(result.reason, "map-centering"));
		}).catch(handleUnexpectedFailure);
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
						mapRef={setMapInstance}
					/>
				) : (
					<div className="loading-state map-fullscreen-loading">
						Updating report markers...
					</div>
				)}
			</div>

			{!selectedHotspotId && !selectedReportGroup ? (
				<div className="map-page-controls">
					<section className="map-priority-legend" aria-label="Map legend">
						<div className="map-priority-legend__item">
							<span className="map-priority-legend__dot map-priority-legend__dot--prioritized" aria-hidden="true" />
							<span>Priority report</span>
						</div>
						<div className="map-priority-legend__item">
							<span className="map-priority-legend__dot map-priority-legend__dot--normal" aria-hidden="true" />
							<span>Report</span>
						</div>
						<div className="map-priority-legend__item">
							<span className="map-priority-legend__diamond" aria-hidden="true" />
							<span>Hotspot</span>
						</div>
					</section>
					<div className="map-action-stack">
						<button
							type="button"
							className="map-action-btn"
							onClick={() => mapInstance?.zoomIn()}
							aria-label="Zoom in"
						>
							<Plus size={21} aria-hidden="true" />
						</button>
						<button
							type="button"
							className="map-action-btn"
							onClick={() => mapInstance?.zoomOut()}
							aria-label="Zoom out"
						>
							<Minus size={21} aria-hidden="true" />
						</button>
						<button
							type="button"
							className={`map-action-btn${isLocating ? " map-action-btn--loading" : ""}`}
							onClick={handleLocateMe}
							disabled={isLocating}
							aria-busy={isLocating}
							aria-label={isLocating ? "Finding current location" : "Center map on my location"}
						>
							<LocateFixed size={21} aria-hidden="true" />
						</button>
					</div>
				</div>
			) : null}

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

			{locationError ? <div className="map-location-error" role="status">{locationError}</div> : null}

			{selectedHotspotId
				? (() => {
						const hotspot = hotspots.find(
							(item) => item.id === selectedHotspotId,
						);
						return hotspot ? (
							<MapHotspotSheet
								hotspot={hotspot}
								onClose={() => setSelectedHotspotId(undefined)}
							/>
						) : null;
					})()
				: null}

			{selectedReportGroup ? (
				<MapReportSheet
					group={selectedReportGroup}
					selectedReport={selectedReport}
					onSelectReport={setSelectedReport}
					onBack={() => setSelectedReport(undefined)}
					onClose={clearSelectedReportGroup}
				/>
			) : null}
		</div>
	);
}
