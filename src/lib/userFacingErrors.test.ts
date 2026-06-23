import { toPublicReportErrorMessage } from "@/lib/userFacingErrors";

describe("user-facing error mapping", () => {
	it("hides raw runtime exceptions on public report pages", () => {
		expect(
			toPublicReportErrorMessage(
				new TypeError("Cannot read properties of null (reading 'observations')"),
			),
		).toBe(
			"Public report details are temporarily unavailable. Return to the map and try again.",
		);
	});

	it("preserves a known missing-report message", () => {
		expect(toPublicReportErrorMessage(new Error("Report not found"))).toBe(
			"No public report was found for this reference.",
		);
	});
});
