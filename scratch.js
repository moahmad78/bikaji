const http = require('http');

http.get('http://localhost:3000', (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    const regex = /href="(\/_next\/static\/chunks\/[^"]+\.css)"/g;
    let match;
    const urls = [];
    while ((match = regex.exec(body)) !== null) {
      urls.push(match[1]);
    }
    console.log(`Found ${urls.length} CSS chunks to fetch.`);
    urls.forEach(url => {
      console.log(`Fetching ${url}...`);
      const req = http.get(`http://localhost:3000${url}`, (r) => {
        let chunkBody = '';
        r.on('data', c => chunkBody += c);
        r.on('end', () => console.log(`DONE: ${url} (length: ${chunkBody.length})`));
      });
      req.on('error', e => console.error(`Error fetching ${url}: ${e.message}`));
      req.setTimeout(3000, () => {
        console.error(`TIMEOUT: ${url}`);
        req.destroy();
      });
    });
  });
});
