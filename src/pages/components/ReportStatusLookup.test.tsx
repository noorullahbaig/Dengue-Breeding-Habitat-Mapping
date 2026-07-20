import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ReportStatusLookup } from "@/pages/components/ReportStatusLookup";

const getReportStatus = vi.fn();
const reportsService = { getReportStatus };

vi.mock("@/app/useServices", () => ({
	useServices: () => ({ reportsService }),
}));

vi.mock("@/pages/components/PredictionEvidencePanel", () => ({
	PredictionEvidencePanel: () => <div>Prediction evidence</div>,
}));

const report = {
	id: "report-1",
	reference: "KL-TEST-0001",
	createdAt: "2026-07-12T12:00:00.000Z",
	status: "submitted",
	prediction: {
		label: "tire",
		confidence: 0.91,
		confidenceBand: "high",
		advisoryText: "Advisory only.",
		detections: [],
	},
	neighborhood: "Bukit Jalil",
	statusMessage: "Received and awaiting review.",
};

function renderLookup(
	props: Partial<React.ComponentProps<typeof ReportStatusLookup>> = {},
) {
	const onSearch = vi.fn();
	const onBack = vi.fn();

	render(
		<MemoryRouter>
			<ReportStatusLookup
				reference=""
				onSearch={onSearch}
				onBack={onBack}
				variant="standalone"
				{...props}
			/>
		</MemoryRouter>,
	);

	return { onSearch, onBack };
}

describe("ReportStatusLookup", () => {
	beforeEach(() => {
		getReportStatus.mockReset();
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn().mockResolvedValue(undefined) },
		});
	});

	it("normalizes a submitted reference before handing it to the host", async () => {
		const user = userEvent.setup();
		const { onSearch } = renderLookup();

		const input = screen.getByPlaceholderText("e.g. KL-ABCD-1234");
		await user.type(input, "kl-test-0001");
		await user.click(screen.getByRole("button", { name: "Track Status" }));

		expect(onSearch).toHaveBeenCalledWith("KL-TEST-0001");
	});

	it("renders the full result and delegates back navigation to its host", async () => {
		const user = userEvent.setup();
		getReportStatus.mockResolvedValue(report);
		const { onBack } = renderLookup({ reference: report.reference });

		expect(
			await screen.findByRole("heading", { name: report.reference }),
		).toBeInTheDocument();
		expect(
			screen.getByText("Received and awaiting review."),
		).toBeInTheDocument();
		expect(screen.getByText("Prediction evidence")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "View on Public Map" }),
		).toHaveAttribute("href", `/map/reports/${report.reference}`);

		await user.click(screen.getByRole("button", { name: "Back to search" }));
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it("shows a loading state while a reference lookup is pending", () => {
		getReportStatus.mockReturnValue(new Promise(() => undefined));
		renderLookup({ reference: report.reference });

		expect(screen.getByText("Locating report securely...")).toBeInTheDocument();
	});

	it("copies the canonical public status link from the activity variant", async () => {
		const user = userEvent.setup();
		const writeText = vi
			.spyOn(navigator.clipboard, "writeText")
			.mockResolvedValue(undefined);
		getReportStatus.mockResolvedValue(report);
		renderLookup({ reference: report.reference, variant: "activity" });

		await screen.findByRole("heading", { name: report.reference });
		await user.click(
			screen.getByRole("button", { name: "Copy tracking link" }),
		);

		await waitFor(() => {
			expect(writeText).toHaveBeenCalledWith(
				`${window.location.origin}/status?ref=${report.reference}`,
			);
		});
	});

	it("shows the existing not-found state when lookup returns no report", async () => {
		getReportStatus.mockResolvedValue(null);
		renderLookup({ reference: "KL-MISSING-0001" });

		expect(
			await screen.findByRole("heading", { name: "Report Not Found" }),
		).toBeInTheDocument();
		expect(screen.getByText(/KL-MISSING-0001/)).toBeInTheDocument();
	});
});
