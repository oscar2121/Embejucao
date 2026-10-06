const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('embejucao.db');

const startDate = new Date();
startDate.setMonth(startDate.getMonth() - 1); // 1 month ago

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatTime(date) {
  return date.toTimeString().split(' ')[0];
}

async function seedData() {
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // Clear existing data (optional, let's just append or clear)
    db.run("DELETE FROM ventas");
    db.run("DELETE FROM ventas_detalle");
    db.run("DELETE FROM caja_sesiones");
    db.run("DELETE FROM gastos");
    
    let currentDate = new Date(startDate);
    let today = new Date();
    
    let sesionId = 1;
    let ventaId = 1;

    while (currentDate <= today) {
      let dateStr = formatDate(currentDate);
      
      // Create session
      db.run(`INSERT INTO caja_sesiones (id, fecha_apertura, fecha_cierre, base_inicial, saldo_final_real, estado) 
              VALUES (?, ?, ?, ?, ?, ?)`, 
              [sesionId, dateStr + ' 08:00:00', dateStr + ' 22:00:00', 100000, 500000, 'cerrada']);
              
      // Create 5 to 15 ventas per day
      let numVentas = randomInt(5, 15);
      
      for(let i=0; i<numVentas; i++) {
        let total = randomInt(15000, 150000);
        let metodos = ['Efectivo', 'Nequi', 'Bancolombia'];
        let metodo = metodos[randomInt(0, 2)];
        
        db.run(`INSERT INTO ventas (id, fecha, tipo_origen, mesa, total, metodo_pago, sesion_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [ventaId, dateStr, 'Mesa', randomInt(1, 10).toString(), total, metodo, sesionId, dateStr + ' ' + formatTime(new Date())]);
                
        // Ventas detalle
        let numDetalles = randomInt(1, 5);
        for(let j=0; j<numDetalles; j++) {
            let precio = randomInt(5000, 30000);
            let cant = randomInt(1, 3);
            db.run(`INSERT INTO ventas_detalle (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal)
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [ventaId, randomInt(1, 10), 'Producto Prueba ' + j, cant, precio, cant*precio]);
        }
        
        ventaId++;
      }
      
      // Gastos
      if (randomInt(0,1) === 1) {
          db.run(`INSERT INTO gastos (descripcion, categoria, valor, fecha, sesion_id, usuario)
                  VALUES (?, ?, ?, ?, ?, ?)`,
                  ['Compra Insumos', 'Insumos', randomInt(20000, 80000), dateStr, sesionId, 'admin']);
      }
      
      sesionId++;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    db.run("COMMIT", (err) => {
        if(err) console.error(err);
        else console.log("Seeding finished");
    });
  });
}

seedData();
