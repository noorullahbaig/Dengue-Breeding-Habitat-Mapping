import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PointExpression } from "leaflet";
import type { UserLocationFix } from "@/app/PublicMapSessionContext";
import {
	buildPublicReportMarkerGroups,
	getVisibleMapVerticalOffset,
	getPublicPriorityState,
	PublicReportsMap,
	type PublicReportGroupSelection,
} from "@/pages/components/PublicReportsMap";
import type { LocationPoint, PublicHotspot, PublicMapReport } from "@/types/report";

const leafletHarness = vi.hoisted(() => ({
	zoom: 13,
	center: { lat: 3.13902, lng: 101.68692 },
	maxZoom: 19,
	containerCenter: undefined as [number, number] | undefined,
	containerZoom: undefined as number | undefined,
	flyTo: vi.fn(),
	mapContainer: undefined as HTMLDivElement | undefined,
	mapSize: { x: 400, y: 800 },
	selectionPoint: { x: 200, y: 220 },
	panBy: vi.fn(),
	onceHandlers: {} as Record<string, (() => void) | undefined>,
	resizeCallbacks: [] as ResizeObserverCallback[],
	latestHandlers: undefined as
		| {
				zoomend?: () => void;
				moveend?: () => void;
				resize?: () => void;
		  }
		| undefined,
}));

function projectPoint(
	point: Pick<LocationPoint, "latitude" | "longitude">,
	zoom: number,
) {
	const effectiveZoom = Math.min(zoom, 19);
	const zoomScale = 2 ** (effectiveZoom - 13);
	return {
		x: point.longitude * 1_000_000 * zoomScale,
		y: point.latitude * 1_000_000 * zoomScale,
	};
}

vi.mock("react-leaflet", () => {
	const mockMap = {
		getZoom: () => leafletHarness.zoom,
		getCenter: () => leafletHarness.center,
		getMaxZoom: () => leafletHarness.maxZoom,
		project: (
			latLng: { lat: number; lng: number },
			zoom: number,
		): PointExpression =>
			projectPoint({ latitude: latLng.lat, longitude: latLng.lng }, zoom),
		unproject: (point: { x: number; y: number }, zoom: number) => {
			const effectiveZoom = Math.min(zoom, 19);
			const zoomScale = 2 ** (effectiveZoom - 13);
			return {
				lat: point.y / (1_000_000 * zoomScale),
				lng: point.x / (1_000_000 * zoomScale),
			};
		},
		getSize: () => leafletHarness.mapSize,
		getContainer: () => leafletHarness.mapContainer,
		latLngToContainerPoint: () => leafletHarness.selectionPoint,
		panBy: leafletHarness.panBy,
		once: (event: string, handler: () => void) => {
			leafletHarness.onceHandlers[event] = handler;
		},
		off: (event: string, handler: () => void) => {
			if (leafletHarness.onceHandlers[event] === handler) {
				leafletHarness.onceHandlers[event] = undefined;
			}
		},
		flyTo: leafletHarness.flyTo,
	};

	return {
		Circle: ({
			radius,
			interactive,
			pathOptions,
		}: {
			radius: number;
			interactive?: boolean;
			pathOptions?: {
				className?: string;
				dashArray?: string;
				fillOpacity?: number;
				opacity?: number;
				weight?: number;
			};
		}) => (
			<div
				data-testid={
					pathOptions?.className === "map-hotspot-advisory-buffer"
						? "hotspot-advisory-buffer"
						: "user-location-accuracy"
				}
				data-radius={radius}
				data-interactive={String(interactive)}
				data-dash-array={pathOptions?.dashArray}
				data-fill-opacity={pathOptions?.fillOpacity}
				data-opacity={pathOptions?.opacity}
				data-weight={pathOptions?.weight}
			/>
		),
		MapContainer: ({
			children,
			maxZoom,
			center,
			zoom,
		}: {
			children: React.ReactNode;
			maxZoom?: number;
			center?: [number, number];
			zoom?: number;
		}) => {
			if (maxZoom) {
				leafletHarness.maxZoom = maxZoom;
			}
			leafletHarness.containerCenter = center;
			leafletHarness.containerZoom = zoom;
			return <div data-testid="public-map">{children}</div>;
		},
		Marker: ({
			eventHandlers,
			title,
			alt,
			icon,
			children,
		}: {
			eventHandlers?: { click?: () => void };
			title?: string;
			alt?: string;
			icon?: { options?: { className?: string } };
			children?: React.ReactNode;
		}) => (
			<button
				type="button"
				data-icon-class={icon?.options?.className ?? ""}
				data-marker-alt={alt ?? ""}
				onClick={() => eventHandlers?.click?.()}
			>
				{title}
				{children}
			</button>
		),
		TileLayer: () => null,
		Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		ZoomControl: () => null,
		useMap: () => mockMap,
		useMapEvents: (
			handlers: NonNullable<typeof leafletHarness.latestHandlers>,
		) => {
			leafletHarness.latestHandlers = handlers;
			return mockMap;
		},
	};
});

function report(
	id: string,
	latitude: number,
	longitude: number,
	overrides: Partial<PublicMapReport> = {},
): PublicMapReport {
	return {
		id,
		reference: `KL-${id}`,
		publicLocation: {
			latitude,
			longitude,
			source: "public",
		},
		habitatClass: "drain_inlet",
		prediction: {
			label: "drain_inlet",
			confidence: 0.84,
			confidenceBand: "high",
			advisoryText: "Likely habitat.",
		},
		status: "submitted",
		neighborhood: "Sentul",
		reportedAt: `2026-06-2${id}`,
		latestReportedAt: `2026-06-2${id}`,
		reportCount: 1,
		thumbnailUrl: "/evidence-thumb.jpg",
		imageUrl: "/evidence.jpg",
		privacyNote: "Public location.",
		...overrides,
	};
}

function hotspot(): PublicHotspot {
	return {
		id: "hotspot-1",
		locality: "Taman Melati",
		district: "Wangsa Maju",
		center: {
			latitude: 3.2001,
			longitude: 101.7182,
			source: "public",
		},
		radiusMeters: 200,
		warningRadiusMeters: 400,
		cumulativeCases: 12,
		outbreakDurationDays: 36,
		outbreakStartDate: "2026-06-21T00:00:00.000Z",
		weekNumber: 29,
		year: 2026,
		snapshotDate: "2026-07-20T00:00:00.000Z",
		sourceLabel: "iDengue hotspot context",
	};
}

describe("PublicReportsMap marker grouping", () => {
	beforeEach(() => {
		leafletHarness.zoom = 13;
		leafletHarness.center = { lat: 3.13902, lng: 101.68692 };
		leafletHarness.maxZoom = 19;
		leafletHarness.containerCenter = undefined;
		leafletHarness.containerZoom = undefined;
		leafletHarness.flyTo.mockClear();
		leafletHarness.mapSize = { x: 400, y: 800 };
		leafletHarness.selectionPoint = { x: 200, y: 220 };
		leafletHarness.panBy.mockClear();
		leafletHarness.onceHandlers = {};
		leafletHarness.mapContainer = document.createElement("div");
		leafletHarness.mapContainer.getBoundingClientRect = () =>
			({
				top: 100,
				bottom: 900,
				left: 0,
				right: 400,
				width: 400,
				height: 800,
				x: 0,
				y: 100,
				toJSON: () => ({}),
			}) as DOMRect;
		leafletHarness.resizeCallbacks = [];
		window.ResizeObserver = class {
			constructor(callback: ResizeObserverCallback) {
				leafletHarness.resizeCallbacks.push(callback);
			}

			observe() {}
			unobserve() {}
			disconnect() {}
		} as typeof ResizeObserver;
		leafletHarness.latestHandlers = undefined;
	});

	it("calculates the vertical shift needed to center a marker above a sheet", () => {
		expect(
			getVisibleMapVerticalOffset({
				mapTop: 100,
				mapHeight: 800,
				sheetTop: 600,
			}),
		).toBe(158);
		expect(
			getVisibleMapVerticalOffset({
				mapTop: 100,
				mapHeight: 800,
				sheetTop: 916,
			}),
		).toBe(0);
	});

	it("focuses a mobile selection in the visible area and responds to sheet resizing", () => {
		leafletHarness.mapSize = { x: 400, y: 900 };
		const sheetWrapper = document.createElement("div");
		const sheet = document.createElement("section");
		sheet.className = "map-detail-sheet";
		sheetWrapper.append(sheet);
		let sheetTop = 600;
		sheet.getBoundingClientRect = () =>
			({
				top: sheetTop,
				bottom: 850,
				left: 0,
				right: 400,
				width: 400,
				height: 250,
				x: 0,
				y: sheetTop,
				toJSON: () => ({}),
			}) as DOMRect;

		render(
			<PublicReportsMap
				reports={[]}
				hotspots={[]}
				showHotspots={false}
				selectionFocus={{
					key: "report:KL-1",
					center: [3.13902, 101.68692],
					minimumZoom: 12,
					adjustForOcclusion: true,
					occludingElement: sheetWrapper,
				}}
			/>,
		);

		expect(leafletHarness.flyTo).toHaveBeenLastCalledWith(
			expect.objectContaining({ lat: 3.139178, lng: 101.68692 }),
			13,
			expect.objectContaining({ duration: 0.45 }),
		);

		act(() => {
			leafletHarness.onceHandlers.moveend?.();
		});
		expect(leafletHarness.panBy).toHaveBeenCalledWith(
			expect.objectContaining({ x: 0, y: -22 }),
			expect.objectContaining({ animate: true }),
		);

		sheetTop = 500;
		act(() => {
			leafletHarness.resizeCallbacks.at(-1)?.([], {} as ResizeObserver);
		});

		expect(leafletHarness.flyTo).toHaveBeenLastCalledWith(
			expect.objectContaining({ lat: 3.139228, lng: 101.68692 }),
			13,
			expect.objectContaining({ duration: 0.45 }),
		);
	});

	it("keeps desktop selection focus at the true marker coordinates", () => {
		render(
			<PublicReportsMap
				reports={[]}
				hotspots={[]}
				showHotspots={false}
				selectionFocus={{
					key: "report:KL-1",
					center: [3.13902, 101.68692],
					minimumZoom: 12,
					adjustForOcclusion: false,
				}}
			/>,
		);

		expect(leafletHarness.flyTo).toHaveBeenCalledWith(
			[3.13902, 101.68692],
			13,
			expect.objectContaining({ duration: 0.45 }),
		);
	});

	it("groups exact duplicate public coordinates into one hard stack", () => {
		const reports = [
			report("1", 3.13902, 101.68692, { reportCount: 2 }),
			report("2", 3.13902, 101.68692),
		];

		const groups = buildPublicReportMarkerGroups(reports, {
			zoom: 13,
			maxZoom: 19,
			project: projectPoint,
		});

		expect(groups).toHaveLength(1);
		expect(groups[0]).toMatchObject({
			isExactStack: true,
			totalReportCount: 3,
		});
		expect(groups[0]?.reports.map((item) => item.id)).toEqual(["2", "1"]);
	});

	it("initializes from a saved viewport and reports settled viewport changes once", () => {
		const handleViewportChange = vi.fn();
		render(
			<PublicReportsMap
				reports={[]}
				hotspots={[]}
				showHotspots={false}
				initialViewport={{ center: [3.18, 101.72], zoom: 16 }}
				onViewportChange={handleViewportChange}
			/>,
		);

		expect(leafletHarness.containerCenter).toEqual([3.18, 101.72]);
		expect(leafletHarness.containerZoom).toBe(16);

		leafletHarness.center = { lat: 3.2, lng: 101.74 };
		leafletHarness.zoom = 17;
		act(() => {
			leafletHarness.latestHandlers?.moveend?.();
			leafletHarness.latestHandlers?.zoomend?.();
		});

		expect(handleViewportChange).toHaveBeenCalledOnce();
		expect(handleViewportChange).toHaveBeenCalledWith({
			center: [3.2, 101.74],
			zoom: 17,
		});
	});

	it("renders a blue user-location marker and an accuracy halo when accuracy is available", () => {
		const userLocationFix: UserLocationFix = {
			location: {
				latitude: 3.139,
				longitude: 101.6869,
				accuracyMeters: 20,
				source: "browser",
			},
			obtainedAt: Date.now(),
		};

		render(
			<PublicReportsMap
				reports={[]}
				hotspots={[]}
				showHotspots={false}
				userLocationFix={userLocationFix}
			/>,
		);

		expect(screen.getByRole("button", { name: "Your current location" })).toHaveAttribute(
			"data-icon-class",
			expect.stringContaining("map-user-location-marker"),
		);
		expect(screen.getByTestId("user-location-accuracy")).toHaveAttribute("data-radius", "20");
	});

	it("renders one non-interactive 400 m buffer only while mobile visibility is enabled", () => {
		const selectedHotspot = hotspot();
		const { rerender } = render(
			<PublicReportsMap
				reports={[]}
				hotspots={[selectedHotspot]}
				showHotspots
				selectedHotspot={selectedHotspot}
				showSelectedHotspotBuffer
				selectionFocus={{
					key: "hotspot:hotspot-1",
					center: [3.2001, 101.7182],
					minimumZoom: 15,
					adjustForOcclusion: false,
				}}
			/>,
		);

		expect(screen.getByTestId("hotspot-advisory-buffer")).toHaveAttribute(
			"data-radius",
			"400",
		);
		expect(screen.getByTestId("hotspot-advisory-buffer")).toHaveAttribute(
			"data-interactive",
			"false",
		);
		expect(screen.getByTestId("hotspot-advisory-buffer")).toHaveAttribute(
			"data-fill-opacity",
			"0.07",
		);
		expect(screen.getByTestId("hotspot-advisory-buffer")).toHaveAttribute(
			"data-dash-array",
			"8 7",
		);
		expect(screen.getByTestId("hotspot-advisory-buffer")).toHaveAttribute(
			"data-weight",
			"2",
		);
		expect(leafletHarness.flyTo).toHaveBeenCalledWith(
			[3.2001, 101.7182],
			15,
			expect.objectContaining({ duration: 0.45 }),
		);

		rerender(
			<PublicReportsMap
				reports={[]}
				hotspots={[selectedHotspot]}
				showHotspots
				selectedHotspot={selectedHotspot}
				showSelectedHotspotBuffer={false}
				selectionFocus={{
					key: "hotspot:hotspot-1",
					center: [3.2001, 101.7182],
					minimumZoom: 15,
					adjustForOcclusion: false,
				}}
			/>,
		);

		expect(screen.queryByTestId("hotspot-advisory-buffer")).not.toBeInTheDocument();
	});

	it("hides only the selected hotspot tooltip", () => {
		const selectedHotspot = hotspot();
		const otherHotspot = {
			...hotspot(),
			id: "hotspot-2",
			locality: "Setapak",
		};

		render(
			<PublicReportsMap
				reports={[]}
				hotspots={[selectedHotspot, otherHotspot]}
				showHotspots
				selectedHotspot={selectedHotspot}
			/>,
		);

		expect(screen.queryByText("Taman Melati")).not.toBeInTheDocument();
		expect(screen.getByText("Setapak")).toBeInTheDocument();
	});

	it("collapses core and warning into the same prioritized public state", () => {
		expect(
			getPublicPriorityState({ priorityLevel: "core", priorityReason: "" }),
		).toBe("prioritized");
		expect(
			getPublicPriorityState({ priorityLevel: "warning", priorityReason: "" }),
		).toBe("prioritized");
		expect(
			getPublicPriorityState({ priorityLevel: "routine", priorityReason: "" }),
		).toBe("normal");
		expect(
			getPublicPriorityState({
				priorityLevel: "unavailable",
				priorityReason: "",
			}),
		).toBe("normal");
		expect(
			getPublicPriorityState({
				priorityLevel: "unassessed",
				priorityReason: "",
			}),
		).toBe("normal");
		expect(getPublicPriorityState(undefined)).toBe("normal");
	});

	it("marks a group prioritized when any included report is prioritized", () => {
		const baseOptions = {
			zoom: 13,
			maxZoom: 19,
			project: projectPoint,
		};
		const atSameLocation = (id: string, priorityLevel?: string) =>
			report(id, 3.13902, 101.68692, {
				hotspotPriority: priorityLevel
					? { priorityLevel, priorityReason: "" }
					: undefined,
			});

		expect(
			buildPublicReportMarkerGroups(
				[atSameLocation("1", "routine"), atSameLocation("2", "warning")],
				baseOptions,
			)[0]?.priorityState,
		).toBe("prioritized");
		expect(
			buildPublicReportMarkerGroups(
				[atSameLocation("1", "routine"), atSameLocation("2")],
				baseOptions,
			)[0]?.priorityState,
		).toBe("normal");
		expect(
			buildPublicReportMarkerGroups(
				[atSameLocation("1", "routine"), atSameLocation("2", "routine")],
				baseOptions,
			)[0]?.priorityState,
		).toBe("normal");
	});

	it("renders concise marker labels and an exact three-item map key", () => {
		render(
			<PublicReportsMap
				reports={[
					report("1", 3.13902, 101.68692, {
						hotspotPriority: {
							priorityLevel: "core",
							priorityReason: "Within 200 m.",
						},
					}),
					report("2", 3.15, 101.7, {
						hotspotPriority: {
							priorityLevel: "routine",
							priorityReason: "Outside 400 m.",
						},
					}),
					report("3", 3.16, 101.71),
				]}
				hotspots={[]}
				showHotspots={false}
			/>,
		);

		const highPriorityMarker = screen.getByRole("button", {
			name: "Priority report. Open report KL-1.",
		});
		expect(highPriorityMarker).toHaveAttribute(
			"data-icon-class",
			expect.stringContaining("map-pin--priority-prioritized"),
		);
		expect(highPriorityMarker).not.toHaveAttribute(
			"data-icon-class",
			expect.stringContaining("map-pin--drain_inlet"),
		);
		expect(highPriorityMarker).toHaveAttribute(
			"data-marker-alt",
			"Priority report. Open report KL-1.",
		);
		expect(
			screen.getByRole("button", { name: "Report. Open report KL-2." }),
		).toHaveAttribute(
			"data-icon-class",
			expect.stringContaining("map-pin--priority-normal"),
		);
		expect(
			screen.getByRole("button", { name: "Report. Open report KL-3." }),
		).toHaveAttribute(
			"data-icon-class",
			expect.stringContaining("map-pin--priority-normal"),
		);

	});

	it("groups nearby coordinates at low zoom and splits them at higher zoom", () => {
		const reports = [
			report("1", 3.13902, 101.68692),
			report("2", 3.13902, 101.68694),
		];

		const lowZoomGroups = buildPublicReportMarkerGroups(reports, {
			zoom: 13,
			maxZoom: 19,
			project: projectPoint,
		});
		const highZoomGroups = buildPublicReportMarkerGroups(reports, {
			zoom: 15,
			maxZoom: 19,
			project: projectPoint,
		});

		expect(lowZoomGroups).toHaveLength(1);
		expect(lowZoomGroups[0]).toMatchObject({
			isExactStack: false,
			totalReportCount: 2,
		});
		expect(highZoomGroups).toHaveLength(2);
	});

	it("opens a grouped overlap immediately instead of zooming first", async () => {
		const user = userEvent.setup();
		const handleSelectGroup = vi.fn();

		render(
			<PublicReportsMap
				reports={[
					report("1", 3.13902, 101.68692),
					report("2", 3.13902, 101.68694),
				]}
				hotspots={[]}
				showHotspots={false}
				onSelectReportGroup={handleSelectGroup}
			/>,
		);

		await user.click(
			screen.getByRole("button", {
				name: "Report. 2 reports in this area.",
			}),
		);

		expect(handleSelectGroup).toHaveBeenCalledWith(
			expect.objectContaining({ isExactStack: false, totalReportCount: 2 }),
		);
		expect(leafletHarness.flyTo).not.toHaveBeenCalled();
	});

	it("opens exact and separated stacks immediately at any zoom", async () => {
		const user = userEvent.setup();
		const handleSelectGroup = vi.fn<[PublicReportGroupSelection], void>();

		const { rerender } = render(
			<PublicReportsMap
				reports={[
					report("1", 3.13902, 101.68692),
					report("2", 3.13902, 101.68692),
				]}
				hotspots={[]}
				showHotspots={false}
				onSelectReportGroup={handleSelectGroup}
			/>,
		);

		await user.click(
			screen.getByRole("button", {
				name: "Report. 2 reports at this public location.",
			}),
		);

		expect(handleSelectGroup).toHaveBeenCalledWith(
			expect.objectContaining({ isExactStack: true, totalReportCount: 2 }),
		);

		handleSelectGroup.mockClear();
		leafletHarness.zoom = 22;
		act(() => {
			leafletHarness.latestHandlers?.zoomend?.();
		});

		rerender(
			<PublicReportsMap
				reports={[
					report("3", 3.13902, 101.68692),
					report("4", 3.13902, 101.68692056),
				]}
				hotspots={[]}
				showHotspots={false}
				onSelectReportGroup={handleSelectGroup}
			/>,
		);

		await user.click(
			screen.getByRole("button", {
				name: "Report. 2 reports in this area.",
			}),
		);

		expect(handleSelectGroup).toHaveBeenCalledWith(
			expect.objectContaining({ isExactStack: false, totalReportCount: 2 }),
		);
		expect(leafletHarness.flyTo).not.toHaveBeenCalled();
	});
});
