import { getPublicHotspotContext } from "@/pages/PublicReportDetailPage";

describe("getPublicHotspotContext", () => {
	it("presents core and warning with identical high-priority language", () => {
		const core = getPublicHotspotContext({
			priorityLevel: "core",
			priorityReason: "Within core radius.",
		});
		const warning = getPublicHotspotContext({
			priorityLevel: "warning",
			priorityReason: "Within warning radius.",
		});

		expect(core).toEqual(warning);
		expect(core).toMatchObject({
			state: "high",
			message: "Within 400 m of an iDengue hotspot when reported.",
		});
	});

	it("distinguishes routine from unavailable hotspot context", () => {
		expect(
			getPublicHotspotContext({
				priorityLevel: "routine",
				priorityReason: "Outside warning radius.",
			}),
		).toMatchObject({
			state: "routine",
			message: "No iDengue hotspot recorded within 400 m when reported.",
		});
		expect(getPublicHotspotContext(undefined)).toMatchObject({
			state: "unknown",
			message: "Hotspot priority could not be assessed.",
		});
		expect(
			getPublicHotspotContext({
				priorityLevel: "unavailable",
				priorityReason: "Mirror unavailable.",
			}),
		).toEqual(getPublicHotspotContext(undefined));
	});
});
