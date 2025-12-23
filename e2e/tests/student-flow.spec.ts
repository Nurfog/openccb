import { test, expect } from '@playwright/test';

test.describe('Student Flow', () => {
    test('should login and view catalog', async ({ page }) => {
        // 1. Register/Login
        // For simplicity, we assume registration or reuse existing
        await page.goto('/auth/login');

        // Register link?
        // await page.click('text=Sign up');
        // ... fill registration ...

        // OR just login if we seed the DB. 
        // For E2E on fresh DB, we might need to register first.

        // Let's try to register a new user every time to be safe
        // Let's try to register a new user every time to be safe
        const email = `student_${Date.now()}@test.com`;
        await page.goto('/auth/register');
        await page.fill('[placeholder="John Doe"]', 'Test Student');
        await page.fill('[placeholder="name@company.com"]', email);
        await page.fill('[placeholder="••••••••"]', 'password123');
        await page.click('button[type="submit"]');

        // Should redirect to dashboard/catalog
        await expect(page).toHaveURL('/', { timeout: 15000 });
        await expect(page.locator('h1')).toContainText('Available Courses', { timeout: 10000 });

        // Check if the course from instructor flow is visible (might need refresh)
        await page.reload();
        // await expect(page.locator('text=Playwright E2E Course')).toBeVisible();
    });
});
