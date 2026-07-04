import { expect, test } from '@playwright/test'

const evidenceJpeg = Buffer.from(
  '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',
  'base64',
)

test('resident public report completes against the local backend', async ({
  context,
  page,
}) => {
  test.setTimeout(180_000)
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 3.139, longitude: 101.6869, accuracy: 20 })

  await page.goto('/report')
  await expect(page.getByLabel('Upload a photo instead')).toBeVisible()
  await page.getByLabel('Upload a photo instead').setInputFiles({
    name: 'local-flow-evidence.jpg',
    mimeType: 'image/jpeg',
    buffer: evidenceJpeg,
  })
  await expect(page.getByRole('button', { name: 'Use photo & continue' })).toBeVisible()
  await page.getByRole('button', { name: 'Use photo & continue' }).click()
  await expect(page.getByText(/blue ring is the approximate device guide/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm this exact pin' })).toBeEnabled()
  await page.getByRole('button', { name: 'Confirm this exact pin' }).click()

  await page.locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'Continue to AI review' }).click()
  await expect(page.getByRole('img', { name: 'Submitted evidence preview' })).toBeVisible({ timeout: 120_000 })
  await expect(page.getByText(/Advisory only/)).toBeVisible()

  const separateButton = page.getByRole('button', { name: 'No, this is separate' })
  if (await separateButton.isVisible().catch(() => false)) {
    await separateButton.click()
  }

  await expect(page.getByRole('button', { name: 'Continue to submit' })).toBeEnabled()
  await page.getByRole('button', { name: 'Continue to submit' }).click()
  const submitButton = page.getByRole('button', { name: /Submit Report|Submit Stacked Report/i })
  await expect(submitButton).toBeEnabled({ timeout: 90_000 })
  await submitButton.click()
  const referenceBadge = page.getByRole('button', { name: 'Copy reference code to clipboard' })
  await expect(referenceBadge).toBeVisible({ timeout: 120_000 })
  const reference = (await referenceBadge.textContent())?.trim() ?? ''
  expect(reference).toMatch(/^KL-[A-Z0-9]+-\d+$/)

  await page.goto(`/map/reports/${reference}`)
  await expect(page.getByText(reference).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Observation history' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Evidence review' })).toBeVisible()

  await page.goto(`/status?ref=${reference}`)
  await expect(page.getByText(reference).first()).toBeVisible()
  await expect(page.getByText(/AI Habitat Advisory/)).toBeVisible()
  await expect(page.getByRole('img', { name: 'Citizen evidence thumbnail' })).toBeVisible()

})

test('desktop resident can confirm the selected location', async ({ context, page }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 3.139, longitude: 101.6869, accuracy: 20 })

  await page.goto('/report')
  await page.getByLabel('Upload a photo instead').setInputFiles({
    name: 'desktop-location-confirmation.jpg',
    mimeType: 'image/jpeg',
    buffer: evidenceJpeg,
  })
  await expect(page.getByRole('button', { name: 'Use photo & continue' })).toBeVisible()
  await page.getByRole('button', { name: 'Use photo & continue' }).click()

  const confirmButton = page.getByRole('button', { name: 'Confirm this exact pin' })
  const progressHeader = page.getByRole('navigation', { name: 'Report progress' })

  await expect(confirmButton).toBeVisible()
  await expect(confirmButton).toBeEnabled()

  const desktopHeaderGeometry = await progressHeader.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const canvas = element.closest('.app-canvas')?.getBoundingClientRect()
    return {
      containedByCanvas:
        Boolean(canvas) &&
        rect.left >= (canvas?.left ?? 0) &&
        rect.right <= (canvas?.right ?? window.innerWidth),
      top: rect.top,
    }
  })

  expect(desktopHeaderGeometry.containedByCanvas).toBeTruthy()
  expect(desktopHeaderGeometry.top).toBeGreaterThanOrEqual(0)

  await page.getByRole('button', { name: 'Take image, complete' }).click()
  await expect(page.getByRole('heading', { name: 'Take image' })).toBeVisible()

  await page.getByRole('button', { name: 'Confirm location, available' }).click()
  await expect(page.getByRole('heading', { name: 'Confirm location' })).toBeVisible()

  await confirmButton.click()
  await expect(page.getByRole('heading', { name: 'Consent form' })).toBeVisible()
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 390, height: 667 },
]) {
  test(`mobile resident can confirm the location at ${viewport.width}x${viewport.height}`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize(viewport)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 3.139, longitude: 101.6869, accuracy: 20 })

    await page.goto('/report')
    await expect(page.getByRole('dialog', { name: 'Report a breeding habitat' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Take image' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Capture Breeding Habitat' })).toBeVisible()

    await page.getByLabel('Upload a photo instead').setInputFiles({
      name: `mobile-local-flow-evidence-${viewport.height}.jpg`,
      mimeType: 'image/jpeg',
      buffer: evidenceJpeg,
    })
    await expect(page.getByRole('button', { name: 'Use photo & continue' })).toBeVisible()
    await expect(page.getByLabel('Retake photo')).toBeVisible()

    const [previewBox, imageBox, retakeBox, continueBox, previewStyles] = await Promise.all([
      page.locator('.report-photo-stage__preview').boundingBox(),
      page.getByRole('img', { name: 'Captured preview' }).boundingBox(),
      page.getByLabel('Retake photo').boundingBox(),
      page.getByRole('button', { name: 'Use photo & continue' }).boundingBox(),
      page.getByRole('img', { name: 'Captured preview' }).evaluate((element) => {
        const styles = window.getComputedStyle(element)
        return {
          objectFit: styles.objectFit,
        }
      }),
    ])

    expect(previewBox).not.toBeNull()
    expect(imageBox).not.toBeNull()
    expect(retakeBox).not.toBeNull()
    expect(continueBox).not.toBeNull()
    expect(imageBox!.width / previewBox!.width).toBeGreaterThanOrEqual(0.7)
    expect(retakeBox!.width).toBeLessThanOrEqual(previewBox!.width)
    expect(continueBox!.width).toBeLessThanOrEqual(previewBox!.width)
    expect(previewStyles.objectFit).toBe('cover')

    await page.getByRole('button', { name: 'Use photo & continue' }).click()

    const confirmButton = page.getByRole('button', { name: 'Confirm this exact site' })
    const progressHeader = page.getByRole('navigation', { name: 'Report progress' })

    await expect(page.getByRole('button', { name: 'Use current location again' })).toBeVisible()
    await expect(confirmButton).toBeVisible()
    await expect(confirmButton).toBeEnabled()

    const locationPanelPosition = await page
      .locator('.report-location-confirmation-panel')
      .evaluate((element) => window.getComputedStyle(element).position)

    expect(locationPanelPosition).toBe('static')

    const [confirmBox, dialogBox] = await Promise.all([
      confirmButton.boundingBox(),
      page.getByRole('dialog', { name: 'Report a breeding habitat' }).boundingBox(),
    ])

    expect(confirmBox).not.toBeNull()
    expect(dialogBox).not.toBeNull()
    expect(confirmBox!.y + confirmBox!.height).toBeLessThanOrEqual(dialogBox!.height)

    const targetSizes = await progressHeader
      .locator('.report-segmented-progress__button')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const rect = button.getBoundingClientRect()
          return { width: rect.width, height: rect.height }
        }),
      )

    expect(targetSizes).toHaveLength(5)
    expect(targetSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBeTruthy()

    await confirmButton.click()
    await expect(page.getByRole('heading', { name: 'Consent form' })).toBeVisible()
  })
}

test('report progress dock respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/report')

  const motionStyles = await page
    .getByRole('navigation', { name: 'Report progress' })
    .evaluate((dock) => {
      const activeBar = dock.querySelector(
        '.report-segmented-progress__item[data-state="current"] .report-segmented-progress__bar',
      )

      return {
        transition: activeBar ? window.getComputedStyle(activeBar).transitionDuration : null,
        animation: activeBar ? window.getComputedStyle(activeBar).animationName : null,
      }
    })

  expect(Number.parseFloat(motionStyles.transition ?? '1')).toBeLessThanOrEqual(0.001)
  expect(motionStyles.animation).toBe('none')
})
