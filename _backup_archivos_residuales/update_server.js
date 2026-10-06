const fs = require('fs');

const file = 'server.js';
let content = fs.readFileSync(file, 'utf8');

const target = `  // 1. Ventas
  db.get(\`SELECT SUM(total) as total FROM ventas WHERE \${dateConditionVentas}\`, [], (err, rVentas) => {
    const ventas = rVentas ? rVentas.total || 0 : 0;
    
    // 2. Gastos
    db.get(\`SELECT SUM(valor) as total FROM gastos WHERE \${dateConditionGastos}\`, [], (err, rGastos) => {
      const gastos = rGastos ? rGastos.total || 0 : 0;
      
      // 3. Gastos por categoría
      db.all(\`SELECT categoria, SUM(valor) as total FROM gastos WHERE \${dateConditionGastos} GROUP BY categoria\`, [], (err, catList) => {
        const gastosPorCategoria = catList || [];
        
        // 4. Últimos gastos
        db.all(\`SELECT * FROM gastos WHERE \${dateConditionGastos} ORDER BY id DESC LIMIT 50\`, [], (err, ultimosGastos) => {
          
          // 5. Métodos de pago
          db.get(\`SELECT SUM(total) as total FROM ventas WHERE (\${dateConditionVentas}) AND metodo_pago = 'Efectivo'\`, [], (err, rEfe) => {
            const efectivo = rEfe ? rEfe.total || 0 : 0;
            
            db.get(\`SELECT SUM(total) as total FROM ventas WHERE (\${dateConditionVentas}) AND metodo_pago = 'Transferencia'\`, [], (err, rTrans) => {
              const transferencia = rTrans ? rTrans.total || 0 : 0;

              // 6. Flujo de Ventas (Agrupado por hora o día)
              let flowSelect = "strftime('%H:00', datetime(fecha, 'localtime')) as label";
              if (rango === 'semana' || rango === 'mes') {
                flowSelect = "date(datetime(fecha, 'localtime')) as label";
              }

              db.all(\`SELECT \${flowSelect}, SUM(total) as total FROM ventas WHERE \${dateConditionVentas} GROUP BY label ORDER BY label ASC\`, [], (err, flujoVentas) => {
                
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
                    cajaSesiones: cajaSesiones || []
                  });
                });
              });
            });
          });
        });
      });
    });
  });`;

const replacement = `  // 1. Ventas y Ticket Promedio
  db.get(\`SELECT SUM(total) as total, COUNT(id) as count FROM ventas WHERE \${dateConditionVentas}\`, [], (err, rVentas) => {
    const ventas = rVentas ? rVentas.total || 0 : 0;
    const ventasCount = rVentas ? rVentas.count || 0 : 0;
    
    // 2. Gastos
    db.get(\`SELECT SUM(valor) as total FROM gastos WHERE \${dateConditionGastos}\`, [], (err, rGastos) => {
      const gastos = rGastos ? rGastos.total || 0 : 0;
      
      // 3. Gastos por categoría
      db.all(\`SELECT categoria, SUM(valor) as total FROM gastos WHERE \${dateConditionGastos} GROUP BY categoria\`, [], (err, catList) => {
        const gastosPorCategoria = catList || [];
        
        // 4. Últimos gastos
        db.all(\`SELECT * FROM gastos WHERE \${dateConditionGastos} ORDER BY id DESC LIMIT 50\`, [], (err, ultimosGastos) => {
          
          // 5. Métodos de pago
          db.get(\`SELECT SUM(total) as total FROM ventas WHERE (\${dateConditionVentas}) AND metodo_pago = 'Efectivo'\`, [], (err, rEfe) => {
            const efectivo = rEfe ? rEfe.total || 0 : 0;
            
            db.get(\`SELECT SUM(total) as total FROM ventas WHERE (\${dateConditionVentas}) AND metodo_pago = 'Transferencia'\`, [], (err, rTrans) => {
              const transferencia = rTrans ? rTrans.total || 0 : 0;

              // 6. Flujo de Ventas y Gastos (Agrupado por hora o día)
              let flowSelect = "strftime('%H:00', datetime(fecha, 'localtime')) as label";
              if (rango === 'semana' || rango === 'mes') {
                flowSelect = "date(datetime(fecha, 'localtime')) as label";
              }

              db.all(\`SELECT \${flowSelect}, SUM(total) as total FROM ventas WHERE \${dateConditionVentas} GROUP BY label ORDER BY label ASC\`, [], (err, flujoVentas) => {
                db.all(\`SELECT \${flowSelect}, SUM(valor) as total FROM gastos WHERE \${dateConditionGastos} GROUP BY label ORDER BY label ASC\`, [], (err, flujoGastos) => {
                
                  // 7. Sesiones de Caja
                  db.all(\`SELECT * FROM caja_sesiones WHERE \${dateConditionCaja} ORDER BY id DESC\`, [], (err, cajaSesiones) => {

                    res.json({
                      rango: rango || 'hoy',
                      ventas,
                      ventasCount,
                      gastos,
                      balance: ventas - gastos,
                      gastosPorCategoria,
                      ultimosGastos: ultimosGastos || [],
                      efectivo,
                      transferencia,
                      flujoVentas: flujoVentas || [],
                      flujoGastos: flujoGastos || [],
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
  });`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Successfully updated server.js');
} else {
  console.log('Target not found in server.js');
}
