const fs = require('fs');
const path = require('path');

const docsDir = '/Users/noorullah/Developer/prototype/docs';

// Find all HTML wireframe files
const files = fs.readdirSync(docsDir).filter(f => f.startsWith('wireframe_') && f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(docsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Remove custom web scrollbars (irrelevant for print)
    content = content.replace(/\/\* Custom Scrollbar[^*]*\*\//gi, '');
    content = content.replace(/\.device::-webkit-scrollbar[^{]*{[^}]*}[\s\n]*/g, '');

    // 2. Remove physical device hardware bezels (shadows, rounded corners, thick borders)
    // We want a clean, flat academic bounding box.
    content = content.replace(/border-radius:\s*30px;/g, 'border-radius: 0px;');
    content = content.replace(/border:\s*4px\s*solid\s*#333;/g, 'border: 2px solid #333;');
    content = content.replace(/box-shadow:\s*10px\s*10px\s*0px\s*rgba\(0,0,0,0\.1\);/g, 'box-shadow: none;');

    // 3. Remove non-grayscale colors from badges (strict wireframe theory)
    content = content.replace(/background-color:\s*#ffd6d6;/gi, 'background-color: #e0e0e0;');
    content = content.replace(/background-color:\s*#ffe8b3;/gi, 'background-color: #eeeeee;');
    content = content.replace(/background-color:\s*#fff0d4;/gi, 'background-color: #eeeeee;');
    
    // Also remove the scrollbar-track from step3
    content = content.replace(/<div class="scrollbar-track"><div class="scrollbar-thumb"><\/div><\/div>/g, '');
    content = content.replace(/\.scrollbar-track[^{]*{[^}]*}[\s\n]*/g, '');
    content = content.replace(/\.scrollbar-thumb[^{]*{[^}]*}[\s\n]*/g, '');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Sanitized: ${file}`);
});
