import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { MOBILE_VIEWPORT_MEDIA_QUERY } from "@/app/layoutConstants";
import { ActivityPage } from "@/pages/ActivityPage";

const reportsService = {
	getReportStatus: vi.fn(),
	getMyReports: vi.fn(),
};

const guestAuthState = {
	isAuthenticated: false,
	isAuthLoading: false,
	sessionMode: "local",
	trackedReferences: [] as string[],
	untrackReport: vi.fn(),
};

vi.mock("@/app/useAuth", () => ({
	useAuth: () => guestAuthState,
}));

vi.mock("@/app/useServices", () => ({
	useServices: () => ({
		reportsService,
	}),
}));

vi.mock("@/pages/components/ReportStatusLookup", () => ({
	ReportStatusLookup: ({
		reference,
		onSearch,
		onBack,
	}: {
		reference: string;
		onSearch: (reference: string) => void;
		onBack: () => void;
	}) => (
		<div data-testid="activity-status-lookup" data-reference={reference}>
			<button type="button" onClick={() => onSearch("KL-SEARCH-0001")}>
				Run lookup
			</button>
			<button type="button" onClick={onBack}>
				Back from result
			</button>
		</div>
	),
}));

function LocationProbe() {
	const location = useLocation();
	return (
		<output data-testid="location">{`${location.pathname}${location.search}`}</output>
	);
}

function renderActivity(initialEntry = "/activity") {
	return render(
		<MemoryRouter initialEntries={[initialEntry]}>
			<ActivityPage />
			<LocationProbe />
		</MemoryRouter>,
	);
}

describe("ActivityPage guest state", () => {
	beforeEach(() => {
		guestAuthState.isAuthLoading = false;
		guestAuthState.isAuthenticated = false;
		guestAuthState.sessionMode = "local";
		reportsService.getMyReports.mockReset();
		reportsService.getMyReports.mockResolvedValue([]);
		vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
			matches: query === MOBILE_VIEWPORT_MEDIA_QUERY,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
	});

	it("waits for session restoration before showing the signed-out gate", () => {
		guestAuthState.isAuthLoading = true;
		renderActivity();

		expect(screen.getByText("Restoring your account…")).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Your Report Activity" }),
		).not.toBeInTheDocument();
	});

	it("keeps the sign-in prompt concise and avoids implementation-detail copy", () => {
		renderActivity();

		expect(
			screen.getByRole("heading", { name: "Your Report Activity" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Sign In to View Activity" }),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/local build keeps saved activity/i),
		).not.toBeInTheDocument();
		expect(screen.queryByText(/Cognito/i)).not.toBeInTheDocument();
		expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
	});

	it("defaults authenticated mobile users to My Reports", async () => {
		guestAuthState.isAuthenticated = true;
		guestAuthState.sessionMode = "cognito";
		renderActivity();

		expect(
			screen.getByRole("tablist", { name: "Activity views" }),
		).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "My Reports" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(screen.getByRole("tab", { name: "Search Report" })).toHaveAttribute(
			"aria-selected",
			"false",
		);
		expect(
			screen.getByRole("heading", { name: "My Reports" }),
		).toBeInTheDocument();
		expect(screen.queryByText("Your Reports")).not.toBeInTheDocument();
		await waitFor(() => expect(reportsService.getMyReports).toHaveBeenCalled());
	});

	it("opens mobile reference searches in public report details", async () => {
		const user = userEvent.setup();
		guestAuthState.isAuthenticated = true;
		guestAuthState.sessionMode = "cognito";
		renderActivity();

		await user.click(screen.getByRole("tab", { name: "Search Report" }));
		expect(screen.getByTestId("location")).toHaveTextContent(
			"/activity?tab=search",
		);
		expect(screen.getByRole("tab", { name: "Search Report" })).toHaveAttribute(
			"aria-selected",
			"true",
		);

		await user.click(screen.getByRole("button", { name: "Run lookup" }));
		expect(screen.getByTestId("location")).toHaveTextContent(
			"/map/reports/KL-SEARCH-0001",
		);

	});

	it("redirects a direct mobile Search Report reference to public details", async () => {
		guestAuthState.isAuthenticated = true;
		guestAuthState.sessionMode = "cognito";
		renderActivity("/activity?tab=search&ref=KL-DIRECT-0001");

		await waitFor(() =>
			expect(screen.getByTestId("location")).toHaveTextContent(
				"/map/reports/KL-DIRECT-0001",
			),
		);
		await waitFor(() => expect(reportsService.getMyReports).toHaveBeenCalled());
	});

	it("keeps the existing desktop Activity presentation without tabs", async () => {
		guestAuthState.isAuthenticated = true;
		guestAuthState.sessionMode = "cognito";
		vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
		renderActivity("/activity?tab=search&ref=KL-DESKTOP-0001");

		expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "My Reports" })).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Track by Reference Code" }),
		).toHaveAttribute("href", "/status");
		await waitFor(() => expect(reportsService.getMyReports).toHaveBeenCalled());
	});

	it("opens an owned report in the owner detail route", async () => {
		guestAuthState.isAuthenticated = true;
		guestAuthState.sessionMode = "cognito";
		reportsService.getMyReports.mockResolvedValue([
			{
				id: "report-1",
				reference: "KL-OWNER-0001",
				createdAt: "2026-07-12T12:00:00.000Z",
				status: "submitted",
				prediction: {
					label: "tire",
					confidence: 0.9,
					confidenceBand: "high",
					advisoryText: "Advisory only.",
					detections: [],
				},
				neighborhood: "Bukit Jalil",
				statusMessage: "Received.",
				notes: "Resident note",
			},
		]);

		renderActivity();

		const link = await screen.findByRole("link", {
			name: "View report details",
		});
		expect(link).toHaveAttribute("href", "/my-reports/KL-OWNER-0001");
		expect(
			screen.queryByRole("link", { name: "View Status" }),
		).not.toBeInTheDocument();
	});
});
