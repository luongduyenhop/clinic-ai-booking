const fs = require('fs');
const path = require('path');
const { renderSwaggerPage } = require('./generate_swagger_views.js');

const manifestPath = path.join(__dirname, 'manifest.json');
const testCases = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const pages = testCases.map(tc => {
    return {
        tcId: tc.tcId,
        imageName: tc.imageName,
        html: renderSwaggerPage(tc)
    };
});

const masterHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Master Swagger Viewer</title>
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
        iframe { width: 100%; height: 100vh; border: none; display: block; }
    </style>
</head>
<body>
    <iframe id="viewer"></iframe>
    <script>
        const testCaseData = ${JSON.stringify(pages)};
        window.showTestCase = function(index) {
            const item = testCaseData[index];
            if (!item) return false;
            document.getElementById('viewer').srcdoc = item.html;
            return { index, tcId: item.tcId, imageName: item.imageName };
        };
        window.showTestCase(0);
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'html', 'master_viewer.html'), masterHtml, 'utf8');
console.log('master_viewer.html generated with iframe.');
