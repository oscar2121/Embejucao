const fs = require('fs');
const content = fs.readFileSync('App.js', 'utf8');
const start = content.indexOf("{adminTab === 'finanzas' &&");
if (start !== -1) {
    console.log(content.slice(start, start + 1200));
} else {
    console.log('Not found');
}
