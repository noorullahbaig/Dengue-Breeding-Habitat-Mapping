const fs = require('fs');
const path = require('path');

const docsDir = '/Users/noorullah/Developer/prototype/docs';
const files = fs.readdirSync(docsDir).filter(f => f.startsWith('wireframe_') && f.endsWith('.html'));

const svgIcons = {
    camera: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>`,
    search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    alert: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; color: #d9534f;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    link: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
    map: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>`,
    pin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    shield: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 15px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    imgPlaceholder: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`
};

files.forEach(file => {
    // Skip the sample file
    if (file === 'wireframe_sample_clean.html') return;
    
    let content = fs.readFileSync(path.join(docsDir, file), 'utf8');

    // 1. Swap Font to standard Sans-Serif
    content = content.replace(/@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Caveat:wght@400;700&display=swap'\);/g, '');
    content = content.replace(/font-family:\s*'Caveat',\s*cursive,\s*sans-serif;/g, 'font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;');
    
    // 2. Add Phone Skeleton styling to .device
    content = content.replace(/\.device\s*{[^}]+}/, `.device {
            width: 320px;
            height: 600px;
            border: 12px solid #333;
            border-radius: 36px;
            background-color: #fff;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 15px 35px rgba(0,0,0,0.15);
        }
        
        /* iPhone Notch */
        .device::before {
            content: '';
            position: absolute;
            top: -1px;
            left: 50%;
            transform: translateX(-50%);
            width: 120px;
            height: 25px;
            background-color: #333;
            border-bottom-left-radius: 16px;
            border-bottom-right-radius: 16px;
            z-index: 1000;
        }`);

    // 3. Add padding-top to elements that sit behind the notch
    content = content.replace(/\.header\s*{/g, '.header {\n            padding-top: 35px;');
    content = content.replace(/\.lookup-container\s*{/g, '.lookup-container {\n            padding-top: 40px;');
    content = content.replace(/\.dashboard-header\s*{/g, '.dashboard-header {\n            padding-top: 35px;');
    content = content.replace(/\.map-ui\s*{/g, '.map-ui {\n            padding-top: 35px;');
    content = content.replace(/\.nav-block\s*{/g, '.nav-block {\n            margin-top: 35px;');
    
    // 4. Soften thick borders globally by replacing 2px with 1px where appropriate
    content = content.replace(/border:\s*2px\s*solid\s*#333;/g, 'border: 1px solid #999;');
    content = content.replace(/border-bottom:\s*2px\s*solid\s*#333;/g, 'border-bottom: 1px solid #ccc;');
    content = content.replace(/border-top:\s*2px\s*solid\s*#333;/g, 'border-top: 1px solid #ccc;');
    content = content.replace(/border-right:\s*2px\s*solid\s*#333;/g, 'border-right: 1px solid #ccc;');
    content = content.replace(/border:\s*2px\s*dashed\s*#999;/g, 'border: 1px dashed #aaa;');
    
    // 5. Buttons Update
    content = content.replace(/\.btn-primary\s*{[^}]+}/, `.btn-primary {
            width: 100%;
            border: 1px solid #444;
            padding: 12px;
            font-size: 16px;
            font-family: inherit;
            border-radius: 6px;
            background-color: #444;
            color: #fff;
            font-weight: 500;
            cursor: pointer;
        }`);
        
    // 6. Replace text bracket icons with clean SVGs
    content = content.replace(/\[\s*Camera Icon\s*\]/gi, svgIcons.camera);
    content = content.replace(/\[\s*Search Icon\s*\]/gi, svgIcons.search);
    content = content.replace(/\[\s*Alert Icon\s*\]/gi, svgIcons.alert);
    content = content.replace(/\[\s*Link\s*\]/gi, svgIcons.link);
    content = content.replace(/\[\s*Map Icon\s*\]/gi, svgIcons.map);
    content = content.replace(/\[\s*Icon\s*\]/gi, svgIcons.pin);
    content = content.replace(/\[\s*Shield Icon\s*\]/gi, svgIcons.shield);
    
    // Step 1 specific fix for image placeholder
    content = content.replace(/<div class="image-placeholder">\s*\[Image\]\s*<\/div>/g, 
        `<div class="image-placeholder" style="display:flex; flex-direction:column; justify-content:center; align-items:center; gap:10px; color:#aaa; font-weight:normal;">
            ${svgIcons.imgPlaceholder}
            <span style="font-size: 14px;">Image Upload Area</span>
        </div>`);
        
    // Dashboard thumb fix
    content = content.replace(/<div class="evidence-thumb">\[Img\]<\/div>/g, 
        `<div class="evidence-thumb">${svgIcons.imgPlaceholder}</div>`);
        
    fs.writeFileSync(path.join(docsDir, file), content, 'utf8');
    console.log(`Upgraded style + Phone Skeleton on: ${file}`);
});
