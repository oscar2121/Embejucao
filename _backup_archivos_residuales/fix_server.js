const fs = require('fs');

let c = fs.readFileSync('server.js', 'utf8');

// Encuentra el bloque del dashboard viejo (que no tiene flujoGastos o está mal anidado)
const start = c.indexOf("app.get('/api/dashboard/financiero', authorize(['admin']), (req, res) => {");
const end = c.indexOf("// ─── INVENTARIO (INSUMOS Y MOVIMIENTOS) ───");

if (start !== -1 && end !== -1) {
  const newDash = `app.get('/api/dashboard/financiero', authorize(['admin']), (req, res) => {
  const { rango } = req.query; // 'hoy', 'semana', 'mes', o 'YYYY-MM-DD'
  const hoy = new Date().toISOString().split('T')[0];

  let sessionCondition = \`sesion_id IN (SELECT id FROM caja_sesiones WHERE estado = 'abierta')\`;
  let flowSelect = "strftime('%H:00', datetime(fecha, 'localtime')) as label";
  let dateConditionCaja = \`estado = 'abierta'\`;

  if (rango === 'semana') {
    sessionCondition = \`sesion_id IN (SELECT id FROM caja_sesiones WHERE date(datetime(fecha_apertura, 'localtime')) >= date('now', '-6 days', 'localtime'))\`;
    flowSelect = "date(datetime(fecha, 'localtime')) as label";
    dateConditionCaja = \`date(datetime(fecha_apertura, 'localtime')) >= date('now', '-6 days', 'localtime')\`;
  } else if (rango === 'mes') {
    sessionCondition = \`sesion_id IN (SELECT id FROM caja_sesiones WHERE strftime('%Y-%m', datetime(fecha_apertura, 'localtime')) = strftime('%Y-%m', 'now', 'localtime'))\`;
    flowSelect = "date(datetime(fecha, 'localtime')) as label";
    dateConditionCaja = \`strftime('%Y-%m', datetime(fecha_apertura, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')\`;
  } else if (rango && /^\\d{4}-\\d{2}-\\d{2}$/.test(rango)) {
    sessionCondition = \`sesion_id IN (SELECT id FROM caja_sesiones WHERE date(datetime(fecha_apertura, 'localtime')) = '\${rango}')\`;
    dateConditionCaja = \`date(datetime(fecha_apertura, 'localtime')) = '\${rango}'\`;
  }

  // Si no hay sesiones en la condición, SQL lanzará 0 de todas formas.
  // 1. Ventas
  db.get(\`SELECT SUM(total) as total, COUNT(id) as count FROM ventas WHERE \${sessionCondition}\`, [], (err, rVentas) => {
    const ventas = rVentas ? rVentas.total || 0 : 0;
    const ventasCount = rVentas ? rVentas.count || 0 : 0;
    
    // 2. Gastos
    db.get(\`SELECT SUM(valor) as total FROM gastos WHERE \${sessionCondition}\`, [], (err, rGastos) => {
      const gastos = rGastos ? rGastos.total || 0 : 0;
      
      // 3. Gastos por categoría
      db.all(\`SELECT categoria, SUM(valor) as total FROM gastos WHERE \${sessionCondition} GROUP BY categoria\`, [], (err, catList) => {
        const gastosPorCategoria = catList || [];
        
        // 4. Últimos gastos
        db.all(\`SELECT * FROM gastos WHERE \${sessionCondition} ORDER BY id DESC LIMIT 50\`, [], (err, ultimosGastos) => {
          
          // 5. Métodos de pago
          db.get(\`SELECT SUM(total) as total FROM ventas WHERE (\${sessionCondition}) AND metodo_pago = 'Efectivo'\`, [], (err, rEfe) => {
            const efectivo = rEfe ? rEfe.total || 0 : 0;
            
            db.get(\`SELECT SUM(total) as total FROM ventas WHERE (\${sessionCondition}) AND metodo_pago = 'Transferencia'\`, [], (err, rTrans) => {
              const transferencia = rTrans ? rTrans.total || 0 : 0;

              // 6. Flujo de Ventas y Gastos
              db.all(\`SELECT \${flowSelect}, SUM(total) as total FROM ventas WHERE \${sessionCondition} GROUP BY label ORDER BY label ASC\`, [], (err, flujoVentas) => {
                
                db.all(\`SELECT \${flowSelect.replace('fecha', 'fecha')}, SUM(valor) as total FROM gastos WHERE \${sessionCondition} GROUP BY label ORDER BY label ASC\`, [], (err, flujoGastos) => {

                  // 7. Sesiones de Caja
                  db.all(\`SELECT * FROM caja_sesiones WHERE \${dateConditionCaja} ORDER BY id DESC\`, [], (err, cajaSesiones) => {

                    res.json({
                      rango: rango || 'hoy',
                      ventas,
                      gastos,
                      balance: ventas - gastos,
                      gastosPorCategoria,
                      ultimosGastos: ultimosGastos || [],
                      efectivo,
                      transferencia,
                      flujoVentas: flujoVentas || [],
                      flujoGastos: flujoGastos || [],
                      ventasCount,
                      cajaSesiones: cajaSesiones || []
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

`;
  
  c = c.slice(0, start) + newDash + c.slice(end);
  fs.writeFileSync('server.js', c);
  console.log('server.js dashboard fixed');
} else {
  console.log('Markers not found');
}
