const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('embejucao.db');

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) throw err;
    console.log("Tables:");
    tables.forEach(t => console.log(t.name));
    
    // Specifically look at usuarios
    db.all("SELECT * FROM usuarios", [], (err, rows) => {
      console.log("\\nUsuarios:");
      console.log(rows);
    });
  });
});
