const fs = require('fs');

let text = fs.readFileSync('App.js', 'utf8');

const map = {
  // Food Emojis missed
  'ðŸ ”': '🍔',
  'ðŸŒ­': '🌭',
  'ðŸŒ¯': '🌯',
  'ðŸ Ÿ': '🍟',
  'ðŸŒ½': '🌽',
  'ðŸ¥¤': '🥤',
  'ðŸ ‹': '🍋',
  'ðŸ º': '🍺',
  'ðŸ¥›': '🥛',
  'ðŸ ¹': '🍹',
  
  // App Emojis missed
  'ðŸŽµ': '🎵',
  'ðŸ“¡': '📡',
  'ðŸ””': '🔔',
  'ðŸ›Žï¸ ': '🛎️',
  'ðŸš€': '🚀',
  'â Œ': '❌',
  'ðŸ” ': '🔍',
  'âš ï¸ ': '⚠️',
  
  // Accents and inverted
  'Â¡': '¡'
};

for (const [bad, good] of Object.entries(map)) {
  text = text.split(bad).join(good);
}

fs.writeFileSync('App.js', text, 'utf8');
console.log('Extra emojis fixed');
