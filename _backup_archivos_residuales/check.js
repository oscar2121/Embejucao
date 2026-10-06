const sqlite3 = require('sqlite3');
const d = new sqlite3.Database('./embejucao.db');
const sqlFecha = (col) => `substr(${col}, 1, 10)`;
let dateConditionVentas = `substr(${sqlFecha('fecha')}, 1, 7) = strftime('%Y-%m', 'now', 'localtime')`;
const qV = `SELECT COALESCE(SUM(total), 0) as total FROM ventas WHERE ${dateConditionVentas}`;
const qE = `SELECT COALESCE(SUM(total), 0) as total FROM ventas WHERE (${dateConditionVentas}) AND (TRIM(LOWER(metodo_pago)) = 'efectivo' OR metodo_pago IS NULL OR TRIM(metodo_pago) = '')`;
const qT = `SELECT COALESCE(SUM(total), 0) as total FROM ventas WHERE (${dateConditionVentas}) AND TRIM(LOWER(metodo_pago)) IN ('transferencia', 'nequi', 'daviplata', 'bancolombia')`;
let r = {};
d.get(qV, (e, v) => {
  r.ventas = v.total;
  d.get(qE, (e, ef) => {
    r.efectivo = ef.total;
    d.get(qT, (e, tr) => {
      r.transferencia = tr.total;
      console.log(JSON.stringify(r, null, 2));
    });
  });
});
