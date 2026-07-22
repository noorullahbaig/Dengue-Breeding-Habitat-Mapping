import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Circle,
	MapContainer,
	Marker,
	TileLayer,
	Tooltip,
	useMap,
	useMapEvents,
} from "react-leaflet";
import type {
	MapViewport,
	UserLocationFix,
} from "@/app/PublicMapSessionContext";
import { DEFAULT_MAP_ZOOM, KL_CENTER } from "@/lib/constants";
import { hotspotMarkerIcon, toLeafletPosition } from "@/lib/map";
import type {
	HotspotPriority,
	PublicHotspot,
	PublicMapReport,
} from "@/types/report";

interface PublicReportsMapProps {
	reports: PublicMapReport[];
	hotspots: PublicHotspot[];
	showHotspots: boolean;
	selectedHotspot?: PublicHotspot;
	showSelectedHotspotBuffer?: boolean;
	selectionFocus?: MapSelectionFocus;
	hotspotError?: string;
	centerOverride?: [number, number];
	initialViewport?: MapViewport;
	onViewportChange?: (viewport: MapViewport) => void;
	userLocationFix?: UserLocationFix;
	onSelectHotspot?: (hotspot: PublicHotspot) => void;
	onSelectReportGroup?: (group: PublicReportGroupSelection) => void;
	mapRef?: React.RefCallback<L.Map>;
}

export interface MapSelectionFocus {
	key: string;
	center: [number, number];
	minimumZoom: number;
	adjustForOcclusion: boolean;
	occludingElement?: HTMLElement | null;
	topOccludingElement?: HTMLElement | null;
}

type TileStatus = "loading" | "ready" | "fallback";

const PUBLIC_MAP_MIN_ZOOM = 11;
const PUBLIC_MAP_MAX_ZOOM = 22;
const REPORT_COLLISION_RADIUS_PX = 36;
const EXACT_LOCATION_DECIMALS = 6;
const SELECTION_SHEET_GAP_PX = 16;
const SELECTION_MARKER_SHEET_DISTANCE_PX = 120;

interface ProjectionPoint {
	x: number;
	y: number;
}

interface ReportGroupingOptions {
	zoom: number;
	collisionRadiusPx?: number;
	project: (
		point: Pick<PublicMapReport["publicLocation"], "latitude" | "longitude">,
		zoom: number,
	) => ProjectionPoint;
}

export function getMobileSelectionTargetY({
	mapTop,
	mapHeight,
	sheetTop,
	controlsBottom,
	gap = SELECTION_SHEET_GAP_PX,
	markerSheetDistance = SELECTION_MARKER_SHEET_DISTANCE_PX,
}: {
	mapTop: number;
	mapHeight: number;
	sheetTop: number;
	controlsBottom?: number;
	gap?: number;
	markerSheetDistance?: number;
}) {
	const minimumTargetY = Math.max(
		0,
		(controlsBottom ?? mapTop) - mapTop + gap,
	);
	const maximumTargetY = Math.min(mapHeight, sheetTop - mapTop - gap);
	const preferredTargetY = sheetTop - mapTop - markerSheetDistance;

	return Math.min(
		maximumTargetY,
		Math.max(minimumTargetY, preferredTargetY),
	);
}

export interface PublicReportGroupSelection {
	reports: PublicMapReport[];
	center: [number, number];
	isExactStack: boolean;
	totalReportCount: number;
}

interface PublicReportMarkerGroup extends PublicReportGroupSelection {
	id: string;
	title: string;
	priorityState: PublicPriorityState;
}

interface MutableReportGroup {
	reports: PublicMapReport[];
	exactKeys: Set<string>;
	projectedCenter: ProjectionPoint;
	latitudeSum: number;
	longitudeSum: number;
}

export type PublicPriorityState = "prioritized" | "normal";

export function getPublicPriorityState(
	priority?: HotspotPriority,
): PublicPriorityState {
	if (
		priority?.priorityLevel === "core" ||
		priority?.priorityLevel === "warning"
	) {
		return "prioritized";
	}

	return "normal";
}

function getGroupPriorityState(
	reports: PublicMapReport[],
): PublicPriorityState {
	const states = reports.map((report) =>
		getPublicPriorityState(report.hotspotPriority),
	);

	return states.includes("prioritized") ? "prioritized" : "normal";
}

function buildPublicIcon(priorityState: PublicPriorityState) {
	return L.divIcon({
		className: `map-pin map-pin--public map-pin--priority-${priorityState}`,
		html: '<span class="map-pin__core"></span>',
		iconSize: [20, 20],
		iconAnchor: [10, 10],
		popupAnchor: [0, -12],
	});
}

function buildPublicStackIcon(
	priorityState: PublicPriorityState,
	totalReportCount: number,
	isExactStack: boolean,
) {
	const countLabel = totalReportCount > 99 ? "99+" : String(totalReportCount);

	return L.divIcon({
		className: `map-pin map-pin--public map-pin--stacked map-pin--priority-${priorityState}${
			isExactStack ? " map-pin--exact-stack" : ""
		}`,
		html: `<span class="map-pin__stack-shell"><span class="map-pin__stack-layer"></span><span class="map-pin__stack-layer"></span><span class="map-pin__core"></span><span class="map-pin__count">${countLabel}</span></span>`,
		iconSize: [38, 38],
		iconAnchor: [19, 19],
		popupAnchor: [0, -18],
	});
}

const userLocationIcon = L.divIcon({
	className: "map-user-location-marker",
	html: '<span class="map-user-location-marker__dot"></span>',
	iconSize: [22, 22],
	iconAnchor: [11, 11],
});

function exactLocationKey(report: PublicMapReport) {
	return [
		report.publicLocation.latitude.toFixed(EXACT_LOCATION_DECIMALS),
		report.publicLocation.longitude.toFixed(EXACT_LOCATION_DECIMALS),
	].join(":");
}

function reportTimestamp(report: PublicMapReport) {
	return new Date(report.latestReportedAt || report.reportedAt).getTime();
}

function compareReportsByFreshness(a: PublicMapReport, b: PublicMapReport) {
	const timestampDelta = reportTimestamp(b) - reportTimestamp(a);

	return timestampDelta === 0 ? a.id.localeCompare(b.id) : timestampDelta;
}

function reportCount(report: PublicMapReport) {
	return Math.max(report.reportCount || 1, 1);
}

function distanceBetween(a: ProjectionPoint, b: ProjectionPoint) {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function markerGroupTitle(
	totalReportCount: number,
	isExactStack: boolean,
	report?: PublicMapReport,
) {
	if (totalReportCount <= 1) {
		return report ? `Open report ${report.reference}` : "Open report";
	}

	return `${totalReportCount} reports ${
		isExactStack ? "at this public location" : "in this area"
	}`;
}

function markerPriorityDescription(
	priorityState: PublicPriorityState,
	title: string,
) {
	const label = priorityState === "prioritized" ? "Priority report" : "Report";
	return `${label}. ${title}.`;
}

function toMarkerGroup(group: MutableReportGroup): PublicReportMarkerGroup {
	const totalReportCount = group.reports.reduce(
		(total, report) => total + reportCount(report),
		0,
	);
	const isExactStack = totalReportCount > 1 && group.exactKeys.size === 1;
	const center: [number, number] = [
		group.latitudeSum / group.reports.length,
		group.longitudeSum / group.reports.length,
	];
	const leadReport = group.reports[0];

	return {
		id: group.reports.map((report) => report.id).join(":"),
		reports: group.reports,
		center,
		isExactStack,
		totalReportCount,
		priorityState: getGroupPriorityState(group.reports),
		title: markerGroupTitle(totalReportCount, isExactStack, leadReport),
	};
}

export function buildPublicReportMarkerGroups(
	reports: PublicMapReport[],
	options: ReportGroupingOptions,
): PublicReportMarkerGroup[] {
	const collisionRadiusPx =
		options.collisionRadiusPx ?? REPORT_COLLISION_RADIUS_PX;
	const groups: MutableReportGroup[] = [];

	for (const report of [...reports].sort(compareReportsByFreshness)) {
		const projection = options.project(report.publicLocation, options.zoom);
		const exactKey = exactLocationKey(report);
		const matchingGroup = groups.find(
			(group) =>
				group.exactKeys.has(exactKey) ||
				distanceBetween(group.projectedCenter, projection) <= collisionRadiusPx,
		);

		if (!matchingGroup) {
			groups.push({
				reports: [report],
				exactKeys: new Set([exactKey]),
				projectedCenter: projection,
				latitudeSum: report.publicLocation.latitude,
				longitudeSum: report.publicLocation.longitude,
			});
			continue;
		}

		const nextSize = matchingGroup.reports.length + 1;
		matchingGroup.reports.push(report);
		matchingGroup.exactKeys.add(exactKey);
		matchingGroup.projectedCenter = {
			x:
				(matchingGroup.projectedCenter.x * (nextSize - 1) + projection.x) /
				nextSize,
			y:
				(matchingGroup.projectedCenter.y * (nextSize - 1) + projection.y) /
				nextSize,
		};
		matchingGroup.latitudeSum += report.publicLocation.latitude;
		matchingGroup.longitudeSum += report.publicLocation.longitude;
	}

	return groups.map((group) => toMarkerGroup(group));
}

function MapCenterSync({
	centerOverride,
	minimumZoom = DEFAULT_MAP_ZOOM,
}: {
	centerOverride?: [number, number];
	minimumZoom?: number;
}) {
	const map = useMap();

	useEffect(() => {
		if (!centerOverride) return;

		map.flyTo(centerOverride, Math.max(map.getZoom(), minimumZoom), {
			duration: 0.45,
			easeLinearity: 0.2,
		});
	}, [centerOverride, map, minimumZoom]);

	return null;
}

function SelectionFocusSync({
	selectionFocus,
	onFocusStart,
	onFocusSettled,
}: {
	selectionFocus?: MapSelectionFocus;
	onFocusStart: (selectionKey: string) => void;
	onFocusSettled: (selectionKey: string) => void;
}) {
	const map = useMap();
	const correctionHandlerRef = useRef<(() => void) | undefined>(undefined);
	const selectionKey = selectionFocus?.key;
	const latitude = selectionFocus?.center[0];
	const longitude = selectionFocus?.center[1];
	const minimumZoom = selectionFocus?.minimumZoom;
	const adjustForOcclusion = selectionFocus?.adjustForOcclusion;
	const occludingElement = selectionFocus?.occludingElement;
	const topOccludingElement = selectionFocus?.topOccludingElement;

	useEffect(() => {
		if (
			!selectionKey ||
			latitude === undefined ||
			longitude === undefined ||
			minimumZoom === undefined
		) {
			return;
		}

		if (adjustForOcclusion && !occludingElement) return;

		const panel = adjustForOcclusion
			? occludingElement?.matches(".map-detail-sheet")
				? occludingElement
				: occludingElement?.querySelector<HTMLElement>(".map-detail-sheet")
			: undefined;

		if (adjustForOcclusion && !panel) return;
		const focusSelectionKey = selectionKey;
		const focusMinimumZoom = minimumZoom;
		const focusCenter: [number, number] = [latitude, longitude];

		function clearPendingCorrection() {
			if (!correctionHandlerRef.current) return;
			map.off("moveend", correctionHandlerRef.current);
			correctionHandlerRef.current = undefined;
		}

		function focusSelection() {
			const zoom = Math.max(map.getZoom(), focusMinimumZoom);
			onFocusStart(focusSelectionKey);

			if (!panel) {
				clearPendingCorrection();
				const settleFocus = () => {
					correctionHandlerRef.current = undefined;
					onFocusSettled(focusSelectionKey);
				};
				correctionHandlerRef.current = settleFocus;
				map.once("moveend", settleFocus);
				map.flyTo(focusCenter, zoom, {
					duration: 0.45,
					easeLinearity: 0.2,
				});
				return;
			}

			const mapRect = map.getContainer().getBoundingClientRect();
			const panelRect = panel.getBoundingClientRect();
			const controlsRect = topOccludingElement?.getBoundingClientRect();
			const targetY = getMobileSelectionTargetY({
				mapTop: mapRect.top,
				mapHeight: mapRect.height,
				sheetTop: panelRect.top,
				controlsBottom: controlsRect?.bottom,
			});
			const verticalOffset = mapRect.height / 2 - targetY;
			const projectedSelection = map.project(L.latLng(focusCenter), zoom);
			const adjustedCenter = map.unproject(
				L.point(
					projectedSelection.x,
					projectedSelection.y + verticalOffset,
				),
				zoom,
			);

			clearPendingCorrection();
			const correctRenderedPosition = () => {
				correctionHandlerRef.current = undefined;
				const liveMapRect = map.getContainer().getBoundingClientRect();
				const livePanelRect = panel.getBoundingClientRect();
				const liveControlsRect =
					topOccludingElement?.getBoundingClientRect();
				const liveTargetY = getMobileSelectionTargetY({
					mapTop: liveMapRect.top,
					mapHeight: liveMapRect.height,
					sheetTop: livePanelRect.top,
					controlsBottom: liveControlsRect?.bottom,
				});
				const desiredPoint = L.point(
					liveMapRect.width / 2,
					liveTargetY,
				);
				const renderedSelection = map.latLngToContainerPoint(
					L.latLng(focusCenter),
				);
				const correction = L.point(
					renderedSelection.x - desiredPoint.x,
					renderedSelection.y - desiredPoint.y,
				);

				if (Math.hypot(correction.x, correction.y) <= 1) {
					onFocusSettled(focusSelectionKey);
					return;
				}
				const settleFocus = () => {
					correctionHandlerRef.current = undefined;
					onFocusSettled(focusSelectionKey);
				};
				correctionHandlerRef.current = settleFocus;
				map.once("moveend", settleFocus);
				map.panBy(correction, {
					animate: true,
					duration: 0.2,
					easeLinearity: 0.2,
				});
			};
			correctionHandlerRef.current = correctRenderedPosition;
			map.once("moveend", correctRenderedPosition);

			map.flyTo(adjustedCenter, zoom, {
				duration: 0.45,
				easeLinearity: 0.2,
			});
		}

		focusSelection();

		if (!panel) return;

		const observer = new ResizeObserver(focusSelection);
		observer.observe(panel);
		observer.observe(map.getContainer());
		if (topOccludingElement) observer.observe(topOccludingElement);
		const handlePanelAnimationEnd = (event: AnimationEvent) => {
			if (event.target === panel) focusSelection();
		};
		panel.addEventListener("animationend", handlePanelAnimationEnd);

		return () => {
			clearPendingCorrection();
			observer.disconnect();
			panel.removeEventListener("animationend", handlePanelAnimationEnd);
		};
	}, [
		adjustForOcclusion,
		latitude,
		longitude,
		map,
		minimumZoom,
		occludingElement,
		onFocusSettled,
		onFocusStart,
		selectionKey,
		topOccludingElement,
	]);

	return null;
}

function MapViewportObserver({
	initialViewport,
	onViewportChange,
}: {
	initialViewport?: MapViewport;
	onViewportChange?: (viewport: MapViewport) => void;
}) {
	const lastViewportRef = useRef<MapViewport | undefined>(initialViewport);
	const map = useMapEvents({
		moveend: publishViewport,
		zoomend: publishViewport,
	});

	function publishViewport() {
		const center = map.getCenter();
		const nextViewport: MapViewport = {
			center: [center.lat, center.lng],
			zoom: map.getZoom(),
		};
		const previousViewport = lastViewportRef.current;
		if (
			previousViewport?.zoom === nextViewport.zoom &&
			previousViewport.center[0] === nextViewport.center[0] &&
			previousViewport.center[1] === nextViewport.center[1]
		) {
			return;
		}

		lastViewportRef.current = nextViewport;
		onViewportChange?.(nextViewport);
	}

	return null;
}

function ReportMarkersLayer({
	reports,
	onSelectReportGroup,
}: {
	reports: PublicMapReport[];
	onSelectReportGroup?: (group: PublicReportGroupSelection) => void;
}) {
	const map = useMap();
	const [mapZoom, setMapZoom] = useState(() => map.getZoom());

	useMapEvents({
		zoomend: () => setMapZoom(map.getZoom()),
	});

	const groups = useMemo(
		() =>
			buildPublicReportMarkerGroups(reports, {
				zoom: mapZoom,
				project: (point, zoom) => {
					const projected = map.project(
						L.latLng(point.latitude, point.longitude),
						zoom,
					);
					return { x: projected.x, y: projected.y };
				},
			}),
		[map, mapZoom, reports],
	);

	function handleGroupClick(group: PublicReportMarkerGroup) {
		onSelectReportGroup?.({
			reports: group.reports,
			center: group.center,
			isExactStack: group.isExactStack,
			totalReportCount: group.totalReportCount,
		});
	}

	return (
		<>
			{groups.map((group) => {
				const isStacked =
					group.reports.length > 1 || group.totalReportCount > 1;
				const accessibleTitle = markerPriorityDescription(
					group.priorityState,
					group.title,
				);

				return (
					<Marker
						key={group.id}
						position={group.center}
						icon={
							isStacked
								? buildPublicStackIcon(
										group.priorityState,
										group.totalReportCount,
										group.isExactStack,
									)
								: buildPublicIcon(group.priorityState)
						}
						title={accessibleTitle}
						alt={accessibleTitle}
						eventHandlers={{ click: () => handleGroupClick(group) }}
					/>
				);
			})}
		</>
	);
}

function UserLocationLayer({ fix }: { fix: UserLocationFix }) {
	const position = toLeafletPosition(fix.location);
	const accuracy = fix.location.accuracyMeters;

	return (
		<>
			{typeof accuracy === "number" && accuracy > 0 ? (
				<Circle
					center={position}
					radius={accuracy}
					interactive={false}
					pathOptions={{
						className: "map-user-location-accuracy",
						color: "#1a73e8",
						fillColor: "#1a73e8",
						fillOpacity: 0.14,
						opacity: 0.28,
						weight: 1,
					}}
				/>
			) : null}
			<Marker
				position={position}
				icon={userLocationIcon}
				interactive={false}
				keyboard={false}
				zIndexOffset={1000}
				title="Your current location"
				alt="Your current location"
			/>
		</>
	);
}

export function PublicReportsMap({
	reports,
	hotspots,
	showHotspots,
	selectedHotspot,
	showSelectedHotspotBuffer = false,
	selectionFocus,
	hotspotError,
	centerOverride,
	initialViewport,
	onViewportChange,
	userLocationFix,
	onSelectHotspot,
	onSelectReportGroup,
	mapRef,
}: PublicReportsMapProps) {
	const [tileStatus, setTileStatus] = useState<TileStatus>("loading");
	const [settledSelectionKey, setSettledSelectionKey] = useState<string>();
	const hadTileErrorRef = useRef(false);
	const handleFocusStart = useCallback(() => {
		setSettledSelectionKey(undefined);
	}, []);
	const handleFocusSettled = useCallback((selectionKey: string) => {
		setSettledSelectionKey(selectionKey);
	}, []);
	const fallbackReport = reports[0];
	const fallbackHotspot = hotspots[0];
	const mapCenter =
		centerOverride ??
		(fallbackReport
			? toLeafletPosition(fallbackReport.publicLocation)
			: fallbackHotspot
				? toLeafletPosition(fallbackHotspot.center)
				: ([KL_CENTER.latitude, KL_CENTER.longitude] as [number, number]));
	const initialCenter = initialViewport?.center ?? mapCenter;
	const initialZoom = initialViewport?.zoom ?? DEFAULT_MAP_ZOOM;

	return (
		<div className={`map-frame map-frame--public map-frame--${tileStatus}`}>
			{tileStatus === "loading" ? (
				<div className="map-frame__banner">
					<strong>Loading basemap</strong>
					<p>
						Public report markers and thumbnails will appear once the map tiles
						finish loading.
					</p>
				</div>
			) : null}

			{tileStatus === "fallback" ? (
				<div className="map-frame__banner map-frame__banner--warning">
					<strong>Basemap unavailable right now</strong>
					<p>
						If the tiles stay gray, reload the page or check the connection.
						Public evidence still loads from the report detail view.
					</p>
				</div>
			) : null}

			{showHotspots && hotspotError ? (
				<div className="map-frame__banner map-frame__banner--warning map-frame__banner--offset">
					<strong>Hotspot context unavailable</strong>
					<p>{hotspotError}</p>
				</div>
			) : null}

			<MapContainer
				ref={mapRef}
				center={initialCenter}
				zoom={initialZoom}
				minZoom={PUBLIC_MAP_MIN_ZOOM}
				maxZoom={PUBLIC_MAP_MAX_ZOOM}
				scrollWheelZoom
				dragging
				touchZoom
				doubleClickZoom
				keyboard
				zoomControl={false}
				attributionControl={false}
				className="map-frame__canvas"
			>
				<MapCenterSync
					centerOverride={centerOverride}
					minimumZoom={DEFAULT_MAP_ZOOM}
				/>
				<SelectionFocusSync
					selectionFocus={selectionFocus}
					onFocusStart={handleFocusStart}
					onFocusSettled={handleFocusSettled}
				/>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					maxNativeZoom={18}
					maxZoom={PUBLIC_MAP_MAX_ZOOM}
					eventHandlers={{
						loading: () =>
							setTileStatus((currentStatus) =>
								currentStatus === "fallback" ? currentStatus : "loading",
							),
						load: () =>
							setTileStatus(hadTileErrorRef.current ? "fallback" : "ready"),
						tileerror: () => {
							hadTileErrorRef.current = true;
							setTileStatus("fallback");
						},
					}}
				/>

				{showHotspots &&
				showSelectedHotspotBuffer &&
				selectedHotspot &&
				settledSelectionKey === selectionFocus?.key ? (
					<Circle
						center={toLeafletPosition(selectedHotspot.center)}
						radius={selectedHotspot.warningRadiusMeters}
						interactive={false}
						pathOptions={{
							className: "map-hotspot-advisory-buffer",
							color: "#d32f2f",
							dashArray: "8 7",
							fillColor: "#d32f2f",
							fillOpacity: 0.07,
							opacity: 0.72,
							weight: 2,
						}}
					/>
				) : null}

				{showHotspots
					? hotspots.map((hotspot) => (
							<Marker
								key={hotspot.id}
								position={toLeafletPosition(hotspot.center)}
				icon={hotspotMarkerIcon}
				eventHandlers={{ click: () => onSelectHotspot?.(hotspot) }}
			>
								{hotspot.id !== selectedHotspot?.id ? (
									<Tooltip direction="top" offset={[0, -10]}>
										<span
											style={{
												fontWeight: 800,
												fontSize: "0.8rem",
												textTransform: "uppercase",
											}}
										>
											{hotspot.locality}
										</span>
									</Tooltip>
								) : null}
							</Marker>
						))
					: null}

				<ReportMarkersLayer
					reports={reports}
					onSelectReportGroup={onSelectReportGroup}
				/>
				{userLocationFix ? <UserLocationLayer fix={userLocationFix} /> : null}
				<MapViewportObserver
					initialViewport={initialViewport}
					onViewportChange={onViewportChange}
				/>
			</MapContainer>
		</div>
	);
}
