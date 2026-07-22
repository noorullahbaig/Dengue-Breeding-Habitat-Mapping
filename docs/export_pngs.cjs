const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const docsDir = '/Users/noorullah/Developer/prototype/docs';
const exportDir = path.join(docsDir, 'exports');

(async () => {
    console.log('Starting Headless Export Pipeline...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const files = fs.readdirSync(docsDir).filter(f => f.startsWith('wireframe_') && f.endsWith('.html') && !f.includes('sample'));

    for (const file of files) {
        const page = await browser.newPage();
        
        // 2x scale for Retina PDF clarity. Large viewport to ensure everything fits.
        await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });
        
        const filePath = 'file://' + path.join(docsDir, file);
        await page.goto(filePath, { waitUntil: 'networkidle0' });
        
        // Calculate the exact bounding box of all devices to perfectly crop the image
        const boundingBox = await page.evaluate(() => {
            // Some files use .device-wrapper for side-by-side screens, others just use .device
            const wrappers = Array.from(document.querySelectorAll('.device-wrapper'));
            const targets = wrappers.length > 0 ? wrappers : Array.from(document.querySelectorAll('.device'));
            
            if (targets.length === 0) return null;
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            targets.forEach(w => {
                const rect = w.getBoundingClientRect();
                minX = Math.min(minX, rect.left);
                minY = Math.min(minY, rect.top);
                maxX = Math.max(maxX, rect.right);
                maxY = Math.max(maxY, rect.bottom);
            });
            
            // Add a clean 30px padding around the combined bounding box
            const padding = 30;
            return {
                x: Math.max(0, minX - padding),
                y: Math.max(0, minY - padding),
                width: maxX - minX + (padding * 2),
                height: maxY - minY + (padding * 2)
            };
        });

        if (boundingBox) {
            const outPath = path.join(exportDir, file.replace('.html', '.png'));
            await page.screenshot({
                path: outPath,
                clip: boundingBox
            });
            console.log(`Exported perfectly cropped PNG: ${outPath}`);
        } else {
            console.log(`Could not find devices in ${file}`);
        }
        
        await page.close();
    }

    await browser.close();
    console.log('All wireframes successfully exported as high-res PNGs.');
})();
