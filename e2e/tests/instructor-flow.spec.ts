import { test, expect } from '@playwright/test';

test.describe('Instructor Flow', () => {
    test('should login, create course, add content, and publish', async ({ page }) => {
        const email = `instructor_${Date.now()}@test.com`;

        // 0. Register (since DB might be empty)
        await page.goto('/auth/register');
        await page.fill('[placeholder="Instructor Name"]', 'E2E Instructor');
        await page.fill('[placeholder="instructor@openccb.com"]', email); // or input[type="email"]
        await page.fill('[placeholder="••••••••"]', 'password123'); // or input[type="password"]
        await page.click('button[type="submit"]');

        // Wait for navigation - Register automatically logs in and redirects to /
        // Increase timeout for cold starts in CI/Docker
        await expect(page).toHaveURL('/', { timeout: 15000 });

        // Verify dashboard loaded
        await expect(page.locator('h2')).toContainText('My Courses', { timeout: 10000 });

        // 2. Create Course
        // Usamos manejador de dialogo para el prompt
        const courseName = 'Playwright E2E Course ' + Date.now();
        page.on('dialog', dialog => dialog.accept(courseName));
        await page.click('button:has-text("New Course")');

        // Esperar a que aparezca el nuevo curso y hacer clic
        await page.waitForTimeout(1000); // Wait for API
        await page.click('text=Playwright E2E Course');

        // 3. Add Module
        await page.click('button:has-text("Add Module")');
        await page.fill('[placeholder="Module Title"]', 'Module 1: Basics');
        await page.click('button:has-text("Create Module")');

        // 4. Add Lesson
        await page.click('button:has-text("Add Lesson")');
        await page.fill('[placeholder="Lesson Title"]', 'Intro Lesson');
        // Select video type (assuming it's default or select dropdown)
        await page.click('button:has-text("Create Lesson")');

        // 5. Publish
        await page.click('button:has-text("Publish Course")');

        // Confirm publish
        // Assuming there is a confirmation or toast
        // await expect(page.locator('text=Published successfully')).toBeVisible();
    });
});
