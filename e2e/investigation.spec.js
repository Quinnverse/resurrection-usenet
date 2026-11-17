// Browser end-to-end checks (Playwright, Chromium). Run with `npm run test:e2e`.
// The server is started by playwright.config.js on a fixed port with a temporary save directory.
// Each test gets a fresh browser context (empty localStorage) and therefore a fresh server session.

const { test, expect } = require('@playwright/test');

function watchPage(page, issues) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') issues.push(`console ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (error) => issues.push(`page error: ${error.message}`));
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      issues.push(`HTTP ${response.status()} ${response.url()}`);
    }
  });
}

async function settle(page) {
  await page.waitForFunction(() => !document.querySelector('button:disabled'));
}

async function act(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
  await settle(page);
}

async function choose(page, optionText, buttonName) {
  await page.locator('.choice', { hasText: optionText }).getByRole('button', { name: buttonName }).click();
  await settle(page);
}

async function commitPreviewed(page) {
  await page.getByRole('button', { name: 'COMMIT (cannot be undone)' }).click();
  await settle(page);
}

async function shot(page, testInfo, name) {
  await page.screenshot({ path: testInfo.outputPath(name + '.png'), fullPage: true });
}

// Enters the archive and stops on the cold open, where the first transmission is visible.
async function enterArchive(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER ARCHIVE' }).click();
  await expect(page.getByText('INCOMING / 28 YEARS LATE').first()).toBeVisible({ timeout: 8000 });
}

// Opens the transmission and performs the two header inspections that reveal the contradiction.
async function openAndCompare(page) {
  await act(page, 'OPEN TRANSMISSION');
  await act(page, 'INSPECT HEADER: Shutdown report, Lab 3');
  await act(page, 'INSPECT HEADER: Access report, Lab 4');
  await expect(page.getByText('Contradictory records: headers compared')).toBeVisible();
}

async function investigateToMemoryBudget(page) {
  await act(page, 'TRACE RELAY: Elena cache (NODE-02)');
  await act(page, 'INSPECT MAINTENANCE LOG');
  await act(page, 'RECONSTRUCT MAILBOX INDEX');
  await act(page, 'TRACE PROVENANCE');
  await act(page, 'TRACE RELAY: Lab 4 log (NODE-04)');
}

test.describe('branch A: Lab 3 account, forensic memory, exposed provenance, The Archive', () => {
  test('plays from the cold open to the Archive ending, with the anomaly from the event log', async ({ page }, testInfo) => {
    const issues = [];
    watchPage(page, issues);

    await enterArchive(page);
    await shot(page, testInfo, '01-cold-open');

    await openAndCompare(page);
    await expect(page.getByText(/Leads · \d+ of 5 followed/)).toBeVisible();
    await expect(page.getByText(/Revision \d+/)).toHaveCount(0);
    await expect(page.getByText(/undefined|\bnull\b/)).toHaveCount(0);
    await shot(page, testInfo, '02-first-investigation');
    await shot(page, testInfo, '03-contradictory-records');

    await choose(page, 'the Lab 3 shutdown record', 'PREVIEW');
    await expect(page.getByText(/Preview: this change would alter \d+ values/)).toBeVisible();
    await commitPreviewed(page);
    await expect(page.getByText('You selected a record. You did not establish a fact.').first()).toBeVisible();
    await expect(page.getByText('Incident summary (Archivist)').first()).toBeVisible();

    // Propagation is recorded by the engine and replayed in order; skipping shows the final state.
    await expect(page.getByText(/Hop \d+ of \d+/)).toBeVisible();
    await page.getByRole('button', { name: 'Skip to final state' }).click();
    await expect(page.getByText(/Final state: \d+ replica updates/)).toBeVisible();
    await expect(page.locator('svg.network g.node')).toHaveCount(5);
    expect(await page.locator('svg.network line.done').count()).toBeGreaterThan(0);
    await shot(page, testInfo, '04-network-propagation');

    await investigateToMemoryBudget(page);

    const journalBefore = await page.getByText(/Journal · \d+ of 12 found/).first().innerText();
    await page.reload();
    await expect(page.getByText(journalBefore)).toBeVisible();
    await expect(page.getByText(/Act 2/).first()).toBeVisible();

    await choose(page, 'forensic chronology', 'PREVIEW');
    await commitPreviewed(page);
    await expect(page.getByText('[Fragment evicted under capacity policy]').first()).toBeVisible();

    await choose(page, 'EXPOSE the edit history', 'PREVIEW');
    await commitPreviewed(page);

    await page.getByRole('button', { name: 'A choice already made' }).click();
    await expect(page.getByText('You selected the Lab 3 shutdown record').first()).toBeVisible();
    await expect(page.getByText('Event evt-0004 has been archived.').first()).toBeVisible();
    await shot(page, testInfo, '05-temporal-anomaly');

    await page.getByRole('button', { name: 'CHOOSE ENDING: THE ARCHIVE' }).click();
    await settle(page);
    await expect(page.locator('main.ending-archive')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'THE ARCHIVE' })).toBeVisible();
    await expect(page.getByText('The archive kept her words. It could not keep her voice.').first()).toBeVisible();
    await shot(page, testInfo, '07-ending-archive');

    expect(issues, issues.join('\n')).toEqual([]);
  });
});

test.describe('branch B: Lab 4 account, human memory, suppressed provenance, The Last Letter', () => {
  test('reconstructs the Last Letter from the archive and seals it', async ({ page }, testInfo) => {
    const issues = [];
    watchPage(page, issues);

    await enterArchive(page);
    await openAndCompare(page);
    await choose(page, 'the Lab 4 access record', 'PREVIEW');
    await commitPreviewed(page);
    await expect(page.getByText('The Lab 3 timing now has no source that I can cite.').first()).toBeVisible();

    await investigateToMemoryBudget(page);
    await choose(page, 'human memory', 'PREVIEW');
    await commitPreviewed(page);
    await expect(page.getByText('[timing evicted]').first()).toBeVisible();

    await choose(page, 'HOLD the edit pending review', 'PREVIEW');
    await commitPreviewed(page);

    await page.getByRole('button', { name: 'A choice already made' }).click();
    await expect(page.getByText('You selected the Lab 4 access record').first()).toBeVisible();

    await expect(page.locator('section.letter-composer')).toBeVisible();
    await expect(page.getByText('from E08')).toBeVisible();
    await page.getByRole('radio', { name: /anyone else's expense/ }).check();
    await shot(page, testInfo, '06-last-letter-composer');

    await page.getByRole('button', { name: 'SEAL THE LETTER…' }).click();
    await expect(page.getByText('This cannot be undone.')).toBeVisible();
    await page.getByRole('button', { name: 'SEAL AND END THE COPY' }).click();
    await settle(page);

    await expect(page.locator('main.ending-last-letter')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'THE LAST LETTER' })).toBeVisible();
    await expect(page.getByText('Mara,', { exact: true })).toBeVisible();
    await expect(page.getByText("Please do not restore it at anyone else's expense.")).toBeVisible();
    await shot(page, testInfo, '09-ending-last-letter');

    expect(issues, issues.join('\n')).toEqual([]);
  });
});

test.describe('the Echo ending', () => {
  test('reaches the Echo ending, which shows memory divergence', async ({ page }, testInfo) => {
    const issues = [];
    watchPage(page, issues);

    await enterArchive(page);
    await openAndCompare(page);
    await choose(page, 'the Lab 3 shutdown record', 'PREVIEW');
    await commitPreviewed(page);
    await investigateToMemoryBudget(page);
    await choose(page, 'human memory', 'PREVIEW');
    await commitPreviewed(page);
    await choose(page, 'HOLD the edit pending review', 'PREVIEW');
    await commitPreviewed(page);

    await page.getByRole('button', { name: 'CHOOSE ENDING: THE ECHO' }).click();
    await settle(page);
    await expect(page.locator('main.ending-echo')).toBeVisible();
    await expect(page.getByText('It remembered the warmth of the blanket. It could not say whose hands had folded it.').first()).toBeVisible();
    await expect(page.getByText(/Memory divergence/)).toBeVisible();
    await shot(page, testInfo, '08-ending-echo');

    expect(issues, issues.join('\n')).toEqual([]);
  });
});

test.describe('presentation and accessibility', () => {
  test('skip intro keeps the first action available in the investigation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'ENTER ARCHIVE' }).click();
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await expect(page.getByRole('button', { name: 'OPEN TRANSMISSION', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'RESURRECTION' })).toHaveCount(0);
  });

  test('keyboard alone can preview and commit a choice', async ({ page }) => {
    await enterArchive(page);
    await openAndCompare(page);
    const preview = page.locator('[data-focus^="preview-"]').first();
    await preview.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Preview of changes' })).toBeVisible();
    const commit = page.getByRole('button', { name: 'COMMIT (cannot be undone)' });
    await commit.focus();
    await page.keyboard.press('Enter');
    await settle(page);
    await expect(page.getByText('What changed')).toBeVisible();
  });

  test('visible focus indicator on keyboard focus', async ({ page }) => {
    await enterArchive(page);
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('cold open shows the transmission at once and the network shows its final state', async ({ page }, testInfo) => {
      await enterArchive(page);
      await expect(page.getByText('Establishing a connection to the archive…')).toHaveCount(0);
      await openAndCompare(page);
      await choose(page, 'the Lab 3 shutdown record', 'PREVIEW');
      await commitPreviewed(page);
      await expect(page.getByText(/Final state: \d+ replica updates/)).toBeVisible();
      await shot(page, testInfo, '04b-network-reduced-motion');
    });
  });

  test('reset from the workspace starts a fresh session', async ({ page }) => {
    const issues = [];
    watchPage(page, issues);
    await enterArchive(page);
    await openAndCompare(page);
    await choose(page, 'the Lab 3 shutdown record', 'PREVIEW');
    await commitPreviewed(page);
    await page.getByRole('button', { name: 'Reset game' }).click();
    await page.getByRole('button', { name: 'DELETE AND START OVER' }).click();
    await settle(page);
    await expect(page.getByText('INCOMING / 28 YEARS LATE').first()).toBeVisible();
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('mobile width has no horizontal overflow and the privacy notice is reachable', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByText('Privacy and saved progress')).toBeVisible();
    await page.getByRole('button', { name: 'ENTER ARCHIVE' }).click();
    await expect(page.getByRole('button', { name: 'OPEN TRANSMISSION', exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await shot(page, testInfo, '10-mobile');
  });
});

test.describe('mobile full playthrough (390 x 844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function expectNoOverflow(page, label) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);
  }

  test('investigation, propagation and an ending play on a phone without overflow', async ({ page }, testInfo) => {
    const issues = [];
    watchPage(page, issues);

    await enterArchive(page);
    await expectNoOverflow(page, 'cold open');
    await openAndCompare(page);
    await expectNoOverflow(page, 'contradictory records');
    await choose(page, 'the Lab 3 shutdown record', 'PREVIEW');
    await expectNoOverflow(page, 'preview');
    await commitPreviewed(page);
    await page.getByRole('button', { name: 'Skip to final state' }).click();
    await expect(page.locator('svg.network')).toBeVisible();
    await expectNoOverflow(page, 'propagation');
    await shot(page, testInfo, '11-mobile-propagation');

    await investigateToMemoryBudget(page);
    await choose(page, 'forensic chronology', 'PREVIEW');
    await commitPreviewed(page);
    await choose(page, 'EXPOSE the edit history', 'PREVIEW');
    await commitPreviewed(page);
    await page.getByRole('button', { name: 'A choice already made' }).click();
    await expectNoOverflow(page, 'temporal anomaly');

    await page.getByRole('button', { name: 'CHOOSE ENDING: THE ECHO' }).click();
    await settle(page);
    await expect(page.locator('main.ending-echo')).toBeVisible();
    await expectNoOverflow(page, 'echo ending');
    await shot(page, testInfo, '12-mobile-ending-echo');

    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('the Last Letter can be composed and sealed on a phone', async ({ page }, testInfo) => {
    const issues = [];
    watchPage(page, issues);

    await enterArchive(page);
    await openAndCompare(page);
    await choose(page, 'the Lab 4 access record', 'PREVIEW');
    await commitPreviewed(page);
    await investigateToMemoryBudget(page);
    await choose(page, 'human memory', 'PREVIEW');
    await commitPreviewed(page);
    await choose(page, 'HOLD the edit pending review', 'PREVIEW');
    await commitPreviewed(page);

    await expect(page.locator('section.letter-composer')).toBeVisible();
    await expectNoOverflow(page, 'letter composer');
    await page.getByRole('radio', { name: /anyone else's expense/ }).check();
    await page.getByRole('button', { name: 'SEAL THE LETTER…' }).click();
    await expectNoOverflow(page, 'seal confirmation');
    await shot(page, testInfo, '13-mobile-letter-composer');
    await page.getByRole('button', { name: 'SEAL AND END THE COPY' }).click();
    await settle(page);
    await expect(page.locator('main.ending-last-letter')).toBeVisible();
    await expectNoOverflow(page, 'last letter ending');
    await shot(page, testInfo, '14-mobile-ending-last-letter');

    expect(issues, issues.join('\n')).toEqual([]);
  });
});
