import { useCallback, useEffect, useMemo, useState } from "react";
import { LocateFixed, Plus, Minus } from "lucide-react";
import { usePublicMapSession } from "@/app/PublicMapSessionContext";
import { useServices } from "@/app/useServices";
import { useMobileViewport } from "@/app/useMobileViewport";
import { Notice } from "@/components/ui";
import { formatHabitatLabel } from "@/lib/formatters";
import { toLeafletPosition } from "@/lib/map";
import {
	MapHotspotSheet,
	MapReportSheet,
} from "@/pages/components/MapDetailSheets";
import {
	PublicReportsMap,
	type PublicReportGroupSelection,
} from "@/pages/components/PublicReportsMap";
import { usePublicMapLocation } from "@/pages/components/usePublicMapLocation";
import type { PublicHotspot, PublicMapReport } from "@/types/report";

export function PublicMapExperience() {
	const { mapService } = useServices();
	const isMobile = useMobileViewport();
	const { session, patchSession } = usePublicMapSession();
	const [reports, setReports] = useState<PublicMapReport[]>([]);
	const [hotspots, setHotspots] = useState<PublicHotspot[]>([]);
	const [isReportsLoading, setIsReportsLoading] = useState(true);
	const [hasLoadedReports, setHasLoadedReports] = useState(false);
	const [hasLoadedHotspots, setHasLoadedHotspots] = useState(false);
	const [hotspotError, setHotspotError] = useState("");
	const [showHotspots, _setShowHotspots] = useState(true);

	const [centerOverride, setCenterOverride] = useState<
		[number, number] | undefined
	>(undefined);
	const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
	const habitatFilter = session.habitatFilter;
	const selectedHotspotId =
		session.selection?.kind === "hotspot"
			? session.selection.hotspotId
			: undefined;
	const selectedHotspot = useMemo(
		() => hotspots.find((hotspot) => hotspot.id === selectedHotspotId),
		[hotspots, selectedHotspotId],
	);
	const selectedReportGroup = useMemo<PublicReportGroupSelection | undefined>(() => {
		if (session.selection?.kind !== "report") return undefined;

		const reportsByReference = new Map(reports.map((report) => [report.reference, report]));
		const selectedReports = session.selection.reportReferences
			.map((reference) => reportsByReference.get(reference))
			.filter((report): report is PublicMapReport => Boolean(report));

		if (!selectedReports.length) return undefined;

		return {
			reports: selectedReports,
			center: session.selection.center,
			isExactStack: session.selection.isExactStack,
			totalReportCount: session.selection.totalReportCount,
		};
	}, [reports, session.selection]);
	const selectedReport = useMemo(() => {
		if (session.selection?.kind !== "report") return undefined;
		const selectedReportReference = session.selection.selectedReportReference;
		return selectedReportGroup?.reports.find(
			(report) => report.reference === selectedReportReference,
		);
	}, [selectedReportGroup, session.selection]);

	const clearSelectedReportGroup = useCallback(() => {
		patchSession({ selection: undefined });
	}, [patchSession]);
	const handleLocationFixChange = useCallback(
		(userLocationFix: typeof session.userLocationFix) => patchSession({ userLocationFix }),
		[patchSession],
	);
	const handleLocationRecenter = useCallback(
		(center: [number, number]) => setCenterOverride(center),
		[],
	);
	const {
		error: locationError,
		isLocating,
		locate,
	} = usePublicMapLocation({
		currentFix: session.userLocationFix,
		onFixChange: handleLocationFixChange,
		onRecenter: handleLocationRecenter,
	});

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
					setHasLoadedReports(true);
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
			})
			.finally(() => {
				if (isMounted) setHasLoadedHotspots(true);
			});

		return () => {
			isMounted = false;
		};
	}, [mapService]);

	useEffect(() => {
		if (!hasLoadedReports || session.selection?.kind !== "report") return;

		const availableReferences = new Set(reports.map((report) => report.reference));
		if (!session.selection.reportReferences.some((reference) => availableReferences.has(reference))) {
			patchSession({ selection: undefined });
		}
	}, [hasLoadedReports, patchSession, reports, session.selection]);

	useEffect(() => {
		if (!hasLoadedHotspots || session.selection?.kind !== "hotspot") return;
		const hotspotId = session.selection.hotspotId;
		if (!hotspots.some((hotspot) => hotspot.id === hotspotId)) {
			patchSession({ selection: undefined });
		}
	}, [hasLoadedHotspots, hotspots, patchSession, session.selection]);

	useEffect(() => {
		if (!selectedHotspotId && !selectedReportGroup) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== "Escape") {
				return;
			}

			patchSession({ selection: undefined });
		}

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [selectedHotspotId, selectedReportGroup, patchSession]);

	function handleHabitatFilterChange(nextHabitat: typeof habitatFilter) {
		if (habitatFilter === nextHabitat) return;
		setIsReportsLoading(true);
		patchSession({ habitatFilter: nextHabitat, selection: undefined });
		setCenterOverride(undefined);
	}

	function handleHotspotClick(hotspot: PublicHotspot) {
		const coords = toLeafletPosition(hotspot.center);
		setCenterOverride(coords);
		patchSession({ selection: { kind: "hotspot", hotspotId: hotspot.id } });
	}

	function handleReportGroupClick(group: PublicReportGroupSelection) {
		setCenterOverride(group.center);
		patchSession({
			selection: {
				kind: "report",
				reportReferences: group.reports.map((report) => report.reference),
				center: group.center,
				isExactStack: group.isExactStack,
				totalReportCount: group.totalReportCount,
				selectedReportReference:
					group.reports.length <= 1 ? group.reports[0]?.reference : undefined,
			},
		});
	}

	function handleSelectReport(report: PublicMapReport) {
		if (session.selection?.kind !== "report") return;
		patchSession({
			selection: {
				...session.selection,
				selectedReportReference: report.reference,
			},
		});
	}

	function handleBackToReportList() {
		if (session.selection?.kind !== "report") return;
		patchSession({
			selection: {
				...session.selection,
				selectedReportReference: undefined,
			},
		});
	}

	return (
		<div className="page page--map-fullscreen">
			{/* Background Interactive Map */}
			<div className="map-fullscreen-container">
				{hasLoadedReports ? (
					<PublicReportsMap
						reports={reports}
						hotspots={hotspots}
						showHotspots={showHotspots}
						selectedHotspot={selectedHotspot}
						showSelectedHotspotBuffer={isMobile && Boolean(selectedHotspot)}
						centerOverride={centerOverride}
						initialViewport={session.viewport}
						userLocationFix={session.userLocationFix}
						onViewportChange={(viewport) => patchSession({ viewport })}
						onSelectHotspot={handleHotspotClick}
						onSelectReportGroup={handleReportGroupClick}
						mapRef={setMapInstance}
					/>
				) : (
					<div className="loading-state map-fullscreen-loading">
						Updating report markers...
					</div>
				)}
				{hasLoadedReports && isReportsLoading ? (
					<div className="loading-state map-fullscreen-loading map-fullscreen-loading--overlay">
						Updating report markers...
					</div>
				) : null}
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
							onClick={() => void locate()}
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
							] as Array<typeof habitatFilter>
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

			{selectedHotspot ? (
				<MapHotspotSheet
					hotspot={selectedHotspot}
					showAdvisoryBuffer={isMobile}
					onClose={() => patchSession({ selection: undefined })}
				/>
			) : null}

			{selectedReportGroup ? (
				<MapReportSheet
					group={selectedReportGroup}
					selectedReport={selectedReport}
					onSelectReport={handleSelectReport}
					onBack={handleBackToReportList}
					onClose={clearSelectedReportGroup}
				/>
			) : null}
		</div>
	);
}
