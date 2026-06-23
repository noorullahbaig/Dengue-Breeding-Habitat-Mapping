import L from "leaflet";
import { useRef, useState } from "react";
import {
	MapContainer,
	Marker,
	TileLayer,
	ZoomControl,
} from "react-leaflet";
import {
	DEFAULT_MAP_ZOOM,
	KL_CENTER,
} from "@/lib/constants";
import { hotspotMarkerIcon, toLeafletPosition } from "@/lib/map";
import type { PublicHotspot, PublicMapReport } from "@/types/report";

interface PublicReportsMapV2Props {
	reports: PublicMapReport[];
	hotspots: PublicHotspot[];
	showHotspots: boolean;
	hotspotError?: string;
	centerOverride?: [number, number];
	onSelectHotspot?: (hotspot: PublicHotspot) => void;
	onSelectReport?: (report: PublicMapReport) => void;
}

type TileStatus = "loading" | "ready" | "fallback";

function buildPublicIcon(habitatClass: string) {
	return L.divIcon({
		className: `map-pin map-pin--public map-pin--${habitatClass}`,
		html: '<span class="map-pin__core"></span>',
		iconSize: [20, 20],
		iconAnchor: [10, 10],
		popupAnchor: [0, -12],
	});
}

export function PublicReportsMapV2({
	reports,
	hotspots,
	showHotspots,
	hotspotError,
	centerOverride,
	onSelectHotspot,
	onSelectReport,
}: PublicReportsMapV2Props) {
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

			<MapContainer
				center={mapCenter}
				zoom={DEFAULT_MAP_ZOOM}
				scrollWheelZoom
				zoomControl={false}
				attributionControl={false}
				className="map-frame__canvas"
			>
				<ZoomControl position="bottomright" />
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
							/>
						))
					: null}

				{reports.map((report) => (
					<Marker
						key={report.id}
						position={toLeafletPosition(report.publicLocation)}
						icon={buildPublicIcon(report.prediction.label)}
						eventHandlers={{ click: () => onSelectReport?.(report) }}
					/>
				))}
			</MapContainer>
		</div>
	);
}
