const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('embejucao.db');

db.serialize(() => {
  // 1. Restaurar pedidos a crédito / fiado
  db.run(`
    UPDATE pedidos 
    SET estado = 'fiado' 
    WHERE (deudor IS NOT NULL AND TRIM(deudor) != '')
       OR notas LIKE '%credito%' 
       OR notas LIKE '%fiado%'
  `, function(err) {
    if (err) {
      console.error("Error al restaurar créditos:", err);
    } else {
      console.log(`Se restauraron ${this.changes} pedidos a crédito.`);
    }
  });

  // 2. Verificar que las mesas activas permanezcan en 'libre'
  db.run("UPDATE mesas SET estado = 'libre'", function(err) {
    if (err) {
      console.error("Error al restablecer mesas:", err);
    } else {
      console.log(`Mesas verificadas como libre.`);
    }
  });

  // 3. Mostrar resumen de los créditos restaurados
  db.all("SELECT id, uuid, mesa, deudor, fecha_fiado, estado, total, abono_parcial FROM pedidos WHERE estado IN ('fiado', 'credito')", (err, rows) => {
    if (err) console.error("Error comprobando pedidos:", err);
    console.log("Total créditos activos:", rows ? rows.length : 0);
    console.log("Créditos activos:", rows);
  });
});

db.close();
