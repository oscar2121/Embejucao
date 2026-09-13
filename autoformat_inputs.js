const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'App.js');
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('const formatMoneyInput')) {
  code = code.replace(
    /const cleanNum = \(val\) => \{/,
    `const formatMoneyInput = (val) => {
  if (!val) return '';
  const num = String(val).replace(/\\D/g, '');
  if (!num) return '';
  // Usamos es-CO para que agregue los puntos de miles automáticamente
  return parseInt(num, 10).toLocaleString('es-CO');
};

const cleanNum = (val) => {`
  );
}

// Replace exact matches for standard setters
code = code.replace(/onChangeText=\{setAperturaBase\}/g, 'onChangeText={(txt) => setAperturaBase(formatMoneyInput(txt))}');
code = code.replace(/onChangeText=\{setEfectivoMixto\}/g, 'onChangeText={(txt) => setEfectivoMixto(formatMoneyInput(txt))}');
code = code.replace(/onChangeText=\{setCierreReal\}/g, 'onChangeText={(txt) => setCierreReal(formatMoneyInput(txt))}');
code = code.replace(/onChangeText=\{setNewProdPrice\}/g, 'onChangeText={(txt) => setNewProdPrice(formatMoneyInput(txt))}');
code = code.replace(/onChangeText=\{setGastoValor\}/g, 'onChangeText={(txt) => setGastoValor(formatMoneyInput(txt))}');
code = code.replace(/onChangeText=\{setInsumoCompra\}/g, 'onChangeText={(txt) => setInsumoCompra(formatMoneyInput(txt))}');

// Replace the inline object updater for formGasto.valor
code = code.replace(
  /onChangeText=\{txt => setFormGasto\(\{...formGasto, valor: txt\}\)\}/g,
  'onChangeText={txt => setFormGasto({...formGasto, valor: formatMoneyInput(txt)})}'
);

fs.writeFileSync(file, code, 'utf8');
console.log("App.js autoformatting patched successfully.");
