const fs = require('fs');
let text = fs.readFileSync('App.js', 'utf8');

const map = {
  'Ã¡': 'á',
  'Ã©': 'é',
  'Ã\\xad': 'í',
  'Ã³': 'ó',
  'Ãº': 'ú',
  'Ã±': 'ñ',
  'Ã ': 'Á',
  'Ã‰': 'É',
  'Ã\x8D': 'Í',
  'Ã“': 'Ó',
  'Ãš': 'Ú',
  'Ã‘': 'Ñ',
  'â”€â”€â”€': '---',
  'Ã—': '×',
  'âš\x80ï¸\x8F': '⚠️',
  '🍔’': '🍔',
  'âš\x80️': '⚠️'
};

for (const [bad, good] of Object.entries(map)) {
  text = text.split(bad).join(good);
}

// Just in case, explicit replacements:
text = text.replace(/SESIÃ“N/g, 'SESIÓN');
text = text.replace(/NOTIFICACIÃ“N/g, 'NOTIFICACIÓN');
text = text.replace(/CONFIGURACIÃ“N/g, 'CONFIGURACIÓN');
text = text.replace(/ACUMULACIÃ“N/g, 'ACUMULACIÓN');
text = text.replace(/CORRECCIÃ“N/g, 'CORRECCIÓN');
text = text.replace(/Ã“RDENES/g, 'ÓRDENES');
text = text.replace(/SELECCIÃ“N/g, 'SELECCIÓN');
text = text.replace(/HISTÃ“RICOS/g, 'HISTÓRICOS');
text = text.replace(/LIQUIDACIÃ“N/g, 'LIQUIDACIÓN');
text = text.replace(/ACTUALIZACIÃ“N/g, 'ACTUALIZACIÓN');
text = text.replace(/Embejucão/g, 'Embejucao');

fs.writeFileSync('App.js', text, 'utf8');
console.log('Explicit fixes applied');
