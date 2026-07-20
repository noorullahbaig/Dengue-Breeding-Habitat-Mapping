import { expect, test } from '@playwright/test'

async function waitForLearnPage(page: import('@playwright/test').Page) {
	await page.goto('/learn')
	await page.getByRole('heading', {
		name: 'Dengue is a growing threat, and prevention starts close to home.',
	}).waitFor()
	await page.evaluate(() => document.fonts.ready)
	await page.getByTestId('learn-hero-image').evaluate(async (image) => {
		if ((image as HTMLImageElement).complete) return
		await new Promise<void>((resolve) => {
			image.addEventListener('load', () => resolve(), { once: true })
			image.addEventListener('error', () => resolve(), { once: true })
		})
	})
}

test.describe('Learn page problem-to-action guide', () => {
	test('communicates dengue scale immediately and stays contained on mobile', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 })
		await waitForLearnPage(page)

		const hero = page.locator('[data-learn-section="problem"]')
		const bottomNavigation = page.getByRole('navigation', { name: 'Primary mobile navigation' })
		await expect(page.getByTestId('learn-hero-image')).toBeVisible()
		await expect(hero.getByRole('heading', { level: 1 })).toBeVisible()
		await expect(hero.getByText('1 in 2')).toBeVisible()
		await expect(hero.getByText('100–400M')).toBeVisible()
		await expect(bottomNavigation).toBeVisible()

		const secondStat = await hero.getByText('100–400M').boundingBox()
		const navigationBox = await bottomNavigation.boundingBox()
		expect(secondStat).not.toBeNull()
		expect(navigationBox).not.toBeNull()
		expect(secondStat!.y + secondStat!.height).toBeLessThanOrEqual(navigationBox!.y)

		const containment = await page.evaluate(() => ({
			documentWidth: document.documentElement.scrollWidth,
			documentClientWidth: document.documentElement.clientWidth,
			pageWidth: document.querySelector('.learn-page')?.scrollWidth ?? 0,
			pageClientWidth: document.querySelector('.learn-page')?.clientWidth ?? 0,
		}))

		expect(containment.documentWidth).toBe(containment.documentClientWidth)
		expect(containment.pageWidth).toBe(containment.pageClientWidth)
		expect(page.locator('[data-habitat]')).toHaveCount(3)
		expect(page.locator('[data-learn-section]')).toHaveCount(6)
		expect(page.getByRole('link', { name: 'Learn what to look for' })).toHaveAttribute(
			'href',
			'#recognise',
		)
		expect(page.getByRole('link', { name: 'View dengue map' })).toHaveAttribute('href', '/map')

		await expect(page).toHaveScreenshot('learn-mobile-top.png', {
			animations: 'disabled',
		})
	})

	test('keeps evidence readable and visually separates the platform chapter', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 800 })
		await waitForLearnPage(page)

		const evidence = page.locator('[data-learn-section="evidence"]')
		await evidence.scrollIntoViewIfNeeded()
		const evidenceLayout = await evidence.locator('.learn-evidence-example').evaluate((element) => {
			const styles = getComputedStyle(element)
			const instructionalSizes = [...element.querySelectorAll<HTMLElement>('[data-instructional]')].map(
				(item) => Number.parseFloat(getComputedStyle(item).fontSize),
			)
			return {
				columns: styles.gridTemplateColumns.split(' ').length,
				instructionalSizes,
			}
		})
		expect(evidenceLayout.columns).toBe(1)
		expect(evidenceLayout.instructionalSizes.length).toBeGreaterThan(0)
		expect(Math.min(...evidenceLayout.instructionalSizes)).toBeGreaterThanOrEqual(14)

		const chapterColors = await page.evaluate(() => {
			const action = document.querySelector('[data-learn-section="action"]')
			const platform = document.querySelector('[data-learn-section="platform"] .learn-platform-intro')
			return {
				action: action ? getComputedStyle(action).backgroundColor : '',
				platform: platform ? getComputedStyle(platform).backgroundColor : '',
			}
		})
		expect(chapterColors.action).not.toBe(chapterColors.platform)
	})

	test('keeps final actions clear of fixed navigation after the full guided scroll', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 932 })
		await waitForLearnPage(page)

		const finalSection = page.locator('[data-learn-section="final"]')
		const finalAction = finalSection.getByRole('link', { name: 'Start report' })
		await finalAction.scrollIntoViewIfNeeded()
		await expect(finalAction).toBeVisible()
		const mainScrollSafety = await page.locator('.app-main').evaluate((element) => {
			const styles = getComputedStyle(element)
			const clearance = Number.parseFloat(
				getComputedStyle(document.documentElement).getPropertyValue('--app-mobile-bottom-clearance'),
			)
			return {
				scrollPaddingBottom: Number.parseFloat(styles.scrollPaddingBottom),
				clearance,
			}
		})
		expect(mainScrollSafety.scrollPaddingBottom).toBeGreaterThanOrEqual(mainScrollSafety.clearance + 24)
		await finalAction.evaluate((element) => element.scrollIntoView({ block: 'end', behavior: 'auto' }))
		const canvasScrollSafety = await page.locator('.app-canvas').evaluate((element) => {
			const styles = getComputedStyle(element)
			const clearance = Number.parseFloat(
				getComputedStyle(document.documentElement).getPropertyValue('--app-mobile-bottom-clearance'),
			)
			return {
				paddingBottom: Number.parseFloat(styles.paddingBottom),
				clearance,
			}
		})
		expect(canvasScrollSafety.paddingBottom).toBeGreaterThanOrEqual(canvasScrollSafety.clearance + 40)

		const [actionBox, navigationBox] = await Promise.all([
			finalAction.boundingBox(),
			page.getByRole('navigation', { name: 'Primary mobile navigation' }).boundingBox(),
		])
		expect(actionBox).not.toBeNull()
		expect(navigationBox).not.toBeNull()
		expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(navigationBox!.y)
		expect(finalAction).toHaveAttribute('href', '/report')
		await expect(page.getByRole('heading', { name: 'Important to know' })).toBeVisible()
	})

	test('preserves the focused guide in the desktop shell', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 })
		await waitForLearnPage(page)

		await expect(page.getByRole('complementary', { name: 'Primary desktop navigation' })).toBeVisible()
		const guideBox = await page.locator('.learn-page').boundingBox()
		expect(guideBox).not.toBeNull()
		expect(guideBox!.width).toBeLessThanOrEqual(760)

		await expect(page).toHaveScreenshot('learn-desktop-top.png', {
			animations: 'disabled',
		})
	})
})
