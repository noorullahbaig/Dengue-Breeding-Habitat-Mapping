import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { toLeafletPosition, residentMarkerIcon } from "@/lib/map";
import { REVIEW_MAP_ZOOM } from "@/lib/constants";
import type { LocationPoint } from "@/types/report";
import { MapFrame } from "@/components/ui";

interface StaticReceiptMapProps {
	location: LocationPoint;
}

export function StaticReceiptMap({ location }: StaticReceiptMapProps) {
	return (
		<MapFrame
			label="Reported location"
			height="compact"
			interactive={false}
			className="map-frame"
		>
			<MapContainer
				center={toLeafletPosition(location)}
				zoom={REVIEW_MAP_ZOOM}
				maxZoom={22}
				dragging={false}
				doubleClickZoom={false}
				scrollWheelZoom={false}
				attributionControl={false}
				zoomControl={false}
				className="map-frame__canvas"
			>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					maxNativeZoom={18}
					maxZoom={22}
				/>
				<Marker
					position={toLeafletPosition(location)}
					icon={residentMarkerIcon}
					interactive={false}
				/>
			</MapContainer>
		</MapFrame>
	);
}
