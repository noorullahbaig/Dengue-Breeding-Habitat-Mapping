import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { StatusPage } from "@/pages/StatusPage";

vi.mock("@/app/useMobileViewport", () => ({
	useMobileViewport: () => true,
}));

vi.mock("@/pages/components/ReportStatusLookup", () => ({
	ReportStatusLookup: ({
		reference,
		onSearch,
		onBack,
		variant,
	}: {
		reference: string;
		onSearch: (reference: string) => void;
		onBack: () => void;
		variant: string;
	}) => (
		<div
			data-testid="status-lookup"
			data-reference={reference}
			data-variant={variant}
		>
			<button type="button" onClick={() => onSearch("KL-NEXT-0001")}>
				Search next
			</button>
			<button type="button" onClick={onBack}>
				Back
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

describe("StatusPage", () => {
	it("opens mobile reference searches in public report details", async () => {
		const user = userEvent.setup();
		render(
			<MemoryRouter initialEntries={["/status"]}>
				<StatusPage />
				<LocationProbe />
			</MemoryRouter>,
		);

		expect(screen.getByTestId("status-lookup")).toHaveAttribute(
			"data-reference",
			"",
		);
		expect(screen.getByTestId("status-lookup")).toHaveAttribute(
			"data-variant",
			"standalone",
		);

		await user.click(screen.getByRole("button", { name: "Search next" }));
		expect(screen.getByTestId("location")).toHaveTextContent(
			"/map/reports/KL-NEXT-0001",
		);

	});
});
