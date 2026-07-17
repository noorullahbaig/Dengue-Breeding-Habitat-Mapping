import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const evidenceImage = readFileSync(
  resolve(process.cwd(), 'src/assets/learn/habitat-tire.webp'),
)

async function expectEvidencePreview(
  page: import('@playwright/test').Page,
  imageName: string | RegExp = 'Submitted evidence preview',
) {
  const image = page.getByRole('img', { name: imageName })
  await expect(image).toBeVisible({ timeout: 120_000 })

  const imageBox = await image.boundingBox()
  expect(imageBox).not.toBeNull()
  expect(imageBox!.width).toBeGreaterThan(0)
  expect(imageBox!.height).toBeGreaterThan(0)

  const boxes = page.locator('.prediction-evidence__box')
  const boxCount = await boxes.count()

  for (let index = 0; index < boxCount; index += 1) {
    const box = await boxes.nth(index).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(imageBox!.x - 1)
    expect(box!.y).toBeGreaterThanOrEqual(imageBox!.y - 1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(imageBox!.x + imageBox!.width + 1)
    expect(box!.y + box!.height).toBeLessThanOrEqual(imageBox!.y + imageBox!.height + 1)
  }
}

test('resident public report completes against the local backend', async ({
  context,
  page,
}) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 3.139, longitude: 101.6869, accuracy: 20 })

  await page.goto('/report')
  await expect(page.getByText('Capture Breeding Habitat')).toBeVisible()
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'local-flow-evidence.webp',
    mimeType: 'image/webp',
    buffer: evidenceImage,
  })
  await expect(page.getByRole('button', { name: 'Use photo & continue' })).toBeVisible()
  await page.getByRole('button', { name: 'Use photo & continue' }).click()
  await page.getByRole('button', { name: 'Share My Location' }).click()
  await expect(page.getByRole('button', { name: 'Use current location again' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm this exact site' })).toBeEnabled()
  await page.getByRole('button', { name: 'Confirm this exact site' }).click()

  const consentBody = page.locator('[aria-label="Public consent text"]')
  await consentBody.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
  })
  await page.locator('input[type="checkbox"]').check()
  await expectEvidencePreview(page)
  await expect(page.getByText(/AI results are advisory/i)).toBeVisible()

  const nearbyDialog = page.getByRole('dialog', { name: 'We found a similar report nearby' })
  if (await nearbyDialog.isVisible().catch(() => false)) {
    const [dialogBox, createSeparateBox] = await Promise.all([
      nearbyDialog.boundingBox(),
      page.getByRole('button', { name: 'Create separate report' }).boundingBox(),
    ])
    expect(dialogBox).not.toBeNull()
    expect(createSeparateBox).not.toBeNull()
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0)
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    expect(createSeparateBox!.y + createSeparateBox!.height).toBeLessThanOrEqual(
      dialogBox!.y + dialogBox!.height + 1,
    )

    const separateButton = page.getByRole('button', { name: 'Create separate report' })
    await separateButton.click()
  }

  await expect(page.getByRole('button', { name: 'Continue to submit' })).toBeEnabled()
  await page.getByRole('button', { name: 'Continue to submit' }).click()
  await expectEvidencePreview(page, /Captured evidence photo|Evidence image with computer-vision detections/i)
  const submitButton = page.getByRole('button', { name: /Submit Report|Submit Stacked Report/i })
  await expect(submitButton).toBeEnabled({ timeout: 90_000 })
  await submitButton.click()
  const referenceBadge = page.getByRole('button', { name: 'Copy tracking ID to clipboard' })
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
  await page.setViewportSize({ width: 390, height: 844 })
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 3.139, longitude: 101.6869, accuracy: 20 })

  await page.goto('/report')
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'desktop-location-confirmation.webp',
    mimeType: 'image/webp',
    buffer: evidenceImage,
  })
  await expect(page.getByRole('button', { name: 'Use photo & continue' })).toBeVisible()
  await page.getByRole('button', { name: 'Use photo & continue' }).click()
  await page.getByRole('button', { name: 'Share My Location' }).click()

  const confirmButton = page.getByRole('button', { name: 'Confirm this exact site' })
  await expect(confirmButton).toBeVisible()
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()
  await expect(page.getByRole('heading', { name: 'Consent form' })).toBeVisible()

  await page.setViewportSize({ width: 1280, height: 900 })

  const progressHeader = page.getByRole('navigation', { name: 'Report progress' })

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
})

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 390, height: 667 },
  { width: 430, height: 932 },
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

    await page.locator('input[type="file"]').first().setInputFiles({
      name: `mobile-local-flow-evidence-${viewport.height}.webp`,
      mimeType: 'image/webp',
      buffer: evidenceImage,
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
    await page.getByRole('button', { name: 'Share My Location' }).click()

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
