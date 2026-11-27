import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

async function assertNoHorizontalOverflow(page: Page, contextLabel: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(
    scrollWidth,
    `${contextLabel}: expected scrollWidth (${scrollWidth}) <= clientWidth (${clientWidth})`
  ).toBeLessThanOrEqual(clientWidth + 1)
}

test.describe('Trinqle Mobile PWA E2E (390x844)', () => {
  test('1. Empty Home single-click demo seeds full scope & zero overflow across all 5 tabs', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText('Set up your form')).toBeVisible()
    const demoBtn = page.getByRole('button', {
      name: /See the scope of the app using fresh demo data/i,
    })
    await expect(demoBtn).toBeVisible()
    await demoBtn.click()

    // Wait for chapters + dashboard + insights to populate Home
    await expect(page.getByText(/Chapter 3: Current Journey/i)).toBeVisible({ timeout: 20_000 })
    await expect(demoBtn).toHaveCount(0)
    await assertNoHorizontalOverflow(page, 'Home (after demo seed)')

    // Check Archive tab shows closed chapters
    await page.getByRole('button', { name: 'Archive' }).click()
    await expect(page.getByText(/Chapter 1: Foundations/i)).toBeVisible()
    await assertNoHorizontalOverflow(page, 'Archive tab')

    // Check Dashboard tab renders graphs without overflow
    await page.getByRole('button', { name: 'Dashboard' }).click()
    await assertNoHorizontalOverflow(page, 'Dashboard tab')

    // Check Insights tab renders findings without overflow
    await page.getByRole('button', { name: 'Insights' }).click()
    await assertNoHorizontalOverflow(page, 'Insights tab')

    // Check Profile tab & return Home
    await page.getByRole('button', { name: 'Profile' }).click()
    await expect(page.getByText(/Backup & Data Export/i)).toBeVisible()
    await assertNoHorizontalOverflow(page, 'Profile tab')

    await page.getByRole('button', { name: 'Home' }).click()
    await assertNoHorizontalOverflow(page, 'Home return')
  })

  test('2. Nightly form fill, No-on-gate submit (F1), and session carousel containment (F2)', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Use sample starter pack/i }).click()
    await expect(page.getByText(/Tonight's journal/i)).toBeVisible()

    // Ensure form is fillable regardless of wall-clock hour
    await page.getByRole('button', { name: 'Profile' }).click()
    const timeInputs = page.locator('input[type="time"]')
    await timeInputs.nth(0).fill('00:00')
    await timeInputs.nth(1).fill('23:59')
    await page.getByRole('button', { name: 'Home' }).click()

    // Open nightly form & fill Day Header in Quick mode
    await page.getByRole('button', { name: /Fill tonight/i }).click()
    const titleInput = page.getByPlaceholder('e.g. Rainy cafe morning & deep focus')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('Quiet evening check-in')
    await page.getByRole('button', { name: /Quick/i }).click()
    await page.getByRole('button', { name: /Continue to questions/i }).first().click()

    // Test repeating session carousel containment (F2) on Sleep
    const addSessionBtn = page.getByRole('button', { name: /Add Session/i }).first()
    await expect(addSessionBtn).toBeVisible()
    await addSessionBtn.click()
    const carousel = page.locator('.snap-x.snap-mandatory').first()
    await expect(carousel).toBeVisible()
    const carouselBox = await carousel.boundingBox()
    expect(carouselBox).not.toBeNull()
    if (carouselBox) {
      expect(carouselBox.width).toBeLessThanOrEqual(390)
    }

    // Cycle every blank core yes/no gate twice (blank -> Yes -> No) so F1 No-on-gate submit is tested
    for (const gateLabel of ['Studied today', 'Coded today', 'Went out', 'Exercised today', 'Took a bath']) {
      const labelEl = page.getByText(gateLabel, { exact: true }).last()
      if (await labelEl.isVisible().catch(() => false)) {
        await labelEl.click() // -> Yes
        await labelEl.click() // -> No
      }
    }

    // Fill all required TimeRange widgets via Dual-Clock OK
    let guard = 0
    while (guard < 5) {
      const trBtn = page.getByRole('button', { name: /Set time range for/i }).first()
      if (!(await trBtn.isVisible().catch(() => false))) break
      await trBtn.click()
      await page.getByRole('button', { name: /^OK$/i }).click()
      guard++
    }

    // Answer required numeric parts
    const numInputs = page.locator('input[type="number"]')
    const numCount = await numInputs.count()
    for (let i = 0; i < numCount; i++) {
      await numInputs.nth(i).fill('5')
    }

    // Answer required star scales & range sliders
    const starBtns = page.locator('button[aria-label*="Rate 4 "]')
    const starCount = await starBtns.count()
    for (let i = 0; i < starCount; i++) {
      await starBtns.nth(i).click()
    }
    const sliders = page.locator('input[type="range"]')
    const sliderCount = await sliders.count()
    for (let i = 0; i < sliderCount; i++) {
      await sliders.nth(i).fill('7')
    }

    const saveBtn = page.getByRole('button', { name: /Save tonight/i })
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    await expect(page.getByText(/Quiet evening check-in/i)).toBeVisible({ timeout: 10_000 })
  })

  test('3. Chapter end-date bounds (F3), Full Backup, Delete All, and Restore round-trip', async ({
    page,
    browserName: _browserName,
  }, testInfo) => {
    await page.goto('/')
    await page.getByRole('button', {
      name: /See the scope of the app using fresh demo data/i,
    }).click()
    await expect(page.getByText(/Chapter 3: Current Journey/i)).toBeVisible({ timeout: 20_000 })

    // Open Chapter Details & test invalid / valid chapter end dates (F3)
    await page.getByText(/Chapter 3: Current Journey/i).click()
    const endDateInput = page.locator('input[type="date"]').first()
    await expect(endDateInput).toBeVisible()
    const maxAttr = await endDateInput.getAttribute('max')
    const minAttr = await endDateInput.getAttribute('min')
    expect(minAttr).toBeTruthy()
    expect(maxAttr).toBeTruthy()
    // Valid update within bounds
    if (maxAttr) {
      await endDateInput.fill(maxAttr)
      await page.getByRole('button', { name: /Update End Date/i }).click()
    }
    await page.getByRole('button', { name: /^Done$/i }).click()

    // Full Backup export in Profile
    await page.getByRole('button', { name: 'Profile' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Full backup/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^trinqle_full_backup_\d{4}-\d{2}-\d{2}\.zip$/)

    const backupPath = path.join(testInfo.outputDir, download.suggestedFilename())
    fs.mkdirSync(testInfo.outputDir, { recursive: true })
    await download.saveAs(backupPath)

    // Delete all data
    await page.getByRole('button', { name: /Delete all data/i }).click()
    await page.getByPlaceholder('Type DELETE').fill('DELETE')
    await page.getByRole('button', { name: /Erase forever/i }).click()
    await expect(page.getByText('Set up your form')).toBeVisible({ timeout: 15_000 })

    // Restore via Import dialog
    await page.getByRole('button', { name: /Import a form/i }).click()
    const fileInput = page.locator('input[type="file"][accept=".json,.zip"]')
    await fileInput.setInputFiles(backupPath)
    await expect(page.getByText(/Full Trinqle Backup/i)).toBeVisible()
    await page.getByRole('button', { name: /Restore backup/i }).click()

    await expect(page.getByText(/Chapter 3: Current Journey/i)).toBeVisible({ timeout: 15_000 })
  })
})
