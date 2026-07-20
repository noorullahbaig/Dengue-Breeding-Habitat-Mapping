import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const evidenceImage = readFileSync(
	resolve(process.cwd(), "src/assets/learn/habitat-tire.webp"),
);

const reference = "KL-LONG-0001";

test("opens mobile Activity reference searches in the shared public detail", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 667 });
	await page.addInitScript(() => {
		window.localStorage.setItem(
			"dwkl.auth.session",
			JSON.stringify({
				id: "resident:mobile@example.com",
				email: "mobile@example.com",
				displayName: "Mobile Resident",
				provider: "local",
			}),
		);
	});

	await page.route("**/api/my-reports", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: "[]",
		});
	});
	await page.route(`**/api/public/reports/${reference}`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				id: "report-long",
				reference,
				reportedAt: "2026-07-12T12:00:00.000Z",
				latestReportedAt: "2026-07-12T12:00:00.000Z",
				status: "submitted",
				habitatClass: "drain_inlet",
				publicLocation: { latitude: 3.139, longitude: 101.6869, source: "public" },
				reportCount: 1,
				thumbnailUrl: `/api/public/reports/${reference}/image`,
				imageUrl: `/api/public/reports/${reference}/image`,
				observations: [],
				privacyNote: "Public by consent.",
				prediction: {
					label: "drain_inlet",
					confidence: 0.82,
					confidenceBand: "high",
					advisoryText:
						"AI evidence is advisory and should be reviewed alongside the submitted report.",
					detections: [
						{
							label: "drain_inlet",
							rawLabel: "Drain Inlet",
							confidence: 0.82,
							bbox: [40, 40, 520, 360],
							imageWidth: 640,
							imageHeight: 480,
						},
					],
				},
				neighborhood: "Bukit Jalil",
			}),
		});
	});
	await page.route(
		`**/api/public/reports/${reference}/image`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "image/webp",
				body: evidenceImage,
			});
		},
	);

	await page.goto("/activity?tab=search");

	const tablist = page.getByRole("tablist", { name: "Activity views" });
	const searchTab = page.getByRole("tab", { name: "Search Report" });

	await expect(tablist).toBeVisible();
	await expect(searchTab).toHaveAttribute("aria-selected", "true");
	await page.getByPlaceholder("e.g. KL-ABCD-1234").fill(reference);
	await page.getByRole("button", { name: "Track Status" }).click();
	await expect(page).toHaveURL(new RegExp(`/map/reports/${reference}$`));
	await expect(page.getByRole("heading", { name: "Bukit Jalil" })).toBeVisible();
	await expect(page.getByText(reference).first()).toBeVisible();
	await expect(page.getByRole("link", { name: "Back to search" })).toHaveAttribute(
		"href",
		"/activity?tab=search",
	);
	await page.getByRole("link", { name: "Back to search" }).click();
	await expect(page).toHaveURL(/\/activity\?tab=search$/);
	await expect(
		page.getByRole("navigation", { name: "Primary mobile navigation" }),
	).toBeVisible();
});

test("opens mobile standalone status searches in the shared public detail", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const reference = "KL-STATUS-0001";
	await page.route(`**/api/public/reports/${reference}`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				id: "status-report",
				reference,
				reportedAt: "2026-07-12T12:00:00.000Z",
				latestReportedAt: "2026-07-12T12:00:00.000Z",
				status: "submitted",
				habitatClass: "tire",
				publicLocation: { latitude: 3.139, longitude: 101.6869, source: "public" },
				reportCount: 1,
				thumbnailUrl: `/api/public/reports/${reference}/image`,
				imageUrl: `/api/public/reports/${reference}/image`,
				observations: [],
				prediction: {
					label: "tire",
					confidence: 0.9,
					confidenceBand: "high",
					advisoryText: "Advisory only.",
					detections: [],
				},
				neighborhood: "Bukit Jalil",
			}),
		});
	});
	await page.route(`**/api/public/reports/${reference}/image`, async (route) => {
		await route.fulfill({ status: 200, contentType: "image/webp", body: evidenceImage });
	});

	await page.goto("/status");
	await page.getByPlaceholder("e.g. KL-ABCD-1234").fill(reference);
	await page.getByRole("button", { name: "Track Status" }).click();
	await expect(page).toHaveURL(new RegExp(`/map/reports/${reference}$`));
	await expect(page.getByRole("heading", { name: "Bukit Jalil" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Back to search" })).toHaveAttribute(
		"href",
		"/status",
	);
});
