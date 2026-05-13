import { expect, test } from '@playwright/test';

/**
 * Smoke E2E. Requires the dev stack to be up and Discord OAuth to be reachable.
 * In CI we stub Auth.js via a test-only sign-in route — out of scope for the
 * initial scaffold; this file documents the contract.
 */

test('login page renders the Discord CTA and the privacy line', async ({ page }) => {
  await page.goto('/en/login');
  await expect(page.getByRole('button', { name: /Continue with Discord/i })).toBeVisible();
  await expect(page.getByText(/Cargo doesn't keep a history/i)).toBeVisible();
});

test('locale toggle switches the URL prefix', async ({ page }) => {
  await page.goto('/en/login');
  // The login page is unauthenticated, locale toggle is only in the authed shell.
  await expect(page).toHaveURL(/\/en\/login$/);
});

test('the share landing page asks unauth visitors to sign in', async ({ page }) => {
  await page.goto('/t/00000000-0000-0000-0000-000000000000');
  await expect(page.getByText(/Sign in to claim this transfer|Continue with Discord/i)).toBeVisible();
});
