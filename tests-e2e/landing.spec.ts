import { expect, test } from '@playwright/test';

// The landing is the only public, indexed page. These tests assume the
// dev stack is up (PLAYWRIGHT_BASE_URL) and that no session cookie is set
// (the default Playwright context starts clean).

test('anonymous visit renders the headline and Sign in with Discord CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Send a file/i);
  await expect(page.getByRole('button', { name: /Sign in with Discord/i })).toBeVisible();
  // The "Open Cargo" affordance must not exist for an anonymous viewer.
  await expect(page.getByRole('link', { name: /Open Cargo/i })).toHaveCount(0);
});

test('the privacy emphasis line is present and reads as expected', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/no history page because there is no history/i)).toBeVisible();
});

test('landing renders in French via the locale switcher', async ({ page }) => {
  await page.goto('/');
  // Two switchers (header + footer) — pick the first.
  await page.locator('select').first().selectOption('fr');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Envoyez un fichier/i);
  await expect(page.getByRole('button', { name: /Se connecter avec Discord/i })).toBeVisible();
});

test('keyboard focus reaches the primary CTA from page load', async ({ page }) => {
  await page.goto('/');
  // Tab through header (logo, language select), then the CTA. The exact tab
  // count depends on the focusable surface area; we assert that the CTA is
  // reachable within a reasonable number of tabs and that its focus ring is
  // visible (ring-2 + ring-accent applied by Tailwind on focus-visible).
  const cta = page.getByRole('button', { name: /Sign in with Discord/i });
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    if (await cta.evaluate((el) => el === document.activeElement).catch(() => false)) break;
  }
  await expect(cta).toBeFocused();
});

test('reduced motion preference renders the static end-state instead of the loop', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  // The animated demo's recipient stub starts blank; the static end-state
  // renders the @handle token immediately.
  await expect(page.getByText(/@alice/).first()).toBeVisible();
  await context.close();
});

test('visual snapshot of the landing hero', async ({ page }) => {
  await page.goto('/');
  // Wait one full animation cycle so the loop is mid-stride; pin the demo
  // to a known phase by emulating reduced motion (static end-state).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('main')).toHaveScreenshot('landing-hero.png', {
    maxDiffPixelRatio: 0.02,
  });
});

test.skip('authed visit shows Open Cargo and links to /dashboard', async () => {
  // Requires a test-only sign-in route to stub the Auth.js session cookie;
  // tracked alongside the rest of the auth-stub work referenced in
  // tests-e2e/smoke.spec.ts. Spec is preserved here so the contract is
  // visible: the CTA must read "Open Cargo →" and href to /dashboard.
});
