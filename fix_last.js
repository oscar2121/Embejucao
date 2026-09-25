const fs = require('fs');
let lines = fs.readFileSync('App.js', 'utf8').split('\n');
lines[1873] = '                 userRol === "cocina" ? `👨‍🍳 Cocina (${cocinaPendientes})` :';
fs.writeFileSync('App.js', lines.join('\n'));
console.log('Fixed line 1874');
