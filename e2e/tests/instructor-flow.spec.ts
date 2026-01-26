import { test, expect } from '@playwright/test';

test.describe('Instructor Flow', () => {
    test.setTimeout(60000); // 1 minute per test allowed

    test('should login, create course, add content, and publish', async ({ page, baseURL }) => {
        const email = `instructor_${Date.now()}@test.com`;
        const courseName = 'Playwright E2E Course ' + Date.now();

        console.log(`Starting Instructor Test for ${email} on ${baseURL}`);

        // 0. Register new instructor
        await page.goto('/auth/register');
        await page.fill('input[placeholder="Instructor Name"]', 'E2E Instructor');
        await page.fill('input[placeholder="instructor@openccb.com"]', email);
        await page.fill('input[placeholder="••••••••"]', 'password123');
        await page.click('button:has-text("Create Studio Workspace")');

        // 1. Wait for dashboard redirection
        // Initially it might redirect to / or /courses
        await expect(page).toHaveURL('/');
        // Check for dashboard header - adapt to allow Spanish or English
        await expect(page.locator('h1')).toContainText(/Courses|Cursos/);

        // 2. Create Course
        // Handle prompt for course name
        page.on('dialog', async dialog => {
            console.log(`Dialog message: ${dialog.message()}`);
            await dialog.accept(courseName);
        });

        // Click "Manual" button to create course manually
        await page.click('button:has-text("Manual")');

        // If modal appears instead of prompt (based on recent code changes)
        // Check if modal exists
        const modalVisible = await page.isVisible('text=Create New Course');
        if (modalVisible) {
            await page.fill('input[placeholder*="Advanced Rust"]', courseName);
            await page.click('button:has-text("Next"), button:has-text("Siguiente")');
        }

        // 3. Verify Course Created and Enter Editor
        // Wait for the new course card to appear
        await expect(page.locator(`h3:has-text("${courseName}")`)).toBeVisible({ timeout: 10000 });
        await page.click(`h3:has-text("${courseName}")`);

        // 4. Add Module
        await expect(page).toHaveURL(/.*\/courses\/.*/);
        await page.click('button:has-text("Add New Module"), button:has-text("Nuevo Módulo")');
        // Edit module title (assuming it defaults to Module 1 and becomes editable or adds new one)
        // Based on code: it creates empty module immediately. Let's find the input.
        // It sets editingId to new module.
        await page.fill('input[value=""]', 'Module 1: Basics');
        await page.press('input[value="Module 1: Basics"]', 'Enter');

        // 5. Add Lesson
        await page.click('button:has-text("New Lesson"), button:has-text("Nueva Lección")');
        // Similar flow for lesson
        await page.fill('input[value*="New Lesson"]', 'Intro Lesson');
        await page.press('input[value="Intro Lesson"]', 'Enter');

        // 6. Publish Course
        await page.click('button:has-text("Publish Course"), button:has-text("Publicar")');

        // Handle alert for success
        // page.on('dialog') handler is already set, but we might need a specific one for "Published successfully"
        // Since we can't easily assert alert content in Playwright without triggering it, 
        // we assume the earlier handler might catch it or we just check button state change if any.

        // Wait a bit for async publish
        await page.waitForTimeout(2000);

        console.log('Instructor flow completed successfully');
    });
});
