const fs = require('fs');

let text = fs.readFileSync('App.js', 'utf8');

const map = {
  // Food Emojis
  'ðŸ ”': '🍔',
  'ðŸŒ­': '🌭',
  'ðŸŒ¯': '🌯',
  'ðŸ Ÿ': '🍟',
  'ðŸŒ½': '🌽',
  'ðŸ¥¤': '🥤',
  'ðŸ ‹': '🍋',
  'ðŸ º': '🍺',
};

for (const [bad, good] of Object.entries(map)) {
  text = text.split(bad).join(good);
}

fs.writeFileSync('App.js', text, 'utf8');
console.log('Food emojis fixed');
