import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const DEFAULT_SERVER_URL = 'http://localhost:3001';

export function useAppStore() {
  const [isOnline, setIsOnline] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  
  // Data states
  const [productos, setProductos] = useState([]);
  const [baseMesas, setBaseMesas] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [sesionActiva, setSesionActiva] = useState(null);
  const [adicionales, setAdicionales] = useState([]);
  
  const socketRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    console.log(`Intentando conectar a Socket.io en ${serverUrl}...`);
    
    socketRef.current = io(serverUrl, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: { 'Bypass-Tunnel-Reminder': 'true' }
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Conectado al servidor WebSocket');
      setIsOnline(true);
      sincronizarDatos(serverUrl);
      
      // Registrar este dispositivo como cocina para recibir pedidos en vivo
      socketRef.current.emit('registrar_dispositivo', {
        rol: 'cocina',
        usuarioId: 'POS-Desktop'
      });
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Desconectado del servidor WebSocket');
      setIsOnline(false);
    });

    // Real-time events based on App.js
    socketRef.current.on('pedido_estado_cambiado', (data) => {
      setPedidos(prev => prev.map(p => p.uuid === data.uuid ? { ...p, items: data.items, estado: data.nuevoEstado } : p));
    });
    
    socketRef.current.on('mesas_actualizadas', (nuevasMesas) => {
      setBaseMesas(nuevasMesas);
    });
    
    socketRef.current.on('pedido_recibido_cocina', (nuevoPedido) => {
      setPedidos(prev => {
        if (prev.some(p => p.uuid === nuevoPedido.uuid)) return prev;
        return [nuevoPedido, ...prev];
      });
    });

    socketRef.current.on('pedido_fiado_servidor', (data) => {
      setPedidos(prev => {
        if (prev.some(p => p.uuid === data.uuid)) {
          return prev.map(p => p.uuid === data.uuid ? { ...p, ...data } : p);
        }
        return [data, ...prev];
      });
    });

    socketRef.current.on('pedido_completado_servidor', (data) => {
      setPedidos(prev => prev.filter(p => p.uuid !== data.uuid));
    });

    socketRef.current.on('pedido_cancelado_servidor', (data) => {
      setPedidos(prev => prev.filter(p => p.uuid !== data.uuid));
    });

    socketRef.current.on('caja_actualizada', (sesion) => {
      setSesionActiva(sesion);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [serverUrl]);

  // Initial Sync Logic
  const sincronizarDatos = async (url) => {
    try {
      const baseUrl = `${url}/api`;
      
      // 1. Fetch Productos
      const prodRes = await axios.get(`${baseUrl}/productos`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (prodRes.data && prodRes.data.productos) {
        setProductos(prodRes.data.productos);
      }

      // 1.5 Fetch Mesas
      const mesasRes = await axios.get(`${baseUrl}/mesas`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (mesasRes.data && mesasRes.data.mesas) {
        setBaseMesas(mesasRes.data.mesas);
      }

      // 1.6 Fetch Adicionales
      const adicRes = await axios.get(`${baseUrl}/adicionales`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (adicRes.data) {
        setAdicionales(adicRes.data.filter(a => a.disponible === 1));
      }

      // 2. Fetch Pedidos del día y Fiados históricos
      const today = new Date().toISOString().split('T')[0];
      const [pedidosRes, fiadosRes] = await Promise.all([
        axios.get(`${baseUrl}/pedidos/date/${today}`, { headers: { 'ngrok-skip-browser-warning': 'true' } }),
        axios.get(`${baseUrl}/pedidos/fiado`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      ]);
      
      const allPedidos = [];
      if (pedidosRes.data && pedidosRes.data.pedidos) {
        allPedidos.push(...pedidosRes.data.pedidos);
      }
      
      if (fiadosRes.data && fiadosRes.data.fiados) {
        fiadosRes.data.fiados.forEach(f => {
          if (!allPedidos.some(p => p.uuid === f.uuid)) {
            allPedidos.push(f);
          }
        });
      }
      setPedidos(allPedidos);
      
      // 3. Fetch Sesión Activa
      try {
        const sesionRes = await axios.get(`${baseUrl}/caja/sesion-activa`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
          timeout: 5000
        });
        if (sesionRes.data && sesionRes.data.sesion) {
          setSesionActiva(sesionRes.data.sesion);
        } else {
          setSesionActiva(null);
        }
      } catch (errSesion) {
        console.log("No se pudo obtener la sesión de caja activa o no existe");
        setSesionActiva(null);
      }
      
      console.log("✅ Datos sincronizados correctamente.");
    } catch (error) {
      console.error("Error sincronizando datos:", error);
    }
  };

  // Autocorrección de mesas basado en pedidos
  useEffect(() => {
    if (!baseMesas || baseMesas.length === 0) return;

    const nuevasMesas = baseMesas.map(m => {
      // Consideramos un pedido activo si NO está completado, cancelado ni fiado
      const pedidoActivo = pedidos.find(p => Number(p.mesa) === m.num && p.estado !== 'completado' && p.estado !== 'cancelado' && p.estado !== 'fiado');
      if (!pedidoActivo) return { ...m, estado: 'libre' };
      
      const estadoActual = pedidoActivo.estado;
      return { ...m, estado: (estadoActual === 'cuenta') ? 'cuenta' : 'ocupada' };
    });
    
    setMesas(nuevasMesas);
  }, [pedidos, baseMesas]);

  return {
    isOnline,
    serverUrl,
    setServerUrl,
    productos,
    mesas,
    pedidos,
    sesionActiva,
    setSesionActiva,
    adicionales,
    setAdicionales,
    socket: socketRef.current
  };
}
