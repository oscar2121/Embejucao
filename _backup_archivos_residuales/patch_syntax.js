const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

const targetRegex = /([ \t]*\)\}\r?\n)([ \t]*<\/ScrollView>\r?\n\r?\n[ \t]*\{\/\* --- MODAL DE CONFIGURAR PRODUCTO)/;

if (content.match(targetRegex)) {
  content = content.replace(targetRegex, "$1      </View>\n$2");
  fs.writeFileSync('App.js', content, 'utf8');
  console.log("Patched syntax successfully");
} else {
  console.log("Target not found");
}
