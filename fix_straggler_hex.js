const fs = require('fs');

let buf = fs.readFileSync('App.js');
let hex = buf.toString('hex');

const map = {
  'c383c2a3': Buffer.from('ã').toString('hex'),
  'c383c281': Buffer.from('Á').toString('hex'),
  'e29d8c': Buffer.from('❌').toString('hex'), // Make sure to preserve ❌
  'e28fb3': Buffer.from('⏳').toString('hex')  // Make sure to preserve ⏳
};

for (const [badHex, goodHex] of Object.entries(map)) {
  hex = hex.split(badHex).join(goodHex);
}

fs.writeFileSync('App.js', Buffer.from(hex, 'hex'));
console.log('Straggler hex replaced.');
