const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

// 1. Remove the incorrectly added </View> at the end
const targetEnd = /([ \t]*\)\}\r?\n)[ \t]*<\/View>\r?\n([ \t]*<\/ScrollView>\r?\n\r?\n[ \t]*\{\/\* --- MODAL DE CONFIGURAR PRODUCTO)/;
if (content.match(targetEnd)) {
  content = content.replace(targetEnd, "$1$2");
}

// 2. Add the missing <ScrollView> before the products grid
const targetStart = /([ \t]*\{\/\* Productos \*\/}\r?\n[ \t]*<View style=\{s\.prodsGrid\}>)/;
if (content.match(targetStart)) {
  content = content.replace(targetStart, "        <ScrollView style={{ flex: 1 }}>\n$1");
}

fs.writeFileSync('App.js', content, 'utf8');
console.log("Patched missing ScrollView and removed errant View");
