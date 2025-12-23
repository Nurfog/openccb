import { defineConfig, devices } from '@playwright/test';

// Use environment variables for base URLs, with fallbacks for local dev vs docker
const STUDIO_URL = process.env.STUDIO_URL || 'http://studio:3000';
const EXPERIENCE_URL = process.env.EXPERIENCE_URL || 'http://experience:3003';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'setup',
            testMatch: /global\.setup\.ts/,
        },
        {
            name: 'studio',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: STUDIO_URL,
            },
            testMatch: /.*instructor.*\.spec\.ts/,
            dependencies: ['setup'],
        },
        {
            name: 'experience',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: EXPERIENCE_URL,
            },
            testMatch: /.*student.*\.spec\.ts/,
            dependencies: ['setup'],
        },
    ],
});
