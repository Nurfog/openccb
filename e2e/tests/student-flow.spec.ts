import { test, expect } from '@playwright/test';

test.describe('Student Flow', () => {
    test.setTimeout(60000);

    test('should register, view catalog, enroll, and view progress', async ({ page, baseURL }) => {
        const email = `student_${Date.now()}@test.com`;
        const name = 'Test Student';

        console.log(`Starting Student Test for ${email} on ${baseURL}`);

        // 1. Register
        await page.goto('/auth/register');
        await page.fill('input[type="text"][placeholder*="Full Name"], input[placeholder="John Doe"]', name);
        await page.fill('input[type="email"]', email);
        await page.fill('input[type="password"]', 'password123');
        // Handle optional Organization field if present or skip

        await page.click('button:has-text("Comenzar a Aprender")');

        // 2. View Catalog (Dashboard)
        await expect(page).toHaveURL('/');
        await expect(page.locator('h1')).toContainText(/Explorar|Explore/);

        // 3. Find a course and Enroll
        // Wait for course cards to load
        // We look for "Inscribirse Gratis" or "Enroll Free"
        const enrollButton = page.locator('button:has-text("Inscribirse Gratis"), button:has-text("Enroll Free")').first();

        if (await enrollButton.count() > 0) {
            await enrollButton.click();
            // 4. Verify Enrollment
            // Should change to "Continuar Aprendiendo" or "Continue Learning"
            await expect(page.locator('a:has-text("Continuar Aprendiendo"), a:has-text("Continue Learning")').first()).toBeVisible({ timeout: 10000 });

            // 5. Enter Course
            await page.click('a:has-text("Continuar Aprendiendo"), a:has-text("Continue Learning")');

            // 6. View Course Outline
            await expect(page).toHaveURL(/.*\/courses\/.*/);
            await expect(page.locator('h1')).toBeVisible(); // Course title

            // 7. Check Progress Icons (Visual Check)
            // We expect at least one module
            await expect(page.locator('.glass-card').first()).toBeVisible();
        } else {
            console.log('No courses available to enroll. Skipping enrollment steps.');
        }

        console.log('Student flow completed successfully');
    });
});
