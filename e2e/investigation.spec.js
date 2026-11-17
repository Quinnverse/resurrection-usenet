// Browser end-to-end checks (Playwright). Run with `npm run test:e2e`.
// The server is started by playwright.config.js on a fixed port with a temporary save directory.
// Each test gets a fresh browser context (empty localStorage) and therefore a fresh server session.

const { test, expect } = require('@playwright/test');

const SHOTS = 'e2e-screenshots';

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

async function openArchive(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER ARCHIVE' }).click();
  await expect(page.getByText('INCOMING / 28 YEARS LATE').first()).toBeVisible();
  await act(page, 'OPEN TRANSMISSION');
  await act(page, 'INSPECT HEADER: Shutdown report, Lab 3');
  await act(page, 'INSPECT HEADER: Access report, Lab 4');
  await expect(page.getByText('Header comparison: Lab 3 against Lab 4')).toBeVisible();
}

async function investigateToMemoryBudget(page) {
  await act(page, 'TRACE RELAY: Elena cache (NODE-02)');
  await act(page, 'INSPECT MAINTENANCE LOG');
  await act(page, 'RECONSTRUCT MAILBOX INDEX');
  await act(page, 'TRACE PROVENANCE');
  await act(page, 'TRACE RELAY: Lab 4 log (NODE-04)');
}

test.describe('branch A: Lab 3 account, forensic memory, exposed provenance, The Archive', () => {
  test('plays to ending and shows evidence from the event log', async ({ page }, testInfo) => {
    const issues = [];
    watchPage(page, issues);

    await openArchive(page);
    await page.screenshot({ path: testInfo.outputPath('01-header-comparison.png'), fullPage: true });

    await choose(page, 'the Lab 3 shutdown record', 'PREVIEW');
    await expect(page.getByText(/Preview: this change would alter \d+ values/)).toBeVisible();
    await commitPreviewed(page);
    await expect(page.getByText('You selected a record. You did not establish a fact.').first()).toBeVisible();
    await expect(page.getByText('Incident summary (Archivist)').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('02-commit-branch-a.png'), fullPage: true });

    await investigateToMemoryBudget(page);

    const revisionBefore = await page.getByText(/Revision \d+/).first().innerText();
    await page.reload();
    await expect(page.getByText(revisionBefore)).toBeVisible();
    await expect(page.getByText('ACT 2').first()).toBeVisible();

    await choose(page, 'forensic chronology', 'PREVIEW');
    await commitPreviewed(page);
    await expect(page.getByText('[Fragment evicted under capacity policy]').first()).toBeVisible();

    await choose(page, 'EXPOSE the edit history', 'PREVIEW');
    await commitPreviewed(page);

    await page.getByRole('button', { name: 'A choice already made' }).click();
    await expect(page.getByText('You selected the Lab 3 shutdown record').first()).toBeVisible();
    await expect(page.getByText('Event evt-0004 has been archived.').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('03-anomaly-branch-a.png'), fullPage: true });

    await page.getByRole('button', { name: 'CHOOSE ENDING: THE ARCHIVE' }).click();
    await settle(page);
    await expect(page.getByRole('heading', { name: 'THE ARCHIVE' })).toBeVisible();
    await expect(page.getByText('The archive kept her words. It could not keep her voice.').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('04-ending-archive.png'), fullPage: true });

    expect(issues, issues.join('\n')).toEqual([]);
  });
});

test.describe('branch B: Lab 4 account, human memory, suppressed provenance, The Last Letter', () => {
  test('plays to the gated ending and shows the letter', async ({ page }, testInfo) => {
    const issues = [];
    watchPage(page, issues);

    await openArchive(page);
    await choose(page, 'the Lab 4 access record', 'PREVIEW');
    await commitPreviewed(page);
    await expect(page.getByText('The Lab 3 timing now has no source that I can cite.').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('05-commit-branch-b.png'), fullPage: true });

    await investigateToMemoryBudget(page);

    await choose(page, 'human memory', 'PREVIEW');
    await commitPreviewed(page);
    await expect(page.getByText('[timing evicted]').first()).toBeVisible();

    await choose(page, 'HOLD the edit pending review', 'PREVIEW');
    await commitPreviewed(page);

    await page.getByRole('button', { name: 'A choice already made' }).click();
    await expect(page.getByText('You selected the Lab 4 access record').first()).toBeVisible();

    await page.getByRole('button', { name: 'CHOOSE ENDING: THE LAST LETTER' }).click();
    await settle(page);
    await expect(page.getByRole('heading', { name: 'THE LAST LETTER' })).toBeVisible();
    await expect(page.getByText('Mara,', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('06-ending-last-letter.png'), fullPage: true });

    expect(issues, issues.join('\n')).toEqual([]);
  });
});

test.describe('recovery and layout', () => {
  test('reset from the workspace starts a fresh session', async ({ page }) => {
    const issues = [];
    watchPage(page, issues);
    await openArchive(page);
    await choose(page, 'the Lab 3 shutdown record', 'PREVIEW');
    await commitPreviewed(page);
    await page.getByRole('button', { name: 'Reset game' }).click();
    await page.getByRole('button', { name: 'DELETE AND START OVER' }).click();
    await settle(page);
    await expect(page.getByText('INCOMING / 28 YEARS LATE').first()).toBeVisible();
    await expect(page.getByText('Revision 0')).toBeVisible();
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('mobile width has no horizontal overflow', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByText('Privacy and saved progress')).toBeVisible();
    await page.getByRole('button', { name: 'ENTER ARCHIVE' }).click();
    await expect(page.getByRole('button', { name: 'OPEN TRANSMISSION', exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('07-mobile-first-screen.png'), fullPage: true });
  });
});
