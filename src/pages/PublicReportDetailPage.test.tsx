import { getPublicHotspotContext } from "@/pages/PublicReportDetailPage";

describe("getPublicHotspotContext", () => {
	it("presents core and warning with the same concise prioritized label", () => {
		const core = getPublicHotspotContext({
			priorityLevel: "core",
			priorityReason: "Within core radius.",
		});
		const warning = getPublicHotspotContext({
			priorityLevel: "warning",
			priorityReason: "Within warning radius.",
		});

		expect(core).toEqual(warning);
		expect(core).toEqual({
			state: "prioritized",
			badge: "Prioritized report",
		});
	});

	it("presents every non-prioritized value as a normal report", () => {
		expect(
			getPublicHotspotContext({
				priorityLevel: "routine",
				priorityReason: "Outside warning radius.",
			}),
		).toEqual({
			state: "normal",
			badge: "Normal report",
		});
		expect(getPublicHotspotContext(undefined)).toEqual({
			state: "normal",
			badge: "Normal report",
		});
		expect(
			getPublicHotspotContext({
				priorityLevel: "unavailable",
				priorityReason: "Mirror unavailable.",
			}),
		).toEqual(getPublicHotspotContext(undefined));
		expect(JSON.stringify(getPublicHotspotContext(undefined))).not.toContain("400");
	});
});
