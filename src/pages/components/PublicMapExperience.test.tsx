import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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
	requestCurrentLocation: vi.fn<() => Promise<LocationRequestResult>>(),
}));

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

vi.mock("@/pages/components/PublicReportsMap", () => ({
	PublicReportsMap: ({
		onSelectReportGroup,
		onSelectHotspot,
		showLegend,
		centerOverride,
	}: {
		onSelectReportGroup?: (
			group: NonNullable<typeof experienceHarness.group>,
		) => void;
		onSelectHotspot?: (
			hotspot: NonNullable<typeof experienceHarness.hotspot>,
		) => void;
		showLegend?: boolean;
		centerOverride?: [number, number];
	}) => (
		<>
			<div data-testid="map-center">{centerOverride?.join(',') ?? 'default center'}</div>
			<div data-testid="legend-state">
				{showLegend === false ? "legend hidden" : "legend visible"}
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
		</>
	),
}));

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
		experienceHarness.centerOverride = undefined;
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
				source: "hotspot",
			},
			cumulativeCases: 12,
			outbreakDurationDays: 6,
			outbreakStartDate: "2026-06-21",
		};
		experienceHarness.listPublicReports.mockResolvedValue(reports);
		experienceHarness.listHotspots.mockResolvedValue([
			experienceHarness.hotspot,
		] satisfies PublicHotspot[]);
	});

	it("keeps the legend and location control in the map UI layer", async () => {
		render(
			<MemoryRouter>
				<PublicMapExperience />
			</MemoryRouter>,
		);

		const legend = await screen.findByRole("region", { name: "Map legend" });
		expect(legend.parentElement).toHaveClass("map-page-controls");
		expect(screen.getByRole("button", { name: "Center map on my location" }).parentElement).toHaveClass("map-page-controls");
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
		render(
			<MemoryRouter>
				<PublicMapExperience />
			</MemoryRouter>,
		);

		await user.click(await screen.findByRole("button", { name: "Center map on my location" }));

		expect(experienceHarness.requestCurrentLocation).toHaveBeenCalledOnce();
		expect(screen.getByTestId("map-center")).toHaveTextContent("3.139,101.6869");
	});

	it("shows progress and ignores duplicate location taps", async () => {
		let resolveRequest: (result: LocationRequestResult) => void = () => {};
		experienceHarness.requestCurrentLocation.mockReturnValue(
			new Promise((resolve) => {
				resolveRequest = resolve;
			}),
		);
		render(
			<MemoryRouter>
				<PublicMapExperience />
			</MemoryRouter>,
		);

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
		render(
			<MemoryRouter>
				<PublicMapExperience />
			</MemoryRouter>,
		);

		fireEvent.click(
			await screen.findByRole("button", { name: "Center map on my location" }),
		);

		expect(
			await screen.findByText(/Location access is blocked for this website/i),
		).toBeInTheDocument();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("opens a report cluster as a compact list and drills into a report", async () => {
		const user = userEvent.setup();

		render(
			<MemoryRouter>
				<PublicMapExperience />
			</MemoryRouter>,
		);

		await user.click(
			await screen.findByRole("button", { name: "Select grouped marker" }),
		);

		const reportSheet = document.querySelector(".map-mobile-sheet--report");
		expect(reportSheet).toBeInstanceOf(HTMLElement);

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

		await user.click(
			screen.getByRole("button", { name: "Back to report list" }),
		);
		expect(
			screen.getByRole("heading", { name: "3 reports at this location" }),
		).toBeInTheDocument();
	});

	it("clears the selected report stack when filters change", async () => {
		const user = userEvent.setup();

		render(
			<MemoryRouter>
				<PublicMapExperience />
			</MemoryRouter>,
		);

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

		render(
			<MemoryRouter>
				<PublicMapExperience />
			</MemoryRouter>,
		);

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

		await user.click(
			screen.getByRole("button", { name: "Close hotspot details" }),
		);

		await waitFor(() => {
			expect(
				screen.queryByRole("heading", { name: "Taman Melati" }),
			).not.toBeInTheDocument();
		});
	});

	it("opens a single report directly without cluster copy and closes on Escape", async () => {
		const user = userEvent.setup();
		experienceHarness.group = {
			reports: [report("3", { reportCount: 1, neighborhood: "Bukit Jalil" })],
			center: [3.13902, 101.68692],
			isExactStack: true,
			totalReportCount: 1,
		};

		render(
			<MemoryRouter>
				<PublicMapExperience />
			</MemoryRouter>,
		);

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
		experienceHarness.group = {
			reports: [
				report("4", {
					reportCount: 3,
					thumbnailUrl: undefined,
					imageUrl: undefined,
				}),
			],
			center: [3.13902, 101.68692],
			isExactStack: true,
			totalReportCount: 3,
		};

		render(
			<MemoryRouter>
				<PublicMapExperience />
			</MemoryRouter>,
		);

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
