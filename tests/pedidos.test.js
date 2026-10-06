const request = require('supertest');
const app = require('../server');
const { db } = require('../src/database/db');

describe('API Backend POS - Pruebas de Integración (Pedidos y Caja)', () => {
  beforeAll((done) => {
    // Dar tiempo para la inicialización completa del esquema SQLite en memoria (:memory:)
    setTimeout(done, 500);
  });

  afterAll((done) => {
    // Cerrar la conexión a SQLite al finalizar los tests
    if (db && typeof db.close === 'function') {
      db.close((err) => {
        if (err) console.error("Error al cerrar DB en test:", err);
        done();
      });
    } else {
      done();
    }
  });

  describe('POST /api/pedidos - Registro de Pedidos / Ventas', () => {
    it('Debe registrar un nuevo pedido exitosamente (Caso de Éxito - HTTP 200 OK)', async () => {
      const nuevoPedido = {
        mesa: 'Mesa 1',
        tipo: 'mesa',
        items: [
          { id: 101, nombre: 'Hamburguesa Clásica', cantidad: 2, precio: 16000, subtotal: 32000 }
        ],
        total: 32000,
        notas: 'Sin cebolla'
      };

      const res = await request(app)
        .post('/api/pedidos')
        .send(nuevoPedido)
        .set('Accept', 'application/json');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('uuid');
      expect(typeof res.body.uuid).toBe('string');
    });

    it('Debe rechazar la solicitud si faltan datos requeridos (Caso de Validación Fallida - HTTP 400 Bad Request)', async () => {
      // Enviar payload incompleto al endpoint de actualización de estado (faltan items y nuevoEstado)
      const payloadIncompleto = {
        uuid: 'ped_test_123'
      };

      const res = await request(app)
        .post('/api/pedidos/estado')
        .send(payloadIncompleto)
        .set('Accept', 'application/json');

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/Faltan parámetros requeridos/i);
    });

    it('Debe retornar error al intentar cancelar un pedido inexistente (HTTP 404 Not Found)', async () => {
      const res = await request(app)
        .post('/api/pedidos/uuid-inexistente-9999/cancelar')
        .send({ motivo: 'Prueba cancelación' })
        .set('Accept', 'application/json');

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Pedido no encontrado');
    });
  });

  describe('GET /api/caja/estado-actual - Consulta de Estado de Caja', () => {
    it('Debe obtener el balance de caja y total proyectado correctamente (HTTP 200 OK)', async () => {
      const res = await request(app)
        .get('/api/caja/estado-actual')
        .set('Accept', 'application/json');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('efectivo_en_caja');
      expect(res.body).toHaveProperty('pendiente_en_mesas');
    });
  });
});
