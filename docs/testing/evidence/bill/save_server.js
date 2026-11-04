const http = require('http');
const fs = require('fs');
const path = require('path');

const targetDir = __dirname;

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/save') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const base64Data = data.dataUrl.replace(/^data:image\/png;base64,/, '');
                const filePath = path.join(targetDir, data.imageName);
                fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                console.log(`Saved: ${data.imageName} (${fs.statSync(filePath).size} bytes)`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, name: data.imageName }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(8765, () => {
    console.log('Server running on port 8765');
});
