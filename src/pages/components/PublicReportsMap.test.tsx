import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PointExpression } from "leaflet";
import {
	buildPublicReportMarkerGroups,
	getPublicPriorityState,
	PublicReportsMap,
	type PublicReportGroupSelection,
} from "@/pages/components/PublicReportsMap";
import type { LocationPoint, PublicMapReport } from "@/types/report";

const leafletHarness = vi.hoisted(() => ({
	zoom: 13,
	maxZoom: 19,
	flyTo: vi.fn(),
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
		getMaxZoom: () => leafletHarness.maxZoom,
		project: (
			latLng: { lat: number; lng: number },
			zoom: number,
		): PointExpression => projectPoint(
			{ latitude: latLng.lat, longitude: latLng.lng },
			zoom,
		),
		flyTo: leafletHarness.flyTo,
	};

	return {
		MapContainer: ({
			children,
			maxZoom,
		}: {
			children: React.ReactNode;
			maxZoom?: number;
		}) => {
			if (maxZoom) {
				leafletHarness.maxZoom = maxZoom;
			}
			return <div data-testid="public-map">{children}</div>;
		},
		Marker: ({
			eventHandlers,
			title,
			alt,
			icon,
		}: {
			eventHandlers?: { click?: () => void };
			title?: string;
			alt?: string;
			icon?: { options?: { className?: string } };
		}) => (
			<button
				type="button"
				data-icon-class={icon?.options?.className ?? ""}
				data-marker-alt={alt ?? ""}
				onClick={() => eventHandlers?.click?.()}
			>
				{title}
			</button>
		),
		TileLayer: () => null,
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

describe("PublicReportsMap marker grouping", () => {
	beforeEach(() => {
		leafletHarness.zoom = 13;
		leafletHarness.maxZoom = 19;
		leafletHarness.flyTo.mockClear();
		leafletHarness.latestHandlers = undefined;
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

	it("collapses core and warning into the same prioritized public state", () => {
		expect(getPublicPriorityState({ priorityLevel: "core", priorityReason: "" })).toBe(
			"prioritized",
		);
		expect(
			getPublicPriorityState({ priorityLevel: "warning", priorityReason: "" }),
		).toBe("prioritized");
		expect(
			getPublicPriorityState({ priorityLevel: "routine", priorityReason: "" }),
		).toBe("normal");
		expect(
			getPublicPriorityState({ priorityLevel: "unavailable", priorityReason: "" }),
		).toBe("normal");
		expect(
			getPublicPriorityState({ priorityLevel: "unassessed", priorityReason: "" }),
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

		const legend = screen.getByRole("region", { name: "Map legend" });
		expect(legend.querySelectorAll(".map-priority-legend__item")).toHaveLength(3);
		expect(legend).toHaveTextContent("Priority report");
		expect(legend).toHaveTextContent("Report");
		expect(legend).toHaveTextContent("Hotspot");
		expect(legend.querySelector(".map-priority-legend__diamond")).not.toBeNull();
		expect(legend).not.toHaveTextContent("400 m");
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
