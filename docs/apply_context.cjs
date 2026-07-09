const fs = require('fs');
const path = require('path');
const docsDir = '/Users/noorullah/Developer/prototype/docs';

// 1. Landing Page
let lp = fs.readFileSync(path.join(docsDir, 'wireframe_landing_page.html'), 'utf8');
lp = lp.replace('Primary Action', 'Submit New Report');
lp = lp.replace('Secondary', 'Track Existing Report');
lp = lp.replace(/Metric Label/g, 'Global Impact Metrics');
lp = lp.replace('Section Header Title', 'Recent Community Reports');
lp = lp.replace('<div class="hero-title"></div>', '<div class="hero-title" style="background:none; font-weight:bold; height:auto; margin-bottom:15px; width:100%; font-size:24px;">Community Reporting Portal</div>');
fs.writeFileSync(path.join(docsDir, 'wireframe_landing_page.html'), lp, 'utf8');

// 2. Educational Page
let ep = fs.readFileSync(path.join(docsDir, 'wireframe_educational_page.html'), 'utf8');
ep = ep.replace('Module Overtitle', 'Habitat Intelligence Guide');
ep = ep.replace('Section Header Title', 'Habitat Classification');
ep = ep.replace(/Category Title/g, 'Habitat Type');
ep = ep.replace(/Descriptive Tagline/g, 'Risk Factor Description');
ep = ep.replace(/Category Badge/g, 'Risk Level');
ep = ep.replace('Information Block Label', 'Lifecycle Metric');
ep = ep.replace('List Block Label', 'Visual Identification Cues');
ep = ep.replace('Instruction Block Label', 'Photo Evidence Tip');
ep = ep.replace('Primary Action Label', 'Submit Report Action');
ep = ep.replace(/Metric Label/g, 'Impact Statistic');
ep = ep.replace('Process Overtitle', 'System Workflow');
ep = ep.replace('Process Header Title', 'Triage Pipeline Process');
fs.writeFileSync(path.join(docsDir, 'wireframe_educational_page.html'), ep, 'utf8');

// 3. Step 1
let s1 = fs.readFileSync(path.join(docsDir, 'wireframe_step1.html'), 'utf8');
s1 = s1.replace('Step 1: Primary Action', 'Step 1: Habitat Evidence');
s1 = s1.replace('Instructional text describing the required user action.', 'Provide photographic evidence of the breeding site.');
s1 = s1.replace(/Primary CTA Label/g, 'Upload Evidence');
s1 = s1.replace('Secondary CTA Label', 'Retake Photo');
fs.writeFileSync(path.join(docsDir, 'wireframe_step1.html'), s1, 'utf8');

// 4. Step 2
let s2 = fs.readFileSync(path.join(docsDir, 'wireframe_step2.html'), 'utf8');
s2 = s2.replace('Step 2: Location Context', 'Step 2: Spatial Pinpoint');
s2 = s2.replace('Instructional text for map interaction.', 'Pinpoint the exact habitat location.');
s2 = s2.replace('Reverse Geocoded Address String', 'Detected Spatial Boundary');
s2 = s2.replace('Primary CTA Label', 'Confirm Spatial Coordinates');
fs.writeFileSync(path.join(docsDir, 'wireframe_step2.html'), s2, 'utf8');

// 5. Step 3
let s3 = fs.readFileSync(path.join(docsDir, 'wireframe_step3.html'), 'utf8');
s3 = s3.replace(/Step 3: Legal & Consent/g, 'Step 3: Anonymity & Consent');
s3 = s3.replace('Standard legal disclaimer text (Lorem ipsum dolor sit amet, consectetur adipiscing elit).', 'Data Privacy & Spatial Anonymity Terms');
s3 = s3.replace('Consent Confirmation Statement', 'Acknowledge Privacy Terms');
s3 = s3.replace('Primary CTA Label', 'Submit Report Securely');
fs.writeFileSync(path.join(docsDir, 'wireframe_step3.html'), s3, 'utf8');

// 6. Step 4
let s4 = fs.readFileSync(path.join(docsDir, 'wireframe_step4.html'), 'utf8');
s4 = s4.replace('Step 4: Automated Review', 'Step 4: AI Triage Engine');
s4 = s4.replace('System processing indicator message...', 'Executing computer vision classification...');
s4 = s4.replace('System feedback message based on processing results.', 'Automated Habitat Classification Results');
s4 = s4.replace('System Alert Header', 'Spatial Duplicate Alert');
s4 = s4.replace('Contextual alert description text.', 'A similar incident was mapped nearby.');
s4 = s4.replace('Primary Action', 'Merge Reports');
s4 = s4.replace('Secondary Action', 'Submit as New');
fs.writeFileSync(path.join(docsDir, 'wireframe_step4.html'), s4, 'utf8');

// 7. Step 5
let s5 = fs.readFileSync(path.join(docsDir, 'wireframe_step5.html'), 'utf8');
s5 = s5.replace('Success Confirmation Header', 'Report Successfully Triaged');
s5 = s5.replace('XX-XXXX-0000', '[ Generated Reference Code ]');
s5 = s5.replace('Instructional text for saving the reference code.', 'Retain this code to track triage status anonymously.');
s5 = s5.replace('Primary CTA Label', 'Track Triage Status');
s5 = s5.replace('Secondary CTA Label', 'Return to Portal');
fs.writeFileSync(path.join(docsDir, 'wireframe_step5.html'), s5, 'utf8');

// 8. Map
let m = fs.readFileSync(path.join(docsDir, 'wireframe_public_map.html'), 'utf8');
m = m.replace(/Filter Category \(Count\)/g, 'Filtered Spatial View');
m = m.replace('Search Input Placeholder', 'Search Location Boundary...');
m = m.replace('Report ID Placeholder', 'Habitat Incident Detail');
m = m.replace('Category Label', 'Predicted Category');
m = m.replace('Relative Timestamp', 'Submission Timestamp');
m = m.replace('System Metric Value', 'AI Confidence Score');
fs.writeFileSync(path.join(docsDir, 'wireframe_public_map.html'), m, 'utf8');

// 9. Dashboard
let d = fs.readFileSync(path.join(docsDir, 'wireframe_review_dashboard.html'), 'utf8');
d = d.replace('Module Header Title', 'Secure Status Tracking');
d = d.replace('Instructional text for input field.', 'Provide reference code to query triage status.');
d = d.replace('Input Placeholder', '[ Reference Code Entry ]');
d = d.replace('Primary CTA Label', 'Query Status');
d = d.replace('Reference Code', 'Incident Ref Code');
d = d.replace('● Status State', '● Triage State');
d = d.replace('Process Step 1', 'Submitted');
d = d.replace('Process Step 2', 'AI Review');
d = d.replace('Process Step 3', 'Prioritized');
d = d.replace('Process Step 4', 'Action Logged');
d = d.replace('Process Step 5', 'Closed');
d = d.replace('Metadata Label 1', 'Submission Timeline');
d = d.replace('Date String', 'Temporal Data');
d = d.replace('Metadata Label 2', 'Spatial Zone');
d = d.replace('Location String', 'Geospatial String');
d = d.replace('Metadata Label 3', 'Predicted Habitat Type');
d = d.replace('Category String', 'Classification Label');
d = d.replace('Metadata Label 4', 'Prediction Confidence');
d = d.replace('Metric Value', 'Confidence Metric');
d = d.replace('Evidence Header Title', 'Analyzed Evidence');
d = d.replace('Evidence descriptive text string', 'Bounding box extraction attached');
d = d.replace('Secondary CTA Label', 'View on Spatial Map');
fs.writeFileSync(path.join(docsDir, 'wireframe_review_dashboard.html'), d, 'utf8');
