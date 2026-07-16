import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
	countReportsSubmittedWithinDays,
	ResidentHomeExperience,
} from "@/pages/components/ResidentHomeExperience";
import type { PublicHotspot, PublicMapReport } from "@/types/report";

const homeHarness = vi.hoisted(() => ({
	listPublicReports: vi.fn(),
	listHotspots: vi.fn(),
}));

vi.mock("@/app/useServices", () => ({
	useServices: () => ({
		mapService: {
			listPublicReports: homeHarness.listPublicReports,
			listHotspots: homeHarness.listHotspots,
		},
	}),
}));

function report(
	id: string,
	latestReportedAt: string,
	overrides: Partial<PublicMapReport> = {},
): PublicMapReport {
	return {
		id,
		reference: `KL-${id}`,
		publicLocation: { latitude: 3.139, longitude: 101.687, source: "public" },
		habitatClass: "drain_inlet",
		prediction: {
			label: "drain_inlet",
			confidence: 0.82,
			confidenceBand: "high",
			advisoryText: "Advisory result.",
		},
		status: "submitted",
		neighborhood: id,
		reportedAt: latestReportedAt,
		latestReportedAt,
		reportCount: 1,
		thumbnailUrl: `/thumb-${id}.jpg`,
		imageUrl: `/image-${id}.jpg`,
		privacyNote: "Public location.",
		...overrides,
	};
}

function hotspot(id: string): PublicHotspot {
	return {
		id,
		locality: id,
		district: "Kuala Lumpur",
		center: { latitude: 3.139, longitude: 101.687, source: "public" },
		radiusMeters: 200,
		cumulativeCases: 4,
		outbreakDurationDays: 8,
		outbreakStartDate: "2026-06-20",
		weekNumber: 25,
		year: 2026,
		snapshotDate: "2026-06-24",
		sourceLabel: "iDengue",
	};
}

describe("ResidentHomeExperience", () => {
	beforeEach(() => {
		homeHarness.listPublicReports.mockResolvedValue(
			[] satisfies PublicMapReport[],
		);
		homeHarness.listHotspots.mockResolvedValue([] satisfies PublicHotspot[]);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("prioritizes reporting and routes detailed education to Learn", async () => {
		render(
			<MemoryRouter>
				<ResidentHomeExperience />
			</MemoryRouter>,
		);

		expect(
			screen.getByRole("heading", { name: "Report a dengue breeding site." }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Start a report" }),
		).toHaveAttribute("href", "/report");
		expect(
			screen.getByRole("link", { name: "Track a report" }),
		).toHaveAttribute("href", "/status");
		expect(
			screen.getByRole("link", { name: "What should I report?" }),
		).toHaveAttribute("href", "/learn");
		expect(
			screen.getByRole("link", { name: "Explore common breeding habitats" }),
		).toHaveAttribute("href", "/learn");
		expect(screen.queryByText(/7 common habitats/i)).not.toBeInTheDocument();
		expect(screen.queryByText("Photo of the habitat")).not.toBeInTheDocument();
		await waitFor(() => {
			expect(homeHarness.listPublicReports).toHaveBeenCalledTimes(1);
		});
	});

	it("counts only reports submitted within the rolling seven-day window", () => {
		const now = new Date("2026-07-04T12:00:00.000Z").getTime();
		const reports = [
			report("Inside", "2026-06-27T12:00:00.001Z"),
			report("Boundary", "2026-06-27T12:00:00.000Z"),
			report("Outside", "2026-06-27T11:59:59.999Z"),
			report("OldButUpdated", "2026-07-04T11:00:00.000Z", {
				reportedAt: "2026-06-20T08:00:00.000Z",
			}),
		];

		expect(countReportsSubmittedWithinDays(reports, 7, now)).toBe(2);
	});

	it("shows accurate metrics and the three freshest public reports", async () => {
		const recentReportedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		homeHarness.listPublicReports.mockResolvedValue([
			report("Oldest", "2026-06-20T08:00:00.000Z"),
			report("Newest", "2026-06-24T08:00:00.000Z", {
				reportedAt: recentReportedAt,
			}),
			report("Third", "2026-06-22T08:00:00.000Z"),
			report("Second", "2026-06-23T08:00:00.000Z"),
		]);
		homeHarness.listHotspots.mockResolvedValue([hotspot("A"), hotspot("B")]);

		render(
			<MemoryRouter>
				<ResidentHomeExperience />
			</MemoryRouter>,
		);

		await screen.findByText("Newest");

		const reportLinks = screen.getAllByTestId("home-report-link");
		expect(reportLinks.map((link) => link.getAttribute("href"))).toEqual([
			"/map/reports/KL-Newest",
			"/map/reports/KL-Second",
			"/map/reports/KL-Third",
		]);
		expect(screen.queryByText("Oldest")).not.toBeInTheDocument();

		const metrics = screen.getByLabelText("Kuala Lumpur public-health summary");
		expect(within(metrics).getByText("4")).toBeInTheDocument();
		expect(within(metrics).getByText("1", { selector: "strong" })).toBeInTheDocument();
		expect(within(metrics).getByText("2", { selector: "strong" })).toBeInTheDocument();
		expect(within(metrics).getByText("Public reports")).toBeInTheDocument();
		expect(within(metrics).getByText("Recent reports")).toBeInTheDocument();
		expect(within(metrics).queryByText("Resolved sites")).not.toBeInTheDocument();
		expect(
			within(metrics).getByText("Active hotspot areas"),
		).toBeInTheDocument();
	});

	it("shows a loading state before public data resolves", () => {
		homeHarness.listPublicReports.mockReturnValue(new Promise(() => {}));
		homeHarness.listHotspots.mockReturnValue(new Promise(() => {}));

		render(
			<MemoryRouter>
				<ResidentHomeExperience />
			</MemoryRouter>,
		);

		expect(screen.getByText("Loading community reports…")).toBeInTheDocument();
		expect(screen.queryByText("No public reports yet")).not.toBeInTheDocument();
	});

	it("keeps hotspot context available when public reports fail", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		homeHarness.listPublicReports.mockRejectedValue(
			new Error("reports offline"),
		);
		homeHarness.listHotspots.mockResolvedValue([hotspot("Only")]);

		render(
			<MemoryRouter>
				<ResidentHomeExperience />
			</MemoryRouter>,
		);

		expect(
			await screen.findByText("Public reports are temporarily unavailable."),
		).toBeInTheDocument();
		expect(screen.queryByText("No public reports yet")).not.toBeInTheDocument();
		const metrics = screen.getByLabelText("Kuala Lumpur public-health summary");
		expect(
			within(metrics).getByText("1", { selector: "strong" }),
		).toBeInTheDocument();
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it("keeps reporting actions available when all live context fails", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		homeHarness.listPublicReports.mockRejectedValue(
			new Error("reports offline"),
		);
		homeHarness.listHotspots.mockRejectedValue(new Error("hotspots offline"));

		render(
			<MemoryRouter>
				<ResidentHomeExperience />
			</MemoryRouter>,
		);

		expect(
			await screen.findByText("Live KL context is temporarily unavailable."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Start a report" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Track a report" }),
		).toBeInTheDocument();
		consoleError.mockRestore();
	});

	it("keeps reports visible when hotspot context fails", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		homeHarness.listPublicReports.mockResolvedValue([
			report("Visible", "2026-06-24T08:00:00.000Z"),
		]);
		homeHarness.listHotspots.mockRejectedValue(new Error("hotspots offline"));

		render(
			<MemoryRouter>
				<ResidentHomeExperience />
			</MemoryRouter>,
		);

		expect(await screen.findByText("Visible")).toBeInTheDocument();
		const metrics = screen.getByLabelText("Kuala Lumpur public-health summary");
		expect(within(metrics).getByText("Unavailable")).toBeInTheDocument();
		consoleError.mockRestore();
	});

	it("uses a stable thumbnail fallback without changing the report destination", async () => {
		homeHarness.listPublicReports.mockResolvedValue([
			report("Fallback", "2026-06-24T08:00:00.000Z"),
		]);

		render(
			<MemoryRouter>
				<ResidentHomeExperience />
			</MemoryRouter>,
		);

		await screen.findByText("Fallback");
		const link = screen.getByTestId("home-report-link");
		const image = link.querySelector("img");
		expect(image).not.toBeNull();
		fireEvent.error(image as HTMLImageElement);

		expect(link).toHaveAttribute("href", "/map/reports/KL-Fallback");
		expect(image?.getAttribute("src")).toContain("data:image/svg+xml");
	});
});
