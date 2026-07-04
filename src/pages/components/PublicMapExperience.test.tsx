import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PublicMapExperience } from "@/pages/components/PublicMapExperience";
import type {
	PublicHotspot,
	PublicMapReport,
} from "@/types/report";

const experienceHarness = vi.hoisted(() => ({
	group: undefined as
		| {
				reports: PublicMapReport[];
				center: [number, number];
				isExactStack: boolean;
				totalReportCount: number;
		  }
		| undefined,
	listPublicReports: vi.fn(),
	listHotspots: vi.fn(),
}));

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
	}: {
		onSelectReportGroup?: (group: NonNullable<typeof experienceHarness.group>) => void;
	}) => (
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
	),
}));

vi.mock("@/pages/components/PredictionEvidencePanel", () => ({
	PredictionEvidencePanel: ({ imageUrl }: { imageUrl?: string }) => (
		<div>Evidence panel {imageUrl}</div>
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
		experienceHarness.group = {
			reports,
			center: [3.13902, 101.68692],
			isExactStack: true,
			totalReportCount: 3,
		};
		experienceHarness.listPublicReports.mockResolvedValue(reports);
		experienceHarness.listHotspots.mockResolvedValue([] satisfies PublicHotspot[]);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("opens a grouped marker as a bottom report stack with carousel navigation", async () => {
		const user = userEvent.setup();

		render(
			<MemoryRouter>
				<PublicMapExperience />
			</MemoryRouter>,
		);

		await user.click(await screen.findByRole("button", { name: "Select grouped marker" }));

		expect(
			screen.getByRole("heading", {
				name: "3 reports at this public location",
			}),
		).toBeInTheDocument();
		expect(screen.getByText("1 / 2")).toBeInTheDocument();
		expect(screen.getByText("Sentul")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "View Evidence" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "View Details" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("Observations at this location"),
		).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Next report" }));

		expect(screen.getByText("2 / 2")).toBeInTheDocument();
		expect(screen.getByText("Wangsa Maju")).toBeInTheDocument();

		const carousel = document.querySelector(".report-stack-sheet__carousel");
		expect(carousel).toBeInstanceOf(HTMLElement);
		Object.defineProperty(carousel, "clientWidth", {
			configurable: true,
			value: 320,
		});
		fireEvent.scroll(carousel as HTMLElement, {
			target: { scrollLeft: 0 },
		});
		expect(screen.getByText("2 / 2")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "View Evidence" }));

		const activeEvidenceSlide = document.querySelector(
			".report-stack-sheet__slide--active",
		) as HTMLElement | null;
		expect(activeEvidenceSlide).not.toBeNull();
		expect(screen.getByText("Evidence panel /image-2.jpg")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Back to summary" }),
		).toBeInTheDocument();
		expect(
			within(activeEvidenceSlide as HTMLElement).queryByText("Latest update"),
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Previous report" }));

		expect(screen.getByText("1 / 2")).toBeInTheDocument();
		expect(screen.getByText("Sentul")).toBeInTheDocument();
		expect(
			screen.queryByText("Evidence panel /image-2.jpg"),
		).not.toBeInTheDocument();
		expect(
			within(
				document.querySelector(".report-stack-sheet__slide--active") as HTMLElement,
			).getByText("Latest update"),
		).toBeInTheDocument();
	});

	it("clears the selected report stack when filters change", async () => {
		const user = userEvent.setup();

		render(
			<MemoryRouter>
				<PublicMapExperience />
			</MemoryRouter>,
		);

		await user.click(await screen.findByRole("button", { name: "Select grouped marker" }));
		expect(
			screen.getByRole("heading", {
				name: "3 reports at this public location",
			}),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Tire" }));

		await waitFor(() => {
			expect(
				screen.queryByRole("heading", {
					name: "3 reports at this public location",
				}),
			).not.toBeInTheDocument();
		});
		expect(experienceHarness.listPublicReports).toHaveBeenCalledWith(
			undefined,
			expect.objectContaining({ habitatClass: "tire" }),
		);
	});

	it("hides redundant single-observation counts and closes on Escape", async () => {
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

		await user.click(await screen.findByRole("button", { name: "Select grouped marker" }));

		expect(
			screen.getByRole("heading", { name: "Report detail" }),
		).toBeInTheDocument();
		expect(
			screen.queryByText("Observations at this location"),
		).not.toBeInTheDocument();
		expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();

		fireEvent.keyDown(window, { key: "Escape" });

		await waitFor(() => {
			expect(
				screen.queryByRole("heading", { name: "Report detail" }),
			).not.toBeInTheDocument();
		});
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

		await user.click(await screen.findByRole("button", { name: "Select grouped marker" }));

		expect(
			screen.queryByRole("button", { name: "View Evidence" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "View Details" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("Observations at this location"),
		).toBeInTheDocument();
		expect(screen.getByText("3")).toBeInTheDocument();
	});
});
