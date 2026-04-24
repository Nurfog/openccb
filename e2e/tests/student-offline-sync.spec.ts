import { test, expect } from '@playwright/test';

test.describe('Student Offline Sync Flow', () => {
    test('should keep pending mutations offline and sync them when back online', async ({ page, context }) => {
        const offlineQueue = [
            {
                id: 'q-grade-1',
                dedupeKey: 'POST:/grades:{"user_id":"u1","course_id":"c1","lesson_id":"l1","score":0.9,"metadata":{}}',
                kind: 'grade',
                url: '/grades',
                method: 'POST',
                isCMS: false,
                body: JSON.stringify({ user_id: 'u1', course_id: 'c1', lesson_id: 'l1', score: 0.9, metadata: {} }),
                createdAt: new Date().toISOString(),
            },
            {
                id: 'q-interaction-1',
                dedupeKey: 'POST:/lessons/l1/interactions:{"event_type":"heartbeat","video_timestamp":21}',
                kind: 'interaction',
                url: '/lessons/l1/interactions',
                method: 'POST',
                isCMS: false,
                body: JSON.stringify({ event_type: 'heartbeat', video_timestamp: 21 }),
                createdAt: new Date().toISOString(),
            },
        ];

        await page.addInitScript((queue) => {
            localStorage.setItem('experience_offline_mutation_queue_v1', JSON.stringify(queue));
            localStorage.setItem('experience_offline_sync_meta_v1', JSON.stringify({
                lastSyncAt: null,
                lastFlushedCount: 0,
                lastError: null,
            }));
        }, offlineQueue);

        await page.goto('/auth/login');

        // Open sync panel details.
        await page.getByRole('button', { name: /sync offline/i }).click();

        // Simulate offline mode; pending should remain after manual sync attempt.
        await context.setOffline(true);
        await page.getByRole('button', { name: /sincronizar ahora/i }).click();
        await expect(page.getByText(/2 pendiente/i)).toBeVisible();

        let gradesHits = 0;
        let interactionsHits = 0;

        await context.setOffline(false);

        await page.route('**/lms-api/grades', async (route) => {
            gradesHits += 1;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'grade-server-1',
                    user_id: 'u1',
                    course_id: 'c1',
                    lesson_id: 'l1',
                    score: 0.9,
                    attempts_count: 1,
                    metadata: {},
                    created_at: new Date().toISOString(),
                }),
            });
        });

        await page.route('**/lms-api/lessons/l1/interactions', async (route) => {
            interactionsHits += 1;
            await route.fulfill({ status: 204, body: '' });
        });

        await page.getByRole('button', { name: /sincronizar ahora/i }).click();

        await expect.poll(async () => {
            return await page.evaluate(() => {
                const raw = localStorage.getItem('experience_offline_mutation_queue_v1');
                const queue = raw ? JSON.parse(raw) : [];
                return queue.length;
            });
        }).toBe(0);

        expect(gradesHits).toBe(1);
        expect(interactionsHits).toBe(1);
        await expect(page.getByText(/0 pendientes|0 pendiente/i)).toBeVisible();
    });
});
