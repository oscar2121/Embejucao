const fs = require('fs');
const content = fs.readFileSync('App.js', 'utf8');
const lines = content.split('\n');

let results = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<TextInput')) {
    let block = [];
    for (let j = i; j < Math.min(i + 15, lines.length); j++) {
      block.push(lines[j]);
      if (lines[j].includes('/>') || lines[j].includes('</TextInput>')) {
        break;
      }
    }
    results.push(`--- Line ${i + 1} ---`);
    results.push(block.join('\n'));
  }
}
fs.writeFileSync('inputs_found.txt', results.join('\n\n'));
