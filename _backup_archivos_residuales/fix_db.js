const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'embejucao.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    UPDATE pedidos 
    SET estado = 'cobrado' 
    WHERE estado NOT IN ('cobrado', 'cancelado')
  `, (err) => {
    if (!err) console.log("Pedidos huérfanos limpiados exitosamente.");
  });

  db.run("UPDATE mesas SET estado = 'libre'", (err) => {
    if (!err) console.log("Todas las mesas restablecidas a LIBRE.");
  });
});
