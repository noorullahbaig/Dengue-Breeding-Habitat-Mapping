import { expect, test } from '@playwright/test'

const mobileWidths = [320, 360, 390, 430]
const containmentRoutes = [
  '/',
  '/report',
  '/activity',
  '/profile',
  '/status',
  '/learn',
  '/map',
  '/map/reports/KL-KC8P-6230',
  '/officer',
]

for (const width of mobileWidths) {
  test(`contains every route within a ${width}px mobile viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 844 })

    for (const route of containmentRoutes) {
      await page.goto(route)
      await page.locator('.app-shell').waitFor()

      const containment = await page.evaluate(() => {
        const canvas = document.querySelector('.app-canvas')
        return {
          documentWidth: document.documentElement.scrollWidth,
          documentClientWidth: document.documentElement.clientWidth,
          canvasWidth: canvas?.scrollWidth ?? 0,
          canvasClientWidth: canvas?.clientWidth ?? 0,
        }
      })

      expect(containment.documentWidth, `${route} document overflow at ${width}px`).toBe(
        containment.documentClientWidth,
      )
      expect(containment.canvasWidth, `${route} canvas overflow at ${width}px`).toBe(
        containment.canvasClientWidth,
      )
    }
  })
}

test.describe('mobile shell regressions', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('keeps mobile chrome fixed and avoids dead space across resident flows', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary mobile navigation' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Track a report' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Keep KL safe from dengue.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Start a report' })).toBeVisible()

    const homeHeroReadiness = await page.evaluate(() => {
      const heading = document.querySelector('.home-hero__title')
      const primaryAction = [...document.querySelectorAll('a')].find(
        (link) => link.textContent?.trim() === 'Start a report',
      )
      if (!(heading instanceof HTMLElement) || !(primaryAction instanceof HTMLElement)) {
        return null
      }

      const headingStyle = window.getComputedStyle(heading)
      const actionRect = primaryAction.getBoundingClientRect()

      return {
        headingOpacity: headingStyle.opacity,
        actionBottom: actionRect.bottom,
        viewportHeight: window.innerHeight,
      }
    })

    expect(homeHeroReadiness).not.toBeNull()
    expect(homeHeroReadiness?.headingOpacity).not.toBe('0')
    expect(homeHeroReadiness?.actionBottom ?? 0).toBeLessThanOrEqual(
      (homeHeroReadiness?.viewportHeight ?? 0) - 72,
    )

    const topbar = page.locator('.app-topbar')
    const bottomNav = page.locator('.app-bottom-nav')
    const canvas = page.locator('.app-canvas')

    const topbarBefore = await topbar.boundingBox()
    const bottomNavBefore = await bottomNav.boundingBox()

    await canvas.evaluate((node) => {
      node.scrollTo({ top: 480, behavior: 'auto' })
    })

    const topbarAfter = await topbar.boundingBox()
    const bottomNavAfter = await bottomNav.boundingBox()

    expect(topbarBefore).not.toBeNull()
    expect(topbarAfter).not.toBeNull()
    expect(bottomNavBefore).not.toBeNull()
    expect(bottomNavAfter).not.toBeNull()

    expect(Math.abs((topbarBefore?.y ?? 0) - (topbarAfter?.y ?? 0))).toBeLessThan(1)
    expect(Math.abs((bottomNavBefore?.y ?? 0) - (bottomNavAfter?.y ?? 0))).toBeLessThan(1)

    await page.goto('/report')

    const reportDialog = page.getByRole('dialog', { name: 'Report a breeding habitat' })
    await expect(reportDialog).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Report progress' })).toBeVisible()

    const reportDialogBox = await reportDialog.boundingBox()
    expect(reportDialogBox).not.toBeNull()
    expect(reportDialogBox?.y ?? -1).toBe(0)
    expect(Math.abs((reportDialogBox?.height ?? 0) - 844)).toBeLessThan(2)

    await page.goto('/map')

    const mapCanvasShell = page.locator('.app-canvas')
    const mapCanvas = page.locator('.map-fullscreen-container')
    await expect(mapCanvas).toBeVisible()

    const mapCanvasShellBox = await mapCanvasShell.boundingBox()
    const mapCanvasBox = await mapCanvas.boundingBox()
    const mapBottomNavBox = await bottomNav.boundingBox()

    expect(mapCanvasShellBox).not.toBeNull()
    expect(mapCanvasBox).not.toBeNull()
    expect(mapBottomNavBox).not.toBeNull()
    expect(mapCanvasShellBox?.x ?? 0).toBeLessThan(1)
    expect(Math.abs((mapCanvasShellBox?.width ?? 0) - 390)).toBeLessThan(2)
    expect(mapCanvasBox?.y! + mapCanvasBox?.height!).toBeGreaterThanOrEqual(mapBottomNavBox?.y ?? 0)
    expect(mapCanvasBox?.y! + mapCanvasBox?.height!).toBeLessThanOrEqual(
      (mapBottomNavBox?.y ?? 0) + (mapBottomNavBox?.height ?? 0),
    )

    await page.goto('/activity')

    const activityCta = page.getByRole('link', { name: /sign in to view activity/i })
    await expect(activityCta).toBeVisible()
    const activityCtaBox = await activityCta.boundingBox()

    expect(activityCtaBox).not.toBeNull()
    expect((activityCtaBox?.y ?? 0) + (activityCtaBox?.height ?? 0)).toBeLessThanOrEqual(844)
    await expect(page.getByText(/local build keeps saved activity/i)).toHaveCount(0)
  })
})
