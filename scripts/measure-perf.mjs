import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targetUrl = process.argv[2];
if (!targetUrl) process.exit(1);

const originalEvidence = readFileSync(
  resolve(process.cwd(), 'src/assets/learn/habitat-tire.webp')
);
const largeEvidenceImage = Buffer.concat(Array(30).fill(originalEvidence));

(async () => {
  console.log(`Starting REAL-WORLD UI test against: ${targetUrl}`);
  console.log(`- Measuring total time from the exact moment upload begins.`);
  console.log(`- Throttling network to "Slow 3G" (240 Kbps) to perfectly simulate`);
  console.log(`  the combined delay of an older phone CPU + cellular upload.\n`);
  
  const browser = await chromium.launch();
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 3.139, longitude: 101.6869, accuracy: 20 },
    viewport: { width: 390, height: 844 }
  });
  
  const page = await context.newPage();

  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (1.5 * 1024 * 1024) / 8, 
    uploadThroughput: (240 * 1024) / 8, // ~30 KB/s (Slow mobile upload)
    latency: 150,
  });

  const iterations = 5; 
  const times = [];

  for (let i = 1; i <= iterations; i++) {
    process.stdout.write(`Upload ${i}/${iterations}... `);
    try {
      await page.goto(`${targetUrl}/report`);
      
      await page.locator('input[type="file"]').first().setInputFiles({
        name: 'heavy-evidence.webp',
        mimeType: 'image/webp',
        buffer: largeEvidenceImage,
      });
      
      await page.getByRole('button', { name: 'Use photo & continue' }).click();
      await page.getByRole('button', { name: 'Share My Location' }).click();
      
      // >>> START TIMING HERE <<<
      // This is the exact moment the API call starts in the background.
      const startTime = performance.now();
      
      await page.getByRole('button', { name: 'Confirm this exact site' }).click();
      
      // Instantly click through the consent form (like a user rushing through)
      const consentBody = page.locator('[aria-label="Public consent text"]');
      await consentBody.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        element.dispatchEvent(new Event('scroll', { bubbles: true }));
      });
      await page.locator('input[type="checkbox"]').check();
      
      // Wait for the AI result panel to finally appear
      await page.getByText(/AI results are advisory/i).waitFor({ state: 'visible', timeout: 120000 });
      
      const endTime = performance.now();
      const durationMs = endTime - startTime;
      times.push(durationMs);
      
      console.log(`${(durationMs / 1000).toFixed(1)}s total perceived wait time`);
    } catch (error) {
      console.log(`Failed! ${error.message.split('\n')[0]}`);
    }
  }

  await browser.close();

  if (times.length > 0) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log('\n--- Real-World Simulation Results ---');
    console.log(`Average Total User Wait Time: ${(avg / 1000).toFixed(1)} seconds`);
  }
})();
