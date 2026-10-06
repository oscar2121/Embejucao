const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'App.js');
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('const cleanNum')) {
  code = code.replace(
    /import React[\s\S]*?;/,
    `$&

const cleanNum = (val) => {
  if (!val) return '0';
  return String(val).replace(/\\./g, '');
};`
  );
}

// Replace parseFloat(someVar) with parseFloat(cleanNum(someVar))
// where someVar is alphanumeric and possibly dot.
code = code.replace(/parseFloat\(([a-zA-Z0-9_.]+)\)/g, 'parseFloat(cleanNum($1))');

fs.writeFileSync(file, code, 'utf8');
console.log("App.js patched successfully.");
