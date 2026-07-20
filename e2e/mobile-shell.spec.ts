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

test('uses the KLCC artwork as a compact phone hero and split tablet hero', async ({ page }) => {
  const phoneViewports = [
    { width: 320, height: 700 },
    { width: 360, height: 844 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 599, height: 900 },
  ]

  for (const viewport of phoneViewports) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const phoneHero = await page.locator('.home-hero').evaluate((hero) => {
      const visual = hero.querySelector('.home-hero__visual')
      const image = hero.querySelector('.home-hero__image')
      const note = hero.querySelector('.home-hero__image-note')
      const title = hero.querySelector('.home-hero__title')
      const description = hero.querySelector('.home-hero__description')
      const actions = hero.querySelector('.home-hero__actions')
      const learnLink = hero.querySelector('.home-hero__learn-link')
      const buttons = [...hero.querySelectorAll('.ui-button')]
      if (
        !(visual instanceof HTMLElement) ||
        !(image instanceof HTMLImageElement) ||
        !note ||
        !(title instanceof HTMLElement) ||
        !(description instanceof HTMLElement) ||
        !(actions instanceof HTMLElement) ||
        !(learnLink instanceof HTMLElement)
      ) {
        return null
      }

      const heroRect = hero.getBoundingClientRect()
      const imageRect = image.getBoundingClientRect()
      const contentRects = [title, description, actions, learnLink, ...buttons].map((element) =>
        element.getBoundingClientRect(),
      )
      const learnLinkRect = learnLink.getBoundingClientRect()
      const imageStyle = window.getComputedStyle(image)

      return {
        heroHeight: heroRect.height,
        contentContained: contentRects.every(
          (rect) => rect.left >= heroRect.left - 1 && rect.right <= heroRect.right + 1,
        ),
        learnLinkHeight: learnLinkRect.height,
        learnLinkLeftDelta: Math.abs(learnLinkRect.left - title.getBoundingClientRect().left),
        imageEdges: {
          top: Math.abs(imageRect.top - heroRect.top),
          right: Math.abs(imageRect.right - heroRect.right),
          bottom: Math.abs(imageRect.bottom - heroRect.bottom),
          left: Math.abs(imageRect.left - heroRect.left),
        },
        objectFit: imageStyle.objectFit,
        objectPosition: imageStyle.objectPosition,
        noteDisplay: window.getComputedStyle(note).display,
        visualPosition: window.getComputedStyle(visual).position,
      }
    })

    expect(phoneHero, `${viewport.width}px phone hero`).not.toBeNull()
    expect(phoneHero?.heroHeight ?? 0).toBeGreaterThanOrEqual(512)
    expect(phoneHero?.heroHeight ?? 0).toBeLessThanOrEqual(546)
    expect(phoneHero?.contentContained).toBe(true)
    expect(phoneHero?.learnLinkHeight ?? 0).toBeGreaterThanOrEqual(44)
    expect(phoneHero?.learnLinkLeftDelta ?? 0).toBeLessThanOrEqual(1)
    expect(phoneHero?.visualPosition).toBe('absolute')
    expect(phoneHero?.objectFit).toBe('cover')
    expect(phoneHero?.objectPosition).toBe('50% 50%')
    expect(phoneHero?.noteDisplay).toBe('none')
    for (const edgeDelta of Object.values(phoneHero?.imageEdges ?? {})) {
      expect(edgeDelta).toBeLessThanOrEqual(1)
    }
  }

  for (const width of [600, 759, 760, 980, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')

    const splitHero = await page.locator('.home-hero').evaluate((hero) => {
      const visual = hero.querySelector('.home-hero__visual')
      const note = hero.querySelector('.home-hero__image-note')
      if (!(visual instanceof HTMLElement) || !note) return null

      return {
        visualPosition: window.getComputedStyle(visual).position,
        noteDisplay: window.getComputedStyle(note).display,
      }
    })

    expect(splitHero, `${width}px split hero`).toEqual({
      visualPosition: 'relative',
      noteDisplay: 'flex',
    })
  }
})

test.describe('mobile shell regressions', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('keeps mobile chrome fixed and avoids dead space across resident flows', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary mobile navigation' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Track a report' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Report a dengue breeding site.' })).toBeVisible()
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

    expect(Math.abs((topbarBefore?.y ?? 0) - (topbarAfter?.y ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((bottomNavBefore?.y ?? 0) - (bottomNavAfter?.y ?? 0))).toBeLessThanOrEqual(1)

    const homeScrollSafety = await page.locator('.app-main').evaluate((element) => {
      const styles = getComputedStyle(element)
      const clearance = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--app-mobile-bottom-clearance'),
      )
      return {
        scrollPaddingBottom: Number.parseFloat(styles.scrollPaddingBottom),
        clearance,
      }
    })
    expect(homeScrollSafety.scrollPaddingBottom).toBeGreaterThanOrEqual(homeScrollSafety.clearance + 24)

    const homeFinalContent = page.locator('.home-activity')
    await homeFinalContent.evaluate((element) => element.scrollIntoView({ block: 'end', behavior: 'auto' }))
    const [homeFinalBox, homeNavigationBox] = await Promise.all([
      homeFinalContent.boundingBox(),
      bottomNav.boundingBox(),
    ])
    expect(homeFinalBox).not.toBeNull()
    expect(homeNavigationBox).not.toBeNull()
    expect(homeFinalBox!.y + homeFinalBox!.height).toBeLessThanOrEqual(homeNavigationBox!.y)

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

    await page.goto('/profile')
    await expect(page.locator('.profile-card')).toBeVisible()
    const profileScrollSafety = await page.locator('.profile-card').evaluate((element) => {
      const styles = getComputedStyle(element)
      return {
        overflowY: styles.overflowY,
        paddingBottom: Number.parseFloat(styles.paddingBottom),
        scrollPaddingBottom: Number.parseFloat(styles.scrollPaddingBottom),
      }
    })
    expect(profileScrollSafety.overflowY).toBe('auto')
    expect(profileScrollSafety.paddingBottom).toBeGreaterThanOrEqual(48)
    expect(profileScrollSafety.scrollPaddingBottom).toBeGreaterThanOrEqual(24)
  })
})

for (const width of mobileWidths) {
  test(`keeps public report detail contained and navigable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 844 })
    await page.goto('/map/reports/KL-KC8P-6230')
    await page.locator('.app-shell').waitFor()

    const backToMap = page.getByRole('link', { name: 'Back to map' })
    await expect(backToMap).toBeVisible()
    await expect(backToMap).toHaveClass(/ui-button--ghost/)
    await expect(backToMap).toHaveClass(/ui-button--compact/)

    const containment = await page.evaluate(() => {
      const canvas = document.querySelector('.app-canvas')
      const detailPage = document.querySelector('.page--detail-revamp')
      const activeTimelineCard = document.querySelector('.timeline-node--active .timeline-card')
      const metadataGrid = document.querySelector('.detail-metadata-grid')
      const heroRef = document.querySelector('.detail-hero-header__ref')

      return {
        documentWidth: document.documentElement.scrollWidth,
        documentClientWidth: document.documentElement.clientWidth,
        canvasWidth: canvas?.scrollWidth ?? 0,
        canvasClientWidth: canvas?.clientWidth ?? 0,
        detailWidth: detailPage?.scrollWidth ?? 0,
        detailClientWidth: detailPage?.clientWidth ?? 0,
        timelineWidth: activeTimelineCard?.scrollWidth ?? 0,
        timelineClientWidth: activeTimelineCard?.clientWidth ?? 0,
        metadataWidth: metadataGrid?.scrollWidth ?? 0,
        metadataClientWidth: metadataGrid?.clientWidth ?? 0,
        heroRefWidth: heroRef?.scrollWidth ?? 0,
        heroRefClientWidth: heroRef?.clientWidth ?? 0,
      }
    })

    expect(containment.documentWidth, `detail route document overflow at ${width}px`).toBe(
      containment.documentClientWidth,
    )
    expect(containment.canvasWidth, `detail route canvas overflow at ${width}px`).toBe(
      containment.canvasClientWidth,
    )
    expect(containment.detailWidth, `detail page overflow at ${width}px`).toBe(
      containment.detailClientWidth,
    )
    expect(containment.timelineWidth, `timeline overflow at ${width}px`).toBe(
      containment.timelineClientWidth,
    )
    expect(containment.metadataWidth, `metadata overflow at ${width}px`).toBe(
      containment.metadataClientWidth,
    )
    expect(containment.heroRefWidth, `reference overflow at ${width}px`).toBeLessThanOrEqual(
      containment.heroRefClientWidth,
    )

    await backToMap.click()
    await page.waitForURL('**/map')
  })
}
