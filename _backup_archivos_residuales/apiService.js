import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL, TIMEOUT } from './config';
import uuid from 'react-native-uuid';

// ─── ALMACENAMIENTO LOCAL ────────────────────────────────
export const storage = {
  getPedidos: async () => {
    try {
      const data = await AsyncStorage.getItem('pedidos');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error getting pedidos:', e);
      return [];
    }
  },

  guardarPedidos: async (pedidos) => {
    try {
      await AsyncStorage.setItem('pedidos', JSON.stringify(pedidos));
    } catch (e) {
      console.error('Error saving pedidos:', e);
    }
  },

  getMesas: async () => {
    try {
      const data = await AsyncStorage.getItem('mesas');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  guardarMesas: async (mesas) => {
    try {
      await AsyncStorage.setItem('mesas', JSON.stringify(mesas));
    } catch (e) {
      console.error('Error saving mesas:', e);
    }
  },
};

// ─── SINCRONIZACIÓN CON SERVIDOR ────────────────────────
export const api = {
  // Crear pedido (enviar a servidor)
  crearPedido: async (mesa, items, hora) => {
    try {
      const pedidoId = uuid.v4();
      const hoy = new Date().toISOString().split('T')[0];

      const response = await axios.post(
        `${API_URL}/pedidos`,
        { uuid: pedidoId, mesa, hora, items, fecha: hoy },
        { timeout: TIMEOUT }
      );

      return { success: true, id: pedidoId, data: response.data };
    } catch (error) {
      console.error('Error creating pedido:', error.message);
      return { success: false, error: error.message };
    }
  },

  // Obtener pedidos del día
  obtenerPedidosDelDia: async () => {
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const response = await axios.get(
        `${API_URL}/pedidos/date/${hoy}`,
        { timeout: TIMEOUT }
      );
      return { success: true, pedidos: response.data.pedidos };
    } catch (error) {
      console.error('Error fetching pedidos:', error.message);
      return { success: false, error: error.message, pedidos: [] };
    }
  },

  // Actualizar estado de item
  actualizarEstadoItem: async (pedidoId, itemIdx, nuevoEstado) => {
    try {
      const response = await axios.put(
        `${API_URL}/pedidos/${pedidoId}/item/${itemIdx}`,
        { nuevoEstado },
        { timeout: TIMEOUT }
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error updating item:', error.message);
      return { success: false, error: error.message };
    }
  },

  // Completar pedido (marcar mesa como libre/completado)
  completarPedido: async (pedidoId) => {
    try {
      const response = await axios.delete(
        `${API_URL}/pedidos/${pedidoId}`,
        { timeout: TIMEOUT }
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error completing pedido:', error.message);
      return { success: false, error: error.message };
    }
  },

  // Check salud del servidor
  checkServerHealth: async () => {
    try {
      await axios.get(`${API_URL.replace('/api', '')}/health`, { timeout: TIMEOUT });
      return true;
    } catch {
      return false;
    }
  },

  // ─── PRODUCTOS/CATÁLOGO ───
  obtenerProductos: async () => {
    try {
      const response = await axios.get(`${API_URL}/productos`, { timeout: TIMEOUT });
      return response.data.productos;
    } catch (error) {
      console.error('Error fetching productos:', error.message);
      return [];
    }
  },

  guardarProducto: async (prod) => {
    try {
      const response = await axios.post(`${API_URL}/productos`, prod, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error saving producto:', error.message);
      return { success: false, error: error.message };
    }
  },

  cambiarDisponibilidadProducto: async (id, disp) => {
    try {
      const response = await axios.put(`${API_URL}/productos/${id}/disponibilidad`, { disp }, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error changing product availability:', error.message);
      return { success: false, error: error.message };
    }
  },

  // ─── SESIONES DE CAJA ───
  obtenerSesionActiva: async () => {
    try {
      const response = await axios.get(`${API_URL}/caja/sesion-activa`, { timeout: TIMEOUT });
      return response.data.sesion;
    } catch (error) {
      console.error('Error getting active session:', error.message);
      return null;
    }
  },

  abrirCaja: async (baseInicial) => {
    try {
      const response = await axios.post(`${API_URL}/caja/abrir`, { base_inicial: baseInicial }, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error opening register:', error.message);
      return { success: false, error: error.message };
    }
  },

  cerrarCaja: async (sesionId, saldoReal) => {
    try {
      const response = await axios.post(`${API_URL}/caja/cerrar`, { sesion_id: sesionId, saldo_final_real: saldoReal }, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error closing register:', error.message);
      return { success: false, error: error.message };
    }
  },

  // ─── VENTAS ───
  registrarVenta: async (venta) => {
    try {
      const response = await axios.post(`${API_URL}/ventas`, venta, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error registering sale:', error.message);
      return { success: false, error: error.message };
    }
  },

  // ─── FINANZAS & GASTOS ───
  obtenerReporteFinanzas: async () => {
    try {
      const response = await axios.get(`${API_URL}/finanzas/reporte`, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error fetching finance report:', error.message);
      return null;
    }
  },

  registrarGasto: async (gasto) => {
    try {
      const response = await axios.post(`${API_URL}/gastos`, gasto, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error registering expense:', error.message);
      return { success: false, error: error.message };
    }
  },

  // ─── INVENTARIO ───
  obtenerInsumos: async () => {
    try {
      const response = await axios.get(`${API_URL}/inventario/insumos`, { timeout: TIMEOUT });
      return response.data.insumos;
    } catch (error) {
      console.error('Error fetching insumos:', error.message);
      return [];
    }
  },

  crearInsumo: async (insumo) => {
    try {
      const response = await axios.post(`${API_URL}/inventario/insumos`, insumo, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error creating insumo:', error.message);
      return { success: false, error: error.message };
    }
  },

  registrarMovimientoInsumo: async (insumoId, movimiento) => {
    try {
      const response = await axios.post(`${API_URL}/inventario/insumos/${insumoId}/movimiento`, movimiento, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error registering inventory movement:', error.message);
      return { success: false, error: error.message };
    }
  },

  obtenerMovimientosInventario: async () => {
    try {
      const response = await axios.get(`${API_URL}/inventario/movimientos`, { timeout: TIMEOUT });
      return response.data.movimientos;
    } catch (error) {
      console.error('Error fetching stock movements:', error.message);
      return [];
    }
  },

  // ─── CANCELACIONES ───
  cancelarPedido: async (uuid, motivo, usuario) => {
    try {
      const response = await axios.post(`${API_URL}/pedidos/${uuid}/cancelar`, { motivo, usuario }, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error canceling order:', error.message);
      return { success: false, error: error.message };
    }
  },

  obtenerPedidosCancelados: async () => {
    try {
      const response = await axios.get(`${API_URL}/pedidos-cancelados`, { timeout: TIMEOUT });
      return response.data.cancelados;
    } catch (error) {
      console.error('Error fetching canceled orders:', error.message);
      return [];
    }
  },

  // ─── SEGURIDAD / LOGIN ───
  login: async (usuario, pin) => {
    try {
      const response = await axios.post(`${API_URL}/login`, { usuario, pin }, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error in login:', error.message);
      return { success: false, error: error.message };
    }
  },

  logout: async (usuario) => {
    try {
      const response = await axios.post(`${API_URL}/logout`, { usuario }, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error in logout:', error.message);
      return { success: false, error: error.message };
    }
  },

  // ─── GESTIÓN DE USUARIOS ───
  obtenerUsuarios: async () => {
    try {
      const response = await axios.get(`${API_URL}/usuarios`, { timeout: TIMEOUT });
      return response.data.usuarios;
    } catch (error) {
      console.error('Error fetching usuarios:', error.message);
      return [];
    }
  },

  guardarUsuario: async (user) => {
    try {
      const response = await axios.post(`${API_URL}/usuarios`, user, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error saving usuario:', error.message);
      return { success: false, error: error.message };
    }
  },

  cambiarEstadoUsuario: async (id, activo, administrador_usuario) => {
    try {
      const response = await axios.put(`${API_URL}/usuarios/${id}/estado`, { activo, administrador_usuario }, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error changing user status:', error.message);
      return { success: false, error: error.message };
    }
  },

  // ─── EDICIÓN DE PEDIDO ───
  actualizarPedido: async (uuid, items, usuario) => {
    try {
      const response = await axios.put(`${API_URL}/pedidos/${uuid}`, { items, usuario }, { timeout: TIMEOUT });
      return response.data;
    } catch (error) {
      console.error('Error updating order:', error.message);
      return { success: false, error: error.message };
    }
  },

  // ─── VENTAS DETALLADAS ───
  obtenerDetallesVenta: async (ventaId) => {
    try {
      const response = await axios.get(`${API_URL}/ventas/${ventaId}/detalles`, { timeout: TIMEOUT });
      return response.data.detalles;
    } catch (error) {
      console.error('Error fetching sales details:', error.message);
      return [];
    }
  },

  // ─── AUDITORÍA ───
  obtenerAuditoria: async (filtros = {}) => {
    try {
      const { usuario, fecha, accion } = filtros;
      const response = await axios.get(`${API_URL}/auditoria`, {
        params: { usuario, fecha, accion },
        timeout: TIMEOUT
      });
      return response.data.logs;
    } catch (error) {
      console.error('Error fetching audit logs:', error.message);
      return [];
    }
  },
};
