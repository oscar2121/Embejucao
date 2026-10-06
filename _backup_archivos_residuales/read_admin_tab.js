const fs = require('fs');
const lines = fs.readFileSync('App.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes("adminTab === 'menu'"));
if (idx > 0) {
  lines.slice(idx - 2, idx + 80).forEach((l,i) => console.log(idx-1+i, l));
} else {
  console.log("Not found");
}
