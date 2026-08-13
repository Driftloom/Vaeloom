const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[console:${m.type()}] ${m.text()}`));
  page.on('requestfailed', r => logs.push(`[failed] ${r.url()} :: ${r.failure()?.errorText}`));
  page.on('response', r => {
    if (r.url().includes('8001')) logs.push(`[resp ${r.status()}] ${r.url()}`);
  });
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'test@vaeloom.ai');
  await page.fill('input[type="password"]', 'password123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForTimeout(10000);
  logs.push('[final-url] ' + page.url());
  console.log(logs.join('\n'));
  await browser.close();
})();