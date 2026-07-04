import { STORAGE_KEY } from "@/lib/constants";
import { createMockAppServices } from "@/mocks/mockServices";
import type { SubmittedReport } from "@/types/report";

describe("mock public report priority", () => {
	it("derives map and detail priority from the true report location", async () => {
		const submittedReport: SubmittedReport = {
			id: "priority-source",
			reference: "KL-PRIORITY-0001",
			createdAt: "2026-07-04T08:00:00.000Z",
			reportLocation: {
				latitude: 3.139,
				longitude: 101.6869,
				source: "browser",
				accuracyMeters: 10,
			},
			publicLocation: {
				latitude: 3.149,
				longitude: 101.6969,
				source: "public",
			},
			status: "submitted",
			prediction: {
				label: "tire",
				confidence: 0.9,
				confidenceBand: "high",
				advisoryText: "Advisory only.",
			},
			neighborhood: "City Centre",
			statusMessage: "Report submitted.",
		};
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify([submittedReport]));
		const services = createMockAppServices();

		const [mapReport] = await services.mapService.listPublicReports();
		const detail = await services.reportsService.getPublicReport(
			submittedReport.reference,
		);

		expect(mapReport?.hotspotPriority?.priorityLevel).toBe("core");
		expect(detail?.hotspotPriority?.priorityLevel).toBe("core");
		expect(mapReport?.publicLocation).toEqual(submittedReport.publicLocation);
	});
});
