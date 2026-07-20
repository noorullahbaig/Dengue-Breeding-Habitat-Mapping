import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { StatusPage } from "@/pages/StatusPage";

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
	it("wraps the shared lookup and keeps public reference navigation on /status", async () => {
		const user = userEvent.setup();
		render(
			<MemoryRouter initialEntries={["/status?ref=KL-EXISTING-0001"]}>
				<StatusPage />
				<LocationProbe />
			</MemoryRouter>,
		);

		expect(screen.getByTestId("status-lookup")).toHaveAttribute(
			"data-reference",
			"KL-EXISTING-0001",
		);
		expect(screen.getByTestId("status-lookup")).toHaveAttribute(
			"data-variant",
			"standalone",
		);

		await user.click(screen.getByRole("button", { name: "Search next" }));
		expect(screen.getByTestId("location")).toHaveTextContent(
			"/status?ref=KL-NEXT-0001",
		);

		await user.click(screen.getByRole("button", { name: "Back" }));
		expect(screen.getByTestId("location")).toHaveTextContent("/status");
	});
});
