const fs = require('fs');

let text = fs.readFileSync('App.js', 'utf8');

const map = {
  // Emojis
  'ðŸ“¦': '📦',
  'ðŸ‘¤': '👤',
  'ðŸ“‹': '📋',
  'ðŸ§¾': '🧾',
  'ðŸ–¨ï¸ ': '🖨️',
  'ðŸ ½ï¸ ': '🍽️',
  'âœ¨': '✨',
  'âž•': '➕',
  'âš ï¸ ': '⚠️',
  'ðŸ“¸': '📸',
  'ðŸ“Š': '📊',
  'ðŸ’¸': '💸',
  'ðŸ ·ï¸ ': '🍷',
  'ðŸ“…': '📅',
  'âž–': '➖',
  'ðŸ“ ': '📌',
  'âš™ï¸ ': '⚙️',
  'ðŸ” ': '🔍',
  'âœ…': '✅',
  'ðŸ•’': '🕒',
  'ðŸ’³': '💳',
  'ðŸ”‘': '🔑',
  'ðŸ’°': '💰',
  'ðŸ ”': '🍔',
  'â Œ': '❌',
  'ðŸ ¦': '🍦',
  'â˜•': '☕',
  'âš ️': '⚠️',
  'âš️': '⚠️',
  'â†’': '→',
  'ðŸ‘¨â€\\x8DðŸ ³': '👨‍🍳',
  'ðŸ‘¨â€ ðŸ ³': '👨‍🍳',
  'âœ ️': '✏️',
  'âˆ’': '−',
  '🍔¥': '🍔',
  'âœ“': '✓',
  
  // UI separators
  'â”€â”€â”€': '---',
  'â”€â”€': '--',
  'â”€': '-',
  'ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬': '---',

  // Uppercase Accents
  'Ã ': 'Á',
  'Ã‰': 'É',
  'Ã\x8D': 'Í',
  'Ã“': 'Ó',
  'Ãš': 'Ú',
  'Ã‘': 'Ñ',
  
  // Lowercase Accents
  'Ã¡': 'á',
  'Ã©': 'é',
  'Ã\\xad': 'í',
  'Ã­': 'í',
  'Ã³': 'ó',
  'Ãº': 'ú',
  'Ã±': 'ñ',
};

// First replace complex emojis and symbols
for (const [bad, good] of Object.entries(map)) {
  text = text.split(bad).join(good);
}

// Then explicitly replace known words to be 100% safe
const wordMap = {
  'GestiÃ³n': 'Gestión',
  'MenÃº': 'Menú',
  'CategorÃ­a': 'Categoría',
  'DescripciÃ³n': 'Descripción',
  'Ãšltimos': 'Últimos',
  'estÃ¡': 'está',
  'registrarÃ¡': 'registrará',
  'sesiÃ³n': 'sesión',
  'fÃ­sica': 'física',
  'ObservaciÃ³n': 'Observación',
  'CancelaciÃ³n': 'Cancelación',
  'aÃºn': 'aún',
  'AUDITORÃ A': 'AUDITORÍA',
  'AcciÃ³n': 'Acción',
  'MÃ¡x.': 'Máx.',
  'ConfiguraciÃ³n': 'Configuración',
  'ImpresiÃ³n': 'Impresión',
  'DirecciÃ³n': 'Dirección',
  'MÃ©todo': 'Método',
  'ArtÃ­culos': 'Artículos',
  'PÃ©rez': 'Pérez',
  'dÃ­gitos': 'dígitos',
  'NÃ³mina': 'Nómina',
  'invÃ¡lido': 'inválido',
  'SESIÃ“N': 'SESIÓN',
  'NOTIFICACIÃ“N': 'NOTIFICACIÓN',
  'ACUMULACIÃ“N': 'ACUMULACIÓN',
  'CORRECCIÃ“N': 'CORRECCIÓN',
  'Ã“RDENES': 'ÓRDENES',
  'SELECCIÃ“N': 'SELECCIÓN',
  'HISTÃ“RICOS': 'HISTÓRICOS',
  'LIQUIDACIÃ“N': 'LIQUIDACIÓN',
  'ACTUALIZACIÃ“N': 'ACTUALIZACIÓN',
  'Ã‰xito': 'Éxito',
  'Ã©xito': 'éxito'
};

for (const [bad, good] of Object.entries(wordMap)) {
  text = text.split(bad).join(good);
}

// Ensure the ugly multi-line string is nuked via simple replace
text = text.replace('// ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ VISTA PEDIDO ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚\\r\\n¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚\\r\\n¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬ââ€ â‚¬', '// --- VISTA PEDIDO ---');
text = text.replace('// â”€â”€â”€ ESTILOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€', '// --- ESTILOS ---');
text = text.replace('// --- VISTA COCINA ---------------------------------------â”€â”€', '// --- VISTA COCINA -----------------------------------------');

fs.writeFileSync('App.js', text, 'utf8');
console.log('Exhaustive mojibake sweep applied');
