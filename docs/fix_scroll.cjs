const fs = require('fs');
const path = require('path');

const docsDir = '/Users/noorullah/Developer/prototype/docs';

// Find all HTML wireframe files
const files = fs.readdirSync(docsDir).filter(f => f.startsWith('wireframe_') && f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(docsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove any scrolling properties to enforce clipping
    content = content.replace(/overflow-y:\s*(auto|scroll);/g, '');
    content = content.replace(/overflow-x:\s*auto;/g, '');
    content = content.replace(/overflow:\s*(auto|scroll);/g, '');

    // Ensure the main device container is strictly hidden (clipping the bottom)
    // Find .device { ... } and ensure it has overflow: hidden;
    if (content.includes('.device {') && !content.includes('overflow: hidden;')) {
        content = content.replace(/\.device\s*{/, '.device {\n            overflow: hidden;');
    }
    
    // Explicitly target some known containers just in case
    content = content.replace(/\.content\s*{[^}]*overflow-y:\s*auto;[^}]*}/g, (match) => {
        return match.replace(/overflow-y:\s*auto;/, '');
    });
    
    // Fix consent form scroll box so it just clips statically
    if (file === 'wireframe_step3.html') {
        content = content.replace(/overflow-y:\s*scroll;/g, 'overflow: hidden;');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Enforced static clipping on: ${file}`);
});
