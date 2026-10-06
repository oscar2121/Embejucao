const fs = require('fs'); 
const lines = fs.readFileSync('App.js', 'utf8').split('\n'); 
const start = lines.findIndex(l => l.includes("adminTab === 'menu'")); 
lines.slice(start, start + 50).forEach((l,i) => console.log(start+i+1, l));
