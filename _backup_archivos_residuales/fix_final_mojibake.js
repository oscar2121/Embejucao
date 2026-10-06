const fs = require('fs');

let text = fs.readFileSync('App.js', 'utf8');

const map = {
  // Remaining Emojis
  'ðŸ’µ': '💵',
  'ðŸ“²': '📱',
  'ðŸ‘¥': '👥',
  'ðŸ–¨ï¸ ': '🖨️',
  'ðŸ”’': '🔒',
  'âšï¸ ': '⚠️',
  'ðŸŽ‰': '🎉',
  'âš™ï¸ ': '⚙️',
  'ðŸ ½ï¸ ': '🍽️',
  'ðŸŽµ': '🎵',
  'ðŸ“¡': '📡',
  'ðŸ””': '🔔',
  'ðŸ›Žï¸ ': '🛎️',
  'ðŸš€': '🚀',
  'â Œ': '❌',
  'ðŸ” ': '🔍',
  'âš ï¸ ': '⚠️',
  'ðŸ’³': '💳',
  
  // Special Characters
  'Â¿': '¿',
  'â€¢': '•',
  'RÃ PIDA': 'RÁPIDA'
};

for (const [bad, good] of Object.entries(map)) {
  text = text.split(bad).join(good);
}

fs.writeFileSync('App.js', text, 'utf8');
console.log('Final remaining mojibake fixed');
