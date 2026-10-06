const fs = require('fs');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Add helpers at the top after imports
  if (!content.includes('const formatNumberInput =')) {
    const helpers = `\nconst formatNumberInput = (text) => {
  if (!text) return '';
  return text.toString().replace(/\\D/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");
};

const cleanNum = (val) => {
  if (!val) return '0';
  return String(val).replace(/\\./g, '');
};\n`;
    
    // Find last import
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfImport = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, endOfImport + 1) + helpers + content.slice(endOfImport + 1);
    } else {
      content = helpers + content;
    }
  }

  // Define variables to transform
  const vars = [
    'efectivoCliente', 'efectivoMixto', 'cierreReal', 'newProdPrice', 
    'gastoValor', 'insumoCant', 'insumoMin', 'insumoCompra', 'movCant',
    'efectivoCount', 'tarjetaCount', 'transferenciaCount'
  ];

  // 1. Transform onChangeText (React Native) or onChange (React DOM)
  vars.forEach(v => {
    // React Native: onChangeText={setEfectivoCliente}
    const setRegexRN1 = new RegExp(`onChangeText=\\{set${v.charAt(0).toUpperCase() + v.slice(1)}\\}`, 'g');
    content = content.replace(setRegexRN1, `onChangeText={(t) => set${v.charAt(0).toUpperCase() + v.slice(1)}(formatNumberInput(t))}`);

    // React Native: onChangeText={(val) => setEfectivoCliente(val)}
    // React DOM: onChange={(e) => setEfectivoCliente(e.target.value)}
    const setRegexDOM = new RegExp(`onChange=\\{\\(e\\) => set${v.charAt(0).toUpperCase() + v.slice(1)}\\(e\\.target\\.value\\)\\}`, 'g');
    content = content.replace(setRegexDOM, `onChange={(e) => set${v.charAt(0).toUpperCase() + v.slice(1)}(formatNumberInput(e.target.value))}`);
  });

  // For formGasto.valor
  content = content.replace(/onChangeText=\{txt => setFormGasto\(\{\.\.\.formGasto, valor: txt\}\)\}/g, 'onChangeText={txt => setFormGasto({...formGasto, valor: formatNumberInput(txt)})}');
  content = content.replace(/onChange=\{\(e\) => setFormGasto\(\{\.\.\.formGasto, valor: e\.target\.value\}\)\}/g, 'onChange={(e) => setFormGasto({...formGasto, valor: formatNumberInput(e.target.value)})}');


  // 2. Wrap usages of these variables with cleanNum in API calls and math
  // We will do a generic replacement for where they are passed or parsed.
  // This is tricky via regex, so we look for parseInt(var), parseFloat(var), Number(var), or when sent in object { price: var }
  
  vars.forEach(v => {
    // parseInt(efectivoCliente) -> parseInt(cleanNum(efectivoCliente))
    content = content.replace(new RegExp(`parseInt\\(${v}\\)`, 'g'), `parseInt(cleanNum(${v}))`);
    content = content.replace(new RegExp(`parseFloat\\(${v}\\)`, 'g'), `parseFloat(cleanNum(${v}))`);
    content = content.replace(new RegExp(`Number\\(${v}\\)`, 'g'), `Number(cleanNum(${v}))`);
    
    // In objects e.g. precio: newProdPrice
    content = content.replace(new RegExp(`: ${v}([,\\}\\n])`, 'g'), `: cleanNum(${v})$1`);
    
    // In template literals e.g. \`\${newProdPrice}\`
    content = content.replace(new RegExp(`\\$\\{${v}\\}`, 'g'), `\${cleanNum(${v})}`);
  });
  
  content = content.replace(/parseInt\(formGasto\.valor\)/g, 'parseInt(cleanNum(formGasto.valor))');
  content = content.replace(/: formGasto\.valor([,\\}\n])/g, ': cleanNum(formGasto.valor)$1');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${filePath}`);
}

['App.js', 'desktop-app/src/AdminModule.jsx', 'desktop-app/src/CajaModule.jsx', 'desktop-app/src/PedidosModule.jsx'].forEach(f => {
  if (fs.existsSync(f)) {
    processFile(f);
  }
});
