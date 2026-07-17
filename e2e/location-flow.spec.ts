import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const evidenceImage = readFileSync(resolve(process.cwd(), 'src/assets/learn/habitat-tire.webp'))

test('public map centers from an explicitly granted browser location', async ({ context, page }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 3.139, longitude: 101.6869, accuracy: 20 })

  await page.goto('/map')
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true)
  await page.getByRole('button', { name: 'Center map on my location' }).click()

  await expect(page.getByRole('status')).toHaveCount(0)
})

test('public map exposes a stable recovery message when browser location is denied', async ({
  context,
  page,
}) => {
  await context.clearPermissions()

  await page.goto('/map')
  await page.getByRole('button', { name: 'Center map on my location' }).click()

  await expect(page.getByRole('status')).toContainText(
    'Location access is blocked for this website.',
  )
  await expect(
    page.getByRole('button', { name: 'Center map on my location' }),
  ).toBeEnabled()
})

test('report location denial removes the stale share button and supports retry', async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await context.clearPermissions()

  await page.goto('/report')
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'location-denial-recovery.webp',
    mimeType: 'image/webp',
    buffer: evidenceImage,
  })
  await page.getByRole('button', { name: 'Use photo & continue' }).click()
  await page.getByRole('button', { name: 'Share My Location' }).click()

  await expect(page.getByRole('heading', { name: 'Location Access Blocked' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Share My Location' })).toHaveCount(0)

  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 3.139, longitude: 101.6869, accuracy: 20 })
  await page.getByRole('button', { name: "I've updated settings — Try Again" }).click()

  await expect(page.getByRole('button', { name: 'Use current location again' })).toBeVisible()
})

test('embedded pages explain a geolocation Permissions Policy block', async ({ page }) => {
  await page.goto('/')
  await page.setContent(
    '<iframe title="Embedded map" src="http://127.0.0.1:5173/map" allow="geolocation \'none\'"></iframe>',
  )
  const embeddedMap = page.frameLocator('iframe[title="Embedded map"]')

  await embeddedMap
    .getByRole('button', { name: 'Center map on my location' })
    .evaluate((button) => (button as HTMLButtonElement).click())

  await expect(embeddedMap.getByRole('status')).toContainText(
    'Location is blocked by the page or browser that opened this site.',
  )
})
