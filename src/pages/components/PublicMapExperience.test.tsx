import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { PublicMapSessionProvider } from "@/app/PublicMapSessionContext";
import { PublicMapExperience } from "@/pages/components/PublicMapExperience";
import type { LocationRequestResult } from "@/lib/geolocation";
import type { PublicHotspot, PublicMapReport } from "@/types/report";

const experienceHarness = vi.hoisted(() => ({
	group: undefined as
		| {
				reports: PublicMapReport[];
				center: [number, number];
				isExactStack: boolean;
				totalReportCount: number;
		  }
		| undefined,
	hotspot: undefined as PublicHotspot | undefined,
	listPublicReports: vi.fn(),
	listHotspots: vi.fn(),
	centerOverride: undefined as [number, number] | undefined,
	mapMountCount: 0,
	isMobile: true,
	requestCurrentLocation: vi.fn<() => Promise<LocationRequestResult>>(),
}));

function renderExperience() {
	return render(
		<MemoryRouter>
			<PublicMapSessionProvider>
				<PublicMapExperience />
			</PublicMapSessionProvider>
		</MemoryRouter>,
	);
}

function RemountableExperience() {
	const [visible, setVisible] = useState(true);

	return (
		<MemoryRouter>
			<PublicMapSessionProvider>
				<button type="button" onClick={() => setVisible((current) => !current)}>
					Toggle map route
				</button>
				{visible ? <PublicMapExperience /> : null}
			</PublicMapSessionProvider>
		</MemoryRouter>
	);
}

vi.mock("@/lib/geolocation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/geolocation")>();
	return {
		...actual,
		requestCurrentLocation: () => experienceHarness.requestCurrentLocation(),
	};
});

vi.mock("@/app/useServices", () => ({
	useServices: () => ({
		mapService: {
			listPublicReports: experienceHarness.listPublicReports,
			listHotspots: experienceHarness.listHotspots,
		},
	}),
}));

vi.mock("@/app/useMobileViewport", () => ({
	useMobileViewport: () => experienceHarness.isMobile,
}));

vi.mock("@/pages/components/PublicReportsMap", async () => {
	const { useState } = await import("react");

	return { PublicReportsMap: ({
		onSelectReportGroup,
		onSelectHotspot,
		showLegend,
		centerOverride,
		initialViewport,
		onViewportChange,
		selectedHotspot,
		showSelectedHotspotBuffer,
		selectionFocus,
	}: {
		onSelectReportGroup?: (
			group: NonNullable<typeof experienceHarness.group>,
		) => void;
		onSelectHotspot?: (
			hotspot: NonNullable<typeof experienceHarness.hotspot>,
		) => void;
		showLegend?: boolean;
		centerOverride?: [number, number];
		initialViewport?: { center: [number, number]; zoom: number };
		onViewportChange?: (viewport: { center: [number, number]; zoom: number }) => void;
		selectedHotspot?: PublicHotspot;
		showSelectedHotspotBuffer?: boolean;
		selectionFocus?: {
			center: [number, number];
			minimumZoom: number;
			adjustForOcclusion: boolean;
			occludingElement?: HTMLElement | null;
		};
	}) => {
		const [mountId] = useState(() => ++experienceHarness.mapMountCount);

		return (
		<>
			<div data-testid="map-mount-id">{mountId}</div>
			<div data-testid="map-center">{centerOverride?.join(',') ?? 'default center'}</div>
			<div data-testid="map-initial-viewport">
				{initialViewport ? `${initialViewport.center.join(',')}@${initialViewport.zoom}` : 'no viewport'}
			</div>
			<div data-testid="legend-state">
				{showLegend === false ? "legend hidden" : "legend visible"}
			</div>
			<div data-testid="selected-hotspot-id">{selectedHotspot?.id ?? "none"}</div>
			<div data-testid="hotspot-buffer-state">
				{showSelectedHotspotBuffer ? "buffer enabled" : "buffer disabled"}
			</div>
			<div data-testid="selection-focus-state">
				{selectionFocus
					? `${selectionFocus.center.join(",")}@${selectionFocus.minimumZoom}:${selectionFocus.adjustForOcclusion ? "adjusted" : "centered"}:${selectionFocus.occludingElement ? "sheet ready" : "no sheet"}`
					: "none"}
			</div>
			<button
				type="button"
				onClick={() => {
					if (experienceHarness.group) {
						onSelectReportGroup?.(experienceHarness.group);
					}
				}}
			>
				Select grouped marker
			</button>
			<button
				type="button"
				onClick={() => {
					if (experienceHarness.hotspot) {
						onSelectHotspot?.(experienceHarness.hotspot);
					}
				}}
			>
				Select hotspot
			</button>
			<button
				type="button"
				onClick={() => onViewportChange?.({ center: [3.18, 101.72], zoom: 16 })}
			>
				Move map
			</button>
		</>
		);
	}, };
});

function report(
	id: string,
	overrides: Partial<PublicMapReport> = {},
): PublicMapReport {
	return {
		id,
		reference: `KL-${id}`,
		publicLocation: {
			latitude: 3.13902,
			longitude: 101.68692,
			source: "public",
		},
		habitatClass: "drain_inlet",
		prediction: {
			label: "drain_inlet",
			confidence: 0.82,
			confidenceBand: "high",
			advisoryText: "Likely habitat.",
		},
		status: "submitted",
		neighborhood: "Sentul",
		reportedAt: `2026-06-2${id}`,
		latestReportedAt: `2026-06-2${id}`,
		reportCount: 1,
		thumbnailUrl: `/thumb-${id}.jpg`,
		imageUrl: `/image-${id}.jpg`,
		privacyNote: "Public location.",
		...overrides,
	};
}

const reports = [
	report("1", { reportCount: 2, neighborhood: "Sentul" }),
	report("2", {
		neighborhood: "Wangsa Maju",
		prediction: {
			label: "tire",
			confidence: 0.71,
			confidenceBand: "moderate",
			advisoryText: "Likely habitat.",
		},
		habitatClass: "tire",
	}),
];

describe("PublicMapExperience report stack sheet", () => {
	beforeEach(() => {
		experienceHarness.mapMountCount = 0;
		experienceHarness.centerOverride = undefined;
		experienceHarness.isMobile = true;
		experienceHarness.group = {
			reports,
			center: [3.13902, 101.68692],
			isExactStack: true,
			totalReportCount: 3,
		};
		experienceHarness.hotspot = {
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
		experienceHarness.listPublicReports.mockResolvedValue(reports);
		experienceHarness.listHotspots.mockResolvedValue([
			experienceHarness.hotspot,
		] satisfies PublicHotspot[]);
	});

	it("keeps the legend and location control in the map UI layer", async () => {
		renderExperience();

		const legend = await screen.findByRole("region", { name: "Map legend" });
		expect(legend.parentElement).toHaveClass("map-page-controls");
		expect(
			screen.getByRole("button", { name: "Center map on my location" })
				.parentElement,
		).toHaveClass("map-action-stack");
	});

	it("centers the map after the resident shares their current location", async () => {
		experienceHarness.requestCurrentLocation.mockResolvedValue({
			ok: true,
			location: {
				latitude: 3.139,
				longitude: 101.6869,
				accuracyMeters: 20,
				source: "browser",
			},
		});

		const user = userEvent.setup();
		renderExperience();

		await user.click(await screen.findByRole("button", { name: "Center map on my location" }));

		expect(experienceHarness.requestCurrentLocation).toHaveBeenCalledOnce();
		expect(screen.getByTestId("map-center")).toHaveTextContent("3.139,101.6869");
	});

	it("restores the viewport and selected report after the map route remounts", async () => {
		const user = userEvent.setup();
		const selectedReport = report("3", { neighborhood: "Bukit Jalil" });
		experienceHarness.group = {
			reports: [selectedReport],
			center: [3.13902, 101.68692],
			isExactStack: false,
			totalReportCount: 1,
		};
		experienceHarness.listPublicReports.mockResolvedValue([selectedReport]);
		render(<RemountableExperience />);

		await user.click(await screen.findByRole("button", { name: "Move map" }));
		await user.click(screen.getByRole("button", { name: "Select grouped marker" }));
		expect(screen.getByRole("heading", { name: "Report" })).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Toggle map route" }));
		await user.click(screen.getByRole("button", { name: "Toggle map route" }));

		expect(await screen.findByTestId("map-initial-viewport")).toHaveTextContent(
			"3.18,101.72@16",
		);
		expect(screen.getByRole("heading", { name: "Report" })).toBeInTheDocument();
		expect(screen.getByText("Bukit Jalil")).toBeInTheDocument();
	});

	it("keeps the Leaflet map mounted while a filter refresh is pending", async () => {
		const user = userEvent.setup();
		let resolveFilteredReports: (reports: PublicMapReport[]) => void = () => {};
		experienceHarness.listPublicReports.mockImplementation((_bounds, filters) => {
			if (filters?.habitatClass === "tire") {
				return new Promise((resolve) => {
					resolveFilteredReports = resolve;
				});
			}
			return Promise.resolve(reports);
		});
		renderExperience();

		const initialMountId = await screen.findByTestId("map-mount-id");
		const mountId = initialMountId.textContent;
		await user.click(screen.getByRole("button", { name: "Tire" }));

		expect(screen.getByTestId("map-mount-id")).toHaveTextContent(mountId ?? "");
		expect(screen.getByText("Updating report markers...")).toBeInTheDocument();

		resolveFilteredReports(reports);
		await waitFor(() => {
			expect(screen.queryByText("Updating report markers...")).not.toBeInTheDocument();
		});
		expect(screen.getByTestId("map-mount-id")).toHaveTextContent(mountId ?? "");
	});

	it("shows progress and ignores duplicate location taps", async () => {
		let resolveRequest: (result: LocationRequestResult) => void = () => {};
		experienceHarness.requestCurrentLocation.mockReturnValue(
			new Promise((resolve) => {
				resolveRequest = resolve;
			}),
		);
		renderExperience();

		const button = await screen.findByRole("button", {
			name: "Center map on my location",
		});
		fireEvent.click(button);
		fireEvent.click(button);

		expect(experienceHarness.requestCurrentLocation).toHaveBeenCalledOnce();
		expect(
			screen.getByRole("button", { name: "Finding current location" }),
		).toBeDisabled();

		resolveRequest({ ok: false, reason: "timeout", browserCode: 3 });
		expect(
			await screen.findByText(/couldn't get your location within 10 seconds/i),
		).toBeInTheDocument();
	});

	it("shows the specific denial recovery message", async () => {
		experienceHarness.requestCurrentLocation.mockResolvedValue({
			ok: false,
			reason: "denied",
			browserCode: 1,
		});
		renderExperience();

		fireEvent.click(
			await screen.findByRole("button", { name: "Center map on my location" }),
		);

		expect(
			await screen.findByText(/Location access is blocked for this website/i),
		).toBeInTheDocument();
	});

	it("re-enables the location control when the request rejects", async () => {
		experienceHarness.requestCurrentLocation.mockRejectedValueOnce(
			new Error("browser request failed"),
		);
		renderExperience();

		fireEvent.click(
			await screen.findByRole("button", { name: "Center map on my location" }),
		);

		const button = await screen.findByRole("button", {
			name: "Center map on my location",
		});
		expect(button).toBeEnabled();
		expect(
			await screen.findByText(/could not determine its location/i),
		).toBeInTheDocument();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("opens a report cluster as a compact list and drills into a report", async () => {
		const user = userEvent.setup();

		renderExperience();

		await user.click(
			await screen.findByRole("button", { name: "Select grouped marker" }),
		);

		const reportSheet = document.querySelector(".map-mobile-sheet--report");
		expect(reportSheet).toBeInstanceOf(HTMLElement);
		expect(screen.getByTestId("selection-focus-state")).toHaveTextContent(
			"3.13902,101.68692@12:adjusted:sheet ready",
		);
		expect(screen.getByTestId("map-center")).toHaveTextContent("default center");

		expect(
			screen.getByRole("heading", {
				name: "3 reports at this location",
			}),
		).toBeInTheDocument();
		expect(screen.queryByRole("region", { name: "Map legend" })).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Open report for Sentul/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Open report for Wangsa Maju/i }),
		).toBeInTheDocument();
		expect(screen.queryByText(/Nearby reports/i)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Evidence/i }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Next report" }),
		).not.toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: /Open report for Wangsa Maju/i }),
		);

		expect(screen.getByRole("heading", { name: "Report" })).toBeInTheDocument();
		expect(screen.getByText("Wangsa Maju")).toBeInTheDocument();
		expect(screen.getByText("71%")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Back to report list" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "View report details" }),
		).toBeInTheDocument();
		expect(screen.getByTestId("selection-focus-state")).toHaveTextContent(
			"3.13902,101.68692@12:adjusted:sheet ready",
		);

		await user.click(
			screen.getByRole("button", { name: "Back to report list" }),
		);
		expect(
			screen.getByRole("heading", { name: "3 reports at this location" }),
		).toBeInTheDocument();
	});

	it("clears the selected report stack when filters change", async () => {
		const user = userEvent.setup();

		renderExperience();

		await user.click(
			await screen.findByRole("button", { name: "Select grouped marker" }),
		);
		expect(
			screen.getByRole("heading", {
				name: "3 reports at this location",
			}),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Tire" }));

		await waitFor(() => {
			expect(
				screen.queryByRole("heading", {
					name: "3 reports at this location",
				}),
			).not.toBeInTheDocument();
		});
		expect(experienceHarness.listPublicReports).toHaveBeenCalledWith(
			undefined,
			expect.objectContaining({ habitatClass: "tire" }),
		);
	});

	it("opens hotspot details in the shared mobile sheet above the bottom navigation", async () => {
		const user = userEvent.setup();

		renderExperience();

		await user.click(
			await screen.findByRole("button", { name: "Select hotspot" }),
		);

		const hotspotSheet = document.querySelector(".map-mobile-sheet--hotspot");
		expect(hotspotSheet).toBeInstanceOf(HTMLElement);
		expect(
			(hotspotSheet as HTMLElement).style.getPropertyValue(
				"--map-sheet-bottom-offset",
			),
		).toBe(
			"calc(var(--app-mobile-bottom-clearance) + var(--space-sm))",
		);
		expect(screen.getByText("Active hotspot")).toBeInTheDocument();
		expect(screen.queryByRole("region", { name: "Map legend" })).not.toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Taman Melati" }),
		).toBeInTheDocument();
		expect(screen.getByText("Wangsa Maju")).toBeInTheDocument();
		expect(screen.getByTestId("selected-hotspot-id")).toHaveTextContent("hotspot-1");
		expect(screen.getByTestId("hotspot-buffer-state")).toHaveTextContent("buffer enabled");
		expect(
			screen.getByText("Habitat reports within 400 m are prioritized for review."),
		).toBeInTheDocument();
		expect(screen.queryByText("400 m advisory proximity buffer")).not.toBeInTheDocument();
		expect(screen.queryByText(/This is not an official hotspot boundary/)).not.toBeInTheDocument();
		expect(screen.queryByText(/iDengue hotspot context/)).not.toBeInTheDocument();
		expect(screen.queryByText(/20 Jul 2026/)).not.toBeInTheDocument();
		expect(screen.getByTestId("selection-focus-state")).toHaveTextContent(
			"3.2001,101.7182@15:adjusted:sheet ready",
		);
		expect(screen.getByTestId("map-center")).toHaveTextContent("default center");

		await user.click(
			screen.getByRole("button", { name: "Close hotspot details" }),
		);

		await waitFor(() => {
			expect(
				screen.queryByRole("heading", { name: "Taman Melati" }),
			).not.toBeInTheDocument();
		});
		expect(screen.getByTestId("selected-hotspot-id")).toHaveTextContent("none");
		expect(screen.getByTestId("hotspot-buffer-state")).toHaveTextContent("buffer disabled");
		expect(
			screen.queryByText("Habitat reports within 400 m are prioritized for review."),
		).not.toBeInTheDocument();
		expect(screen.getByTestId("selection-focus-state")).toHaveTextContent("none");
	});

	it("keeps the 400 m buffer and explanation off desktop", async () => {
		experienceHarness.isMobile = false;
		const user = userEvent.setup();

		renderExperience();
		await user.click(await screen.findByRole("button", { name: "Select hotspot" }));

		expect(screen.getByTestId("hotspot-buffer-state")).toHaveTextContent("buffer disabled");
		expect(
			screen.queryByText("Habitat reports within 400 m are prioritized for review."),
		).not.toBeInTheDocument();
		expect(screen.getByTestId("selection-focus-state")).toHaveTextContent(
			"3.2001,101.7182@12:centered:no sheet",
		);
	});

	it("opens a single report directly without cluster copy and closes on Escape", async () => {
		const user = userEvent.setup();
		const selectedReport = report("3", { reportCount: 1, neighborhood: "Bukit Jalil" });
		experienceHarness.group = {
			reports: [selectedReport],
			center: [3.13902, 101.68692],
			isExactStack: true,
			totalReportCount: 1,
		};
		experienceHarness.listPublicReports.mockResolvedValue([selectedReport]);

		renderExperience();

		await user.click(
			await screen.findByRole("button", { name: "Select grouped marker" }),
		);

		expect(screen.getByRole("heading", { name: "Report" })).toBeInTheDocument();
		expect(screen.queryByText(/Nearby reports/i)).not.toBeInTheDocument();
		expect(
			screen.queryByText(/reports at this location/i),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Evidence/i }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "View report details" }),
		).toBeInTheDocument();

		fireEvent.keyDown(window, { key: "Escape" });

		await waitFor(() => {
			expect(
				screen.queryByRole("heading", { name: "Report" }),
			).not.toBeInTheDocument();
		});
		expect(screen.getByTestId("legend-state")).toHaveTextContent(
			"legend visible",
		);
	});

	it("keeps the details action usable when evidence is unavailable", async () => {
		const user = userEvent.setup();
		const selectedReport = report("4", {
			reportCount: 3,
			thumbnailUrl: undefined,
			imageUrl: undefined,
		});
		experienceHarness.group = {
			reports: [selectedReport],
			center: [3.13902, 101.68692],
			isExactStack: true,
			totalReportCount: 3,
		};
		experienceHarness.listPublicReports.mockResolvedValue([selectedReport]);

		renderExperience();

		await user.click(
			await screen.findByRole("button", { name: "Select grouped marker" }),
		);

		expect(
			screen.queryByRole("button", { name: /Evidence/i }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "View report details" }),
		).toBeInTheDocument();
		expect(screen.getByText("3 observations")).toBeInTheDocument();
	});
});
