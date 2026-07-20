import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const evidenceImage = readFileSync(
	resolve(process.cwd(), "src/assets/learn/habitat-tire.webp"),
);

const drainPrediction = {
	label: "drain_inlet",
	confidence: 0.82,
	confidenceBand: "high",
	topRawLabel: "Drain-Inlet",
	advisoryText:
		"The model produced stronger evidence for this habitat class, but final verification is still required.",
	detections: Array.from({ length: 8 }, (_, index) => ({
		label: "drain_inlet",
		rawLabel: "Drain-Inlet",
		confidence: 0.82 - index * 0.01,
		bbox: [10 + index, 20 + index, 160 + index, 180 + index],
	})),
};

test("scrolls AI inference results while keeping actions visible on a short mobile viewport", async ({
	context,
	page,
}) => {
	const viewport = { width: 390, height: 500 };
	await page.setViewportSize(viewport);
	await context.grantPermissions(["geolocation"]);
	await context.setGeolocation({
		latitude: 3.139,
		longitude: 101.6869,
		accuracy: 20,
	});

	await page.route("**/api/reports/precheck", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				prediction: drainPrediction,
				candidates: [],
				imageUrl: "/api/reports/precheck-images/test-drain.webp",
			}),
		});
	});
	await page.route("**/api/reports/precheck-images/**", async (route) => {
		await route.fulfill({ body: evidenceImage, contentType: "image/webp" });
	});

	await page.goto("/report");
	await page.locator('input[type="file"]').first().setInputFiles({
		name: "drain-inference-scroll.webp",
		mimeType: "image/webp",
		buffer: evidenceImage,
	});
	await page.getByRole("button", { name: "Use photo & continue" }).click();
	await page.getByRole("button", { name: "Share My Location" }).click();
	await page.getByRole("button", { name: "Confirm this exact site" }).click();

	const consentBody = page.locator('[aria-label="Public consent text"]');
	await consentBody.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
		element.dispatchEvent(new Event("scroll", { bubbles: true }));
	});
	await page.locator('input[type="checkbox"]').check();

	const results = page.locator(".report-ai-results");
	const action = page.getByRole("button", { name: "Continue to submit" });
	const summary = page.getByRole("region", { name: "Detection summary" });

	await expect(summary).toBeVisible();
	await expect(action).toBeVisible();

	const before = await results.evaluate((element) => ({
		clientHeight: element.clientHeight,
		scrollHeight: element.scrollHeight,
		scrollTop: element.scrollTop,
	}));
	expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

	const actionBefore = await action.boundingBox();
	await results.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});
	const after = await results.evaluate((element) => element.scrollTop);
	const actionAfter = await action.boundingBox();

	expect(after).toBeGreaterThan(0);
	if (!actionBefore || !actionAfter) {
		throw new Error(
			"Continue action must remain measurable while results scroll.",
		);
	}
	expect(actionAfter.y).toBeCloseTo(actionBefore.y, 0);

	await expect(summary).toBeVisible();
	await action.click();
	await expect(
		page.getByRole("heading", { name: "Final confirmation" }),
	).toBeVisible();
});
