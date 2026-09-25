const fs = require('fs');

let text = fs.readFileSync('App.js', 'utf8');

const map = {
  'ðŸ›’': '🛒',
  'â ³': '⏳',
  'ðŸ”¥': '🔥',
  'âœ ï¸ ': '✏️',
  'ðŸŸ¢': '🟢',
  'âšï¸ ': '⚠️',
  'âš ï¸ ': '⚠️',
  'ðŸ–¨ï¸ ': '🖨️',
  'ðŸ“ ': '📌',
  'ðŸ ½ï¸ ': '🍽️',
  'âš™ï¸ ': '⚙️',
  'â Œ': '❌',
  'ðŸ ”': '🍔',
  'ðŸ Ÿ': '🍟',
  'ðŸ ‹': '🍋',
  'ðŸ º': '🍺',
  'ðŸ ¦': '🍦',
  'ðŸ” ': '🔍',
  'â€¢': '•',
  'â€”': '—',
  'Ã—': '×',
  'â¬…': '⬅'
};

for (const [bad, good] of Object.entries(map)) {
  text = text.split(bad).join(good);
}

fs.writeFileSync('App.js', text, 'utf8');
console.log('Stragglers fixed');
