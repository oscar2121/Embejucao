const fs = require('fs');

let buf = fs.readFileSync('App.js');
let hex = buf.toString('hex');

const map = {
  // Emojis mapped by explicit hex
  'c3b0c5b8c28de2809d': Buffer.from('🍔').toString('hex'),
  'c3b0c5b8c28dc5b8': Buffer.from('🍟').toString('hex'),
  'c3b0c5b8c28de280b9': Buffer.from('🍋').toString('hex'),
  'c3b0c5b8c28dc2ba': Buffer.from('🍺').toString('hex'),
  'c3b0c5b8c28dc2b9': Buffer.from('🍹').toString('hex'),
  'c3b0c5b8e280bac5bdc3afc2b8c28f': Buffer.from('🛎️').toString('hex'),
  'c3a2c29dc592': Buffer.from('❌').toString('hex'),
  'c3b0c5b8e2809dc28d': Buffer.from('🔍').toString('hex'),
  'c3a2c5a1c2a0c3afc2b8c28f': Buffer.from('⚠️').toString('hex'),
  'c3b0c5b8e2809cc29d': Buffer.from('📌').toString('hex'),
  'c3a2c5a1e284a2c3afc2b8c28f': Buffer.from('⚙️').toString('hex'),
  'c3b0c5b8e2809de2809e': Buffer.from('🔄').toString('hex'),
  'c3b0c5b8e28098c2a8c3a2e282acc28dc3b0c5b8c28dc2b3': Buffer.from('👨‍🍳').toString('hex'),
  'c3b0c5b8c5a1c2aa': Buffer.from('🚪').toString('hex'),
  'c3b0c5b8e280bac28dc3afc2b8c28f': Buffer.from('🛒').toString('hex'),
  'c3a2c28fc2b3': Buffer.from('⏳').toString('hex'),
  'c3b0c5b8c28dc2bdc3afc2b8c28f': Buffer.from('🍽️').toString('hex'),
  'c3a2c593c28fc3afc2b8c28f': Buffer.from('✏️').toString('hex'),
  'c3b0c5b8e2809cc28d': Buffer.from('📌').toString('hex'),
  'c3b0c5b8e28093c2a8c3afc2b8c28f': Buffer.from('🖨️').toString('hex'),
  'c3b0c5b8c28fc2a6': Buffer.from('🍦').toString('hex'),
  'c3b0c5b8c28fc2b7c3afc2b8c28f': Buffer.from('🍷').toString('hex'),
  
  // Replace the ridiculously long broken border line with '---'
  'c383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2ac': Buffer.from('---').toString('hex'),
  'c383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2acc383c2a2c3a2e282acc29dc3a2e2809ac2ac': Buffer.from('---').toString('hex')
};

for (const [badHex, goodHex] of Object.entries(map)) {
  hex = hex.split(badHex).join(goodHex);
}

fs.writeFileSync('App.js', Buffer.from(hex, 'hex'));
console.log('Hex-level obliteration complete.');
