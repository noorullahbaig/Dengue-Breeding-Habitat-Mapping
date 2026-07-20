import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const evidenceImage = readFileSync(
	resolve(process.cwd(), "src/assets/learn/habitat-tire.webp"),
);

const reference = "KL-LONG-0001";

test("keeps Activity tabs fixed while a long status result scrolls", async ({
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
	await page.route(`**/api/reports/status/${reference}`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				id: "report-long",
				reference,
				createdAt: "2026-07-12T12:00:00.000Z",
				status: "submitted",
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
				statusMessage:
					"The report was received and is awaiting review by the responsible team.",
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

	await page.goto(`/activity?tab=search&ref=${reference}`);

	const tablist = page.getByRole("tablist", { name: "Activity views" });
	const searchTab = page.getByRole("tab", { name: "Search Report" });
	const resultPanel = page.getByRole("tabpanel", { name: "Search Report" });
	const activityNav = page.getByRole("link", { name: "Activity" });

	await expect(tablist).toBeVisible();
	await expect(searchTab).toHaveAttribute("aria-selected", "true");
	await expect(page.getByRole("heading", { name: reference })).toBeVisible();
	await expect(activityNav).toHaveClass(/app-bottom-nav__link--active/);
	await page.locator(".activity-card").evaluate((element) => {
		for (const animation of element.getAnimations({ subtree: true })) {
			animation.finish();
		}
	});

	const before = await resultPanel.evaluate((element) => ({
		clientHeight: element.clientHeight,
		scrollHeight: element.scrollHeight,
		scrollTop: element.scrollTop,
	}));
	const tablistBefore = await tablist.boundingBox();

	expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
	expect(before.scrollTop).toBe(0);

	await resultPanel.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});
	await expect
		.poll(() => resultPanel.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);

	await expect(
		page.getByRole("region", { name: "Evidence Analyzed" }),
	).toBeVisible();
	await expect(tablist).toBeVisible();
	await expect(
		page.getByRole("navigation", { name: "Primary mobile navigation" }),
	).toBeVisible();

	const tablistAfter = await tablist.boundingBox();
	expect(tablistBefore).not.toBeNull();
	expect(tablistAfter).not.toBeNull();
	expect(
		Math.abs((tablistBefore?.y ?? 0) - (tablistAfter?.y ?? 0)),
	).toBeLessThanOrEqual(1);
});
