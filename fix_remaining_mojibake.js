const fs = require('fs');
let txt = fs.readFileSync('App.js', 'utf8');
const replacements = {
  'ðŸ” ':'🔍', 
  'ðŸ ·ï¸ ':'🏷️', 
  'ðŸ’µ':'💵', 
  'ðŸ“²':'📲', 
  'ðŸ‘¥':'👥', 
  'ðŸ–¨ï¸ ':'🖨️', 
  'ðŸ”’':'🔒', 
  'âš ï¸ ':'⚠️', 
  'âšï¸ ':'⚠️', 
  'ðŸ ”':'🍔', 
  'ðŸŒ­':'🌭', 
  'ðŸŒ¯':'🌯', 
  'ðŸ Ÿ':'🍟', 
  'ðŸŒ½':'🌽', 
  'ðŸ¥¤':'🥤', 
  'ðŸ ‹':'🍋', 
  'ðŸ º':'🍻', 
  'ðŸ ½ï¸ ':'🍽️', 
  'â Œ':'❌', 
  'ðŸ ¦':'🍦', 
  'ðŸ“ ':'📝', 
  'âš™ï¸ ':'⚙️', 
  'ðŸ“…':'📅', 
  'ðŸŽ‰':'🎉', 
  '➕':'➕', 
  'íšltimos':'Últimos', 
  'ðŸ’¸':'💸', 
  'ðŸ“‹':'📋', 
  'ðŸ“Š':'📊'
};
for (const [k, v] of Object.entries(replacements)) {
  txt = txt.split(k).join(v);
}
fs.writeFileSync('App.js', txt, 'utf8');
console.log('App.js sanitized fully');
