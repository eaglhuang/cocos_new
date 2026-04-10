'use strict';
const path = require('path');
const https = require('https');
require(path.join(__dirname, 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '.env') });

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const key = process.env.GOOGLE_AI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=100`;
  const data = await get(url);
  if (data.error) { console.error(JSON.stringify(data.error)); return; }
  const models = (data.models || []).filter(m =>
    m.name && (m.name.includes('flash') || m.name.includes('imagen') || m.name.includes('image'))
  );
  models.forEach(m => {
    const methods = (m.supportedGenerationMethods || []).join(',');
    console.log(m.name, '|', methods);
  });
}
main().catch(e => console.error(e.message));
