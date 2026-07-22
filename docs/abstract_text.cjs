const fs = require('fs');
const path = require('path');
const docsDir = '/Users/noorullah/Developer/prototype/docs';

// Step 1
let content1 = fs.readFileSync(path.join(docsDir, 'wireframe_step1.html'), 'utf8');
content1 = content1.replace('Step 1: Take Image', 'Step 1: Primary Action');
content1 = content1.replace('Add a clear image of the breeding habitat.', 'Instructional text describing the required user action.');
content1 = content1.replace('Use photo &amp; continue', 'Primary CTA Label');
content1 = content1.replace('Use photo & continue', 'Primary CTA Label');
content1 = content1.replace('Retake photo', 'Secondary CTA Label');
fs.writeFileSync(path.join(docsDir, 'wireframe_step1.html'), content1, 'utf8');

// Step 2
let content2 = fs.readFileSync(path.join(docsDir, 'wireframe_step2.html'), 'utf8');
content2 = content2.replace('Step 2: Confirm Location', 'Step 2: Location Context');
content2 = content2.replace('Drag the pin to the exact location.', 'Instructional text for map interaction.');
content2 = content2.replace('Jalan Kerinchi, Bangsar South', 'Reverse Geocoded Address String');
content2 = content2.replace('Confirm Location', 'Primary CTA Label');
fs.writeFileSync(path.join(docsDir, 'wireframe_step2.html'), content2, 'utf8');

// Step 3
let content3 = fs.readFileSync(path.join(docsDir, 'wireframe_step3.html'), 'utf8');
content3 = content3.replace('Step 3: Anonymity &amp; Consent', 'Step 3: Legal & Consent');
content3 = content3.replace('Step 3: Anonymity & Consent', 'Step 3: Legal & Consent');
content3 = content3.replace(/By submitting this report you agree that:\s*<\/p>\s*<ul[^>]*>[\s\S]*?<\/ul>/, 'Standard legal disclaimer text (Lorem ipsum dolor sit amet, consectetur adipiscing elit).');
content3 = content3.replace('I agree to the terms', 'Consent Confirmation Statement');
content3 = content3.replace('Submit Report Anonymously', 'Primary CTA Label');
fs.writeFileSync(path.join(docsDir, 'wireframe_step3.html'), content3, 'utf8');

// Step 4
let content4 = fs.readFileSync(path.join(docsDir, 'wireframe_step4.html'), 'utf8');
content4 = content4.replace('Step 4: AI Triage', 'Step 4: Automated Review');
content4 = content4.replace('Analyzing image for habitat classification...', 'System processing indicator message...');
content4 = content4.replace('AI analysis complete. High confidence of Aedes breeding site.', 'System feedback message based on processing results.');
content4 = content4.replace('Duplicate Detected?', 'System Alert Header');
content4 = content4.replace('A similar report was filed 5m away today.', 'Contextual alert description text.');
content4 = content4.replace('Stack Report', 'Primary Action');
content4 = content4.replace('Submit as New', 'Secondary Action');
fs.writeFileSync(path.join(docsDir, 'wireframe_step4.html'), content4, 'utf8');

// Step 5
let content5 = fs.readFileSync(path.join(docsDir, 'wireframe_step5.html'), 'utf8');
content5 = content5.replace('Report Submitted!', 'Success Confirmation Header');
content5 = content5.replace('KL-ABCD-1234', 'XX-XXXX-0000');
content5 = content5.replace('Save this reference code to track triage status.', 'Instructional text for saving the reference code.');
content5 = content5.replace('Track Status', 'Primary CTA Label');
content5 = content5.replace('Return to Home', 'Secondary CTA Label');
fs.writeFileSync(path.join(docsDir, 'wireframe_step5.html'), content5, 'utf8');

// Map
let contentMap = fs.readFileSync(path.join(docsDir, 'wireframe_public_map.html'), 'utf8');
contentMap = contentMap.replace('Active Reports (24)', 'Filter Category (Count)');
contentMap = contentMap.replace('Hotspots (3)', 'Filter Category (Count)');
contentMap = contentMap.replace('Search location...', 'Search Input Placeholder');
contentMap = contentMap.replace('Report #KL-1234', 'Report ID Placeholder');
contentMap = contentMap.replace('Drain Inlet', 'Category Label');
contentMap = contentMap.replace('Reported 2h ago', 'Relative Timestamp');
contentMap = contentMap.replace('AI Confidence: High', 'System Metric Value');
fs.writeFileSync(path.join(docsDir, 'wireframe_public_map.html'), contentMap, 'utf8');

// Dashboard
let contentDash = fs.readFileSync(path.join(docsDir, 'wireframe_review_dashboard.html'), 'utf8');
contentDash = contentDash.replace('Track Your Report', 'Module Header Title');
contentDash = contentDash.replace('Enter your secure reference code to check triage updates.', 'Instructional text for input field.');
contentDash = contentDash.replace('e.g. KL-ABCD-1234', 'Input Placeholder');
contentDash = contentDash.replace('Track Status', 'Primary CTA Label');
contentDash = contentDash.replace('KL-ABCD-1234', 'Reference Code');
contentDash = contentDash.replace('● Under Review', '● Status State');
contentDash = contentDash.replace('Submitted', 'Process Step 1');
contentDash = contentDash.replace('Under Review', 'Process Step 2');
contentDash = contentDash.replace('Prioritized', 'Process Step 3');
contentDash = contentDash.replace('Action Logged', 'Process Step 4');
contentDash = contentDash.replace('Closed', 'Process Step 5');
contentDash = contentDash.replace('Date Submitted', 'Metadata Label 1');
contentDash = contentDash.replace('Oct 12, 2026', 'Date String');
contentDash = contentDash.replace('Location Area', 'Metadata Label 2');
contentDash = contentDash.replace('Bangsar South', 'Location String');
contentDash = contentDash.replace('Habitat', 'Metadata Label 3');
contentDash = contentDash.replace('Drain Inlet', 'Category String');
contentDash = contentDash.replace('Confidence', 'Metadata Label 4');
contentDash = contentDash.replace('85% High', 'Metric Value');
contentDash = contentDash.replace('Evidence Analyzed', 'Evidence Header Title');
contentDash = contentDash.replace('AI bounding box attached', 'Evidence descriptive text string');
contentDash = contentDash.replace('View on Public Map', 'Secondary CTA Label');
fs.writeFileSync(path.join(docsDir, 'wireframe_review_dashboard.html'), contentDash, 'utf8');

console.log('Successfully abstracted content across all remaining wireframes.');
