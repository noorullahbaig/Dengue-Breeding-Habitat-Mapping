import {
	Circle,
	MapContainer,
	Marker,
	Polygon,
	Popup,
	TileLayer,
	useMap,
	useMapEvents,
} from "react-leaflet";
import { useEffect, useState } from "react";
import { REVIEW_MAP_ZOOM } from "@/lib/constants";
import {
	detectedLocationIcon,
	residentMarkerIcon,
	toLeafletPosition,
} from "@/lib/map";
import {
	isWithinServiceArea,
	serviceAreaMapBounds,
	serviceAreaMaskPositions,
	serviceAreaBoundaryPolygons,
	SERVICE_AREA_ERROR,
	SERVICE_AREA_LABEL,
} from "@/lib/serviceArea";
import type { LocationPoint } from "@/types/report";
import { MapFrame } from "@/components/ui";

interface LocationReviewMapProps {
	location: LocationPoint;
	detectedLocation?: LocationPoint | null;
	allowedRadiusMeters?: number | null;
	selectionMode?: "marker" | "fixed-center";
	onLocationChange: (location: LocationPoint) => void;
}

const NUDGE_DEGREES = 0.00045;

function RecenterMap({ location }: { location: LocationPoint }) {
	const map = useMap();

	useEffect(() => {
		map.setView(toLeafletPosition(location), REVIEW_MAP_ZOOM);
	}, [location, map]);

	return null;
}

function ServiceAreaPatternDefs() {
	const map = useMap();

	useEffect(() => {
		function ensurePattern() {
			const svg = map.getPanes().overlayPane.querySelector("svg");
			if (!svg || svg.querySelector("#service-area-hatch")) {
				return;
			}

			const namespace = "http://www.w3.org/2000/svg";
			const defs = document.createElementNS(namespace, "defs");
			const pattern = document.createElementNS(namespace, "pattern");
			pattern.setAttribute("id", "service-area-hatch");
			pattern.setAttribute("patternUnits", "userSpaceOnUse");
			pattern.setAttribute("width", "12");
			pattern.setAttribute("height", "12");

			const rect = document.createElementNS(namespace, "rect");
			rect.setAttribute("width", "12");
			rect.setAttribute("height", "12");
			rect.setAttribute("fill", "#4f5d57");
			rect.setAttribute("fill-opacity", "0.2");

			const path = document.createElementNS(namespace, "path");
			path.setAttribute("d", "M-3 12L12 -3M3 15L15 3");
			path.setAttribute("stroke", "#4f5d57");
			path.setAttribute("stroke-width", "2");
			path.setAttribute("stroke-opacity", "0.34");

			pattern.append(rect, path);
			defs.append(pattern);
			svg.prepend(defs);
		}

		ensurePattern();
		map.on("layeradd", ensurePattern);
		map.on("zoomend", ensurePattern);

		return () => {
			map.off("layeradd", ensurePattern);
			map.off("zoomend", ensurePattern);
		};
	}, [map]);

	return null;
}

function ClickToPlacePin({
	location,
	onLocationChange,
	onBoundaryWarning,
}: {
	location: LocationPoint;
	onLocationChange: (location: LocationPoint) => void;
	onBoundaryWarning: (message: string) => void;
}) {
	useMapEvents({
		click(event) {
			const nextLocation: LocationPoint = {
				latitude: event.latlng.lat,
				longitude: event.latlng.lng,
				accuracyMeters: location.accuracyMeters,
				source: "manual",
			};

			if (!isWithinServiceArea(nextLocation)) {
				onBoundaryWarning("Choose a point inside the Kuala Lumpur boundary.");
				return;
			}

			onBoundaryWarning("");
			onLocationChange(nextLocation);
		},
	});

	return null;
}

function CenterPinSelection({
	location,
	onLocationChange,
}: {
	location: LocationPoint;
	onLocationChange: (location: LocationPoint) => void;
}) {
	const map = useMap();

	useEffect(() => {
		function syncCenterSelection() {
			const center = map.getCenter();
			onLocationChange({
				latitude: center.lat,
				longitude: center.lng,
				accuracyMeters: location.accuracyMeters,
				source: "manual",
			});
		}

		map.on("moveend", syncCenterSelection);

		return () => {
			map.off("moveend", syncCenterSelection);
		};
	}, [location.accuracyMeters, map, onLocationChange]);

	return null;
}

export function LocationReviewMap({
	location,
	detectedLocation,
	allowedRadiusMeters,
	selectionMode = "marker",
	onLocationChange,
}: LocationReviewMapProps) {
	const [boundaryWarning, setBoundaryWarning] = useState("");
	const isFixedCenterMode = selectionMode === "fixed-center";

	useEffect(() => {
		if (isFixedCenterMode || isWithinServiceArea(location)) {
			setBoundaryWarning("");
		}
	}, [isFixedCenterMode, location]);

	function movePin(deltaLatitude: number, deltaLongitude: number) {
		const nextLocation: LocationPoint = {
			...location,
			latitude: location.latitude + deltaLatitude,
			longitude: location.longitude + deltaLongitude,
			source: "manual",
		};

		if (!isWithinServiceArea(nextLocation)) {
			setBoundaryWarning("The pin stayed at the last valid location.");
			return;
		}

		setBoundaryWarning("");
		onLocationChange(nextLocation);
	}

	return (
		<MapFrame
			label="Choose the exact report location"
			height="immersive"
			className="map-frame stack-md"
			banner={
				boundaryWarning ? (
					<div aria-live="polite">
						<strong>{SERVICE_AREA_ERROR}</strong>
						<p>{boundaryWarning}</p>
					</div>
				) : undefined
			}
		>
			<div className="u-static-2aa73adf">
				<MapContainer
					center={toLeafletPosition(location)}
					zoom={REVIEW_MAP_ZOOM}
					maxZoom={22}
					maxBounds={serviceAreaMapBounds}
					maxBoundsViscosity={1}
					scrollWheelZoom={false}
					attributionControl={false}
					className="map-frame__canvas u-static-0dbf464c"
				>
					<TileLayer
						attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
						maxNativeZoom={18}
						maxZoom={22}
					/>
					<RecenterMap location={location} />
					<ServiceAreaPatternDefs />
					{isFixedCenterMode ? (
						<CenterPinSelection
							location={location}
							onLocationChange={onLocationChange}
						/>
					) : (
						<ClickToPlacePin
							location={location}
							onLocationChange={onLocationChange}
							onBoundaryWarning={setBoundaryWarning}
						/>
					)}
					<Polygon
						positions={serviceAreaMaskPositions}
						interactive={false}
						pathOptions={{
							className: "service-area-mask service-area-mask--hatched",
							color: "#4f5d57",
							fillColor: "url(#service-area-hatch)",
							fillOpacity: 1,
							opacity: 0,
							weight: 0,
						}}
					/>
					{serviceAreaBoundaryPolygons.map((polygon) => (
						<Polygon
							key={polygon.id}
							positions={polygon.positions}
							pathOptions={{
								color: "#185676",
								fillColor: "#185676",
								fillOpacity: 0.08,
								weight: 2.4,
								dashArray: "8 5",
							}}
						>
							<Popup>{SERVICE_AREA_LABEL}</Popup>
						</Polygon>
					))}
					{detectedLocation ? (
						<Circle
							center={toLeafletPosition(detectedLocation)}
							radius={Math.max(detectedLocation.accuracyMeters ?? 28, 28)}
							pathOptions={{
								color: "#2f7dd3",
								fillColor: "#2f7dd3",
								fillOpacity: 0.12,
							}}
						/>
					) : null}
					{detectedLocation && allowedRadiusMeters ? (
						<Circle
							center={toLeafletPosition(detectedLocation)}
							radius={allowedRadiusMeters}
							pathOptions={{
								color: "#156874",
								fillOpacity: 0,
								opacity: 0.95,
								weight: 2.5,
								dashArray: "7 5",
							}}
						/>
					) : null}
					{detectedLocation ? (
						<Marker
							position={toLeafletPosition(detectedLocation)}
							icon={detectedLocationIcon}
							zIndexOffset={400}
						>
							<Popup>
								Approximate device location. Use this as a guide only.
							</Popup>
						</Marker>
					) : null}
					{!isFixedCenterMode ? (
						<Marker
							position={toLeafletPosition(location)}
							draggable
							icon={residentMarkerIcon}
							zIndexOffset={600}
							eventHandlers={{
								dragend(event) {
									const marker = event.target;
									const nextLatLng = marker.getLatLng();
									const nextLocation: LocationPoint = {
										latitude: nextLatLng.lat,
										longitude: nextLatLng.lng,
										accuracyMeters: location.accuracyMeters,
										source: "manual",
									};

									if (!isWithinServiceArea(nextLocation)) {
										marker.setLatLng(toLeafletPosition(location));
										setBoundaryWarning(
											"The pin was returned to the last valid location.",
										);
										return;
									}

									setBoundaryWarning("");
									onLocationChange(nextLocation);
								},
							}}
						>
							<Popup>
								Drag this pin to the exact point you consent to publish.
							</Popup>
						</Marker>
					) : null}
				</MapContainer>

				{isFixedCenterMode ? (
					<div className="map-center-pin" aria-hidden="true">
						<div className="map-center-pin__stem" />
						<div className="map-center-pin__head" />
						<div className="map-center-pin__pulse" />
					</div>
				) : (
					<div className="map-nudge-control">
						<span className="map-nudge-control__label">Nudge</span>
						<button
							type="button"
							className="map-nudge-control__btn"
							onClick={() => movePin(0, -NUDGE_DEGREES)}
							title="Nudge West"
							aria-label="Nudge West"
						>
							◀
						</button>
						<button
							type="button"
							className="map-nudge-control__btn"
							onClick={() => movePin(NUDGE_DEGREES, 0)}
							title="Nudge North"
							aria-label="Nudge North"
						>
							▲
						</button>
						<button
							type="button"
							className="map-nudge-control__btn"
							onClick={() => movePin(-NUDGE_DEGREES, 0)}
							title="Nudge South"
							aria-label="Nudge South"
						>
							▼
						</button>
						<button
							type="button"
							className="map-nudge-control__btn"
							onClick={() => movePin(0, NUDGE_DEGREES)}
							title="Nudge East"
							aria-label="Nudge East"
						>
							▶
						</button>
					</div>
				)}
			</div>
		</MapFrame>
	);
}
