import { expect, test } from '@playwright/test'

const officerHeaders = {
  Authorization: 'Bearer local-officer-demo-token',
}

const evidenceJpeg = Buffer.from(
  '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',
  'base64',
)

test('resident public report and officer review complete against the local backend', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000)

  const syncResponse = await request.post('http://127.0.0.1:8000/api/officer/hotspots/sync', {
    headers: officerHeaders,
  })
  expect(syncResponse.ok()).toBeTruthy()
  const syncBody = await syncResponse.json()
  expect(syncBody.syncedCount).toBeGreaterThan(0)

  await page.goto('/report')
  await expect(page.getByText(/Next needed: add one clear evidence photo/)).toBeVisible()
  await page.getByLabel('Upload a photo instead').setInputFiles({
    name: 'local-flow-evidence.jpg',
    mimeType: 'image/jpeg',
    buffer: evidenceJpeg,
  })
  await page.getByRole('button', { name: 'Use demo Kuala Lumpur location' }).click()
  await expect(page.getByText(/blue ring is the approximate device guide/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm this exact pin' })).toBeEnabled()
  await page.getByRole('button', { name: 'Confirm this exact pin' }).click()

  await page.locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'Continue to AI review' }).click()
  await expect(page.getByText(/Computer vision suggests/)).toBeVisible({ timeout: 120_000 })
  await expect(page.getByText(/How to read this AI result/).first()).toBeVisible()

  const separateButton = page.getByRole('button', { name: 'Create separate report' })
  if (await separateButton.isVisible().catch(() => false)) {
    await separateButton.click()
  }

  await expect(page.getByRole('button', { name: 'Continue to submit' })).toBeEnabled()
  await page.getByRole('button', { name: 'Continue to submit' }).click()
  const submitButton = page.getByRole('button', { name: /Submit public report|Submit stacked report/ })
  await expect(submitButton).toBeEnabled({ timeout: 90_000 })
  await submitButton.click()
  const referenceBadge = page.locator('.success-card__reference')
  await expect(referenceBadge).toBeVisible({ timeout: 120_000 })
  const reference = (await referenceBadge.textContent())?.trim() ?? ''
  expect(reference).toMatch(/^KL-[A-Z0-9]+-\d+$/)

  await page.goto(`/map/reports/${reference}`)
  await expect(page.getByRole('heading', { name: reference })).toBeVisible()
  await expect(page.getByText('All public submissions in this stack')).toBeVisible()
  await expect(page.getByText(/How to read this AI result/).first()).toBeVisible()

  await page.goto(`/status?ref=${reference}`)
  await expect(page.getByText(reference).first()).toBeVisible()
  await expect(page.getByText(/Advisory habitat/)).toBeVisible()
  await expect(page.getByText(/Public model evidence/)).toBeVisible()
  await expect(page.getByText(/How to read this AI result/).first()).toBeVisible()

  await page.goto('/officer')
  await expect(page.getByText(/current hotspot row/)).toBeVisible()
  await expect(page.getByText(reference).first()).toBeVisible()
  await page.getByRole('button', { name: new RegExp(reference) }).click()
  await expect(page.getByText(/Hotspot priority/)).toBeVisible()
  await expect(page.getByText(/Officer model evidence/)).toBeVisible()
  await page.getByLabel('Review status').selectOption('action_recorded')
  await page.getByLabel('Officer notes').fill('Verified by Playwright full-flow rehearsal.')
  await page.getByLabel('Follow-up action').fill('Inspection scheduled from local E2E test.')
  await page.getByRole('button', { name: 'Save review update' }).click()
  await expect(page.getByText(`Saved review update for ${reference}.`)).toBeVisible()

  const officerReport = await request.get(
    `http://127.0.0.1:8000/api/officer/reports/${reference}`,
    { headers: officerHeaders },
  )
  expect(officerReport.ok()).toBeTruthy()
  const officerBody = await officerReport.json()
  expect(officerBody.status).toBe('action_recorded')
  expect(officerBody.officerNotes).toBe('Verified by Playwright full-flow rehearsal.')
  expect(officerBody.hotspotPriority.priorityLevel).not.toBe('unassessed')
})

test('mobile resident flow keeps the guided stepper and pin controls usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/report')
  await expect(page.getByRole('button', { name: /1\. Photo/ })).toBeVisible()
  await expect(page.getByText(/Next needed: add one clear evidence photo/)).toBeVisible()

  await page.getByLabel('Upload a photo instead').setInputFiles({
    name: 'mobile-local-flow-evidence.jpg',
    mimeType: 'image/jpeg',
    buffer: evidenceJpeg,
  })
  await page.getByRole('button', { name: 'Use demo Kuala Lumpur location' }).click()
  await expect(page.getByRole('button', { name: 'North' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm this exact pin' })).toBeEnabled()
})
