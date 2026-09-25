const fs = require('fs');
let text = fs.readFileSync('App.js', 'utf8');

const map = {
  'âœ¨': '✨',
  'âœ ️': '✏️',
  'â€”': '—',
  'ðŸ‘¨â€\x8DðŸ ³': '👨‍🍳',
  'ðŸ‘¨â€ ðŸ ³': '👨‍🍳',
  'ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ VISTA PEDIDO ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚\r?\n¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚\r?\n¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬': '--- VISTA PEDIDO ---',
};

for (const [bad, good] of Object.entries(map)) {
  text = text.split(bad).join(good);
}

// Special regex for multiline garbage comment
text = text.replace(/\/\/ ââ€ â‚¬.*?\n.*?\n.*?\n/g, '// --- VISTA PEDIDO ---\n');

fs.writeFileSync('App.js', text, 'utf8');
console.log('Final emojis fixed');
