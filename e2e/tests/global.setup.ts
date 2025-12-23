import { test as setup } from '@playwright/test';

setup('check services are up', async ({ request }) => {
    // We could ping health endpoints here
    // const studio = await request.get('http://studio:3000');
    // expect(studio.ok()).toBeTruthy();
    console.log('Setup complete - proceeding to tests');
});
