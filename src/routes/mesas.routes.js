const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAuditoria } = require('../utils/helpers');
const { getIO } = require('../utils/socket');

// ─── MESAS ───

// GET - Obtener todas las mesas
router.get('/mesas', (req, res) => {
  db.all(`SELECT * FROM mesas ORDER BY num ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (rows.length === 0) {
      // Inicializar si está vacío
      const iniciales = [
        { num: 1, estado: "libre" },
        { num: 2, estado: "libre" },
        { num: 3, estado: "libre" },
        { num: 4, estado: "libre" }
      ];
      
      const stmt = db.prepare(`INSERT INTO mesas (num, estado) VALUES (?, ?)`);
      iniciales.forEach(m => stmt.run(m.num, m.estado));
      stmt.finalize(() => {
        db.all(`SELECT * FROM mesas ORDER BY num ASC`, [], (err2, newRows) => {
          res.json({ mesas: newRows });
        });
      });
    } else {
      res.json({ mesas: rows });
    }
  });
});

// PUT - Actualizar cantidad de mesas
router.put('/mesas/cantidad', (req, res) => {
  const io = req.io || getIO();
  const { cantidad, usuario } = req.body;
  if (!cantidad || cantidad < 1 || cantidad > 100) return res.status(400).json({ error: "Cantidad inválida (1-100)" });
  
  db.all(`SELECT * FROM mesas ORDER BY num ASC`, [], (err, mesasActuales) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const cantidadActual = mesasActuales.length;
    
    if (cantidad === cantidadActual) {
      return res.json({ success: true, message: "La cantidad ya es correcta." });
    }
    
    if (cantidad > cantidadActual) {
      // Agregar nuevas mesas
      const stmt = db.prepare(`INSERT INTO mesas (num, estado) VALUES (?, 'libre')`);
      for (let i = cantidadActual + 1; i <= cantidad; i++) {
        stmt.run(i);
      }
      stmt.finalize(() => {
        logAuditoria(usuario, 'mesas_actualizadas', `Cantidad de mesas aumentada a ${cantidad}`);
        db.all(`SELECT * FROM mesas ORDER BY num ASC`, [], (err2, rows) => {
          if (io) io.emit('mesas_actualizadas', rows);
          res.json({ success: true, mesas: rows });
        });
      });
    } else {
      // Reducir mesas, primero verificar si las que se van a eliminar están ocupadas
      const mesasAEliminar = mesasActuales.filter(m => m.num > cantidad);
      const mesasOcupadas = mesasAEliminar.filter(m => m.estado !== 'libre');
      
      if (mesasOcupadas.length > 0) {
        const nums = mesasOcupadas.map(m => m.num).join(', ');
        return res.status(400).json({ error: `No se puede reducir la cantidad. Las siguientes mesas están ocupadas o en cuenta: ${nums}` });
      }
      
      db.run(`DELETE FROM mesas WHERE num > ?`, [cantidad], (errDelete) => {
        if (errDelete) return res.status(500).json({ error: errDelete.message });
        logAuditoria(usuario, 'mesas_actualizadas', `Cantidad de mesas reducida a ${cantidad}`);
        
        db.all(`SELECT * FROM mesas ORDER BY num ASC`, [], (err2, rows) => {
          if (io) io.emit('mesas_actualizadas', rows);
          res.json({ success: true, mesas: rows });
        });
      });
    }
  });
});

module.exports = router;
