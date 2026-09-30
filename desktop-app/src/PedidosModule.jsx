import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const formatNumberInput = (text) => {
  if (!text) return '';
  return text.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const cleanNum = (val) => {
  if (!val) return '0';
  return String(val).replace(/\./g, '');
};

const sugerirEmojiPorCategoria = (categoriaTexto) => {
  const c = String(categoriaTexto || '').toLowerCase().trim();
  if (c.includes('hambur')) return '🍔';
  if (c.includes('perro') || c.includes('hot dog')) return '🌭';
  if (c.includes('burrito') || c.includes('taco') || c.includes('mexic')) return '🌯';
  if (c.includes('salch')) return '🍟';
  if (c.includes('mazor')) return '🌽';
  if (c.includes('jugo') || c.includes('batid') || c.includes('smooth')) return '🥤';
  if (c.includes('limonad')) return '🍋';
  if (c.includes('cerveza') || c.includes('pola')) return '🍺';
  if (c.includes('caf') || c.includes('tinto') || c.includes('bebida cal')) return '☕';
  if (c.includes('adic') || c.includes('extra')) return '🍟';
  if (c.includes('pizza')) return '🍕';
  if (c.includes('postre') || c.includes('dulce') || c.includes('helad')) return '🍦';
  if (c.includes('pollo') || c.includes('alita')) return '🍗';
  if (c.includes('carne') || c.includes('asado') || c.includes('parrill')) return '🥩';
  if (c.includes('pan') || c.includes('sandwich') || c.includes('sándwich')) return '🥪';
  if (c.includes('gaseos') || c.includes('refres') || c.includes('soda')) return '🥤';
  if (c.includes('licor') || c.includes('trago') || c.includes('coctel')) return '🍹';
  return '🍽️';
};

const DEFAULT_CATEGORIAS = [
  { id: 1, nombre: "Hamburguesas", emoji: "🍔", color: "var(--cat-green)" },
  { id: 2, nombre: "Perros Calientes", emoji: "🌭", color: "var(--cat-brown)" },
  { id: 3, nombre: "Burritos", emoji: "🌯", color: "var(--cat-grey)" },
  { id: 4, nombre: "Salchipapas", emoji: "🍟", color: "var(--cat-green)" },
  { id: 5, nombre: "Mazorcada", emoji: "🌽", color: "var(--cat-brown)" },
  { id: 6, nombre: "Jugos Naturales", emoji: "🥤", color: "var(--cat-grey)" },
  { id: 7, nombre: "Limonadas", emoji: "🍋", color: "var(--cat-green)" },
  { id: 8, nombre: "Cervezas", emoji: "🍺", color: "var(--cat-brown)" },
  { id: 9, nombre: "Bebidas Calientes", emoji: "☕", color: "var(--cat-grey)" },
  { id: 10, nombre: "Adicionales", emoji: "🍟", color: "var(--cat-orange)" },
];

export function PedidosModule({ productos, mesas, serverUrl, adicionales = [], pedidoEditando, setPedidoEditando, pedidos = [], categorias = [] }) {
  const [catLocales, setCatLocales] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(1);

  useEffect(() => {
    if ((!categorias || categorias.length === 0) && serverUrl) {
      axios.get(`${serverUrl}/api/categorias`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
        .then(res => {
          const raw = Array.isArray(res.data) ? res.data : (res.data?.categorias || []);
          if (raw.length > 0) setCatLocales(raw);
        })
        .catch(err => console.log('Error fetching local categorias', err));
    }
  }, [serverUrl, categorias]);

  const listaCategoriasDinamicas = React.useMemo(() => {
    const map = new Map();

    const addCat = (id, nombre, emoji, color) => {
      if (!nombre) return;
      const nomStr = String(nombre).trim();
      if (!nomStr) return;
      const key = nomStr.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: id || `cat_${key}`,
          nombre: nomStr,
          emoji: emoji || sugerirEmojiPorCategoria(nomStr),
          color: color || 'var(--cat-green)'
        });
      }
    };

    DEFAULT_CATEGORIAS.forEach(c => addCat(c.id, c.nombre, c.emoji, c.color));

    const catsServidor = [...(categorias || []), ...(catLocales || [])];
    catsServidor.forEach(c => {
      const nom = typeof c === 'string' ? c : (c.nombre || c.categoria);
      const id = typeof c === 'object' && c !== null ? c.id : null;
      const emoji = typeof c === 'object' && c !== null ? c.emoji : null;
      const color = typeof c === 'object' && c !== null ? c.color : null;
      addCat(id, nom, emoji, color);
    });

    (productos || []).forEach(p => {
      const rawCat = p.categoria ?? p.categoria_nombre ?? p.cat;
      const nom = typeof rawCat === 'string' ? rawCat : (rawCat?.nombre || rawCat?.categoria || '');
      if (nom) addCat(p.categoria_id || p.cat, nom, p.emoji_categoria, null);
    });

    return Array.from(map.values()).sort((a, b) => 
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
  }, [categorias, catLocales, productos]);
  const [carrito, setCarrito] = useState([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [paraLlevar, setParaLlevar] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Estados de Configuración de Producto
  const [prodConfigModalVisible, setProdConfigModalVisible] = useState(false);
  const [prodToConfig, setProdToConfig] = useState(null);
  const [configObservaciones, setConfigObservaciones] = useState('');
  const [configAdicionales, setConfigAdicionales] = useState([]);
  const [configCantidad, setConfigCantidad] = useState(1);

  const handleSelectMesa = (m) => {
    const mesaNumStr = String(m.num || m.id || m.numero || '');
    
    // Si la mesa ya tiene una comanda activa, cargarla automáticamente para agregar ítems
    const pedidoActivo = (pedidos || []).find(p => 
      (String(p.mesa_id || p.mesa) === mesaNumStr || String(p.mesa_id || p.mesa) === `Mesa ${mesaNumStr}`) &&
      !['cobrado', 'cancelado', 'archivado', 'credito', 'fiado'].includes(String(p.estado || '').toLowerCase()) &&
      (p.pagado === 0 || p.pagado === null || p.pagado === undefined || p.pagado === false)
    );

    if (pedidoActivo && setPedidoEditando) {
      setPedidoEditando(pedidoActivo);
    }

    setMesaSeleccionada(mesaNumStr);
    setParaLlevar(false);
    setIsDropdownOpen(false);
  };

  useEffect(() => {
    if (pedidoEditando) {
      setMesaSeleccionada(pedidoEditando.mesa);
      setParaLlevar(pedidoEditando.mesa === 'Llevar');
      
      const itemsForCart = pedidoEditando.items.map((item, idx) => {
        const prod = productos.find(p => p.nombre === item.nombre) || {};
        return {
          uuid: item.uuid || `exist_${idx}`,
          id: prod.id || ('temp_' + item.nombre),
          cat: item.cat || prod.cat,
          nombre: item.nombre,
          precio: item.precio || prod.precio || 0,
          desc: prod.desc || '',
          emoji: prod.emoji || '🍔',
          cantidad: item.cantidad,
          nota: item.nota || '',
          estado: item.estado || 'pendiente',
          esExistente: true
        };
      });
      setCarrito(itemsForCart);
    } else {
      setCarrito([]);
      setMesaSeleccionada('');
      setParaLlevar(false);
    }
  }, [pedidoEditando, productos]);

  const catObjActivo = listaCategoriasDinamicas.find(c => 
    String(c.id) === String(categoriaActiva) || 
    c.nombre.toLowerCase() === String(categoriaActiva).toLowerCase()
  ) || listaCategoriasDinamicas[0];

  const nombreCatActiva = catObjActivo ? catObjActivo.nombre.toLowerCase() : '';
  const idCatActiva = catObjActivo ? catObjActivo.id : null;

  const prodsFromDb = (productos || []).filter(p => {
    if (!catObjActivo) return true;

    if (idCatActiva === 10 || nombreCatActiva.includes('adicional')) {
      const catName = String(p.categoria || p.categoria_nombre || p.cat || '').toLowerCase();
      if (catName.includes('adicional') || catName.includes('extra')) return true;
    }

    const pCatId = p.cat ?? p.categoria_id;
    if (pCatId !== undefined && pCatId !== null && String(pCatId) === String(idCatActiva)) return true;

    const pCatName = String(p.categoria || p.categoria_nombre || p.cat || '').toLowerCase().trim();
    if (pCatName && nombreCatActiva) {
      if (pCatName === nombreCatActiva) return true;
      if (pCatName.includes(nombreCatActiva) || nombreCatActiva.includes(pCatName)) return true;
    }

    return false;
  });

  const adicionalesMapped = ((idCatActiva === 10 || nombreCatActiva.includes('adicional')) && Array.isArray(adicionales))
    ? adicionales.filter(a => a.disponible !== 0).map(a => ({
        id: `adic_${a.id}`,
        original_adic_id: a.id,
        nombre: a.nombre,
        precio: Number(a.precio || 0),
        emoji: '🍟',
        cat: 10,
        categoria: 'Adicionales',
        es_adicional_directo: true
      })).filter(a => !prodsFromDb.some(p => p.nombre.toLowerCase().trim() === a.nombre.toLowerCase().trim()))
    : [];

  const productosFiltrados = [...prodsFromDb, ...adicionalesMapped];

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value || 0);
  };

  const esProductoBebida = (prod, catObj = null) => {
    if (!prod) return false;
    if (prod.permite_adicionales === false || prod.es_bebida === true) return true;
    
    const limpiar = (txt = '') => String(txt).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const nombreProd = limpiar(prod.nombre);
    const nombreCat = limpiar(catObj?.nombre || prod.categoria_nombre || '');
    
    const terminosBebida = [
      'bebida', 'jugo', 'cerveza', 'gaseosa', 'limonada', 'agua',
      'soda', 'refresco', 'hit', 'postobon', 'coca', 'botella', 'lata'
    ];
    
    return terminosBebida.some(t => nombreProd.includes(t) || nombreCat.includes(t));
  };

  const iniciarAgregarProducto = (prod) => {
    setProdToConfig(prod);
    setConfigObservaciones('');
    setConfigAdicionales([]);
    setConfigCantidad(1);
    setProdConfigModalVisible(true);
  };

  const agregarProductoSeguro = (producto, adicionales = [], notas = '', cantSolicitada = 1) => {
    const tieneAdics = Array.isArray(adicionales) && adicionales.length > 0;
    const tieneNotas = Boolean(notas && notas.trim());
    const cantidadFinal = tieneAdics || tieneNotas ? 1 : Math.max(1, Number(cantSolicitada) || 1);

    setCarrito(prev => {
      if (!tieneAdics && !tieneNotas) {
        const idx = prev.findIndex(it => it.id === producto.id && (!it.adicionales || it.adicionales.length === 0) && !it.nota && !it.observaciones && !it.notas);
        if (idx !== -1) {
          const copia = [...prev];
          const exist = copia[idx];
          const nuevaCant = Number(exist.cantidad || 1) + cantidadFinal;
          copia[idx] = {
            ...exist,
            cantidad: nuevaCant,
            subtotal: (Number(exist.precio) || 0) * nuevaCant
          };
          return copia;
        }
      }

      // 1. Calcular el total acumulado de todos los adicionales seleccionados
      const totalAdicionales = (adicionales || []).reduce((sum, adic) => {
        const cant = Number(adic.cantidad || 1);
        const precio = Number(adic.precio || 0);
        return sum + (precio * cant);
      }, 0);

      // 2. El precio unitario real del producto con sus extras incluidos
      const precioBase = Number(producto.precio || producto.precio_unitario || 0) || 0;
      const precioFinalUnitario = precioBase + totalAdicionales;

      // 3. Estructurar el ítem que se añade al carrito/pedido
      const nuevaLinea = {
        ...producto,
        uuid: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        id: producto.id,
        nombre: producto.nombre,
        precio: precioFinalUnitario,       // Debe ser el precio completo con adicionales
        precio_base: precioBase,           // Guardar el original por referencia
        cantidad: cantidadFinal,
        adicionales: (adicionales || []).map(a => ({
          id: a.id,
          nombre: a.nombre,
          precio: Number(a.precio || 0) || 0,
          cantidad: Number(a.cantidad || 1)
        })),
        observaciones: notas ? notas.trim() : '',
        nota: notas ? notas.trim() : '',
        notas: notas ? notas.trim() : '',
        subtotal: precioFinalUnitario * cantidadFinal
      };

      return [...prev, nuevaLinea];
    });
  };

  const handleSumarAdicional = (adic, e) => {
    if (e) e.stopPropagation();
    setConfigAdicionales(prev => {
      const existe = prev.find(a => a.id === adic.id);
      if (existe) {
        return prev.map(a => a.id === adic.id ? { ...a, cantidad: (a.cantidad || 1) + 1 } : a);
      }
      return [...prev, { ...adic, cantidad: 1 }];
    });
  };

  const handleRestarAdicional = (adic, e) => {
    if (e) e.stopPropagation();
    setConfigAdicionales(prev => {
      const existe = prev.find(a => a.id === adic.id);
      if (!existe) return prev;
      if ((existe.cantidad || 1) <= 1) {
        return prev.filter(a => a.id !== adic.id);
      }
      return prev.map(a => a.id === adic.id ? { ...a, cantidad: a.cantidad - 1 } : a);
    });
  };

  const confirmarAgregarProducto = () => {
    if (!prodToConfig) return;
    agregarProductoSeguro(prodToConfig, configAdicionales, configObservaciones, configCantidad);
    setProdConfigModalVisible(false);
    setProdToConfig(null);
  };

  const agregarAlCarrito = (itemExistente) => {
    setCarrito(prev => prev.map(i => i.uuid === itemExistente.uuid ? { ...i, cantidad: i.cantidad + 1 } : i));
  };

  const disminuirCantidad = (uuid) => {
    setCarrito(prev => prev.map(i => {
      if (i.uuid === uuid && i.cantidad > 1) return { ...i, cantidad: i.cantidad - 1 };
      return i;
    }));
  };

  const eliminarDelCarrito = (uuid) => {
    setCarrito(prev => prev.filter(i => i.uuid !== uuid));
  };

  const totalCarrito = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const descuento = 0; // Por ahora 0, luego se puede implementar
  const subtotal = totalCarrito - descuento;

  const enviarComanda = async () => {
    if (carrito.length === 0) return toast.error('El carrito está vacío');
    if (!paraLlevar && !mesaSeleccionada) return toast.error('Debes seleccionar una mesa o marcar como Para Llevar');

    try {
      if (pedidoEditando) {
        // Enviar edición
        const url = `${serverUrl}/api/pedidos/${pedidoEditando.uuid}`;
        await axios.put(url, {
          items: carrito,
          usuario: 'Caja'
        }, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        toast.success("✅ Pedido actualizado");
      } else {
        // Enviar nuevo
        const nuevoPedido = {
          uuid: Date.now().toString(),
          mesa: paraLlevar ? 'Llevar' : mesaSeleccionada,
          items: carrito,
          estado: 'activo',
          fecha: new Date().toISOString(),
          hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        };
        const res = await axios.post(`${serverUrl}/api/pedidos`, nuevoPedido, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (res.data && res.data.message) {
          toast.success(`✅ ${res.data.message}`);
        } else {
          toast.success("✅ Pedido enviado");
        }

        // Forzar recarga inmediata de mesas y pedidos localmente tras el POST 200 OK
        try {
          const today = new Date().toISOString().split('T')[0];
          await Promise.all([
            axios.get(`${serverUrl}/api/mesas`, { headers: { 'ngrok-skip-browser-warning': 'true' } }),
            axios.get(`${serverUrl}/api/pedidos/date/${today}`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
          ]);
        } catch (eRefetch) {}
      }

      setCarrito([]);
      setMesaSeleccionada('');
      setParaLlevar(false);
      if (setPedidoEditando) setPedidoEditando(null);
    } catch (error) {
      console.error('Error enviando pedido:', error);
      if (error?.response?.status === 409 || (error?.response?.data?.error && String(error.response.data.error).toLowerCase().includes('activo'))) {
        if (mesaSeleccionada) {
          const mesaTarget = String(mesaSeleccionada);
          const pedActivo = (pedidos || []).find(p =>
            (String(p.mesa_id || p.mesa) === mesaTarget || String(p.mesa_id || p.mesa) === `Mesa ${mesaTarget}`) &&
            !['cobrado', 'cancelado', 'archivado', 'credito', 'fiado'].includes(String(p.estado || '').toLowerCase())
          );
          if (pedActivo && setPedidoEditando) {
            setPedidoEditando(pedActivo);
          }
        }
        toast.success("✅ Ítems agregados a la orden abierta de la mesa.");
        setCarrito([]);
        setMesaSeleccionada('');
        setParaLlevar(false);
        return;
      }
      const msg = error?.response?.data?.error || 'Error al enviar la comanda al servidor. Revisa la conexión.';
      toast.error(msg);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      
      {/* COLUMNA CENTRAL: Detalle del Pedido */}
      <div className="pos-center-col">
        {/* Encabezado Mesa */}
        <div className="pos-table-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <span>Mesa: </span>
            <div style={{ position: 'relative' }}>
              <div 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{
                  backgroundColor: 'white', color: 'black', border: '1px solid var(--border)', 
                  fontSize: '16px', fontWeight: 'bold', outline: 'none', cursor: 'pointer',
                  padding: '6px 12px', borderRadius: '6px', minWidth: '80px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                {mesaSeleccionada ? mesaSeleccionada : '-'}
                <span style={{ fontSize: '10px', marginLeft: '8px' }}>▼</span>
              </div>
              
              {isDropdownOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                  backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '6px',
                  boxShadow: 'var(--shadow)', zIndex: 50, minWidth: '160px', maxHeight: '280px', overflowY: 'auto'
                }}>
                  <div 
                    onClick={() => { setMesaSeleccionada(''); setParaLlevar(false); setIsDropdownOpen(false); }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'black', fontWeight: 'bold' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--surface)'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    - (Sin Mesa)
                  </div>
                  {mesas.map(m => {
                    const mesaNumStr = String(m.num || m.id || m.numero || '');
                    const tieneComandaActiva = (pedidos || []).some(p => 
                      (String(p.mesa_id || p.mesa) === mesaNumStr || String(p.mesa_id || p.mesa) === `Mesa ${mesaNumStr}`) &&
                      !['cobrado', 'cancelado', 'archivado', 'credito', 'fiado'].includes(String(p.estado || '').toLowerCase()) &&
                      (p.pagado === 0 || p.pagado === null || p.pagado === undefined || p.pagado === false)
                    );
                    const estaOcupada = m.estado === 'ocupada' || m.estado === 'cuenta' || tieneComandaActiva;

                    return (
                      <div 
                        key={m.id}
                        onClick={() => handleSelectMesa(m)}
                        title={estaOcupada ? `Mesa ${m.num} tiene comanda activa` : `Mesa ${m.num} Libre`}
                        style={{ 
                          padding: '8px 12px', 
                          cursor: 'pointer', 
                          color: estaOcupada ? 'var(--red)' : 'black', 
                          fontWeight: 'bold', 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: estaOcupada ? '#fef2f2' : 'white',
                          borderBottom: '1px solid #f1f5f9'
                        }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = estaOcupada ? '#fee2e2' : 'var(--surface)'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = estaOcupada ? '#fef2f2' : 'white'}
                      >
                        <span>Mesa {m.num}</span>
                        <span style={{ 
                          fontSize: '10px', 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          backgroundColor: estaOcupada ? '#fecaca' : '#dcfce7',
                          color: estaOcupada ? '#b91c1c' : '#15803d'
                        }}>
                          {estaOcupada ? 'Ocupada' : 'Libre'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <button 
              onClick={() => { setParaLlevar(!paraLlevar); setMesaSeleccionada(''); }}
              style={{
                padding: '6px 12px', borderRadius: '20px', border: 'none',
                backgroundColor: paraLlevar ? 'var(--orange)' : 'rgba(255,255,255,0.2)', 
                color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                boxShadow: paraLlevar ? '0 2px 8px rgba(232, 82, 10, 0.4)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              {paraLlevar ? 'Llevando' : 'Llevar'}
            </button>
            <input 
              type="text" 
              placeholder="Nombre" 
              value={nombreCliente}
              onChange={e => setNombreCliente(e.target.value)}
              style={{
                padding: '6px 8px', borderRadius: '6px', border: 'none',
                backgroundColor: 'rgba(255,255,255,0.9)', color: 'var(--text)', 
                fontSize: '14px', outline: 'none', width: '100px', flex: 1
              }}
            />
          </div>
          <div style={{ whiteSpace: 'nowrap' }}>Hora: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>

        {/* Lista de Ítems */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {carrito.map((item, idx) => (
            <div key={item.uuid || item.id || idx} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              
              <div style={{ flex: 1, paddingRight: '12px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '2px', color: 'var(--text)' }}>{item.nombre}</div>
                {(item.nota || item.observaciones || item.notas) && (
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', fontStyle: 'italic', marginBottom: '2px' }}>
                    📝 {item.nota || item.observaciones || item.notas}
                  </div>
                )}
                {Array.isArray(item.adicionales) && item.adicionales.length > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--orange)', marginBottom: '2px' }}>
                    ➕ {item.adicionales.map(a => `${a.nombre}${(a.cantidad && a.cantidad > 1) ? ` x${a.cantidad}` : ''}`).join(', ')}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: 'var(--orange)' }}>{item.estado}</div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '20px', overflow: 'hidden' }}>
                  <button disabled={item.esExistente && item.estado === 'listo'} onClick={() => disminuirCantidad(item.uuid)} style={{ width: '32px', height: '32px', border: 'none', backgroundColor: 'var(--surface)', cursor: (item.esExistente && item.estado === 'listo') ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>-</button>
                  <div style={{ width: '30px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>{item.cantidad}</div>
                  <button disabled={item.esExistente && item.estado === 'listo'} onClick={() => agregarAlCarrito(item)} style={{ width: '32px', height: '32px', border: 'none', backgroundColor: 'var(--surface)', cursor: (item.esExistente && item.estado === 'listo') ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>+</button>
                </div>
                
                <div style={{ fontWeight: 'bold', fontSize: '16px', minWidth: '80px', textAlign: 'right', color: 'var(--text)' }}>
                  {formatCurrency(item.precio * item.cantidad)}
                </div>
                
                <button 
                  disabled={item.esExistente && item.estado === 'listo'}
                  onClick={() => eliminarDelCarrito(item.uuid)} 
                  style={{ 
                    border: 'none', 
                    backgroundColor: 'transparent', 
                    cursor: (item.esExistente && item.estado === 'listo') ? 'not-allowed' : 'pointer', 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    color: (item.esExistente && item.estado === 'listo') ? '#9CA3AF' : '#EF4444', 
                    marginLeft: '4px' 
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Totales */}
        <div style={{ padding: '24px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '16px', color: 'var(--text-light)' }}>
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '16px', color: 'var(--text-light)' }}>
            <span>Descuento</span>
            <span>{formatCurrency(descuento)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '24px', fontWeight: '900', color: 'var(--text)' }}>
            <span>Total</span>
            <span style={{ color: 'var(--orange)' }}>{formatCurrency(totalCarrito)}</span>
          </div>

          <button 
            onClick={enviarComanda}
            disabled={carrito.length === 0}
            style={{ 
              width: '100%', padding: '16px', marginTop: '24px', backgroundColor: carrito.length > 0 ? 'var(--header-bg)' : '#d1d5db',
              color: 'white', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: carrito.length > 0 ? 'pointer' : 'not-allowed'
            }}
          >
            Enviar Pedido
          </button>
        </div>
      </div>

      {/* MODAL CONFIGURAR PRODUCTO */}
      {prodConfigModalVisible && prodToConfig && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--brand)' }}>{prodToConfig.nombre}</h2>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--orange)' }}>{formatCurrency(prodToConfig.precio)}</span>
            </div>

            {/* Solo mostrar adicionales si es comida */}
            {!esProductoBebida(prodToConfig) && (
              <>
                <h3 style={{ fontSize: '16px', color: 'var(--text-light)', marginBottom: '12px' }}>🍟 Adicionales Extra:</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  {adicionales.map(adic => {
                    const itemSel = configAdicionales.find(a => a.id === adic.id);
                    const cantidad = itemSel ? (itemSel.cantidad || 1) : 0;
                    const isSelected = cantidad > 0;

                    return (
                      <div
                        key={adic.id}
                        onClick={(e) => handleSumarAdicional(adic, e)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          border: `2px solid ${isSelected ? 'var(--orange)' : 'var(--border)'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(232,82,10,0.08)' : 'var(--surf2)',
                          userSelect: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>{adic.nombre}</span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--orange)' }}>
                            +{formatCurrency(adic.precio)}
                          </span>
                        </div>

                        {isSelected ? (
                          <div 
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleRestarAdicional(adic, e)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#dc2626',
                                color: '#fff',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              -
                            </button>

                            <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', color: 'var(--text)' }}>
                              {cantidad}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => handleSumarAdicional(adic, e)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#16a34a',
                                color: '#fff',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Tocar para añadir</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <h3 style={{ fontSize: '16px', color: 'var(--text-light)', marginBottom: '12px' }}>
              {esProductoBebida(prodToConfig) ? "📌 Notas para barra / servicio:" : "📝 Observaciones para cocina:"}
            </h3>
            <textarea 
              value={configObservaciones}
              onChange={(e) => setConfigObservaciones(e.target.value)}
              placeholder={esProductoBebida(prodToConfig) ? "Ej. Con hielo, en vaso, sin azúcar..." : "Ej. Sin tomate, poca salsa..."}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surf2)', color: 'var(--text)', minHeight: '80px', marginBottom: '24px', resize: 'vertical' }}
            />

            {(() => {
              const tieneModificadores = !esProductoBebida(prodToConfig) && ((configAdicionales && configAdicionales.length > 0) || Boolean(configObservaciones && configObservaciones.trim()));
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--surf3)', borderRadius: '8px', marginBottom: '24px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Cantidad:</span>
                  {tieneModificadores ? (
                    <span style={{ fontSize: '14px', color: '#FF9800', fontWeight: 'bold' }}>Personalización individual (1)</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <button onClick={() => setConfigCantidad(c => Math.max(1, c - 1))} style={{ width: '40px', height: '40px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--surf2)', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer' }}>-</button>
                      <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{configCantidad}</span>
                      <button onClick={() => setConfigCantidad(c => c + 1)} style={{ width: '40px', height: '40px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--surf2)', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
                    </div>
                  )}
                </div>
              );
            })()}

            {(() => {
              // Suma exacta de adicionales multiplicando cada precio por su cantidad
              const totalAdicionales = (configAdicionales || []).reduce((acc, adic) => {
                const cant = Number(adic.cantidad || 1);
                const precio = Number(adic.precio || 0);
                return acc + (precio * cant);
              }, 0);

              const precioUnitarioConAdicionales = Number(prodToConfig?.precio || 0) + totalAdicionales;
              const totalFinalModal = precioUnitarioConAdicionales * (Number(configCantidad) || 1);

              return (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={() => { setProdConfigModalVisible(false); setProdToConfig(null); }}
                    style={{ flex: 1, padding: '16px', borderRadius: '8px', border: '2px solid var(--border)', backgroundColor: 'transparent', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmarAgregarProducto}
                    style={{ flex: 1, padding: '16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--orange)', color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                  >
                    Añadir ({formatCurrency ? formatCurrency(totalFinalModal) : `$${totalFinalModal.toLocaleString('es-CO')}`})
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* COLUMNA DERECHA: Catálogo */}
      <div className="pos-right-col">
        {/* Categorías */}
        <div className="pos-categories">
          <div style={{ fontWeight: 'bold', fontSize: '18px', color: 'var(--header-bg)', marginBottom: '8px', textAlign: 'center' }}>
            Categorías
          </div>
          {listaCategoriasDinamicas.map(cat => {
            const isSelected = catObjActivo && (
              String(cat.id) === String(catObjActivo.id) ||
              cat.nombre.toLowerCase() === catObjActivo.nombre.toLowerCase()
            );
            return (
              <button
                key={cat.id}
                className="pos-cat-btn"
                onClick={() => setCategoriaActiva(cat.id)}
                style={{
                  backgroundColor: isSelected ? 'var(--orange)' : 'white',
                  color: isSelected ? 'white' : 'var(--text)',
                  border: isSelected ? 'none' : '1px solid var(--border)',
                  borderRadius: '50px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                  opacity: 1
                }}
              >
                <span>{cat.emoji || sugerirEmojiPorCategoria(cat.nombre)}</span>
                <span>{cat.nombre}</span>
              </button>
            );
          })}
        </div>

        {/* Grilla de Productos */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontWeight: 'bold', fontSize: '18px', color: 'var(--header-bg)', marginBottom: '16px', flexShrink: 0 }}>
            Catálogo de Productos
          </div>
          
          <div className="pos-catalog">
            {productosFiltrados.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
                No hay productos configurados para esta categoría.
              </div>
            ) : (
              productosFiltrados.map(prod => (
                <div key={prod.id} className="pos-product-card" onClick={() => iniciarAgregarProducto(prod)}>
                  <div className="pos-product-img">
                    {prod.emoji}
                  </div>
                  <div className="pos-product-info">
                    <div className="pos-product-name">{prod.nombre}</div>
                    {prod.desc && <div className="pos-product-desc">{prod.desc}</div>}
                    <div className="pos-product-price">{formatCurrency(prod.precio)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
