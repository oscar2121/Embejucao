const fs = require('fs');

let appJs = fs.readFileSync('App.js', 'utf8');

const targetGastoMojibake = `      if (res.data && res.data.success) {
        showToast('âœ… Gasto registrado con Ã©xito');
        setGastoDesc('');
        setGastoValor('');
        setGastoModalVisible(false);
        cargarFinanzas();
      }`;

const targetGasto = `      if (res.data && res.data.success) {
        showToast('✅ Gasto registrado con éxito');
        setGastoDesc('');
        setGastoValor('');
        setGastoModalVisible(false);
        cargarFinanzas();
      }`;

const replacementGasto = `      if (res.data && res.data.success) {
        showToast('✅ Gasto registrado con éxito');
        setGastoDesc('');
        setGastoValor('');
        setGastoModalVisible(false);
        
        // Recargar métricas financieras para repintar dona y barras de inmediato
        if (typeof cargarReporteFinanciero === 'function') {
          cargarReporteFinanciero();
        } else if (typeof fetchFinanzas === 'function') {
          fetchFinanzas();
        } else if (typeof cargarFinanzas === 'function') {
          cargarFinanzas();
        }
      }`;

if (appJs.includes(targetGastoMojibake)) {
    appJs = appJs.replace(targetGastoMojibake, replacementGasto);
    console.log("Replaced with targetGastoMojibake");
} else if (appJs.includes(targetGasto)) {
    appJs = appJs.replace(targetGasto, replacementGasto);
    console.log("Replaced with targetGasto");
} else {
    // Regex fallback
    appJs = appJs.replace(/setGastoModalVisible\(false\);\s*cargarFinanzas\(\);\s*\}/, "setGastoModalVisible(false);\n        if (typeof cargarReporteFinanciero === 'function') {\n          cargarReporteFinanciero();\n        } else if (typeof fetchFinanzas === 'function') {\n          fetchFinanzas();\n        } else if (typeof cargarFinanzas === 'function') {\n          cargarFinanzas();\n        }\n      }");
    console.log("Replaced with regex fallback");
}

fs.writeFileSync('App.js', appJs, 'utf8');
console.log('App.js patched successfully');
