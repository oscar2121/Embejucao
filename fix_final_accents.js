const fs = require('fs');
let txt = fs.readFileSync('App.js', 'utf8');

txt = txt.replace(/í“/g, 'Ó'); 
txt = txt.replace(/í\x8D/g, 'Í'); 
txt = txt.replace(/í£/g, 'á'); 
txt = txt.replace(/í¢/g, '─'); 
txt = txt.replace(/í—/g, '×'); 
txt = txt.replace(/íš/g, 'Ú'); 
txt = txt.replace(/í\x81/g, 'Á');

// Fix the "Para llevar" icon as requested
txt = txt.replace(/<Text style=\{\{ fontSize: 18 \}\}>👥 <\/Text>/g, '<Text style={{ fontSize: 18 }}>🛍️ </Text>');

fs.writeFileSync('App.js', txt);
console.log('App.js final fixes applied.');
