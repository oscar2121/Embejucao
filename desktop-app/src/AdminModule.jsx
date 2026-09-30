import { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import DashboardFinanciero from '../../admin/DashboardFinanciero';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const formatNumberInput = (text) => {
  if (!text) return '';
  return text.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const cleanNum = (val) => {
  if (!val) return '0';
  return String(val).replace(/\./g, '');
};

const sugerirEmojiPorCategoria = (categoriaTexto) => {
  const c = (categoriaTexto || '').toLowerCase().trim();
  if (c.includes('hamburguesa') || c.includes('burger')) return '🍔';
  if (c.includes('perro') || c.includes('chori')) return '🌭';
  if (c.includes('burro') || c.includes('burrito') || c.includes('wrap')) return '🌯';
  if (c.includes('mazorcada')) return '🌽';
  if (c.includes('papa') || c.includes('salchipapa')) return '🍟';
  if (c.includes('bebida') || c.includes('jugo') || c.includes('gaseosa') || c.includes('agua')) return '🥤';
  if (c.includes('cerveza') || c.includes('trago')) return '🍺';
  if (c.includes('postre') || c.includes('helado')) return '🍰';
  if (c.includes('pizza')) return '🍕';
  return '🍽️';
};

const sugerirEmojiPorNombre = (nombre) => {
  if (!nombre) return '🍔';
  const n = String(nombre).toLowerCase().trim();
  if (n.includes('pizza')) return '🍕';
  if (n.includes('cafe') || n.includes('café') || n.includes('tinto') || n.includes('capuchino') || n.includes('cappuccino') || n.includes('aromatica') || n.includes('aromática') || n.includes('chocolate')) return '☕';
  if (n.includes('cerveza') || n.includes('poker') || n.includes('aguila') || n.includes('águila') || n.includes('corona') || n.includes('club') || n.includes('heineken') || n.includes('stella')) return '🍺';
  if (n.includes('jugo') || n.includes('limonada') || n.includes('mango') || n.includes('fresa') || n.includes('mora') || n.includes('maracuya') || n.includes('maracuyá') || n.includes('lulo') || n.includes('naranja') || n.includes('guanabana') || n.includes('guanábana')) return '🥤';
  if (n.includes('perro') || n.includes('hot dog') || n.includes('salchipapa') || n.includes('choriperro')) return '🌭';
  if (n.includes('burrito') || n.includes('taco') || n.includes('quesadilla') || n.includes('wrap') || n.includes('fajita')) return '🌯';
  if (n.includes('postre') || n.includes('cake') || n.includes('pastel') || n.includes('torta') || n.includes('helado') || n.includes('brownie')) return '🍰';
  if (n.includes('agua') || n.includes('gaseosa') || n.includes('coca') || n.includes('postobon') || n.includes('postobón') || n.includes('soda') || n.includes('red bull') || n.includes('hit') || n.includes('quatro') || n.includes('colombiana')) return '🍾';
  if (n.includes('hamburguesa') || n.includes('burger') || n.includes('carne') || n.includes('clasica') || n.includes('clásica') || n.includes('especial') || n.includes('doble')) return '🍔';
  if (n.includes('papa') || n.includes('frita') || n.includes('fritas') || n.includes('chips')) return '🍟';
  if (n.includes('alita') || n.includes('alitas') || n.includes('pollo') || n.includes('nugget') || n.includes('crispy')) return '🍗';
  if (n.includes('sandwich') || n.includes('sándwich') || n.includes('sub')) return '🥪';
  if (n.includes('mazorcada') || n.includes('maiz') || n.includes('maíz') || n.includes('choclo')) return '🌽';
  if (n.includes('vino') || n.includes('copa')) return '🍷';
  if (n.includes('coctel') || n.includes('cóctel') || n.includes('mojito') || n.includes('margarita')) return '🍸';
  return '🍽️';
};

const sugerirGrupoReporte = (categoriaTexto, nombreTexto = '') => {
  const c = String(categoriaTexto || '').toLowerCase().trim();
  const n = String(nombreTexto || '').toLowerCase().trim();
  if (c.includes('cerveza') || n.includes('cerveza') || n.includes('corona') || n.includes('club colombia') || n.includes('aguila') || n.includes('poker')) return 'cervezas';
  if (c === 'gaseosas' || c === 'bebidas' || n.includes('gaseosa') || n.includes('coca cola') || n.includes('postobon') || n.includes('agua') || n.includes('hit') || n.includes('red bull')) return 'gaseosas_embotellados';
  if (c.includes('jugo') || n.includes('jugo') || n.includes('limonada')) return 'jugos_naturales';
  if (n.includes('cafe') || n.includes('tinto') || n.includes('aromatica') || n.includes('chocolate') || n.includes('cappuccino')) return 'bebidas_calientes';
  return 'comida';
};

export function AdminModule({ pedidos, productos, serverUrl, mesas, socket }) {
  const [adminTab, setAdminTab] = useState('catalogo');
  const [listaProductos, setListaProductos] = useState(productos || []);

  const [adminToken, setAdminToken] = useState(null);
  const [loginPin, setLoginPin] = useState('');
  const [loginUser, setLoginUser] = useState('');
  const [loginError, setLoginError] = useState('');

  // Estados de Impresora
  const [printerType, setPrinterType] = useState(localStorage.getItem('printerType') || 'ip');
  const [printerIP, setPrinterIP] = useState(localStorage.getItem('printerIP') || '');
  const [systemPrinters, setSystemPrinters] = useState([]);
  const [selectedSystemPrinter, setSelectedSystemPrinter] = useState(localStorage.getItem('selectedSystemPrinter') || '');
  
  // Estados para el Modal de Productos / Categorías Unificado
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSubTab, setModalSubTab] = useState('producto'); // 'producto' | 'categorias'
  const [productoEditando, setProductoEditando] = useState(null); // null = Crear Nuevo, Object = Editar
  const [formProd, setFormProd] = useState({ nombre: '', precio: '', emoji: '🍽️', categoria: '', desc: '', imagen: '', disp: true, grupo_reporte: 'comida' });
  const [emojiManual, setEmojiManual] = useState(false);
  const [catFiltro, setCatFiltro] = useState('Todos');
  const [guardandoProd, setGuardandoProd] = useState(false);

  const [categoriasDinamicas, setCategoriasDinamicas] = useState(['Todos', 'Hamburguesas', 'Perros', 'Burritos', 'Sandwich', 'Bebidas', 'Otros']);
  const [categoriasFull, setCategoriasFull] = useState([]);
  const [nuevaCatNombre, setNuevaCatNombre] = useState('');
  const [catEditando, setCatEditando] = useState(null);
  const [catEditNombre, setCatEditNombre] = useState('');
  const [modoNuevaCat, setModoNuevaCat] = useState(false);
  const [categoriaInput, setCategoriaInput] = useState('');

  const cargarCatalogo = async () => {
    try {
      const targetUrl = serverUrl || 'http://localhost:3001';
      const [resProd, resCat] = await Promise.all([
        axios.get(`${targetUrl}/api/productos`, { headers: { 'ngrok-skip-browser-warning': 'true' } }),
        axios.get(`${targetUrl}/api/categorias`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      ]);
      const prodsCargados = resProd.data?.productos || [];
      setListaProductos(prodsCargados);

      const rawCats = Array.isArray(resCat.data) ? resCat.data : (resCat.data?.categorias || []);
      const sortedRawCats = [...rawCats].sort((a, b) => {
        const nomA = typeof a === 'string' ? a : (a.nombre || a.categoria || '');
        const nomB = typeof b === 'string' ? b : (b.nombre || b.categoria || '');
        return nomA.localeCompare(nomB, 'es', { sensitivity: 'base' });
      });
      setCategoriasFull(sortedRawCats);

      const catNames = sortedRawCats.map(c => typeof c === 'string' ? c : (c.nombre || c.categoria)).filter(Boolean);
      const prodsCats = prodsCargados.map(p => {
        const c = p?.categoria ?? p?.cat;
        return typeof c === 'string' ? c : (c?.nombre || c?.categoria || '');
      }).filter(Boolean);

      const sortedNames = [...new Set([...catNames, ...prodsCats, 'Otros'])].sort((a, b) =>
        a.localeCompare(b, 'es', { sensitivity: 'base' })
      );
      setCategoriasDinamicas(['Todos', ...sortedNames]);
    } catch (e) {
      console.error("Error cargando catalogo", e);
    }
  };

  useEffect(() => {
    if (adminTab === 'productos' || adminTab === 'catalogo') {
      cargarCatalogo();
    }
  }, [adminTab, serverUrl]);

  // Escucha de Socket en Desktop para tiempo real
  useEffect(() => {
    if (socket) {
      const recargarCatalogo = () => {
        cargarCatalogo();
      };
      socket.on('catalogo_actualizado', recargarCatalogo);
      socket.on('productos_actualizados', recargarCatalogo);
      return () => {
        socket.off('catalogo_actualizado', recargarCatalogo);
        socket.off('productos_actualizados', recargarCatalogo);
      };
    }
  }, [socket]);

  // Sincronizar si la prop externa cambia
  useEffect(() => {
    if (Array.isArray(productos)) {
      setListaProductos(productos);
    }
  }, [productos]);

  const obtenerCategoriaReal = (prod) => {
    if (!prod) return 'Otros';
    const raw = prod.categoria ?? prod.cat;
    if (typeof raw === 'string') return raw.trim() || 'Otros';
    if (typeof raw === 'object' && raw !== null) return (raw.nombre || raw.categoria || 'Otros').trim();
    return raw ? String(raw).trim() : 'Otros';
  };

  const productosFiltradosVista = useMemo(() => {
    const prods = listaProductos || [];
    const conCat = prods.map(p => ({ ...p, _catReal: obtenerCategoriaReal(p) }));
    if (catFiltro === 'Todos') return conCat;
    const catFiltroLower = String(catFiltro || '').toLowerCase().trim();
    return conCat.filter(p => p._catReal.toLowerCase() === catFiltroLower);
  }, [listaProductos, catFiltro]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleCambioCategoria = (valor) => {
    const emojiDetectado = sugerirEmojiPorCategoria(valor);
    const grupoSugerido = sugerirGrupoReporte(valor, formProd.nombre);
    setFormProd((prev) => ({
      ...prev,
      categoria: valor,
      emoji: emojiDetectado,
      grupo_reporte: prev.grupo_reporte && prev.grupo_reporte !== 'comida' ? prev.grupo_reporte : grupoSugerido
    }));
  };

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
  const [dashboardFechaPersonalizada, setDashboardFechaPersonalizada] = useState('');
  const [cajaActual, setCajaActual] = useState(null);
  const [dashboardData, setDashboardData] = useState({ ventas: 0, gastos: 0, balance: 0, gastosPorCategoria: [], ultimosGastos: [] });
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

  // Estados para Insumos
  const [insumos, setInsumos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [modalInsumoOpen, setModalInsumoOpen] = useState(false);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState(null);
  const [tipoMov, setTipoMov] = useState('entrada');
  const [modalMovimiento, setModalMovimiento] = useState(false);

  useEffect(() => {
    if (adminTab === 'historial') {
      axios.get(`${serverUrl}/api/ventas`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
        .then(res => {
          if (res.data.ventas) setHistorialFacturas(res.data.ventas);
        })
        .catch(e => console.error("Error cargando historial de facturas", e));
    }
  }, [adminTab, serverUrl]);

  const cargarInventarioDesktop = async () => {
    try {
      const targetUrl = serverUrl || 'http://localhost:3001';
      const [resIns, resMov] = await Promise.all([
        axios.get(`${targetUrl}/api/inventario/insumos`, { headers: { 'ngrok-skip-browser-warning': 'true' } }).catch(() => ({ data: { insumos: [] } })),
        axios.get(`${targetUrl}/api/inventario/movimientos`, { headers: { 'ngrok-skip-browser-warning': 'true' } }).catch(() => ({ data: { movimientos: [] } }))
      ]);

      setInsumos(resIns.data?.insumos || []);
      setMovimientos(resMov.data?.movimientos || []);
    } catch (err) {
      console.error("Error al cargar insumos/kardex:", err);
    }
  };

  const eliminarInsumoDesktop = async (ins) => {
    if (!ins || !ins.id) return;
    if (!window.confirm(`¿Estás seguro de eliminar el insumo "${ins.nombre}"?\n\nEsta acción no se puede deshacer. Se eliminarán sus registros y se revertirá cualquier gasto asociado devolviendo el dinero.`)) {
      return;
    }
    try {
      const targetUrl = serverUrl || 'http://localhost:3001';
      const res = await axios.delete(`${targetUrl}/api/inventario/insumos/${ins.id}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.data && res.data.success) {
        if (typeof toast !== 'undefined' && toast.success) {
          toast.success("Insumo y sus gastos asociados eliminados correctamente. Dinero restaurado.");
        } else {
          alert("Insumo y gastos asociados eliminados correctamente.");
        }
        cargarInventarioDesktop();
        if (typeof cargarGastos === 'function') cargarGastos(filtroGastosInicio, filtroGastosFin);
        if (typeof cargarGastosPorGrupo === 'function') cargarGastosPorGrupo(filtroProdInicio, filtroProdFin);
        if (typeof cargarConsolidado === 'function') cargarConsolidado();
      } else {
        alert("⚠️ Error al eliminar el insumo");
      }
    } catch (err) {
      console.error("Error al eliminar insumo:", err);
      alert("⚠️ Error al eliminar insumo: " + (err.response?.data?.error || err.message));
    }
  };

  useEffect(() => {
    if (adminTab === 'insumos') {
      cargarInventarioDesktop();
    }
  }, [adminTab]);

  // Estados para Productividad y Reinversión
  const [productividadEnVivo, setProductividadEnVivo] = useState({
    comida: 0,
    jugos_naturales: 0,
    cervezas: 0,
    gaseosas_embotellados: 0,
    bebidas_calientes: 0,
    total_turno: 0
  });
  const [cargandoProdVivo, setCargandoProdVivo] = useState(false);
  const [sesionActivaInfo, setSesionActivaInfo] = useState(null);

  const getPrimerDiaMes = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const getHoyStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [historialProdData, setHistorialProdData] = useState([]);
  const [filtroProdInicio, setFiltroProdInicio] = useState(getPrimerDiaMes());
  const [filtroProdFin, setFiltroProdFin] = useState(getHoyStr());
  const [cargandoHistorialProd, setCargandoHistorialProd] = useState(false);

  // Gran acumulado consolidado de todo el período
  const acumuladoPeriodo = useMemo(() => {
    return (historialProdData || []).reduce((acc, dia) => {
      acc.comida += Number(dia.comida) || 0;
      acc.jugos_naturales += Number(dia.jugos_naturales) || 0;
      acc.cervezas += Number(dia.cervezas) || 0;
      acc.gaseosas_embotellados += Number(dia.gaseosas_embotellados) || 0;
      acc.bebidas_calientes += Number(dia.bebidas_calientes) || 0;
      acc.total_general += Number(dia.total_dia) || 0;
      return acc;
    }, { comida: 0, jugos_naturales: 0, cervezas: 0, gaseosas_embotellados: 0, bebidas_calientes: 0, total_general: 0 });
  }, [historialProdData]);

  // Estados del Módulo de Gastos / Egresos
  const [gastosData, setGastosData] = useState([]);
  const [gastosResumen, setGastosResumen] = useState({ total_efectivo: 0, total_transferencia: 0, total_gastos: 0 });
  const [gastosPorGrupo, setGastosPorGrupo] = useState({
    comida: 0,
    jugos_naturales: 0,
    cervezas: 0,
    gaseosas_embotellados: 0,
    bebidas_calientes: 0,
    gastos_generales: 0,
    total_gastado: 0,
    gastado_efectivo: 0,
    gastado_transferencia: 0
  });
  const [cargandoGastos, setCargandoGastos] = useState(false);
  const [filtroGastosInicio, setFiltroGastosInicio] = useState(getPrimerDiaMes());
  const [filtroGastosFin, setFiltroGastosFin] = useState(getHoyStr());
  const [modalGastoVisible, setModalGastoVisible] = useState(false);
  const [formGasto, setFormGasto] = useState({
    categoria: 'Ingredientes / Materia Prima',
    descripcion: '',
    monto: '',
    metodo_pago: 'efectivo',
    grupo_afectado: 'comida',
    fuente_financiamiento: 'caja_negocio'
  });
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  const cargarProductividadEnVivo = async () => {
    setCargandoProdVivo(true);
    try {
      const targetUrl = serverUrl || 'http://localhost:3001';
      const res = await axios.get(`${targetUrl}/api/caja/productividad-en-vivo`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.data?.success && res.data?.productividad) {
        setProductividadEnVivo(res.data.productividad);
        setSesionActivaInfo(res.data.sesion_activa || null);
      }
    } catch (err) {
      console.error("Error al cargar productividad en vivo:", err);
    } finally {
      setCargandoProdVivo(false);
    }
  };

  const cargarHistorialProd = async (fInicio = filtroProdInicio, fFin = filtroProdFin, rango = '') => {
    setCargandoHistorialProd(true);
    try {
      const targetUrl = serverUrl || 'http://localhost:3001';
      let url = `${targetUrl}/api/reportes/productividad/historial`;
      const params = new URLSearchParams();
      if (rango) {
        params.append('rango', rango);
      } else if (fInicio === getPrimerDiaMes() && (!fFin || fFin === getHoyStr())) {
        params.append('rango', 'mes');
      }
      if (fInicio) params.append('fecha_inicio', fInicio);
      if (fFin) params.append('fecha_fin', fFin);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axios.get(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      setHistorialProdData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error al cargar historial productividad:", err);
      toast.error("⚠️ Error al consultar historial de productividad");
    } finally {
      setCargandoHistorialProd(false);
    }
  };

  const cargarGastos = async (fInicio = filtroGastosInicio, fFin = filtroGastosFin, rango = '') => {
    setCargandoGastos(true);
    try {
      const targetUrl = serverUrl || 'http://localhost:3001';
      let url = `${targetUrl}/api/gastos`;
      const params = new URLSearchParams();
      if (rango) {
        params.append('rango', rango);
      } else if (fInicio === getPrimerDiaMes() && (!fFin || fFin === getHoyStr())) {
        params.append('rango', 'mes');
      }
      if (fInicio) params.append('fecha_inicio', fInicio);
      if (fFin) params.append('fecha_fin', fFin);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axios.get(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      if (res.data) {
        setGastosResumen({
          total_efectivo: Number(res.data.total_efectivo) || 0,
          total_transferencia: Number(res.data.total_transferencia) || 0,
          total_gastos: Number(res.data.total_gastos) || 0
        });
        setGastosData(Array.isArray(res.data.lista) ? res.data.lista : (Array.isArray(res.data.gastos) ? res.data.gastos : []));
      }
    } catch (err) {
      console.error("Error al cargar gastos:", err);
      toast.error("⚠️ Error al consultar gastos");
    } finally {
      setCargandoGastos(false);
    }
  };

  const cargarGastosPorGrupo = async (fInicio = filtroProdInicio, fFin = filtroProdFin, rango = '') => {
    try {
      const targetUrl = serverUrl || 'http://localhost:3001';
      let url = `${targetUrl}/api/gastos/resumen-por-grupo`;
      const params = new URLSearchParams();
      if (rango) {
        params.append('rango', rango);
      } else if (fInicio === getPrimerDiaMes() && (!fFin || fFin === getHoyStr())) {
        params.append('rango', 'mes');
      }
      if (fInicio) params.append('fecha_inicio', fInicio);
      if (fFin) params.append('fecha_fin', fFin);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axios.get(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      const map = {
        comida: 0,
        jugos_naturales: 0,
        cervezas: 0,
        gaseosas_embotellados: 0,
        bebidas_calientes: 0,
        gastos_generales: 0,
        total_gastado: 0,
        gastado_efectivo: 0,
        gastado_transferencia: 0
      };
      let totalGastado = 0;
      let totalEf = 0;
      let totalTr = 0;
      if (Array.isArray(res.data)) {
        res.data.forEach(item => {
          const key = String(item.grupo_afectado || '').toLowerCase().trim();
          const montoGasto = Number(item.total_gastado) || 0;
          const montoEf = Number(item.gastado_efectivo) || 0;
          const montoTr = Number(item.gastado_transferencia) || 0;
          totalGastado += montoGasto;
          totalEf += montoEf;
          totalTr += montoTr;
          if (key && map.hasOwnProperty(key)) {
            map[key] = montoGasto;
          } else {
            map.gastos_generales = (map.gastos_generales || 0) + montoGasto;
          }
        });
      }
      map.total_gastado = totalGastado;
      map.gastado_efectivo = totalEf;
      map.gastado_transferencia = totalTr;
      setGastosPorGrupo(map);
    } catch (err) {
      console.error("Error al cargar resumen de gastos por grupo:", err);
    }
  };

  const handleActualizarGrupoGasto = async (gastoId, nuevoGrupo) => {
    try {
      const targetUrl = serverUrl || 'http://localhost:3001';
      const res = await axios.put(`${targetUrl}/api/gastos/${gastoId}/grupo`, {
        grupo_afectado: nuevoGrupo
      }, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.data?.success) {
        toast.success(`Grupo del egreso reclasificado a: ${nuevoGrupo}`);
        cargarGastos();
        cargarGastosPorGrupo();
      }
    } catch (err) {
      console.error("Error al reclasificar grupo de gasto:", err);
      toast.error("Error al reclasificar grupo de gasto");
    }
  };

  const handleEliminarGasto = async (gastoId, descripcion) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar este gasto?\n"${descripcion || 'Gasto'}"\n\nEl dinero será restaurado a los reportes y liquidez.`)) {
      return;
    }
    try {
      const targetUrl = serverUrl || 'http://localhost:3001';
      const res = await axios.delete(`${targetUrl}/api/gastos/${gastoId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.data?.success) {
        toast.success("Gasto eliminado exitosamente. Dinero restaurado.");
        cargarGastos();
        cargarGastosPorGrupo();
        if (typeof cargarConsolidado === 'function') cargarConsolidado();
      } else {
        toast.error("No se pudo eliminar el gasto");
      }
    } catch (err) {
      console.error("Error al eliminar gasto:", err);
      toast.error("Error al eliminar el gasto: " + (err.response?.data?.error || err.message));
    }
  };

  const handleCrearGasto = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const montoLimpio = Number(cleanNum(formGasto.monto));
    if (!formGasto.descripcion.trim()) {
      return toast.error("Por favor ingresa la descripción del gasto");
    }
    if (!montoLimpio || montoLimpio <= 0) {
      return toast.error("El monto debe ser un valor válido mayor a 0");
    }
    if (!formGasto.metodo_pago) {
      return toast.error("Elige si el pago fue en Efectivo o Transferencia");
    }

    setGuardandoGasto(true);
    try {
      const targetUrl = serverUrl || 'http://localhost:3001';
      const payload = {
        categoria: formGasto.categoria,
        descripcion: formGasto.descripcion.trim(),
        monto: montoLimpio,
        metodo_pago: formGasto.metodo_pago,
        grupo_afectado: formGasto.grupo_afectado || 'comida',
        fuente_financiamiento: formGasto.fuente_financiamiento || 'caja_negocio',
        caja_sesion_id: sesionActivaInfo?.id || null
      };

      await axios.post(`${targetUrl}/api/gastos`, payload, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      toast.success("✅ Gasto registrado exitosamente");
      setModalGastoVisible(false);
      setFormGasto({
        categoria: 'Ingredientes / Materia Prima',
        descripcion: '',
        monto: '',
        metodo_pago: 'efectivo',
        grupo_afectado: 'comida',
        fuente_financiamiento: 'caja_negocio'
      });
      cargarGastos(filtroGastosInicio, filtroGastosFin);
      cargarGastosPorGrupo(filtroProdInicio, filtroProdFin);
      cargarProductividadEnVivo();
      cargarHistorialProd(filtroProdInicio, filtroProdFin);
      if (socket && typeof socket.emit === 'function') {
        socket.emit('caja_actualizada');
        socket.emit('gastos_actualizados');
      }
    } catch (err) {
      console.error("Error guardando gasto:", err);
      toast.error(err.response?.data?.error || "Error al registrar gasto");
    } finally {
      setGuardandoGasto(false);
    }
  };

  const setFiltroProdRapido = (tipo) => {
    const hoy = new Date();
    const formatDate = (d) => {
      if (!d) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let inicio = '';
    let fin = formatDate(hoy); // Por defecto hoy

    if (tipo === 'hoy') {
      inicio = formatDate(hoy);
      fin = formatDate(hoy);
    } else if (tipo === 'ayer') {
      const ayer = new Date(hoy);
      ayer.setDate(hoy.getDate() - 1);
      inicio = formatDate(ayer);
      fin = formatDate(ayer);
    } else if (tipo === 'esta_semana' || tipo === 'semana') {
      const primerDiaSemana = new Date(hoy);
      primerDiaSemana.setDate(hoy.getDate() - hoy.getDay());
      inicio = formatDate(primerDiaSemana);
      fin = formatDate(hoy);
    } else if (tipo === 'este_mes' || tipo === 'mes') {
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      inicio = formatDate(primerDiaMes);
      fin = formatDate(hoy);
    } else if (tipo === 'todo') {
      inicio = '';
      fin = '';
    }

    setFiltroProdInicio(inicio);
    setFiltroProdFin(fin);
    setFiltroGastosInicio(inicio);
    setFiltroGastosFin(fin);

    cargarHistorialProd(inicio, fin, tipo);
    cargarGastos(inicio, fin, tipo);
    cargarGastosPorGrupo(inicio, fin, tipo);
  };

  const limpiarFiltrosProd = () => {
    setFiltroProdInicio('');
    setFiltroProdFin('');
    cargarHistorialProd('', '');
    setFiltroGastosInicio('');
    setFiltroGastosFin('');
    cargarGastos('', '');
    cargarGastosPorGrupo('', '');
  };



  const formatFechaTabla = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const cleanRaw = String(dateStr).replace('T', ' ').trim();
      const parts = cleanRaw.split(' ');
      const datePart = parts[0];
      const timePart = parts[1] ? parts[1].substring(0, 5) : '';

      let formattedDate = datePart;
      if (datePart.includes('-')) {
        const dParts = datePart.split('-');
        if (dParts.length === 3) {
          formattedDate = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
        }
      }
      return timePart ? `${formattedDate} ${timePart}` : formattedDate;
    } catch (e) {
      return dateStr;
    }
  };

  useEffect(() => {
    if (adminTab === 'productividad' || adminTab === 'gastos') {
      const inicioMes = getPrimerDiaMes();
      const finHoy = getHoyStr();
      cargarProductividadEnVivo();
      cargarHistorialProd(filtroProdInicio || inicioMes, filtroProdFin || finHoy);
      cargarGastos(filtroGastosInicio || inicioMes, filtroGastosFin || finHoy);
      cargarGastosPorGrupo(filtroProdInicio || inicioMes, filtroProdFin || finHoy);
    }
  }, [adminTab]);

  const recargarTimerRef = useRef(null);

  // Listener seguro contra fallos de referencia
  useEffect(() => {
    // Detectar socket si fue inyectado por props o window
    const s = (typeof socket !== 'undefined' && socket) ? socket : (window.socket || null);
    if (!s) return;

    const recargarEnVivo = () => {
      if (recargarTimerRef.current) clearTimeout(recargarTimerRef.current);
      recargarTimerRef.current = setTimeout(() => {
        if (adminTab === 'dashboard' && typeof cargarDashboardFinanciero === 'function') {
          cargarDashboardFinanciero();
        }
        if (adminTab === 'insumos' && typeof cargarInventarioDesktop === 'function') {
          cargarInventarioDesktop();
        }
        if (adminTab === 'productividad' || adminTab === 'gastos') {
          cargarProductividadEnVivo();
          cargarGastosPorGrupo(filtroProdInicio, filtroProdFin);
          cargarGastos(filtroGastosInicio, filtroGastosFin);
          cargarHistorialProd(filtroProdInicio, filtroProdFin);
        }
      }, 250);
    };

    s.on('dashboard:actualizado', recargarEnVivo);
    s.on('caja:estado', recargarEnVivo);
    s.on('caja_actualizada', recargarEnVivo);
    s.on('gastos_actualizados', recargarEnVivo);
    s.on('inventario:actualizado', recargarEnVivo);

    return () => {
      if (recargarTimerRef.current) clearTimeout(recargarTimerRef.current);
      s.off('dashboard:actualizado', recargarEnVivo);
      s.off('caja:estado', recargarEnVivo);
      s.off('caja_actualizada', recargarEnVivo);
      s.off('gastos_actualizados', recargarEnVivo);
      s.off('inventario:actualizado', recargarEnVivo);
    };
  }, [typeof socket !== 'undefined' ? socket : null, adminTab, filtroProdInicio, filtroProdFin, filtroGastosInicio, filtroGastosFin]);

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
      const fechaParam = dashboardFechaPersonalizada || dashboardRango;
      const res = await axios.get(`${serverUrl}/api/dashboard/financiero`, {
        params: { rango: fechaParam },
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.data) {
        setDashboardData(res.data);
        if (res.data.caja) setCajaActual(res.data.caja);
      }
    } catch (e) {
      console.error('Error fetching dashboard financiero:', e.message);
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

  const listaCategorias = useMemo(() => {
    const sinTodos = categoriasDinamicas.filter(c => c !== 'Todos');
    if (!sinTodos.includes('Otros')) sinTodos.push('Otros');
    return sinTodos.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [categoriasDinamicas]);

  const resetFormProducto = () => {
    setFormProd({ nombre: '', precio: '', desc: '', emoji: '', disp: true, categoria: '', grupo_reporte: 'comida', imagen: '' });
    if (typeof setCategoriaInput === 'function') setCategoriaInput('');
    if (typeof setImageFile === 'function') setImageFile(null);
    if (typeof setProductoEditando === 'function') setProductoEditando(null);
  };

  const abrirModalNuevo = () => {
    setProductoEditando(null);
    const initialCat = listaCategorias[0] || 'Otros';
    setEmojiManual(false);
    setFormProd({ 
      nombre: '', 
      precio: '', 
      emoji: '🍔', 
      cat: initialCat, 
      categoria: initialCat, 
      desc: '', 
      imagen: '', 
      disp: true,
      grupo_reporte: sugerirGrupoReporte(initialCat)
    });
    setModoNuevaCat(false);
    setCategoriaInput(initialCat);
    setImageFile(null);
    setImagePreviewUrl(null);
    setModalSubTab('producto');
    setModalVisible(true);
  };

  const abrirModalEditar = (prod) => {
    setProductoEditando(prod);
    const prodCat = prod.categoria || prod.cat || 'Otros';
    setEmojiManual(true);
    setFormProd({
      nombre: prod.nombre,
      precio: prod.precio,
      emoji: prod.emoji || sugerirEmojiPorNombre(prod.nombre),
      categoria: prodCat,
      cat: prodCat,
      desc: prod.desc || prod.descripcion || '',
      imagen: prod.imagen || '',
      disp: prod.disponible !== 0 && prod.disponible !== false && prod.disp !== false,
      grupo_reporte: prod.grupo_reporte || sugerirGrupoReporte(prodCat, prod.nombre)
    });
    setCategoriaInput(prodCat);
    if (listaCategorias.includes(prodCat)) {
      setModoNuevaCat(false);
    } else {
      setModoNuevaCat(true);
    }
    setImageFile(null);
    setImagePreviewUrl(prod.imagen || null);
    setModalSubTab('producto');
    setModalVisible(true);
  };

  const guardarProducto = async () => {
    if (guardandoProd) return;
    if (!formProd.nombre || !formProd.precio) return toast.error("Completa los campos.");
  
    const catFinal = (categoriaInput || formProd.categoria || 'Otros').trim() || 'Otros';
    setGuardandoProd(true);
  
    try {
      let finalImageUrl = formProd.imagen;
  
      if (imageFile) {
        const formData = new FormData();
        formData.append('imagen', imageFile);
        const uploadRes = await axios.post(`${serverUrl}/api/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', 'Bypass-Tunnel-Reminder': 'true' },
          timeout: 10000
        });
        if (uploadRes.data?.success) {
          finalImageUrl = uploadRes.data.url;
        }
      }
  
      const payload = {
        nombre: formProd.nombre.trim(),
        cat: catFinal,
        categoria: catFinal,
        desc: formProd.desc || '',
        descripcion: formProd.desc || '',
        emoji: formProd.emoji || '',
        precio: Number(cleanNum(formProd.precio)),
        imagen: finalImageUrl,
        disp: formProd.disp !== false ? 1 : 0,
        disponible: formProd.disp !== false ? 1 : 0,
        grupo_reporte: formProd.grupo_reporte || 'comida',
        usuario: 'Admin'
      };
  
      if (productoEditando) {
        // Usar una sola ruta definitiva para actualizar
        await axios.put(`${serverUrl}/api/productos/${productoEditando.id}`, { ...payload, id: productoEditando.id }, { timeout: 8000 });
        toast.success('Producto actualizado exitosamente');
      } else {
        await axios.post(`${serverUrl}/api/productos`, payload, { timeout: 8000 });
        toast.success('Producto creado exitosamente');
      }
  
      if (socket?.emit) {
        socket.emit('catalogo_actualizado');
      }
  
      setModalVisible(false);
      resetFormProducto();
      if (typeof cargarCatalogo === 'function') cargarCatalogo();
    } catch (e) {
      console.error("Error al guardar producto:", e);
      toast.error("Error al guardar el producto. Revisa la consola.");
    } finally {
      setGuardandoProd(false);
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
          <button onClick={() => setAdminTab('productividad')} style={navBtnStyle(adminTab === 'productividad')}>📊 Productividad y Reinversión</button>
          <button onClick={() => setAdminTab('gastos')} style={navBtnStyle(adminTab === 'gastos')}>💸 Control de Gastos</button>
          <button onClick={() => setAdminTab('catalogo')} style={navBtnStyle(adminTab === 'catalogo' || adminTab === 'productos')}>🍔 Catálogo</button>
          <button onClick={() => setAdminTab('adicionales')} style={navBtnStyle(adminTab === 'adicionales')}>🍟 Adicionales</button>
          <button onClick={() => setAdminTab('historial')} style={navBtnStyle(adminTab === 'historial')}>📄 Historial de Facturas</button>
          <button onClick={() => setAdminTab('insumos')} style={navBtnStyle(adminTab === 'insumos')}>📦 Insumos y Kardex</button>
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

        {adminTab === 'dashboard' && <DashboardFinanciero serverUrl={serverUrl} socket={socket} adminToken={adminToken} />}

        {adminTab === 'productividad' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Cabecera Principal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '26px', fontWeight: 'bold', color: 'var(--brand)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  📊 Productividad y Reinversión
                </h2>
                <p style={{ margin: 0, color: 'var(--text2)', fontSize: '14px' }}>
                  Auditoría contable y liquidez clasificada por los 5 macro-grupos para reinversión estratégica
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setModalGastoVisible(true)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(220,38,38,0.2)'
                  }}
                >
                  💸 + Registrar Gasto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cargarProductividadEnVivo();
                    cargarHistorialProd(filtroProdInicio, filtroProdFin);
                    cargarGastos(filtroGastosInicio, filtroGastosFin);
                    toast.success('Métricas actualizadas');
                  }}
                  disabled={cargandoProdVivo || cargandoHistorialProd || cargandoGastos}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--surf2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  🔄 Actualizar Datos
                </button>
              </div>
            </div>

            {/* SECCIÓN SUPERIOR: Consolidado Total del Período */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* Barra de Filtros y Presets del Período */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>📈</span>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--text)' }}>
                      Total Consolidado del Período
                    </h3>
                    <span style={{ backgroundColor: 'rgba(232,82,10,0.1)', color: 'var(--brand)', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                      {(!filtroProdInicio && !filtroProdFin) ? 'Histórico Completo' : `${formatFechaTabla(filtroProdInicio)} al ${formatFechaTabla(filtroProdFin)}`}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text2)' }}>
                    Sumatoria total acumulada en ventas durante el rango de fechas seleccionado
                  </p>
                </div>

                {/* Presets Rápidos */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setFiltroProdRapido('hoy')}
                    style={{
                      padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      backgroundColor: 'var(--surf2)', color: 'var(--text)'
                    }}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroProdRapido('ayer')}
                    style={{
                      padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      backgroundColor: 'var(--surf2)', color: 'var(--text)'
                    }}
                  >
                    Ayer
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroProdRapido('esta_semana')}
                    style={{
                      padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      backgroundColor: 'var(--surf2)', color: 'var(--text)'
                    }}
                  >
                    Esta Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroProdRapido('este_mes')}
                    style={{
                      padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      backgroundColor: 'var(--surf2)', color: 'var(--text)'
                    }}
                  >
                    Este Mes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroProdRapido('todo')}
                    style={{
                      padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      backgroundColor: (!filtroProdInicio && !filtroProdFin) ? '#0f172a' : 'var(--surf2)',
                      color: (!filtroProdInicio && !filtroProdFin) ? 'white' : 'var(--text)'
                    }}
                  >
                    Todo
                  </button>
                </div>
              </div>

              {/* Filtro Manual por Fechas */}
              <div style={{
                display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
                backgroundColor: 'var(--surf2)', padding: '12px 16px', borderRadius: '10px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text2)' }}>Desde:</span>
                  <input
                    type="date"
                    value={filtroProdInicio}
                    onChange={(e) => setFiltroProdInicio(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', backgroundColor: 'white' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text2)' }}>Hasta:</span>
                  <input
                    type="date"
                    value={filtroProdFin}
                    onChange={(e) => setFiltroProdFin(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', backgroundColor: 'white' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    cargarHistorialProd(filtroProdInicio, filtroProdFin);
                    cargarGastos(filtroProdInicio, filtroProdFin);
                    cargarGastosPorGrupo(filtroProdInicio, filtroProdFin);
                  }}
                  disabled={cargandoHistorialProd || cargandoGastos}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', border: 'none',
                    backgroundColor: 'var(--brand)', color: 'white', fontWeight: 'bold',
                    fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  {cargandoHistorialProd ? 'Cargando...' : '🔍 Filtrar'}
                </button>
                <button
                  type="button"
                  onClick={limpiarFiltrosProd}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)',
                    backgroundColor: 'white', color: 'var(--text)', fontWeight: 'bold',
                    fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Limpiar
                </button>
              </div>

              {/* 6 Tarjetas Ejecutivas con Descuento Dinámico y Saldo Neto de Reinversión */}
              {(() => {
                const totalGenerales = Number(gastosPorGrupo.gastos_generales || 0);
                const totalIngresosCategorias = Number(acumuladoPeriodo.comida || 0) +
                  Number(acumuladoPeriodo.jugos_naturales || 0) +
                  Number(acumuladoPeriodo.cervezas || 0) +
                  Number(acumuladoPeriodo.gaseosas_embotellados || 0) +
                  Number(acumuladoPeriodo.bebidas_calientes || 0);

                const getGastoGeneralProrrateado = (ingresosCat) => {
                  if (totalGenerales <= 0) return 0;
                  const prop = totalIngresosCategorias > 0 ? (ingresosCat / totalIngresosCategorias) : (1 / 5);
                  return Math.round(totalGenerales * prop);
                };

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '14px' }}>
                    {/* 1. Comida */}
                    {(() => {
                      const ingresos = Number(acumuladoPeriodo.comida || 0);
                      const egresos = Number(gastosPorGrupo.comida || 0);
                      const gastoGeneral = getGastoGeneralProrrateado(ingresos);
                      const totalEgresosCat = egresos + gastoGeneral;
                      const neto = ingresos - totalEgresosCat;
                      const esDeficit = neto < 0;
                      return (
                        <div style={{
                          backgroundColor: esDeficit ? '#fef2f2' : 'var(--surf2)',
                          borderRadius: '12px',
                          padding: '14px',
                          border: esDeficit ? '1.5px solid #f87171' : '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>🍔</span> COMIDA
                            </span>
                            {esDeficit && (
                              <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                ⚠️ Déficit
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: '600' }}>
                              <span>Ingresos:</span>
                              <span>+${ingresos.toLocaleString('es-CO')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: '600' }}>
                              <span>Gastos Insumos:</span>
                              <span>-${egresos.toLocaleString('es-CO')}</span>
                            </div>
                            {gastoGeneral > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontSize: '10px' }}>
                                <span>G. Generales:</span>
                                <span>-${gastoGeneral.toLocaleString('es-CO')}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 'bold' }}>Saldo Disponible:</div>
                            <div style={{
                              fontSize: '18px',
                              fontWeight: '900',
                              color: esDeficit ? '#dc2626' : 'var(--text)',
                              marginTop: '2px'
                            }}>
                              =${neto.toLocaleString('es-CO')}
                            </div>
                            {esDeficit && (
                              <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px', fontWeight: '600' }}>
                                Gastos superan ventas
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 2. Jugos Naturales */}
                    {(() => {
                      const ingresos = Number(acumuladoPeriodo.jugos_naturales || 0);
                      const egresos = Number(gastosPorGrupo.jugos_naturales || 0);
                      const gastoGeneral = getGastoGeneralProrrateado(ingresos);
                      const totalEgresosCat = egresos + gastoGeneral;
                      const neto = ingresos - totalEgresosCat;
                      const esDeficit = neto < 0;
                      return (
                        <div style={{
                          backgroundColor: esDeficit ? '#fef2f2' : 'var(--surf2)',
                          borderRadius: '12px',
                          padding: '14px',
                          border: esDeficit ? '1.5px solid #f87171' : '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>🥤</span> JUGOS NAT.
                            </span>
                            {esDeficit && (
                              <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                ⚠️ Déficit
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: '600' }}>
                              <span>Ingresos:</span>
                              <span>+${ingresos.toLocaleString('es-CO')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: '600' }}>
                              <span>Gastos Insumos:</span>
                              <span>-${egresos.toLocaleString('es-CO')}</span>
                            </div>
                            {gastoGeneral > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontSize: '10px' }}>
                                <span>G. Generales:</span>
                                <span>-${gastoGeneral.toLocaleString('es-CO')}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 'bold' }}>Saldo Disponible:</div>
                            <div style={{
                              fontSize: '18px',
                              fontWeight: '900',
                              color: esDeficit ? '#dc2626' : 'var(--text)',
                              marginTop: '2px'
                            }}>
                              =${neto.toLocaleString('es-CO')}
                            </div>
                            {esDeficit && (
                              <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px', fontWeight: '600' }}>
                                Gastos superan ventas
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 3. Cervezas */}
                    {(() => {
                      const ingresos = Number(acumuladoPeriodo.cervezas || 0);
                      const egresos = Number(gastosPorGrupo.cervezas || 0);
                      const gastoGeneral = getGastoGeneralProrrateado(ingresos);
                      const totalEgresosCat = egresos + gastoGeneral;
                      const neto = ingresos - totalEgresosCat;
                      const esDeficit = neto < 0;
                      return (
                        <div style={{
                          backgroundColor: esDeficit ? '#fef2f2' : 'var(--surf2)',
                          borderRadius: '12px',
                          padding: '14px',
                          border: esDeficit ? '1.5px solid #f87171' : '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>🍺</span> CERVEZAS
                            </span>
                            {esDeficit && (
                              <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                ⚠️ Déficit
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: '600' }}>
                              <span>Ingresos:</span>
                              <span>+${ingresos.toLocaleString('es-CO')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: '600' }}>
                              <span>Gastos Insumos:</span>
                              <span>-${egresos.toLocaleString('es-CO')}</span>
                            </div>
                            {gastoGeneral > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontSize: '10px' }}>
                                <span>G. Generales:</span>
                                <span>-${gastoGeneral.toLocaleString('es-CO')}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 'bold' }}>Saldo Disponible:</div>
                            <div style={{
                              fontSize: '18px',
                              fontWeight: '900',
                              color: esDeficit ? '#dc2626' : 'var(--text)',
                              marginTop: '2px'
                            }}>
                              =${neto.toLocaleString('es-CO')}
                            </div>
                            {esDeficit && (
                              <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px', fontWeight: '600' }}>
                                Gastos superan ventas
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 4. Gaseosas y Embotellados */}
                    {(() => {
                      const ingresos = Number(acumuladoPeriodo.gaseosas_embotellados || 0);
                      const egresos = Number(gastosPorGrupo.gaseosas_embotellados || 0);
                      const gastoGeneral = getGastoGeneralProrrateado(ingresos);
                      const totalEgresosCat = egresos + gastoGeneral;
                      const neto = ingresos - totalEgresosCat;
                      const esDeficit = neto < 0;
                      return (
                        <div style={{
                          backgroundColor: esDeficit ? '#fef2f2' : 'var(--surf2)',
                          borderRadius: '12px',
                          padding: '14px',
                          border: esDeficit ? '1.5px solid #f87171' : '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>🍾</span> EMBOTELLADOS
                            </span>
                            {esDeficit && (
                              <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                ⚠️ Déficit
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: '600' }}>
                              <span>Ingresos:</span>
                              <span>+${ingresos.toLocaleString('es-CO')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: '600' }}>
                              <span>Gastos Insumos:</span>
                              <span>-${egresos.toLocaleString('es-CO')}</span>
                            </div>
                            {gastoGeneral > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontSize: '10px' }}>
                                <span>G. Generales:</span>
                                <span>-${gastoGeneral.toLocaleString('es-CO')}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 'bold' }}>Saldo Disponible:</div>
                            <div style={{
                              fontSize: '18px',
                              fontWeight: '900',
                              color: esDeficit ? '#dc2626' : 'var(--text)',
                              marginTop: '2px'
                            }}>
                              =${neto.toLocaleString('es-CO')}
                            </div>
                            {esDeficit && (
                              <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px', fontWeight: '600' }}>
                                Gastos superan ventas
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 5. Bebidas Calientes */}
                    {(() => {
                      const ingresos = Number(acumuladoPeriodo.bebidas_calientes || 0);
                      const egresos = Number(gastosPorGrupo.bebidas_calientes || 0);
                      const gastoGeneral = getGastoGeneralProrrateado(ingresos);
                      const totalEgresosCat = egresos + gastoGeneral;
                      const neto = ingresos - totalEgresosCat;
                      const esDeficit = neto < 0;
                      return (
                        <div style={{
                          backgroundColor: esDeficit ? '#fef2f2' : 'var(--surf2)',
                          borderRadius: '12px',
                          padding: '14px',
                          border: esDeficit ? '1.5px solid #f87171' : '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>☕</span> BEB. CALIENTES
                            </span>
                            {esDeficit && (
                              <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                ⚠️ Déficit
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: '600' }}>
                              <span>Ingresos:</span>
                              <span>+${ingresos.toLocaleString('es-CO')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: '600' }}>
                              <span>Gastos Insumos:</span>
                              <span>-${egresos.toLocaleString('es-CO')}</span>
                            </div>
                            {gastoGeneral > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontSize: '10px' }}>
                                <span>G. Generales:</span>
                                <span>-${gastoGeneral.toLocaleString('es-CO')}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 'bold' }}>Saldo Disponible:</div>
                            <div style={{
                              fontSize: '18px',
                              fontWeight: '900',
                              color: esDeficit ? '#dc2626' : 'var(--text)',
                              marginTop: '2px'
                            }}>
                              =${neto.toLocaleString('es-CO')}
                            </div>
                            {esDeficit && (
                              <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px', fontWeight: '600' }}>
                                Gastos superan ventas
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                {/* 6. Total Recaudado General y Liquidez Neta */}
                {(() => {
                  const totalRecaudado = Number(acumuladoPeriodo.total_general || 0);
                  const totalGastosPeriodo = Number(gastosPorGrupo.total_gastado || gastosResumen.total_gastos || 0);
                  const totalEf = Number(gastosPorGrupo.gastado_efectivo || gastosResumen.total_efectivo || 0);
                  const totalTr = Number(gastosPorGrupo.gastado_transferencia || gastosResumen.total_transferencia || 0);
                  const liquidezNeta = totalRecaudado - totalGastosPeriodo;
                  const esDeficit = liquidezNeta < 0;

                  return (
                    <div style={{
                      backgroundColor: esDeficit ? '#fef2f2' : 'rgba(232,82,10,0.06)',
                      borderRadius: '12px',
                      padding: '14px',
                      border: esDeficit ? '2px solid #ef4444' : '2px solid var(--brand)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: esDeficit ? '#b91c1c' : 'var(--brand)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>💰</span> TOTAL GENERAL
                        </span>
                        {esDeficit && (
                          <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                            ⚠️ Déficit
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: '600' }}>
                          <span>Recaudado Bruto:</span>
                          <span>+${totalRecaudado.toLocaleString('es-CO')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: '600' }}>
                          <span>Total Gastos:</span>
                          <span>-${totalGastosPeriodo.toLocaleString('es-CO')}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text3)', textAlign: 'right', marginTop: '1px' }}>
                          💵 Ef: ${totalEf.toLocaleString('es-CO')} | 💳 Tr: ${totalTr.toLocaleString('es-CO')}
                        </div>
                      </div>
                      <div style={{ borderTop: '1px dashed #fdba74', paddingTop: '6px' }}>
                        <div style={{ fontSize: '11px', color: esDeficit ? '#b91c1c' : 'var(--brand)', fontWeight: 'bold' }}>
                          Liquidez Neta Real:
                        </div>
                        <div style={{
                          fontSize: '19px',
                          fontWeight: '900',
                          color: esDeficit ? '#dc2626' : 'var(--brand)',
                          marginTop: '2px'
                        }}>
                          =${liquidezNeta.toLocaleString('es-CO')}
                        </div>
                        <div style={{ fontSize: '10px', color: esDeficit ? '#b91c1c' : 'var(--brand)', marginTop: '2px', fontWeight: '600' }}>
                          En Mano / Bancos
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

              {/* Indicador sutil de Turno en Vivo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text2)', backgroundColor: 'var(--surf2)', padding: '8px 14px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🟢</span>
                  <span><strong>Turno Actual en Vivo:</strong> {sesionActivaInfo ? `Sesión Activa #${sesionActivaInfo.id}` : 'Caja Cerrada (Día de hoy)'}</span>
                  <span>|</span>
                  <span>Comida: <strong>${Number(productividadEnVivo.comida || 0).toLocaleString('es-CO')}</strong></span>
                  <span>|</span>
                  <span>Bebidas/Otros: <strong>${(Number(productividadEnVivo.total_turno || 0) - Number(productividadEnVivo.comida || 0)).toLocaleString('es-CO')}</strong></span>
                  <span>|</span>
                  <span>Total Turno: <strong style={{ color: 'var(--brand)' }}>${Number(productividadEnVivo.total_turno || 0).toLocaleString('es-CO')}</strong></span>
                </div>
                {cargandoProdVivo && <span>⏳ Sincronizando...</span>}
              </div>
            </div>

            {/* SECCIÓN INFERIOR: Historial y Auditoría de Fechas */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📅 Desglose Diario por Fechas
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text2)' }}>
                  Detalle del dinero recaudado día a día por cada uno de los 5 grupos en el período
                </p>
              </div>

              {/* Tabla de Auditoría Histórica */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
                {cargandoHistorialProd ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)' }}>
                    <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>⏳</span>
                    Cargando auditoría histórica de productividad...
                  </div>
                ) : (!historialProdData || historialProdData.length === 0) ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)' }}>
                    <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📋</span>
                    No se registraron ventas en el período seleccionado.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--surf2)', borderBottom: '2px solid var(--border)' }}>
                        <th style={thStyle}>Fecha</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>🍔 Comida</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>🥤 Jugos Nat.</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>🍺 Cervezas</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>🍾 Embotellados</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>☕ Beb. Calientes</th>
                        <th style={{ ...thStyle, textAlign: 'right', color: 'var(--brand)' }}>💰 Total Día</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialProdData.map((fila, idx) => (
                        <tr key={fila.fecha || idx} style={{ borderBottom: '1px solid var(--border)', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          <td style={{ ...tdStyle, fontWeight: '600' }}>
                            {formatFechaTabla(fila.fecha)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            $ {Number(fila.comida || 0).toLocaleString('es-CO')}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            $ {Number(fila.jugos_naturales || 0).toLocaleString('es-CO')}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            $ {Number(fila.cervezas || 0).toLocaleString('es-CO')}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            $ {Number(fila.gaseosas_embotellados || 0).toLocaleString('es-CO')}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            $ {Number(fila.bebidas_calientes || 0).toLocaleString('es-CO')}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: 'var(--brand)' }}>
                            $ {Number(fila.total_dia || 0).toLocaleString('es-CO')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: 'var(--surf2)', borderTop: '2px solid var(--border)', fontWeight: 'bold' }}>
                        <td style={{ ...tdStyle, fontSize: '14px', color: 'var(--text)' }}>
                          TOTALES GENERALES ({historialProdData.length} días)
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontSize: '14px' }}>
                          $ {Number(acumuladoPeriodo.comida || 0).toLocaleString('es-CO')}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontSize: '14px' }}>
                          $ {Number(acumuladoPeriodo.jugos_naturales || 0).toLocaleString('es-CO')}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontSize: '14px' }}>
                          $ {Number(acumuladoPeriodo.cervezas || 0).toLocaleString('es-CO')}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontSize: '14px' }}>
                          $ {Number(acumuladoPeriodo.gaseosas_embotellados || 0).toLocaleString('es-CO')}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontSize: '14px' }}>
                          $ {Number(acumuladoPeriodo.bebidas_calientes || 0).toLocaleString('es-CO')}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--brand)', fontSize: '16px', fontWeight: '900' }}>
                          $ {Number(acumuladoPeriodo.total_general || 0).toLocaleString('es-CO')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'gastos' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Cabecera Principal Gastos */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '26px', fontWeight: 'bold', color: '#dc2626', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  💸 Control de Gastos y Egresos
                </h2>
                <p style={{ margin: 0, color: 'var(--text2)', fontSize: '14px' }}>
                  Control de insumos, proveedores, nómina y servicios clasificando el pago en Efectivo o Transferencia
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setModalGastoVisible(true)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 8px rgba(220,38,38,0.25)'
                  }}
                >
                  ➕ Registrar Gasto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cargarGastos(filtroGastosInicio, filtroGastosFin);
                    toast.success('Gastos actualizados');
                  }}
                  disabled={cargandoGastos}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--surf2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  🔄 Refrescar
                </button>
              </div>
            </div>

            {/* 3 Tarjetas Ejecutivas de Gastos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#16a34a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>💵</span> GASTOS EN EFECTIVO
                </div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text)' }}>
                  $ {Number(gastosResumen.total_efectivo || 0).toLocaleString('es-CO')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>Salidas físicas de caja</div>
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2563eb', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>💳</span> GASTOS EN TRANSFERENCIA
                </div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text)' }}>
                  $ {Number(gastosResumen.total_transferencia || 0).toLocaleString('es-CO')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>Nequi, Daviplata y bancos</div>
              </div>

              <div style={{ backgroundColor: 'rgba(220,38,38,0.06)', borderRadius: '16px', padding: '20px', border: '2px solid #dc2626', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#dc2626', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📉</span> TOTAL EGRESOS GLOBALES
                </div>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#dc2626' }}>
                  $ {Number(gastosResumen.total_gastos || 0).toLocaleString('es-CO')}
                </div>
                <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontWeight: 'bold' }}>Período seleccionado</div>
              </div>
            </div>

            {/* Filtros de Gastos */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '20px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)' }}>
                  Filtrar Egresos por Fecha:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setFiltroProdRapido('hoy')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', border: '1px solid var(--border)', cursor: 'pointer', backgroundColor: 'var(--surf2)', color: 'var(--text)' }}>Hoy</button>
                  <button type="button" onClick={() => setFiltroProdRapido('ayer')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', border: '1px solid var(--border)', cursor: 'pointer', backgroundColor: 'var(--surf2)', color: 'var(--text)' }}>Ayer</button>
                  <button type="button" onClick={() => setFiltroProdRapido('esta_semana')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', border: '1px solid var(--border)', cursor: 'pointer', backgroundColor: 'var(--surf2)', color: 'var(--text)' }}>Esta Semana</button>
                  <button type="button" onClick={() => setFiltroProdRapido('este_mes')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', border: '1px solid var(--border)', cursor: 'pointer', backgroundColor: 'var(--surf2)', color: 'var(--text)' }}>Este Mes</button>
                  <button type="button" onClick={() => setFiltroProdRapido('todo')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', border: '1px solid var(--border)', cursor: 'pointer', backgroundColor: 'var(--surf2)', color: 'var(--text)' }}>Todo</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: 'var(--surf2)', padding: '12px 16px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text2)' }}>Desde:</span>
                  <input type="date" value={filtroGastosInicio} onChange={(e) => setFiltroGastosInicio(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', backgroundColor: 'white' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text2)' }}>Hasta:</span>
                  <input type="date" value={filtroGastosFin} onChange={(e) => setFiltroGastosFin(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', backgroundColor: 'white' }} />
                </div>
                <button type="button" onClick={() => cargarGastos(filtroGastosInicio, filtroGastosFin)} disabled={cargandoGastos} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: 'white', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                  {cargandoGastos ? 'Cargando...' : '🔍 Filtrar'}
                </button>
                <button type="button" onClick={() => { setFiltroGastosInicio(''); setFiltroGastosFin(''); cargarGastos('', ''); }} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'white', color: 'var(--text)', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                  Limpiar
                </button>
              </div>

              {/* Tabla de Gastos */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
                {cargandoGastos ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)' }}>
                    <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>⏳</span>
                    Cargando historial de gastos...
                  </div>
                ) : (!gastosData || gastosData.length === 0) ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)' }}>
                    <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>💸</span>
                    No se registran gastos en el período seleccionado.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--surf2)', borderBottom: '2px solid var(--border)' }}>
                        <th style={thStyle}>Fecha / Hora</th>
                        <th style={thStyle}>Categoría</th>
                        <th style={thStyle}>Grupo Afectado</th>
                        <th style={thStyle}>Descripción</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Método de Pago</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Monto</th>
                        <th style={thStyle}>Responsable</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gastosData.map((g, idx) => (
                        <tr key={g.id || idx} style={{ borderBottom: '1px solid var(--border)', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          <td style={{ ...tdStyle, fontWeight: '600' }}>
                            {formatFechaTabla(g.fecha || g.created_at)}
                          </td>
                          <td style={tdStyle}>
                            <span style={{ backgroundColor: '#e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                              {g.categoria || 'Insumos'}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <select
                              value={g.grupo_afectado || 'gastos_generales'}
                              onChange={(e) => handleActualizarGrupoGasto(g.id, e.target.value)}
                              title="Reclasificar grupo de gasto"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                backgroundColor: (g.grupo_afectado || 'gastos_generales') === 'gastos_generales' ? '#f1f5f9' : '#fff7ed',
                                color: (g.grupo_afectado || 'gastos_generales') === 'gastos_generales' ? '#475569' : '#ea580c',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="comida">🍔 Comida</option>
                              <option value="jugos_naturales">🥤 Jugos Naturales</option>
                              <option value="cervezas">🍺 Cervezas</option>
                              <option value="gaseosas_embotellados">🍾 Embotellados</option>
                              <option value="bebidas_calientes">☕ Bebidas Calientes</option>
                              <option value="gastos_generales">🏢 Gastos Generales</option>
                            </select>
                          </td>
                          <td style={{ ...tdStyle, fontWeight: '500' }}>
                            {g.descripcion}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {String(g.metodo_pago).toLowerCase() === 'transferencia' ? (
                              <span style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: '#2563eb', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                                💳 Transferencia
                              </span>
                            ) : (
                              <span style={{ backgroundColor: 'rgba(22,163,74,0.1)', color: '#16a34a', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                                💵 Efectivo
                              </span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>
                            $ {Number(g.monto || g.valor || 0).toLocaleString('es-CO')}
                          </td>
                          <td style={{ ...tdStyle, color: 'var(--text2)', fontSize: '13px' }}>
                            {g.usuario || 'Admin'}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleEliminarGasto(g.id, g.descripcion)}
                              title="Eliminar este gasto y restaurar dinero"
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid #fca5a5',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              🗑️ Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: 'var(--surf2)', borderTop: '2px solid var(--border)', fontWeight: 'bold' }}>
                        <td colSpan={5} style={{ ...tdStyle, fontSize: '14px', color: 'var(--text)' }}>
                          TOTAL EGRESOS DEL PERÍODO ({gastosData.length} registros)
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#dc2626', fontSize: '16px', fontWeight: '900' }}>
                          $ {Number(gastosResumen.total_gastos || 0).toLocaleString('es-CO')}
                        </td>
                        <td colSpan={2} style={tdStyle}></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}


        {(adminTab === 'productos' || adminTab === 'catalogo') && (
          <div className="animate-fade-in">
            {/* Cabecera con botón superior derecho */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--text)' }}>🍔 Gestión de Catálogo</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text2)' }}>
                  Administra los productos, precios y disponibilidad en el menú
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => abrirModalNuevo()}
                  style={{
                    backgroundColor: 'var(--brand, #16A34A)',
                    color: '#fff',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  + Agregar Producto / Categorías
                </button>
              </div>
            </div>

            {/* Barra de Filtros por Categoría */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              {categoriasDinamicas.map((cat) => {
                const activa = catFiltro === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatFiltro(cat)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: activa ? '2px solid var(--brand, #16A34A)' : '1px solid var(--border)',
                      backgroundColor: activa ? 'var(--brand, #16A34A)' : 'var(--card-bg, #fff)',
                      color: activa ? '#fff' : 'var(--text)',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {cat === 'Hamburguesas' && '🍔 '}
                    {cat === 'Perros' && '🌭 '}
                    {cat === 'Burritos' && '🌯 '}
                    {cat === 'Sandwich' && '🥪 '}
                    {cat === 'Bebidas' && '🥤 '}
                    {cat}
                  </button>
                );
              })}

              {/* Botón para eliminar la categoría seleccionada (excepto 'Todos' y 'Otros') */}
              {catFiltro !== 'Todos' && catFiltro !== 'Otros' && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`¿Eliminar la categoría "${catFiltro}"? Sus productos pasarán automáticamente a "Otros".`)) {
                      try {
                        const targetUrl = serverUrl || 'http://localhost:3001';
                        await axios.delete(`${targetUrl}/api/categorias/${encodeURIComponent(catFiltro)}`);
                        setCatFiltro('Todos');
                        await cargarCatalogo();
                      } catch (e) {
                        console.error("Error al eliminar categoría:", e);
                        alert("Error al eliminar la categoría del servidor.");
                      }
                    }
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '20px',
                    border: '1px solid #DC2626',
                    backgroundColor: '#FEE2E2',
                    color: '#DC2626',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginLeft: '4px'
                  }}
                  title={`Eliminar categoría "${catFiltro}"`}
                >
                  🗑️ Eliminar "{catFiltro}"
                </button>
              )}
            </div>

            {/* Grid de Productos Filtrados */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px'
            }}>
              {productosFiltradosVista.map((prod) => {
                  const disponible = prod.disponible !== 0 && prod.disponible !== false;
                  return (
                    <div
                      key={prod.id}
                      style={{
                        backgroundColor: 'var(--card-bg, #fff)',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                        opacity: disponible ? 1 : 0.6,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          fontSize: '26px',
                          backgroundColor: 'var(--surf, #F5EBE1)',
                          width: '46px',
                          height: '46px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {prod.emoji || prod.icono || '🍔'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--text)' }}>
                            {prod.nombre}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                            {prod._catReal}
                          </div>
                          <div style={{ fontWeight: '700', color: '#16A34A', fontSize: '15px', marginTop: '2px' }}>
                            ${Number(prod.precio || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Acciones de la tarjeta */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid var(--border)',
                        paddingTop: '10px'
                      }}>
                        <button
                          type="button"
                          onClick={async () => {
                            const nuevoDisp = !disponible;

                            // 1. Cambio visual instantáneo (optimista)
                            setListaProductos(prev =>
                              prev.map(p => p.id === prod.id ? { ...p, disponible: nuevoDisp } : p)
                            );

                            // 2. Persistir en la base de datos
                            try {
                              const targetUrl = serverUrl || 'http://localhost:3001';
                              await axios.post(`${targetUrl}/api/productos`, {
                                id: prod.id,
                                disponible: nuevoDisp ? 1 : 0,
                                disp: nuevoDisp,
                                cat: prod.categoria || prod.cat,
                                emoji: prod.emoji,
                                nombre: prod.nombre,
                                precio: prod.precio
                              }, { headers: { 'ngrok-skip-browser-warning': 'true' } });

                              if (socket && typeof socket.emit === 'function') {
                                socket.emit('producto:actualizado', { id: prod.id, disponible: nuevoDisp });
                              }
                            } catch (e) {
                              console.error("Error al guardar en backend, revirtiendo:", e);
                              // Revertir si falló la red
                              setListaProductos(prev =>
                                prev.map(p => p.id === prod.id ? { ...p, disponible: disponible } : p)
                              );
                            }
                          }}
                          style={{
                            backgroundColor: disponible ? '#DCFCE7' : '#FEE2E2',
                            color: disponible ? '#16A34A' : '#DC2626',
                            border: 'none',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {disponible ? '🟢 Activo' : '🔴 Agotado'}
                        </button>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(prod)}
                            style={{
                              background: 'none',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              cursor: 'pointer'
                            }}
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`¿Eliminar ${prod.nombre}?`)) {
                                try {
                                  await axios.delete(`${serverUrl}/api/productos/${prod.id}`);
                                  setListaProductos(prev => prev.filter(p => p.id !== prod.id));
                                  if (socket && typeof socket.emit === 'function') {
                                    socket.emit('productos_actualizados');
                                  }
                                } catch (e) {
                                  console.error(e);
                                }
                              }
                            }}
                            style={{
                              background: 'none',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              cursor: 'pointer'
                            }}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                      }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                      if (res.data.success) toast.success("Cantidad de mesas actualizada");
                    } catch (e) {
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

        {adminTab === 'insumos' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '28px' }}>
                📦 Control de Insumos y Stock
              </h2>
              <button
                onClick={() => setModalInsumoOpen(true)}
                style={{
                  backgroundColor: 'var(--brand)',
                  color: '#fff',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                + Nuevo Insumo
              </button>
            </div>

            <div style={{ backgroundColor: 'var(--card-bg, #fff)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text)' }}>Inventario Actual</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontSize: '13px' }}>
                    <th style={{ padding: '10px' }}>Nombre</th>
                    <th style={{ padding: '10px' }}>Stock Actual</th>
                    <th style={{ padding: '10px' }}>Stock Mínimo</th>
                    <th style={{ padding: '10px' }}>Precio Compra</th>
                    <th style={{ padding: '10px' }}>Estado</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {insumos && insumos.length > 0 ? (
                    insumos.map((ins) => {
                      const bajoStock = Number(ins.cantidad_actual) <= Number(ins.stock_minimo);
                      return (
                        <tr key={ins.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px' }}>
                          <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{ins.nombre}</td>
                          <td style={{ padding: '12px 10px' }}>{ins.cantidad_actual} {ins.unidad}</td>
                          <td style={{ padding: '12px 10px' }}>{ins.stock_minimo} {ins.unidad}</td>
                          <td style={{ padding: '12px 10px' }}>${Number(ins.precio_compra || 0).toLocaleString()}</td>
                          <td style={{ padding: '12px 10px' }}>
                            {bajoStock ? (
                              <span style={{ color: '#DC2626', fontWeight: 'bold' }}>⚠️ Bajo Stock</span>
                            ) : (
                              <span style={{ color: '#16A34A', fontWeight: 'bold' }}>OK</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                            <button
                              onClick={() => { setInsumoSeleccionado(ins); setTipoMov('entrada'); setModalMovimiento(true); }}
                              style={{ marginRight: '6px', padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#DCFCE7', color: '#16A34A', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              + Entrada
                            </button>
                            <button
                              onClick={() => { setInsumoSeleccionado(ins); setTipoMov('ajuste'); setModalMovimiento(true); }}
                              style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--surf, #F3F4F6)', color: 'var(--text)', cursor: 'pointer' }}
                            >
                              Ajuste
                            </button>
                            <button
                              onClick={() => eliminarInsumoDesktop(ins)}
                              style={{ marginLeft: '6px', padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#FEE2E2', color: '#DC2626', cursor: 'pointer', fontWeight: 'bold' }}
                              title="Eliminar insumo"
                            >
                              🗑️ Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>
                        No hay insumos registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ backgroundColor: 'var(--card-bg, #fff)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text)' }}>Últimos Movimientos (Kardex)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontSize: '13px' }}>
                    <th style={{ padding: '10px' }}>Fecha</th>
                    <th style={{ padding: '10px' }}>Insumo</th>
                    <th style={{ padding: '10px' }}>Tipo</th>
                    <th style={{ padding: '10px' }}>Cantidad</th>
                    <th style={{ padding: '10px' }}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos && movimientos.length > 0 ? (
                    movimientos.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px' }}>
                        <td style={{ padding: '10px' }}>{m.fecha ? new Date(m.fecha).toLocaleString() : '--'}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{m.insumo_nombre || m.nombre || 'Insumo'}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            backgroundColor: m.tipo === 'entrada' ? '#DCFCE7' : '#FEF3C7',
                            color: m.tipo === 'entrada' ? '#16A34A' : '#D97706'
                          }}>
                            {m.tipo ? m.tipo.toUpperCase() : 'MOVIMIENTO'}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>{m.cantidad}</td>
                        <td style={{ padding: '10px', color: 'var(--text2)' }}>{m.motivo || 'Operación de stock'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)' }}>
                        No hay movimientos recientes
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {modalInsumoOpen && (
              <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '480px', maxWidth: '92%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
                  <h3 style={{ margin: '0 0 16px 0', color: 'var(--brand, #144c3c)', fontSize: '20px', fontWeight: 'bold' }}>📦 + Nuevo Insumo / Materia Prima</h3>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const f = e.target;
                    const btnSubmit = f.querySelector('button[type="submit"]');
                    if (btnSubmit) btnSubmit.disabled = true;

                    try {
                      const targetUrl = serverUrl || 'http://localhost:3001';
                      const nombreInsumo = f.nombre.value.trim();
                      const unidadInsumo = f.unidad.value;
                      const stockMinimo = Number(f.stock_minimo.value) || 0;
                      const stockInicial = Number(f.cantidad_actual.value) || 0;
                      const precioCompra = Number(f.precio_compra.value) || 0;
                      const registrarGastoBool = f.registrar_gasto.checked;
                      const metodoPago = f.metodo_pago.value;
                      const grupoAfectado = f.grupo_afectado.value;
                      const fuenteFin = f.fuente_financiamiento.value;

                      // 1. Guardar Insumo
                      await axios.post(`${targetUrl}/api/inventario/insumos`, {
                        nombre: nombreInsumo,
                        unidad: unidadInsumo,
                        stock_minimo: stockMinimo,
                        cantidad_actual: stockInicial,
                        precio_compra: precioCompra
                      }, { 
                        headers: { 'ngrok-skip-browser-warning': 'true' },
                        timeout: 8000
                      });

                      // 2. Registrar egreso en finanzas si está activado y tiene costo
                      const costoTotalCalculado = precioCompra > 0 ? (stockInicial > 0 ? precioCompra * stockInicial : precioCompra) : 0;
                      if (registrarGastoBool && costoTotalCalculado > 0) {
                        try {
                          await axios.post(`${targetUrl}/api/gastos`, {
                            categoria: 'Ingredientes / Materia Prima',
                            descripcion: `Compra Insumo: ${nombreInsumo} (${stockInicial > 0 ? stockInicial : 1} ${unidadInsumo})`,
                            monto: costoTotalCalculado,
                            metodo_pago: metodoPago,
                            grupo_afectado: grupoAfectado,
                            fuente_financiamiento: fuenteFin,
                            caja_sesion_id: sesionActivaInfo?.id || null
                          }, {
                            headers: { 'ngrok-skip-browser-warning': 'true' }
                          });
                        } catch (errG) {
                          console.error('Error registrando egreso automático:', errG);
                        }
                      }

                      f.reset();
                      setModalInsumoOpen(false);
                      if (typeof cargarInventarioDesktop === 'function') cargarInventarioDesktop();
                      if (typeof cargarGastos === 'function') cargarGastos();
                      if (typeof cargarGastosPorGrupo === 'function') cargarGastosPorGrupo();
                      toast.success(registrarGastoBool && costoTotalCalculado > 0 
                        ? `✅ Insumo guardado y gasto de $${costoTotalCalculado.toLocaleString()} registrado` 
                        : "Insumo registrado correctamente");
                    } catch (err) {
                      console.error('Error creando insumo:', err);
                      alert('Error al guardar el insumo');
                    } finally {
                      if (btnSubmit) btnSubmit.disabled = false;
                    }
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Nombre del Insumo</label>
                      <input name="nombre" required placeholder="Ej: Queso Mozzarella, Carne, Papa..." style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Unidad de Medida</label>
                        <select name="unidad" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                          <option value="Kg">Kg</option>
                          <option value="Gr">Gramos</option>
                          <option value="Unidad">Unidad</option>
                          <option value="Litro">Litro</option>
                          <option value="Paquete">Paquete</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Precio Compra (x Unidad)</label>
                        <input name="precio_compra" type="number" placeholder="0" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Stock Inicial</label>
                        <input name="cantidad_actual" type="number" step="any" required placeholder="0" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Stock Mínimo</label>
                        <input name="stock_minimo" type="number" step="any" required placeholder="0" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      </div>
                    </div>

                    {/* Bloque Financiero / Opciones de Registrar Gasto */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', color: '#dc2626' }}>
                        <input type="checkbox" name="registrar_gasto" defaultChecked style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                        💸 Registrar también la compra como Gasto / Egreso en Finanzas
                      </label>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text2)', marginBottom: '4px' }}>
                          ¿A qué grupo pertenece? (Descontar de):
                        </label>
                        <select name="grupo_afectado" defaultValue="comida" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                          <option value="comida">🍔 Comida (Pan, carnes, verduras, salsas, quesos)</option>
                          <option value="jugos_naturales">🥤 Jugos Naturales (Frutas, pulpas, leche, azúcar)</option>
                          <option value="cervezas">🍺 Cervezas (Canastas y barriles)</option>
                          <option value="gaseosas_embotellados">🍾 Embotellados (Gaseosas, aguas, jugos)</option>
                          <option value="bebidas_calientes">☕ Bebidas Calientes (Café, té, aromáticas)</option>
                          <option value="gastos_generales">🏢 Gastos Generales (Servicios, aseo)</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text2)', marginBottom: '4px' }}>
                            Método de Pago:
                          </label>
                          <select name="metodo_pago" defaultValue="efectivo" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                            <option value="efectivo">💵 Efectivo (Caja)</option>
                            <option value="transferencia">💳 Transferencia (Nequi / Daviplata / Banco)</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text2)', marginBottom: '4px' }}>
                            Fuente de Financiamiento:
                          </label>
                          <select name="fuente_financiamiento" defaultValue="caja_negocio" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                            <option value="caja_negocio">🏪 Caja del Negocio (Ventas)</option>
                            <option value="aporte_capital">💼 Aporte de Capital (Inyección)</option>
                            <option value="prestamo">🤝 Préstamo / Pasivo (A devolver)</option>
                            <option value="ingreso_no_operacional">📈 Ingreso No Operacional</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                      <button type="button" onClick={() => setModalInsumoOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                      <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: 'var(--brand, #144c3c)', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                        💾 Guardar Insumo y Gasto
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {modalMovimiento && insumoSeleccionado && (
              <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '420px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                  <h3 style={{ margin: '0 0 16px 0', color: 'var(--brand, #144c3c)' }}>
                    {tipoMov === 'entrada' ? 'Entrada de Insumo' : 'Ajuste de Inventario'}
                  </h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text2)' }}>
                    Insumo: <strong style={{ color: 'var(--text)' }}>{insumoSeleccionado.nombre}</strong><br/>
                    Stock actual: <strong>{insumoSeleccionado.cantidad_actual} {insumoSeleccionado.unidad}</strong>
                  </p>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const f = e.target;
                    try {
                      const targetUrl = serverUrl || 'http://localhost:3001';
                      const payload = {
                        insumo_id: insumoSeleccionado.id,
                        tipo: tipoMov,
                        cantidad: Number(f.cantidad.value),
                        motivo: f.motivo ? f.motivo.value : (tipoMov === 'entrada' ? 'Compra' : 'Ajuste manual'),
                        costo: f.costo ? Number(f.costo.value) : 0,
                        usuario: 'Admin'
                      };
                      await axios.post(`${targetUrl}/api/inventario/movimientos`, payload, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                      
                      setModalMovimiento(false);
                      setInsumoSeleccionado(null);
                      if (typeof cargarInventarioDesktop === 'function') cargarInventarioDesktop();
                      toast.success(tipoMov === 'entrada' ? 'Entrada registrada' : 'Ajuste registrado');
                    } catch (err) {
                      console.error('Error registrando movimiento:', err);
                      toast.error('Error al guardar el movimiento');
                    }
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {tipoMov === 'entrada' ? (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Cantidad a ingresar ({insumoSeleccionado.unidad})</label>
                          <input name="cantidad" type="number" step="any" required placeholder="Ej. 10" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Costo total de esta entrada ($)</label>
                          <input name="costo" type="number" step="any" required placeholder="Ej. 50000" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Nuevo Stock Real ({insumoSeleccionado.unidad})</label>
                          <input name="cantidad" type="number" step="any" required placeholder={`Actual: ${insumoSeleccionado.cantidad_actual}`} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                          <small style={{ color: 'var(--text3)' }}>* Reemplazará el stock actual</small>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Motivo / Justificación</label>
                          <input name="motivo" required placeholder="Ej. Merma, Descuadre..." style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                        </div>
                      </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                      <button type="button" onClick={() => { setModalMovimiento(false); setInsumoSeleccionado(null); }} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                      <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: 'var(--brand, #144c3c)', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                        {tipoMov === 'entrada' ? 'Registrar Entrada' : 'Aplicar Ajuste'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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
                        Mesa {p.mesa} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text2)' }}>({p.metodo_pago})</span>
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
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '4px', fontWeight: 'bold' }}>
                    📅 Fecha de Auditoría:
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="date"
                      value={auditFechaFilter}
                      onChange={(e) => setAuditFechaFilter(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#fff',
                        fontSize: '14px',
                        color: '#0f172a',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    />
                    {auditFechaFilter && (
                      <button
                        type="button"
                        onClick={() => setAuditFechaFilter('')}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: 'var(--surf2, #f1f5f9)',
                          color: 'var(--text2, #64748b)',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                        title="Limpiar fecha"
                      >
                        ✕
                      </button>
                    )}
                  </div>
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


                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Unificado de Producto y Categorías */}
      {modalVisible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="animate-fade-in" style={{
            backgroundColor: 'var(--card-bg, #fff)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Sub-Pestañas Superiores en el Modal */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--border, #e2e8f0)', paddingBottom: '8px', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setModalSubTab('producto')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: modalSubTab === 'producto' ? 'var(--brand, #16A34A)' : 'transparent',
                  color: modalSubTab === 'producto' ? '#fff' : 'var(--text2)',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {productoEditando ? '✏️ Editar Producto' : '🍔 Nuevo Producto'}
              </button>
              <button
                type="button"
                onClick={() => setModalSubTab('categorias')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: modalSubTab === 'categorias' ? 'var(--brand, #16A34A)' : 'transparent',
                  color: modalSubTab === 'categorias' ? '#fff' : 'var(--text2)',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                🏷️ Gestionar Categorías
              </button>
            </div>

            {/* Pestaña 1: Nuevo / Editar Producto */}
            {modalSubTab === 'producto' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Categoría */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text2)', marginBottom: '4px', fontWeight: 'bold' }}>
                    Categoría:
                  </label>
                  <select
                    value={categoriaInput}
                    onChange={(e) => {
                      setCategoriaInput(e.target.value);
                      handleCambioCategoria(e.target.value);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '14px'
                    }}
                  >
                    {listaCategorias.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Estado del Producto (Activo/Inactivo) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--text2)', marginBottom: '4px' }}>
                    Estado del Producto:
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormProd(prev => ({ ...prev, disp: !prev.disp }))}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: formProd.disp !== false ? '#DCFCE7' : '#FEE2E2',
                      color: formProd.disp !== false ? '#16A34A' : '#DC2626',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {formProd.disp !== false ? '🟢 Activo' : '🔴 Inactivo / Agotado'}
                  </button>
                </div>

                {/* Selector libre y autodetección de Emoji */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold' }}>
                      Ícono / Emoji:
                    </label>
                    {emojiManual && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmojiManual(false);
                          setFormProd(prev => ({ ...prev, emoji: sugerirEmojiPorNombre(prev.nombre) }));
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--brand, #16A34A)',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title="Volver a sugerir automáticamente según el nombre"
                      >
                        ✨ Autodetectar por nombre
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="text"
                        value={formProd.emoji || ''}
                        placeholder="🍽️"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val.trim()) {
                            // Si se borra, vuelve a autodetectar por nombre
                            setEmojiManual(false);
                            setFormProd({ ...formProd, emoji: sugerirEmojiPorNombre(formProd.nombre) });
                          } else {
                            setEmojiManual(true);
                            setFormProd({ ...formProd, emoji: val });
                          }
                        }}
                        style={{
                          width: '64px',
                          height: '46px',
                          textAlign: 'center',
                          fontSize: '24px',
                          padding: '4px',
                          borderRadius: '8px',
                          border: '2px solid var(--border)',
                          backgroundColor: 'var(--surface, #ffffff)',
                          color: 'var(--text, #0f172a)'
                        }}
                        title="Escribe o pega cualquier emoji desde el teclado o portapapeles"
                      />
                      <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: '1.4' }}>
                        <span>Pega o escribe cualquier emoji libremente (ej. 🍕, ☕, 🍣, 🍷).</span>
                        {!emojiManual && (
                          <span style={{ color: 'var(--brand, #16A34A)', fontWeight: 'bold', display: 'block' }}>
                            🪄 Autodetectando según el nombre del producto
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Paleta rápida de emojis populares */}
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '600', marginRight: '4px' }}>Rápidos:</span>
                      {['🍔', '🌭', '🌯', '🍕', '🍟', '🍗', '🥪', '🌽', '🥤', '🍺', '🍾', '☕', '🍰', '🍷', '🍣', '🍽️'].map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => {
                            setEmojiManual(true);
                            setFormProd({ ...formProd, emoji: em });
                          }}
                          style={{
                            background: formProd.emoji === em ? 'var(--brand, #16A34A)' : 'var(--surf, #f3f4f6)',
                            color: formProd.emoji === em ? '#fff' : 'inherit',
                            border: formProd.emoji === em ? '1px solid var(--brand, #16A34A)' : '1px solid var(--border)',
                            borderRadius: '6px',
                            padding: '4px 7px',
                            cursor: 'pointer',
                            fontSize: '15px',
                            transition: 'all 0.15s ease'
                          }}
                          title={`Seleccionar ${em}`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Nombre y Precio */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: 'var(--text2)', fontSize: '13px' }}>Nombre del Producto</label>
                  <input
                    value={formProd.nombre}
                    onChange={e => {
                      const nuevoNombre = e.target.value;
                      setFormProd(prev => ({
                        ...prev,
                        nombre: nuevoNombre,
                        emoji: emojiManual ? prev.emoji : sugerirEmojiPorNombre(nuevoNombre),
                        grupo_reporte: prev.grupo_reporte || sugerirGrupoReporte(prev.categoria || prev.cat, nuevoNombre)
                      }));
                    }}
                    placeholder="Ej. Hamburguesa Doble Carne"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: 'var(--text2)', fontSize: '13px' }}>Precio (COP)</label>
                  <input
                    type="text" inputMode="numeric"
                    value={formProd.precio}
                    onChange={e => setFormProd({ ...formProd, precio: formatNumberInput(e.target.value) })}
                    placeholder="Ej. 18.000"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                  />
                </div>

                {/* Grupo de Productividad (Reporte) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--text2)', marginBottom: '4px' }}>
                    Grupo de Productividad (Reporte):
                  </label>
                  <select
                    value={formProd.grupo_reporte || 'comida'}
                    onChange={e => setFormProd({ ...formProd, grupo_reporte: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="comida">🍔 Comida preparada (Hamburguesas, Perros, Burritos, etc.)</option>
                    <option value="jugos_naturales">🥤 Jugos naturales y limonadas</option>
                    <option value="cervezas">🍺 Cerveza nacional e importada</option>
                    <option value="gaseosas_embotellados">🍾 Gaseosas, aguas y embotellados</option>
                    <option value="bebidas_calientes">☕ Bebidas calientes (cafés, tés, aromáticas)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: 'var(--text2)', fontSize: '13px' }}>Descripción (Ingredientes)</label>
                  <textarea
                    value={formProd.desc}
                    onChange={e => setFormProd({ ...formProd, desc: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', minHeight: '60px', resize: 'vertical' }}
                    placeholder="Ej. Pan artesanal, 125g carne res..."
                  />
                </div>

                {/* Foto del Producto */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: 'var(--text2)', fontSize: '13px' }}>Foto del Producto</label>
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
                        padding: '12px',
                        textAlign: 'center',
                        gap: '4px',
                        minHeight: '80px'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>📸</span>
                      <span style={{ fontSize: '13px', color: 'var(--orange)', fontWeight: 'bold' }}>
                        {imageFile ? 'Cambiar Foto' : 'Subir Foto'}
                      </span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: 'var(--text2)', fontSize: '13px' }}>Vista Previa</label>
                    <div style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surf2)',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      overflow: 'hidden'
                    }}>
                      {imagePreviewUrl ? (
                        <img src={imagePreviewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '40px', opacity: 0.5 }}>{formProd.emoji}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setModalVisible(false)}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid var(--border)', backgroundColor: 'transparent', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={guardarProducto}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--brand, #16A34A)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Guardar Producto
                  </button>
                </div>
              </div>
            )}

            {/* Pestaña 2: Gestionar Categorías */}
            {modalSubTab === 'categorias' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Formulario rápido arriba */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Nombre de la nueva categoría..."
                    value={nuevaCatNombre}
                    onChange={e => setNuevaCatNombre(e.target.value)}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!nuevaCatNombre.trim()) return;
                      try {
                        const targetUrl = serverUrl || 'http://localhost:3001';
                        await axios.post(`${targetUrl}/api/categorias`, { nombre: nuevaCatNombre.trim() });
                        setNuevaCatNombre('');
                        await cargarCatalogo();
                        if (socket && typeof socket.emit === 'function') {
                          socket.emit('catalogo_actualizado');
                        }
                        toast.success("Categoría creada");
                      } catch (e) {
                        console.error(e);
                        toast.error("Error al crear categoría");
                      }
                    }}
                    style={{ padding: '10px 16px', backgroundColor: 'var(--brand, #16A34A)', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                  >
                    Crear Categoría
                  </button>
                </div>

                {/* Lista vertical de las categorías existentes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', marginTop: '6px' }}>
                  {categoriasFull.length === 0 ? (
                    <div style={{ padding: '12px', color: 'var(--text3)', textAlign: 'center' }}>
                      No hay categorías registradas
                    </div>
                  ) : (
                    categoriasFull.map(c => {
                      const nombreCat = typeof c === 'string' ? c : (c.nombre || c.categoria || '');
                      const esFijo = ['todos', 'otros'].includes(String(nombreCat).toLowerCase().trim());

                      return (
                        <div key={c.id || nombreCat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--surface, #f9fafb)' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text)' }}>{nombreCat}</span>

                          {!esFijo && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(`¿Eliminar la categoría "${nombreCat}"? Sus productos pasarán automáticamente a "Otros".`)) {
                                  try {
                                    const targetUrl = serverUrl || 'http://localhost:3001';
                                    await axios.delete(`${targetUrl}/api/categorias/${encodeURIComponent(nombreCat)}`);
                                    setCatFiltro('Todos');
                                    await cargarCatalogo();
                                    if (socket && typeof socket.emit === 'function') {
                                      socket.emit('catalogo_actualizado');
                                    }
                                    toast.success(`Categoría "${nombreCat}" eliminada`);
                                  } catch (e) {
                                    console.error(e);
                                    toast.error("Error al eliminar la categoría");
                                  }
                                }
                              }}
                              style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                              title="Eliminar categoría"
                            >
                              🗑️ Eliminar
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setModalVisible(false)}
                  style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--surf3)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Cerrar Modal
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para Registrar Gasto */}
      {modalGastoVisible && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="animate-fade-in" style={{
            backgroundColor: 'white',
            padding: '28px',
            borderRadius: '20px',
            width: '460px',
            maxWidth: '92%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💸 Registrar Nuevo Gasto / Egreso
              </h2>
              <button
                type="button"
                onClick={() => setModalGastoVisible(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text2)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearGasto} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* ¿A qué grupo pertenece el gasto? */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '6px' }}>
                  ¿A qué grupo pertenece el gasto? (Descontar de):
                </label>
                <select
                  value={formGasto.grupo_afectado || 'comida'}
                  onChange={(e) => {
                    const g = e.target.value;
                    const catMap = {
                      comida: 'Ingredientes / Materia Prima',
                      jugos_naturales: 'Ingredientes / Materia Prima',
                      cervezas: 'Bebidas / Licores',
                      gaseosas_embotellados: 'Bebidas / Licores',
                      bebidas_calientes: 'Ingredientes / Materia Prima',
                      gastos_generales: 'Servicios / Generales'
                    };
                    setFormGasto({ ...formGasto, grupo_afectado: g, categoria: catMap[g] || 'Gastos' });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '2px solid var(--brand)',
                    fontSize: '13.5px',
                    backgroundColor: 'white',
                    fontWeight: '600',
                    color: 'var(--text)'
                  }}
                >
                  <option value="comida">🍔 Comida (Pan, carnes, verduras, salsas, quesos)</option>
                  <option value="jugos_naturales">🥤 Jugos Naturales (Frutas, pulpas, leche, azúcar)</option>
                  <option value="cervezas">🍺 Cervezas (Canastas y barriles de cerveza)</option>
                  <option value="gaseosas_embotellados">🍾 Embotellados (Gaseosas, aguas, jugos en caja)</option>
                  <option value="bebidas_calientes">☕ Bebidas Calientes (Café, té, aromáticas, leche)</option>
                  <option value="gastos_generales">🏢 Gastos Generales (Servicios, aseo, mantenimiento)</option>
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '6px' }}>
                  Descripción / Concepto:
                </label>
                <input
                  type="text"
                  placeholder="ej: Compra de carne y papas, Cajas de Postobón..."
                  value={formGasto.descripcion}
                  onChange={(e) => setFormGasto({ ...formGasto, descripcion: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {/* Monto */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '6px' }}>
                  Monto ($ COP):
                </label>
                <input
                  type="text"
                  placeholder="ej: 50.000"
                  value={formGasto.monto}
                  onChange={(e) => setFormGasto({ ...formGasto, monto: formatNumberInput(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#dc2626',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {/* Método de Pago */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '6px' }}>
                  Método de Pago (¿De dónde salió el dinero?):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setFormGasto({ ...formGasto, metodo_pago: 'efectivo' })}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: formGasto.metodo_pago === 'efectivo' ? '2px solid #16a34a' : '1px solid var(--border)',
                      backgroundColor: formGasto.metodo_pago === 'efectivo' ? 'rgba(22,163,74,0.1)' : 'white',
                      color: formGasto.metodo_pago === 'efectivo' ? '#16a34a' : 'var(--text)',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>💵</span> Efectivo (Caja)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormGasto({ ...formGasto, metodo_pago: 'transferencia' })}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: formGasto.metodo_pago === 'transferencia' ? '2px solid #2563eb' : '1px solid var(--border)',
                      backgroundColor: formGasto.metodo_pago === 'transferencia' ? 'rgba(37,99,235,0.1)' : 'white',
                      color: formGasto.metodo_pago === 'transferencia' ? '#2563eb' : 'var(--text)',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>💳</span> Transferencia
                  </button>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text3)' }}>
                  Transferencia incluye: Nequi, Daviplata, Bancolombia u otros bancos.
                </p>
              </div>

              {/* Fuente de Financiamiento / Origen del Dinero */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '6px' }}>
                  Fuente de Financiamiento / Origen del Dinero:
                </label>
                <select
                  value={formGasto.fuente_financiamiento || 'caja_negocio'}
                  onChange={(e) => setFormGasto({ ...formGasto, fuente_financiamiento: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13.5px',
                    backgroundColor: 'white',
                    fontWeight: '600',
                    color: 'var(--text)'
                  }}
                >
                  <option value="caja_negocio">🏪 Caja del Negocio (Ventas del Turno)</option>
                  <option value="aporte_capital">💼 Aporte de Capital / Inyección de Capital (Ahorros o socio)</option>
                  <option value="prestamo">🤝 Préstamo / Pasivo (Banco, prestamista o familiar a devolver)</option>
                  <option value="ingreso_no_operacional">📈 Ingreso No Operacional (Entrada externa no proveniente de comida)</option>
                </select>
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalGastoVisible(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surf2)',
                    color: 'var(--text)',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoGasto}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 6px rgba(220,38,38,0.2)'
                  }}
                >
                  {guardandoGasto ? 'Guardando...' : '💾 Guardar Gasto'}
                </button>
              </div>
            </form>
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
                      onChange={e => { setFormUser({ ...formUser, nombre: e.target.value }); setUserFormError(''); }}
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
                    onChange={e => { setFormUser({ ...formUser, pin: e.target.value }); setUserFormError(''); }}
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
                  onChange={e => setFormAdicional({ ...formAdicional, nombre: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text2)' }}>Precio (COP)</label>
                <input
                  type="text" inputMode="numeric"
                  value={formAdicional.precio}
                  onChange={e => setFormAdicional({ ...formAdicional, precio: formatNumberInput(e.target.value) })}
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
