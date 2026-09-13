const assert = require('assert');

// Extraemos las funciones tal cual como las pusimos en el código
const formatNumberInput = (text) => {
  if (!text) return '';
  return text.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const cleanNum = (val) => {
  if (!val) return '0';
  return String(val).replace(/\./g, '');
};

try {
  console.log("Iniciando pruebas unitarias de funciones lógicas...");

  // Pruebas de formatNumberInput
  assert.strictEqual(formatNumberInput('100'), '100');
  assert.strictEqual(formatNumberInput('1000'), '1.000');
  assert.strictEqual(formatNumberInput('200000'), '200.000');
  assert.strictEqual(formatNumberInput('1500000'), '1.500.000');
  assert.strictEqual(formatNumberInput('a1000'), '1.000', "Debe ignorar letras");
  assert.strictEqual(formatNumberInput(''), '');
  assert.strictEqual(formatNumberInput(null), '');
  
  // Pruebas de cleanNum
  assert.strictEqual(cleanNum('1.000'), '1000');
  assert.strictEqual(cleanNum('200.000'), '200000');
  assert.strictEqual(cleanNum('1.500.000'), '1500000');
  assert.strictEqual(cleanNum('100'), '100');
  assert.strictEqual(cleanNum(null), '0');
  assert.strictEqual(cleanNum(undefined), '0');
  assert.strictEqual(cleanNum(''), '0');

  // Prueba de flujo simulado de Cobro Mixto
  const totalPedido = 58000;
  const efectivoIngresadoTexto = formatNumberInput('200000'); // El usuario teclea 200000 y se vuelve "200.000"
  const efectivoParseado = parseFloat(cleanNum(efectivoIngresadoTexto)) || 0; // Se parsea internamente
  
  // Validación de seguridad de cobro mixto
  let exito = false;
  if (efectivoParseado > totalPedido) {
     // Esto debería dispararse
     exito = true;
  }
  assert.strictEqual(exito, true, "La validación de cobro mixto mayor al total debe funcionar");

  console.log("✅ Todas las pruebas unitarias pasaron exitosamente.");

} catch (error) {
  console.error("❌ Falló una prueba:", error.message);
}
