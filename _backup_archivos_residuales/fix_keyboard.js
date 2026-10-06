const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'App.js');
let code = fs.readFileSync(file, 'utf8');

// We want to replace keyboardType="numeric" with keyboardType="decimal-pad" 
// BUT we want to preserve "numeric" for PIN fields (which usually have maxLength={6})
// A simple approach: replace all to decimal-pad first
code = code.replace(/keyboardType="numeric"/g, 'keyboardType="decimal-pad"');

// Then, specifically for PIN inputs which have maxLength={6}, we can change them back to "numeric".
// In the code, PIN inputs look like:
// keyboardType="decimal-pad"
// maxLength={6}
// We can use a regex to revert those.
code = code.replace(/keyboardType="decimal-pad"(\s+)maxLength=\{6\}/g, 'keyboardType="numeric"$1maxLength={6}');
code = code.replace(/secureTextEntry(\s+)keyboardType="decimal-pad"/g, 'secureTextEntry$1keyboardType="numeric"');

fs.writeFileSync(file, code, 'utf8');
console.log("App.js keyboardType patched successfully.");
