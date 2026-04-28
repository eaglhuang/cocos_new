const fs = require('fs');
const layoutData = JSON.parse(fs.readFileSync('assets/resources/ui-spec/layouts/battle-hud-main.json', 'utf8'));
const rootNode = layoutData.root || layoutData;
console.log('rootNode type:', rootNode.type, 'name:', rootNode.name);
console.log('children count:', (rootNode.children || []).length);
(rootNode.children || []).forEach(c => {
  console.log(' child:', c.name, 'widget:', JSON.stringify(c.widget), 'height:', c.height);
});
