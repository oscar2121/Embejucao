import { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const formatNumberInput = (text) => {
  if (!text) return '';
  return text.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const cleanNum = (val) => {
  if (!val) return '0';
  return String(val).replace(/\./g, '');
};
export function AdminModule({ pedidos, productos, serverUrl, mesas }) {
  const [adminToken, setAdminToken] = useState(null);
  const [loginPin, setLoginPin] = useState('');
  const [loginUser, setLoginUser] = useState('');
  const [loginError, setLoginError] = useState('');
  const [adminTab, setAdminTab] = useState('dashboard');
  
  // Estados de Impresora
  const [printerType, setPrinterType] = useState(localStorage.getItem('printerType') || 'ip');
  const [printerIP, setPrinterIP] = useState(localStorage.getItem('printerIP') || '');
  const [systemPrinters, setSystemPrinters] = useState([]);
  const [selectedSystemPrinter, setSelectedSystemPrinter] = useState(localStorage.getItem('selectedSystemPrinter') || '');
  // Estados para el Modal de Productos
  const [modalVisible, setModalVisible] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null); // null = Crear Nuevo, Object = Editar
  const [formProd, setFormProd] = useState({ nombre: '', precio: '', emoji: '🍔', cat: 1, desc: '', imagen: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Estados para Adicionales
  const [adicionalesAdmin, setAdicionalesAdmin] = useState([]);
  const [modalAdicionalVisible, setModalAdicionalVisible] = useState(false);
  const [adicionalEditando, setAdicionalEditando] = useState(null);
  const [formAdicional, setFormAdicional] = useState({ nombre: '', precio: '' });

  // Estados para Auditoría
  const [auditoriaLogs, setAuditoriaLogs] = useState([]);
  const [expandedAuditId, setExpandedAuditId] = useState(null);
  const [showAuditoriaList, setShowAuditoriaList] = useState(false);
  const [auditUserFilter, setAuditUserFilter] = useState('');
  const [auditAccionFilter, setAuditAccionFilter] = useState('');
  const [auditFechaFilter, setAuditFechaFilter] = useState('');

  // Estados para el Dashboard Financiero
  const [dashboardRango, setDashboardRango] = useState('hoy');
  const [dashboardData, setDashboardData] = useState({ ventas: 0, gastos: 0, balance: 0, gastosPorCategoria: [], ultimosGastos: [] });
  const [modalGastoVisible, setModalGastoVisible] = useState(false);
  const [formGasto, setFormGasto] = useState({ descripcion: '', categoria: 'Proveedores', valor: '' });
  const [modalPedidosActivosVisible, setModalPedidosActivosVisible] = useState(false);
  
  // Estados para Usuarios
  const [usuarios, setUsuarios] = useState([]);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [editUserSel, setEditUserSel] = useState(null);
  const [formUser, setFormUser] = useState({ nombre: '', pin: '', roles: ['pedido'], activo: true });
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  
  // Estado para Mesas
  const [numMesasInput, setNumMesasInput] = useState('');

  const [historialFacturas, setHistorialFacturas] = useState([]);

  useEffect(() => {
    if (adminTab === 'historial') {
      axios.get(`${serverUrl}/api/ventas`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
        .then(res => {
          if (res.data.ventas) setHistorialFacturas(res.data.ventas);
        })
        .catch(e => console.error("Error cargando historial de facturas", e));
    }
  }, [adminTab, serverUrl]);

  const ROLES_DISPONIBLES = [
    { id: 'admin', label: 'Admin' },
    { id: 'caja', label: 'Caja' },
    { id: 'cocina', label: 'Cocina' },
    { id: 'pedido', label: 'Mesero' }
  ];

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post(`${serverUrl}/api/login`, {
        usuario: loginUser,
        pin: loginPin
      }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      
      if (res.data && res.data.success) {
        if (res.data.roles && res.data.roles.includes('admin')) {
          localStorage.setItem('userToken', res.data.token);
          setAdminToken(res.data.token);
        } else {
          setLoginError('Este usuario no tiene permisos de Administrador.');
        }
      } else {
        setLoginError(res.data.message || 'Error al iniciar sesión');
      }
    } catch (e) {
      setLoginError('Error de conexión.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    setAdminToken(null);
  };

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${serverUrl}/api/usuarios`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.data.usuarios) {
        setUsuarios(res.data.usuarios);
      }
    } catch (e) {
      console.error('Error fetching usuarios:', e.message);
    }
  };

  const toggleEstadoUsuario = async (userId, currentState, userName) => {
    try {
      const res = await axios.put(`${serverUrl}/api/usuarios/${userId}/estado`, {
        activo: !currentState,
        administrador_usuario: 'Admin de PC'
      }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      if (res.data && res.data.success) {
        cargarUsuarios();
      }
    } catch (e) {
      toast.error('Error al cambiar estado del usuario.');
    }
  };

  const eliminarUsuario = async (userId, userName) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar PERMANENTEMENTE al usuario "${userName}"? Esto no se puede deshacer.`)) {
      try {
        const res = await axios.delete(`${serverUrl}/api/usuarios/${userId}`, {
          data: { administrador_usuario: 'Admin de PC' },
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (res.data && res.data.success) {
          toast.success('Usuario eliminado correctamente.');
          cargarUsuarios();
        }
      } catch (e) {
        toast.error('Error al eliminar el usuario.');
      }
    }
  };

  const guardarUsuario = async () => {
    setUserFormError('');
    if (!formUser.nombre) return setUserFormError("El nombre es requerido.");
    if (formUser.pin && (formUser.pin.length < 4 || formUser.pin.length > 6)) return setUserFormError("El PIN debe tener entre 4 y 6 dígitos.");
    
    if (!editUserSel && !formUser.pin) return setUserFormError("Debe establecer un PIN para el nuevo usuario.");
    if (isChangingPin && !formUser.pin) return setUserFormError("El PIN no puede estar vacío.");

    try {
      const payload = {
        ...formUser,
        roles: formUser.roles.length > 0 ? formUser.roles : ['pedido'],
        administrador_usuario: 'Admin de PC'
      };
      if (editUserSel) {
        payload.id = editUserSel.id;
        if (!isChangingPin && !formUser.pin) {
          delete payload.pin;
        }
      }

      await axios.post(`${serverUrl}/api/usuarios`, payload, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      toast.success(editUserSel ? (isChangingPin ? "PIN actualizado exitosamente" : "Usuario actualizado exitosamente") : "Usuario creado exitosamente");
      setUserModalVisible(false);
      cargarUsuarios();
    } catch (e) {
      setUserFormError('Error al guardar el usuario: ' + (e.response?.data?.error || e.message));
    }
  };

  const cargarAuditoria = async () => {
    try {
      const res = await axios.get(`${serverUrl}/api/auditoria`, {
        params: {
          usuario: auditUserFilter,
          accion: auditAccionFilter,
          fecha: auditFechaFilter
        },
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.data.logs) {
        setAuditoriaLogs(res.data.logs);
      }
    } catch (e) {
      console.error('Error fetching auditoria:', e.message);
    }
  };

  const cargarDashboardFinanciero = async () => {
    try {
      const res = await axios.get(`${serverUrl}/api/dashboard/financiero`, {
        params: { rango: dashboardRango },
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.data) {
        setDashboardData(res.data);
      }
    } catch (e) {
      console.error('Error fetching dashboard financiero:', e.message);
    }
  };

  const handleRegistrarGasto = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${serverUrl}/api/gastos`, {
        descripcion: formGasto.descripcion,
        categoria: formGasto.categoria,
        valor: parseFloat(formGasto.valor),
        sesion_id: 1 // TODO: sesion_id dinámico si existe
      }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      
      if (res.data.success) {
        setModalGastoVisible(false);
        setFormGasto({ descripcion: '', categoria: 'Proveedores', valor: '' });
        cargarDashboardFinanciero();
      }
    } catch (error) {
      toast.error('Error registrando gasto: ' + error.message);
    }
  };

  useEffect(() => {
    if (adminTab === 'auditoria') {
      cargarAuditoria();
    }
    if (adminTab === 'usuarios') {
      cargarUsuarios();
    }
    if (adminTab === 'dashboard') {
      cargarDashboardFinanciero();
    }
    if (adminTab === 'mesas') {
      setNumMesasInput(mesas ? mesas.length.toString() : '4');
    }
    if (adminTab === 'adicionales') {
      cargarAdicionales();
    }
  }, [adminTab, dashboardRango, mesas, serverUrl]);

  const cargarAdicionales = async () => {
    try {
      const res = await axios.get(`${serverUrl}/api/adicionales`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.data) {
        setAdicionalesAdmin(res.data);
      }
    } catch (e) {
      console.error('Error fetching adicionales:', e.message);
    }
  };

  const abrirModalAdicionalNuevo = () => {
    setAdicionalEditando(null);
    setFormAdicional({ nombre: '', precio: '' });
    setModalAdicionalVisible(true);
  };

  const abrirModalAdicionalEditar = (adic) => {
    setAdicionalEditando(adic);
    setFormAdicional({ nombre: adic.nombre, precio: adic.precio });
    setModalAdicionalVisible(true);
  };

  const guardarAdicional = async () => {
    if (!formAdicional.nombre || !formAdicional.precio) return toast.error("Completa los campos.");
    try {
      if (adicionalEditando) {
        await axios.put(`${serverUrl}/api/adicionales/${adicionalEditando.id}`, { ...formAdicional, precio: cleanNum(formAdicional.precio) });
        toast.success('Adicional actualizado');
      } else {
        await axios.post(`${serverUrl}/api/adicionales`, { ...formAdicional, precio: cleanNum(formAdicional.precio) });
        toast.success('Adicional creado');
      }
      setModalAdicionalVisible(false);
      cargarAdicionales();
    } catch (e) {
      toast.error("Error al guardar adicional");
    }
  };

  const eliminarAdicional = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este adicional?")) {
      try {
        await axios.delete(`${serverUrl}/api/adicionales/${id}`);
        toast.success('Adicional eliminado');
        cargarAdicionales();
      } catch (e) {
        toast.error("Error al eliminar adicional");
      }
    }
  };

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  useEffect(() => {
    if (printerType === 'usb' && window.electronAPI) {
      window.electronAPI.getPrinters().then(printers => setSystemPrinters(printers));
    }
  }, [printerType]);

  const savePrinterConfig = () => {
    localStorage.setItem('printerType', printerType);
    localStorage.setItem('printerIP', printerIP);
    localStorage.setItem('selectedSystemPrinter', selectedSystemPrinter);
    toast.success('Configuración de impresora guardada correctamente.');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  };

  const getProductoInfo = (prodId) => {
    return productos.find(p => p.id === prodId) || { nombre: 'Desconocido', precio: 0, emoji: '❓' };
  };

  const calcularEstadoCocina = (items) => {
    let pendientes = 0;
    let preparando = 0;
    let listos = 0;
    if (items && items.length > 0) {
      items.forEach(item => {
        if (item.estado === 'pendiente') pendientes += (item.cantidad || 1);
        else if (item.estado === 'preparando') preparando += (item.cantidad || 1);
        else if (item.estado === 'listo') listos += (item.cantidad || 1);
      });
    }
    return { pendientes, preparando, listos };
  };

  const calcularTotal = (pedido) => {
    if (!pedido) return 0;
    let sum = 0;
    if (pedido.items) {
      pedido.items.forEach(i => {
        sum += (i.precio || getProductoInfo(i.productoId || i.id).precio) * (i.cantidad || 1);
      });
    }
    return sum;
  };

  // Cálculos para el Dashboard
  const dashboardDataLocal = useMemo(() => {
    let total = 0;
    let ordenes = 0;
    const conteoProductos = {};
    let ingresosPorPago = { Efectivo: 0, Nequi: 0, Tarjeta: 0 };
    
    // Simular un flujo de ventas por horas (9am a 9pm)
    const ventasPorHora = Array.from({ length: 13 }, (_, i) => ({ hora: `${i + 9}:00`, ventas: 0 }));

    pedidos.forEach(p => {
      if (p.estado === 'completado') {
        ordenes++;
        
        let pedidoTotal = 0;
        if (p.items) {
          p.items.forEach(item => {
            const prod = getProductoInfo(item.productoId || item.id);
            const precio = item.precio || prod.precio;
            const cant = item.cantidad || 1;
            const subtotal = precio * cant;
            
            total += subtotal;
            pedidoTotal += subtotal;
            
            // Contabilizar productos
            if (conteoProductos[prod.nombre]) {
              conteoProductos[prod.nombre].cantidad += cant;
              conteoProductos[prod.nombre].ingresos += subtotal;
            } else {
              conteoProductos[prod.nombre] = { nombre: prod.nombre, emoji: prod.emoji, cantidad: cant, ingresos: subtotal };
            }
          });
        }
        
        // Asignar método de pago (simulado si no existe o usando p.metodoPago)
        const metodo = p.metodoPago || 'Efectivo'; 
        if (ingresosPorPago[metodo] !== undefined) ingresosPorPago[metodo] += pedidoTotal;
        else ingresosPorPago['Efectivo'] += pedidoTotal;
        
        // Simular hora de venta aleatoria o basada en timestamp
        const hourIndex = Math.floor(Math.random() * 13);
        ventasPorHora[hourIndex].ventas += pedidoTotal;
      }
    });

    const topProductos = Object.values(conteoProductos).sort((a, b) => b.cantidad - a.cantidad);
    
    // Mock Gastos
    const totalGastos = total * 0.4; // Simular 40% de gastos
    const balance = total - totalGastos;
    const porcentajeGastos = total > 0 ? (totalGastos / total) * 100 : 0;
    
    // Mock Deudores
    const deudoresMonto = 125000;
    
    const donutData = [
      { name: 'Efectivo', value: ingresosPorPago.Efectivo, color: '#2D6A3F' }, // green
      { name: 'Nequi / Davi', value: ingresosPorPago.Nequi, color: '#E8520A' }, // orange
      { name: 'Tarjeta', value: ingresosPorPago.Tarjeta, color: '#D97706' }, // yellow
    ].filter(d => d.value > 0);
    
    // Si no hay datos reales, poner un placeholder
    if (donutData.length === 0) donutData.push({ name: 'Sin ventas', value: 1, color: '#ccc' });

    return { 
      totalVentas: total, 
      totalOrdenes: ordenes, 
      productosVendidos: topProductos,
      totalGastos,
      balance,
      porcentajeGastos,
      deudoresMonto,
      donutData,
      ventasPorHora
    };
  }, [pedidos, productos]);
  
  const { totalVentas, totalOrdenes, productosVendidos, totalGastos, balance: localBalance, porcentajeGastos, deudoresMonto, donutData, ventasPorHora } = dashboardDataLocal;

  const abrirModalNuevo = () => {
    setProductoEditando(null);
    setFormProd({ nombre: '', precio: '', emoji: '🍔', cat: 1, desc: '', imagen: '' });
    setImageFile(null);
    setImagePreviewUrl(null);
    setModalVisible(true);
  };

  const abrirModalEditar = (prod) => {
    setProductoEditando(prod);
    setFormProd({ 
      nombre: prod.nombre, 
      precio: prod.precio, 
      emoji: prod.emoji || '🍔', 
      cat: prod.cat || 1, 
      desc: prod.desc || '', 
      imagen: prod.imagen || '' 
    });
    setImageFile(null);
    setImagePreviewUrl(prod.imagen || null);
    setModalVisible(true);
  };

  const guardarProducto = async () => {
    if (!formProd.nombre || !formProd.precio) return toast.error("Completa los campos.");
    try {
      let finalImageUrl = formProd.imagen;

      // Si el usuario seleccionó un nuevo archivo, súbelo primero
      if (imageFile) {
        const formData = new FormData();
        formData.append('imagen', imageFile);
        const uploadRes = await axios.post(`${serverUrl}/api/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', 'Bypass-Tunnel-Reminder': 'true' }
        });
        if (uploadRes.data.success) {
          finalImageUrl = uploadRes.data.url;
        }
      }

      const nuevoProd = {
        nombre: formProd.nombre,
        categoria: formProd.categoria,
        precio: Number(cleanNum(formProd.precio)),
        imagen: finalImageUrl
      };

      if (productoEditando) {
        // Actualizar
        // Nota: asumiendo que server.js maneja UPDATE por id, pero el POST general maneja ambos si se pasa id. 
        // Originalmente se usaba axios.put pero POST maneja ambos en server.js. Usaremos POST para consistencia.
        await axios.post(`${serverUrl}/api/productos`, { ...payload, id: productoEditando.id });
        toast.success('Producto actualizado exitosamente');
      } else {
        // Crear
        await axios.post(`${serverUrl}/api/productos`, payload);
        toast.success('Producto creado exitosamente');
      }
      setModalVisible(false);
      // Nota: Si el backend emite un socket de actualización, useSocket lo actualizará automáticamente,
      // si no, habría que forzar un refetch o agregarlo al estado local temporalmente.
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar el producto en el servidor. Revisa la consola o la ruta del API.");
    }
  };

  if (!adminToken) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
        <h2 style={{ color: 'var(--text)' }}>🔐 Acceso Administrativo</h2>
        <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '300px', backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {loginError && (
            <div style={{ backgroundColor: 'var(--red, #e74c3c)', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', textAlign: 'center' }}>
              {loginError}
            </div>
          )}
          <input type="text" placeholder="Usuario (ej. admin)" value={loginUser} onChange={(e) => { setLoginUser(e.target.value); setLoginError(''); }} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }} />
          <input type="password" placeholder="PIN" value={loginPin} onChange={(e) => { setLoginPin(e.target.value); setLoginError(''); }} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }} />
          <button type="submit" style={{ padding: '12px', backgroundColor: 'var(--brand)', color: 'white', borderRadius: '8px', fontWeight: 'bold' }}>Ingresar</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '24px', height: '100%' }}>
      {/* Sidebar Menú Admin */}
      <div style={{ flex: '0.6', display: 'flex', flexDirection: 'column', gap: '16px', borderRight: '1px solid var(--border)', paddingRight: '24px' }}>
        <h2 style={{ fontSize: '24px', color: 'var(--brand)' }}>⚙️ Configuración</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => setAdminTab('dashboard')} style={navBtnStyle(adminTab === 'dashboard')}>📊 Dashboard de Hoy</button>
          <button onClick={() => setAdminTab('productos')} style={navBtnStyle(adminTab === 'productos')}>🍔 Catálogo</button>
          <button onClick={() => setAdminTab('adicionales')} style={navBtnStyle(adminTab === 'adicionales')}>🍟 Adicionales</button>
          <button onClick={() => setAdminTab('historial')} style={navBtnStyle(adminTab === 'historial')}>🧾 Historial de Facturas</button>
          <button onClick={() => setAdminTab('usuarios')} style={navBtnStyle(adminTab === 'usuarios')}>👤 Gestión de Usuarios</button>
          <button onClick={() => setAdminTab('auditoria')} style={navBtnStyle(adminTab === 'auditoria')}>📋 Log de Auditoría</button>
          <button onClick={() => setAdminTab('mesas')} style={navBtnStyle(adminTab === 'mesas')}>🪑 Gestión de Mesas</button>
          <button onClick={() => setAdminTab('impresora')} style={navBtnStyle(adminTab === 'impresora')}>🖨️ Impresora Térmica</button>
        </div>
      </div>

      {/* Contenido Principal Admin */}
      <div style={{ flex: '2', display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: '16px' }}>
        
        {adminTab === 'impresora' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
            <h2 style={{ fontSize: '28px', color: 'var(--brand)', margin: 0 }}>🖨️ Configuración de Impresora</h2>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--text2)', marginBottom: '8px' }}>Tipo de Conexión</label>
                <select 
                  value={printerType} 
                  onChange={(e) => setPrinterType(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px' }}
                >
                  <option value="ip">Red Local (IP / WiFi)</option>
                  <option value="usb">Sistema / USB (Solo PC)</option>
                </select>
              </div>

              {printerType === 'ip' && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--text2)', marginBottom: '8px' }}>Dirección IP de la Impresora</label>
                  <input 
                    type="text" 
                    value={printerIP} 
                    onChange={(e) => setPrinterIP(e.target.value)}
                    placeholder="Ej: 192.168.1.100"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px' }}
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>Asegúrate de que la impresora esté conectada a la misma red WiFi/LAN.</p>
                </div>
              )}

              {printerType === 'usb' && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--text2)', marginBottom: '8px' }}>Seleccionar Impresora del Sistema</label>
                  {window.electronAPI ? (
                    <select 
                      value={selectedSystemPrinter} 
                      onChange={(e) => setSelectedSystemPrinter(e.target.value)}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px' }}
                    >
                      <option value="">-- Selecciona una impresora --</option>
                      {systemPrinters.map(p => (
                        <option key={p.name} value={p.name}>{p.name} {p.isDefault ? '(Predeterminada)' : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ color: 'var(--red)' }}>La conexión USB solo está disponible si inicias la app desde Electron (No en navegador web normal).</p>
                  )}
                </div>
              )}

              <button 
                onClick={savePrinterConfig}
                style={{ width: '100%', padding: '14px', backgroundColor: 'var(--brand)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Guardar Configuración
              </button>

            </div>
          </div>
        )}

        {adminTab === 'dashboard' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '28px', color: 'var(--brand)', margin: 0 }}>Dashboard Financiero</h2>
              
              <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--surf)', padding: '4px', borderRadius: '8px' }}>
                {['hoy', 'semana', 'mes'].map(rango => (
                  <button 
                    key={rango}
                    onClick={() => setDashboardRango(rango)}
                    style={{ 
                      padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                      backgroundColor: dashboardRango === rango ? 'var(--brand)' : 'transparent',
                      color: dashboardRango === rango ? 'white' : 'var(--text2)', transition: '0.2s'
                    }}
                  >
                    {rango.charAt(0).toUpperCase() + rango.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{...kpiCardStyle, cursor: 'pointer', backgroundColor: 'var(--surf)'}} onClick={() => setModalPedidosActivosVisible(true)} className="hover-lift">
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Pedidos Activos</span>
                <span style={{ fontSize: '32px', color: 'var(--orange)', fontWeight: '800' }}>{pedidos.filter(p => p.estado === 'activo').length}</span>
              </div>
              <div style={kpiCardStyle}>
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Ingresos (Ventas)</span>
                <span style={{ fontSize: '32px', color: 'var(--green)', fontWeight: '800' }}>{formatCurrency(dashboardData.ventas)}</span>
              </div>
              <div style={kpiCardStyle}>
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Egresos (Gastos)</span>
                <span style={{ fontSize: '32px', color: 'var(--red)', fontWeight: '800' }}>{formatCurrency(dashboardData.gastos)}</span>
              </div>
              <div style={kpiCardStyle}>
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Utilidad Neta</span>
                <span style={{ fontSize: '32px', color: dashboardData.balance >= 0 ? 'var(--brand)' : 'var(--red)', fontWeight: '800' }}>{formatCurrency(dashboardData.balance)}</span>
              </div>
              <div style={{...kpiCardStyle, backgroundColor: 'var(--orange)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer'}} onClick={() => setModalGastoVisible(true)}>
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>+ Registrar Gasto</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Desglose de Gastos */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--brand)', marginBottom: '16px', fontWeight: 'bold' }}>Distribución de Gastos</h3>
                <div style={{ height: '250px', width: '100%', flex: 1 }}>
                  {dashboardData.gastosPorCategoria && dashboardData.gastosPorCategoria.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboardData.gastosPorCategoria.map((c, i) => ({ name: c.categoria, value: c.total, color: ['#E8520A', '#2D6A3F', '#F4A261', '#2A9D8F', '#E9C46A'][i%5] }))}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none"
                        >
                          {dashboardData.gastosPorCategoria.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#E8520A', '#2D6A3F', '#F4A261', '#2A9D8F', '#E9C46A'][index%5]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>No hay gastos en este periodo</div>
                  )}
                </div>
              </div>

              {/* Flujo de ventas (Mantenemos el de hoy por compatibilidad o se puede usar el historial) */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--brand)', marginBottom: '16px', fontWeight: 'bold' }}>Flujo de Ventas (Hoy)</h3>
                <div style={{ height: '250px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ventasPorHora} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--orange)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--orange)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="hora" tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(val) => `$${val/1000}k`} tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                      <RechartsTooltip formatter={(value) => formatCurrency(value)} labelStyle={{ color: 'var(--brand)', fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="ventas" stroke="var(--orange)" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Últimos Egresos */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--brand)', margin: 0, fontWeight: 'bold' }}>Últimos Egresos</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: 'var(--surf2)' }}>
                  <tr>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Descripción</th>
                    <th style={thStyle}>Categoría</th>
                    <th style={thStyle}>Responsable</th>
                    <th style={{...thStyle, textAlign: 'right'}}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.ultimosGastos && dashboardData.ultimosGastos.map((gasto) => (
                    <tr key={gasto.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-lift-row">
                      <td style={tdStyle}>{gasto.fecha}</td>
                      <td style={{...tdStyle, fontWeight: 'bold'}}>{gasto.descripcion}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--surf3)', fontSize: '12px', fontWeight: 'bold' }}>
                          {gasto.categoria}
                        </span>
                      </td>
                      <td style={tdStyle}>{gasto.usuario || 'N/A'}</td>
                      <td style={{...tdStyle, textAlign: 'right', color: 'var(--red)', fontWeight: 'bold'}}>{formatCurrency(gasto.valor)}</td>
                    </tr>
                  ))}
                  {(!dashboardData.ultimosGastos || dashboardData.ultimosGastos.length === 0) && (
                    <tr>
                      <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)' }}>No hay gastos en este periodo</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {adminTab === 'productos' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '28px', color: 'var(--brand)', marginBottom: '24px' }}>Gestión de Catálogo</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              <div 
                onClick={abrirModalNuevo}
                style={{ padding: '20px', border: '2px dashed var(--orange)', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--orange)', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'rgba(232, 82, 10, 0.05)', transition: 'all 0.2s' }}
              >
                + Agregar Nuevo Producto
              </div>
              {productos.map(p => (
                <div key={p.id} style={{ padding: '16px', backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }} className="hover-lift">
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {p.imagen ? (
                      <div style={{ width: '64px', height: '64px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                        <img src={p.imagen} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ width: '64px', height: '64px', borderRadius: '12px', backgroundColor: 'var(--surf2)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '32px' }}>{p.emoji}</span>
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{p.nombre}</div>
                      <div style={{ color: 'var(--green)', fontWeight: '600', fontSize: '16px' }}>{formatCurrency(p.precio)}</div>
                    </div>
                  </div>
                  <button onClick={() => abrirModalEditar(p)} style={{ backgroundColor: 'var(--orange-light)', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ✏️ Editar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {adminTab === 'adicionales' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '28px', color: 'var(--brand)', marginBottom: '24px' }}>Gestión de Adicionales</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              <div 
                onClick={abrirModalAdicionalNuevo}
                style={{ padding: '20px', border: '2px dashed var(--orange)', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--orange)', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'rgba(232, 82, 10, 0.05)', transition: 'all 0.2s' }}
              >
                + Agregar Nuevo Adicional
              </div>
              {adicionalesAdmin.map(a => (
                <div key={a.id} style={{ padding: '16px', backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{a.nombre}</div>
                    <div style={{ color: 'var(--green)', fontWeight: '600', fontSize: '16px' }}>{formatCurrency(a.precio)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => abrirModalAdicionalEditar(a)} style={{ backgroundColor: 'var(--orange-light)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                      Editar
                    </button>
                    <button onClick={() => eliminarAdicional(a.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                      X
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {adminTab === 'mesas' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '28px', color: 'var(--brand)', marginBottom: '24px' }}>Gestión de Mesas</h2>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', maxWidth: '500px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--text)', marginBottom: '16px' }}>Cantidad de Mesas</h3>
              <p style={{ color: 'var(--text2)', marginBottom: '20px', fontSize: '14px' }}>
                Define la cantidad total de mesas físicas en el restaurante. Si reduces el número, asegúrate de que las mesas que se van a eliminar estén libres.
              </p>
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <input 
                  type="text" inputMode="numeric" 
                  min="1" 
                  max="100" 
                  value={numMesasInput}
                  onChange={(e) => setNumMesasInput(e.target.value)}
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '18px', width: '100px', textAlign: 'center' }}
                />
                <button 
                  onClick={async () => {
                    const cant = parseInt(numMesasInput);
                    if (isNaN(cant) || cant < 1) return toast.error("Cantidad inválida");
                    try {
                      const res = await axios.put(`${serverUrl}/api/mesas/cantidad`, {
                        cantidad: cant,
                        usuario: 'Admin'
                      }, { headers: { 'ngrok-skip-browser-warning': 'true' }});
                      if (res.data.success) toast.success("Cantidad de mesas actualizada");
                    } catch(e) {
                      toast.error(e.response?.data?.error || "Error al actualizar mesas");
                    }
                  }}
                  style={{ padding: '12px 24px', backgroundColor: 'var(--brand)', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Actualizar Mesas
                </button>
              </div>
              
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ color: 'var(--text)', marginBottom: '12px' }}>Estado Actual:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {mesas && mesas.map(m => (
                    <div key={m.num} style={{ 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      backgroundColor: m.estado === 'libre' ? 'var(--surf2)' : (m.estado === 'cuenta' ? '#FEE2E2' : '#FEF3C7'),
                      border: '1px solid var(--border)',
                      fontWeight: 'bold',
                      color: m.estado === 'libre' ? 'var(--text2)' : (m.estado === 'cuenta' ? '#DC2626' : '#D97706')
                    }}>
                      Mesa {m.num}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'historial' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '28px', color: 'var(--brand)', marginBottom: '24px' }}>Historial de Facturas</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {historialFacturas.length === 0 && (
                 <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text2)' }}>No hay facturas registradas aún.</div>
              )}
              {historialFacturas.map(p => {
                return (
                  <div key={p.uuid || p.id} style={{ padding: '16px', backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                        Mesa {p.mesa} <span style={{fontSize:'12px', fontWeight:'normal', color:'var(--text2)'}}>({p.metodo_pago})</span>
                      </div>
                      <div style={{ color: 'var(--text2)', fontSize: '12px' }}>
                        {new Date(p.fecha).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '20px', color: 'var(--green)' }}>
                      {formatCurrency(p.total)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* LOG DE AUDITORÍA */}
        {adminTab === 'auditoria' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '28px', color: 'var(--brand)', marginBottom: '24px' }}>Log de Auditoría</h2>
            
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--text)', marginBottom: '16px', fontWeight: 'bold' }}>📋 Filtros de Auditoría</h3>
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>Usuario:</label>
                  <input
                    type="text"
                    placeholder="Ej. Admin"
                    value={auditUserFilter}
                    onChange={(e) => setAuditUserFilter(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', backgroundColor: 'var(--surf2)' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>Fecha (AAAA-MM-DD):</label>
                  <input
                    type="text"
                    placeholder="Ej. 2026-06-08"
                    value={auditFechaFilter}
                    onChange={(e) => setAuditFechaFilter(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', backgroundColor: 'var(--surf2)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '8px' }}>Acción:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { id: '', label: 'Todos' },
                    { id: 'login', label: 'Login' },
                    { id: 'login_fallido', label: 'Login fallido' },
                    { id: 'logout', label: 'Logout' },
                    { id: 'pedido_creado', label: 'Pedido creado' },
                    { id: 'pedido_editado', label: 'Pedido editado' },
                    { id: 'pedido_cancelado', label: 'Pedido cancelado' },
                    { id: 'pedido_cobrado', label: 'Pedido cobrado' },
                    { id: 'gasto_registrado', label: 'Gasto registrado' },
                    { id: 'insumo_creado', label: 'Insumo creado' },
                    { id: 'entrada_inventario', label: 'Entrada inventario' },
                    { id: 'ajuste_inventario', label: 'Ajuste inventario' },
                    { id: 'usuario_creado', label: 'Usuario creado' },
                    { id: 'usuario_editado', label: 'Usuario editado' },
                    { id: 'pin_cambiado', label: 'PIN cambiado' }
                  ].map(a => {
                    const isSelected = auditAccionFilter === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setAuditAccionFilter(a.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          border: `1px solid ${isSelected ? 'var(--orange)' : 'var(--border)'}`,
                          backgroundColor: isSelected ? 'var(--orange)' : 'white',
                          color: isSelected ? 'white' : 'var(--text)',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={cargarAuditoria}
                style={{ backgroundColor: 'var(--brand)', color: 'white', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
              >
                Aplicar Filtros
              </button>
            </div>

            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', cursor: 'pointer' }}
              onClick={() => setShowAuditoriaList(!showAuditoriaList)}
            >
              <h3 style={{ fontSize: '18px', color: 'var(--brand)', margin: 0, fontWeight: 'bold' }}>Log de Eventos (Máx. 20)</h3>
              <span style={{ fontSize: '18px', color: 'var(--text2)' }}>{showAuditoriaList ? '▲' : '▼'}</span>
            </div>

            {showAuditoriaList && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '24px' }}>
                {auditoriaLogs.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                    No se encontraron registros de auditoría
                  </div>
                ) : (
                  auditoriaLogs.slice(0, 20).map(l => {
                    const isExpanded = expandedAuditId === l.id;
                    let badgeBg = '#E5E7EB';
                    let badgeText = '#4B5563';
                    if (l.accion.includes('fallido') || l.accion.includes('cancelado')) {
                      badgeBg = '#FEE2E2';
                      badgeText = '#DC2626';
                    } else if (l.accion.includes('creado') || l.accion.includes('cobrado') || l.accion === 'login') {
                      badgeBg = '#DCFCE7';
                      badgeText = '#15803D';
                    } else if (l.accion.includes('editado') || l.accion.includes('cambiado')) {
                      badgeBg = '#FEF3C7';
                      badgeText = '#D97706';
                    } else if (l.accion.includes('gasto')) {
                      badgeBg = '#F3E8FF';
                      badgeText = '#7E22CE';
                    }

                    return (
                      <div 
                        key={l.id} 
                        onClick={() => setExpandedAuditId(isExpanded ? null : l.id)}
                        style={{ padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text2)' }}>👤 {l.usuario}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text3)' }}>🕒 {new Date(l.fecha).toLocaleString('es-CO')}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ backgroundColor: badgeBg, color: badgeText, padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {l.accion}
                          </span>
                          <span style={{ color: 'var(--text3)' }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '14px', color: 'var(--text)' }}>
                            {l.detalle}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
        
        {/* GESTIÓN DE USUARIOS */}
        {adminTab === 'usuarios' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '28px', color: 'var(--brand)', margin: 0 }}>Gestión de Usuarios</h2>
              <button 
                onClick={() => {
                  setEditUserSel(null);
                  setIsChangingPin(false);
                  setFormUser({ nombre: '', pin: '', rol: 'pedido', activo: true });
                  setUserModalVisible(true);
                }}
                style={{ backgroundColor: 'var(--orange)', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                + Nuevo Usuario
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {usuarios.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                  No hay usuarios registrados
                </div>
              ) : (
                usuarios.map(u => (
                  <div key={u.id} style={{ padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{u.nombre}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                        Roles: {u.roles ? u.roles.map(r => ROLES_DISPONIBLES.find(x => x.id === r)?.label || r).join(', ') : ''}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      {u.nombre !== 'Administrador' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: u.activo ? 'var(--green)' : 'var(--text3)' }}>
                            {u.activo ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                          <div 
                            onClick={() => toggleEstadoUsuario(u.id, u.activo, u.nombre)}
                            style={{
                              width: '40px', height: '24px', borderRadius: '12px',
                              backgroundColor: u.activo ? 'var(--green)' : 'var(--border)',
                              display: 'flex', alignItems: 'center',
                              padding: '2px', cursor: 'pointer',
                              justifyContent: u.activo ? 'flex-end' : 'flex-start'
                            }}
                          >
                            <div style={{ width: '20px', height: '20px', borderRadius: '10px', backgroundColor: 'white' }} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--green)' }}>
                            ACTIVO (Fijo)
                          </span>
                        </div>
                      )}

                      <button 
                        onClick={() => {
                          setEditUserSel(u);
                          setIsChangingPin(false);
                          setFormUser({ nombre: u.nombre, pin: '', roles: u.roles || [], activo: !!u.activo });
                          setUserModalVisible(true);
                        }}
                        style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--orange)', color: 'var(--orange)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        Editar
                      </button>

                      <button 
                        onClick={() => {
                          setEditUserSel(u);
                          setIsChangingPin(true);
                          setFormUser({ nombre: u.nombre, pin: '', roles: u.roles || [], activo: !!u.activo });
                          setUserModalVisible(true);
                        }}
                        style={{ padding: '8px 16px', backgroundColor: 'var(--brand)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        Cambiar PIN
                      </button>

                      {u.nombre !== 'Administrador' && (
                        <button 
                          onClick={() => eliminarUsuario(u.id, u.nombre)}
                          style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Producto */}
      {modalVisible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="animate-fade-in" style={{ backgroundColor: 'white', padding: '32px', borderRadius: '24px', width: '400px', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ color: 'var(--brand)', marginBottom: '24px' }}>
              {productoEditando ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Categoría</label>
                <select 
                  value={formProd.cat} 
                  onChange={e => setFormProd({...formProd, cat: Number(e.target.value)})} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px', backgroundColor: 'white' }} 
                >
                  <option value={1}>Hamburguesas</option>
                  <option value={2}>Perros Calientes</option>
                  <option value={3}>Burritos</option>
                  <option value={4}>Salchipapas</option>
                  <option value={5}>Mazorcadas</option>
                  <option value={6}>Jugos Naturales</option>
                  <option value={7}>Limonadas</option>
                  <option value={8}>Bebidas / Otros</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Nombre del Producto</label>
                <input 
                  value={formProd.nombre} 
                  onChange={e => setFormProd({...formProd, nombre: e.target.value})} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Precio (COP)</label>
                <input 
                  type="text" inputMode="numeric"
                  value={formProd.precio} 
                  onChange={e => setFormProd({...formProd, precio: formatNumberInput(e.target.value)})} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Descripción (Ingredientes)</label>
                <textarea 
                  value={formProd.desc} 
                  onChange={e => setFormProd({...formProd, desc: e.target.value})} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', minHeight: '60px', resize: 'vertical' }} 
                  placeholder="Ej. Pan artesanal, 125g carne res..."
                />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Emoji</label>
                  <input 
                    value={formProd.emoji} 
                    onChange={e => setFormProd({...formProd, emoji: e.target.value})} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '18px', marginBottom: '16px' }} 
                  />
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Foto del Producto</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={e => setImageFile(e.target.files[0])} 
                    style={{ display: 'none' }}
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ 
                      flex: 1,
                      border: '2px dashed var(--orange)', 
                      borderRadius: '12px', 
                      display: 'flex', 
                      flexDirection: 'column',
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      cursor: 'pointer', 
                      backgroundColor: 'rgba(232, 82, 10, 0.05)',
                      padding: '16px',
                      textAlign: 'center',
                      gap: '8px',
                      minHeight: '100px'
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>📸</span>
                    <span style={{ fontSize: '14px', color: 'var(--orange)', fontWeight: 'bold' }}>
                      {imageFile ? 'Cambiar Foto' : 'Subir Foto'}
                    </span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Vista Previa</label>
                  <div style={{ 
                    width: '100%', 
                    aspectRatio: '1', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border)', 
                    backgroundColor: 'var(--surf2)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    {imagePreviewUrl ? (
                      <img src={imagePreviewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '48px', opacity: 0.5 }}>{formProd.emoji}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button 
                onClick={() => setModalVisible(false)}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid var(--border)', backgroundColor: 'transparent', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={guardarProducto}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--orange)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Usuario */}
      {userModalVisible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="animate-fade-in" style={{ backgroundColor: 'white', padding: '32px', borderRadius: '24px', width: '400px', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ color: 'var(--brand)', marginBottom: '24px' }}>
              {isChangingPin ? 'Cambiar PIN' : (editUserSel ? 'Editar Usuario' : 'Nuevo Usuario')}
            </h2>
            
            {userFormError && (
              <div style={{ backgroundColor: 'var(--red, #e74c3c)', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
                {userFormError}
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!isChangingPin && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Nombre del Usuario</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Juan"
                      value={formUser.nombre} 
                      onChange={e => { setFormUser({...formUser, nombre: e.target.value}); setUserFormError(''); }} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px' }} 
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Roles Asignados</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {ROLES_DISPONIBLES.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            const current = formUser.roles || [];
                            if (current.includes(r.id)) {
                              setFormUser({ ...formUser, roles: current.filter(x => x !== r.id) });
                            } else {
                              setFormUser({ ...formUser, roles: [...current, r.id] });
                            }
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            border: `2px solid ${(formUser.roles || []).includes(r.id) ? 'var(--brand)' : 'var(--border)'}`,
                            backgroundColor: (formUser.roles || []).includes(r.id) ? 'var(--brand)' : 'var(--surface)',
                            color: (formUser.roles || []).includes(r.id) ? 'white' : 'var(--text)',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          {(formUser.roles || []).includes(r.id) ? '✓ ' : ''}{r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(!editUserSel || isChangingPin) && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>
                    {isChangingPin ? 'Nuevo PIN (4 a 6 dígitos)' : 'PIN de Acceso (4 a 6 dígitos)'}
                  </label>
                  <input 
                    type="password" 
                    placeholder="****"
                    value={formUser.pin} 
                    onChange={e => { setFormUser({...formUser, pin: e.target.value}); setUserFormError(''); }} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px' }} 
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
              <button 
                onClick={() => { setUserModalVisible(false); setUserFormError(''); }} 
                style={{ flex: 1, padding: '16px', backgroundColor: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={guardarUsuario} 
                style={{ flex: 1, padding: '16px', backgroundColor: 'var(--brand)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal para Registrar Gasto */}
      {modalGastoVisible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="animate-fade-in" style={{ backgroundColor: 'white', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '24px', color: 'var(--brand)', margin: '0 0 24px 0' }}>Registrar Gasto</h3>
            <form onSubmit={handleRegistrarGasto} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Descripción del Gasto</label>
                <input 
                  type="text" 
                  value={formGasto.descripcion} 
                  onChange={e => setFormGasto({...formGasto, descripcion: e.target.value})}
                  placeholder="Ej. Pago de Internet"
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid var(--border)', fontSize: '16px' }}
                  required
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Categoría</label>
                <select 
                  value={formGasto.categoria} 
                  onChange={e => setFormGasto({...formGasto, categoria: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid var(--border)', fontSize: '16px', backgroundColor: 'white' }}
                >
                  {["Proveedores", "Servicios", "Nómina", "Mantenimiento", "Varios"].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Monto ($)</label>
                <input 
                  type="text" inputMode="numeric" 
                  value={formGasto.valor} 
                  onChange={e => setFormGasto({...formGasto, valor: formatNumberInput(e.target.value)})}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid var(--border)', fontSize: '16px' }}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setModalGastoVisible(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--surf3)', color: 'var(--text)', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--orange)', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Adicionales */}
      {modalAdicionalVisible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="animate-fade-in" style={{ backgroundColor: 'white', padding: '32px', borderRadius: '24px', width: '400px', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ color: 'var(--brand)', marginBottom: '24px' }}>
              {adicionalEditando ? 'Editar Adicional' : 'Nuevo Adicional'}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Nombre del Adicional</label>
                <input 
                  value={formAdicional.nombre} 
                  onChange={e => setFormAdicional({...formAdicional, nombre: e.target.value})} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Precio (COP)</label>
                <input 
                  type="text" inputMode="numeric"
                  value={formAdicional.precio} 
                  onChange={e => setFormAdicional({...formAdicional, precio: formatNumberInput(e.target.value)})} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px' }} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button 
                onClick={() => setModalAdicionalVisible(false)}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid var(--border)', backgroundColor: 'transparent', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={guardarAdicional}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--orange)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalles Pedidos Activos */}
      {modalPedidosActivosVisible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '24px' }}>
          <div className="animate-scale-in" style={{ backgroundColor: 'var(--bg)', borderRadius: '24px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface)' }}>
              <h2 style={{ margin: 0, color: 'var(--brand)', fontSize: '24px' }}>🍔 Detalle de Pedidos Activos</h2>
              <button onClick={() => setModalPedidosActivosVisible(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text2)' }}>✕</button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: 'var(--surf2)' }}>
              {pedidos.filter(p => p.estado === 'activo').length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '18px', padding: '40px' }}>No hay pedidos activos en este momento.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {pedidos.filter(p => p.estado === 'activo').map(p => {
                    const cocina = calcularEstadoCocina(p.items);
                    const total = calcularTotal(p);
                    const isLlevar = isNaN(Number(p.mesa));
                    return (
                      <div key={p.uuid} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h3 style={{ margin: 0, color: 'var(--brand)', fontSize: '20px' }}>
                            {isLlevar ? p.mesa : `Mesa ${p.mesa}`}
                          </h3>
                          <span style={{ fontWeight: '900', fontSize: '18px', color: 'var(--green)' }}>{formatCurrency(total)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px', flex: 1 }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text2)', marginBottom: '4px' }}>Estado Cocina:</span>
                          {cocina.pendientes > 0 && <span style={{ color: 'var(--red)', fontSize: '14px', fontWeight: 'bold' }}>• {cocina.pendientes} Pendientes</span>}
                          {cocina.preparando > 0 && <span style={{ color: 'var(--orange)', fontSize: '14px', fontWeight: 'bold' }}>• {cocina.preparando} Preparando</span>}
                          {cocina.listos > 0 && <span style={{ color: 'var(--green)', fontSize: '14px', fontWeight: 'bold' }}>• {cocina.listos} Listos</span>}
                          {cocina.pendientes === 0 && cocina.preparando === 0 && cocina.listos === 0 && <span style={{ color: 'var(--text3)', fontSize: '14px' }}>Sin ítems de cocina</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                          Inició a las: {p.hora}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtnStyle = (isActive) => ({
  padding: '12px 16px',
  border: 'none',
  borderRadius: '12px',
  textAlign: 'left',
  fontSize: '16px',
  fontWeight: 'bold',
  cursor: 'pointer',
  backgroundColor: isActive ? 'var(--orange-light)' : 'transparent',
  color: isActive ? 'white' : 'var(--text2)',
  transition: 'all 0.2s',
  border: isActive ? 'none' : '1px solid transparent',
});

const kpiCardStyle = {
  flex: 1, 
  backgroundColor: 'white', 
  border: '1px solid var(--border)', 
  borderRadius: '16px', 
  padding: '24px', 
  display: 'flex', 
  flexDirection: 'column', 
  gap: '8px',
  boxShadow: 'var(--shadow-sm)'
};

const thStyle = {
  padding: '16px',
  textAlign: 'left',
  fontWeight: '800',
  color: 'var(--brand)',
  borderBottom: '2px solid var(--border)'
};

const tdStyle = {
  padding: '16px',
  color: 'var(--text)'
};
