import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';

console.log("Starting server...");
const server = spawn('npm', ['run', 'dev', '--', '--port', '5177', '--strictPort'], { stdio: 'inherit' });

async function waitForServer(url) {
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode === 200) resolve();
          else reject();
        });
        req.on('error', reject);
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

(async () => {
  console.log("Waiting for Vite server to be ready...");
  const isReady = await waitForServer('http://localhost:5177');
  if (!isReady) {
    console.error("Vite server did not start in time.");
    server.kill();
    process.exit(1);
  }

  console.log("Launching browser...");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 12/13/14
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  
  const page = await context.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log("Navigating to http://localhost:5177...");
  try {
    await page.goto('http://localhost:5177');
    
    console.log("Waiting a bit for map to settle...");
    await page.waitForTimeout(5000);

    console.log("Taking screenshot...");
    await page.screenshot({ path: '/Users/noorullah/.gemini/antigravity/brain/3b999558-0a8d-4382-9c71-ec92eb2e7cee/map-screenshot.png' });
    console.log("Screenshot saved.");
  } catch (error) {
    console.error("Error taking screenshot:", error);
  } finally {
    await browser.close();
    server.kill();
    process.exit(0);
  }
})();
