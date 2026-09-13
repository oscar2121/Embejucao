DELETE FROM adicionales;
DELETE FROM auditoria;
DELETE FROM caja_sesiones;
DELETE FROM clientes;
DELETE FROM gastos;
DELETE FROM insumos;
DELETE FROM movimientos_inventario;
DELETE FROM pedidos;
DELETE FROM pedidos_cancelados;
DELETE FROM productos;
DELETE FROM ventas;
DELETE FROM ventas_detalle;
DELETE FROM usuarios WHERE id != 1;
DELETE FROM usuario_roles WHERE usuario_id != 1;

-- Opcional: reiniciar los autoincrements para que los nuevos IDs empiecen en 1
DELETE FROM sqlite_sequence WHERE name IN ('adicionales', 'auditoria', 'caja_sesiones', 'clientes', 'gastos', 'insumos', 'movimientos_inventario', 'pedidos', 'pedidos_cancelados', 'productos', 'ventas', 'ventas_detalle');
