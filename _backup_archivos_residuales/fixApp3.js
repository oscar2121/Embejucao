const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Force ipToUse to always be Ngrok, ignoring savedIP
const targetBlock = `        const ipToUse = savedIP || defaultIP;`;
const replacementBlock = `        const ipToUse = "https://brisket-pregnant-squiggly.ngrok-free.dev";`;

if (content.includes(targetBlock)) {
  content = content.replace(targetBlock, replacementBlock);
  fs.writeFileSync('App.js', content);
  console.log('App.js force fixed');
} else {
  console.log('Could not find target block');
}
