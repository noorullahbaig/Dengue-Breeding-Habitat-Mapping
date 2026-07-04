import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	MapContainer,
	Marker,
	TileLayer,
	Tooltip,
	useMap,
	useMapEvents,
	ZoomControl,
} from "react-leaflet";
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
	showLegend?: boolean;
	hotspotError?: string;
	centerOverride?: [number, number];
	onSelectHotspot?: (hotspot: PublicHotspot) => void;
	onSelectReportGroup?: (group: PublicReportGroupSelection) => void;
}

type TileStatus = "loading" | "ready" | "fallback";

const PUBLIC_MAP_MIN_ZOOM = 11;
const PUBLIC_MAP_MAX_ZOOM = 22;
const REPORT_COLLISION_RADIUS_PX = 36;
const EXACT_LOCATION_DECIMALS = 6;

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
}: {
	centerOverride?: [number, number];
}) {
	const map = useMap();

	useEffect(() => {
		if (!centerOverride) return;

		map.flyTo(centerOverride, Math.max(map.getZoom(), DEFAULT_MAP_ZOOM), {
			duration: 0.45,
			easeLinearity: 0.2,
		});
	}, [centerOverride, map]);

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

export function PublicReportsMap({
	reports,
	hotspots,
	showHotspots,
	showLegend = true,
	hotspotError,
	centerOverride,
	onSelectHotspot,
	onSelectReportGroup,
}: PublicReportsMapProps) {
	const [tileStatus, setTileStatus] = useState<TileStatus>("loading");
	const hadTileErrorRef = useRef(false);
	const fallbackReport = reports[0];
	const fallbackHotspot = hotspots[0];
	const mapCenter =
		centerOverride ??
		(fallbackReport
			? toLeafletPosition(fallbackReport.publicLocation)
			: fallbackHotspot
				? toLeafletPosition(fallbackHotspot.center)
				: ([KL_CENTER.latitude, KL_CENTER.longitude] as [number, number]));

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

			{showLegend ? (
				<section className="map-priority-legend" aria-label="Map legend">
					<div className="map-priority-legend__item">
						<span
							className="map-priority-legend__dot map-priority-legend__dot--prioritized"
							aria-hidden="true"
						/>
						<span>Priority report</span>
					</div>
					<div className="map-priority-legend__item">
						<span
							className="map-priority-legend__dot map-priority-legend__dot--normal"
							aria-hidden="true"
						/>
						<span>Report</span>
					</div>
					<div className="map-priority-legend__item">
						<span className="map-priority-legend__diamond" aria-hidden="true" />
						<span>Hotspot</span>
					</div>
				</section>
			) : null}

			<MapContainer
				center={mapCenter}
				zoom={DEFAULT_MAP_ZOOM}
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
				<MapCenterSync centerOverride={centerOverride} />
				<ZoomControl position="bottomright" />
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

				{showHotspots
					? hotspots.map((hotspot) => (
							<Marker
								key={hotspot.id}
								position={toLeafletPosition(hotspot.center)}
								icon={hotspotMarkerIcon}
								eventHandlers={{ click: () => onSelectHotspot?.(hotspot) }}
							>
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
							</Marker>
						))
					: null}

				<ReportMarkersLayer
					reports={reports}
					onSelectReportGroup={onSelectReportGroup}
				/>
			</MapContainer>
		</div>
	);
}
