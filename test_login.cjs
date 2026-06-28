const { chromium } = require('playwright');

(async () => {
  console.log("Starting browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`));
  page.on('pageerror', error => console.error(`[Browser PageError]: ${error.message}`));
  page.on('request', request => console.log(`[Network Req]: ${request.url()}`));

  console.log("Navigating to http://localhost:5173/login ...");
  await page.goto('http://localhost:5173/login');
  
  console.log("Waiting for network idle...");
  await page.waitForLoadState('networkidle');

  console.log("Clicking 'Continue with Google' button...");
  await page.click('button:has-text("Continue with Google")');

  console.log("Waiting 3 seconds to see what happens...");
  await page.waitForTimeout(3000);
  
  console.log(`Final URL: ${page.url()}`);
  
  const content = await page.content();
  if (content.includes('Failed to initiate')) {
    console.log("Found error text on screen!");
  }

  await browser.close();
})();
