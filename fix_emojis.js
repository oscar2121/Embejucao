const fs = require('fs');
let text = fs.readFileSync('App.js', 'utf8');

const map = {
  // Emojis and specific strings from user
  'âš™ï¸': '⚙️',
  'âš™️': '⚙️',
  'ðŸ’°': '💵',
  'ðŸ’¦': '📦',
  'ðŸ”': '🍔',
  'âŒ': '❌',
  'ðŸ›ï¸': '🏦',
  'ðŸ’¸': '💸',
  'ðŸ‘¨â€ðŸ³': '👨‍🍳',
  'âœ…': '✅',
  'âš ï¸': '⚠️',
  'âšï¸': '⚠️',
  'ðŸŽ‰': '🎉',
  'ðŸ’µ': '💵',
  'ðŸ“²': '📱',
  'ðŸ‘¤': '👤',
  'ðŸ”’': '🔒',
  'ðŸŸ¢': '🟢',
  'ðŸ“‹': '📋',
  'ðŸ” ': '🔍',
  'ðŸŽµ': '🎵',
  'â€¢': '•',
  'Â¿': '¿',
  'Â¡': '¡',
  'Â°': '°',
  'Ãš': 'Ú'
};

for (const k in map) {
  text = text.split(k).join(map[k]);
}

fs.writeFileSync('App.js', text, 'utf8');
console.log("Emoji fixes applied.");
