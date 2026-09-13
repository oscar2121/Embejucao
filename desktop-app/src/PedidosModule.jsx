import { useState, useEffect } from 'react';
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

const CATEGORIAS = [
  { id: 1, nombre: "Hamburguesas", emoji: "🍔", color: "var(--cat-green)" },
  { id: 2, nombre: "Perros Calientes", emoji: "🌭", color: "var(--cat-brown)" },
  { id: 3, nombre: "Burritos", emoji: "🌯", color: "var(--cat-grey)" },
  { id: 4, nombre: "Salchipapas", emoji: "🍟", color: "var(--cat-green)" },
  { id: 5, nombre: "Mazorcada", emoji: "🌽", color: "var(--cat-brown)" },
  { id: 6, nombre: "Jugos Naturales", emoji: "🥤", color: "var(--cat-grey)" },
  { id: 7, nombre: "Limonadas", emoji: "🍋", color: "var(--cat-green)" },
  { id: 8, nombre: "Cervezas", emoji: "🍺", color: "var(--cat-brown)" },
  { id: 9, nombre: "Bebidas Calientes", emoji: "☕", color: "var(--cat-grey)" },
];

export function PedidosModule({ productos, mesas, serverUrl, adicionales = [], pedidoEditando, setPedidoEditando }) {
  const [categoriaActiva, setCategoriaActiva] = useState(1);
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

  const productosFiltrados = productos.filter(p => p.cat === categoriaActiva);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value || 0);
  };

  const iniciarAgregarProducto = (prod) => {
    setProdToConfig(prod);
    setConfigObservaciones('');
    setConfigAdicionales([]);
    setConfigCantidad(1);
    setProdConfigModalVisible(true);
  };

  const confirmarAgregarProducto = () => {
    if (!prodToConfig) return;
    
    let nombreFinal = prodToConfig.nombre;
    let precioFinal = prodToConfig.precio;
    
    if (configAdicionales.length > 0) {
      const nombresAdic = configAdicionales.map(a => a.nombre).join(', ');
      nombreFinal += ` (+ ${nombresAdic})`;
      precioFinal += configAdicionales.reduce((sum, a) => sum + a.precio, 0);
    }
    
    const uuid = Math.random().toString(36).substr(2, 9);
    const nuevoItem = {
      ...prodToConfig,
      uuid: uuid,
      nombre: nombreFinal,
      precio: precioFinal,
      cantidad: configCantidad,
      estado: 'pendiente',
      nota: configObservaciones.trim()
    };
    
    setCarrito(prev => {
      const exist = prev.find(i => i.id === prodToConfig.id && i.nombre === nombreFinal && i.nota === nuevoItem.nota);
      if (exist) {
        return prev.map(i => (i.id === prodToConfig.id && i.nombre === nombreFinal && i.nota === nuevoItem.nota) 
          ? { ...i, cantidad: i.cantidad + configCantidad } 
          : i);
      }
      return [...prev, nuevoItem];
    });
    
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
        await axios.post(`${serverUrl}/api/pedidos`, nuevoPedido, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        toast.success("✅ Pedido enviado");
      }

      setCarrito([]);
      setMesaSeleccionada('');
      setParaLlevar(false);
      if (setPedidoEditando) setPedidoEditando(null);
    } catch (error) {
      console.error('Error enviando pedido:', error);
      toast.error('Error al enviar la comanda al servidor. Revisa la conexión.');
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
                  boxShadow: 'var(--shadow)', zIndex: 50, minWidth: '100%', overflow: 'hidden'
                }}>
                  <div 
                    onClick={() => { setMesaSeleccionada(''); setParaLlevar(false); setIsDropdownOpen(false); }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'black', fontWeight: 'bold' }}
                    onMouseOver={e => e.target.style.backgroundColor = 'var(--surface)'}
                    onMouseOut={e => e.target.style.backgroundColor = 'white'}
                  >
                    -
                  </div>
                  {mesas.map(m => {
                    const isOcupada = m.estado !== 'libre';
                    return (
                      <div 
                        key={m.id}
                        onClick={() => { setMesaSeleccionada(String(m.num)); setParaLlevar(false); setIsDropdownOpen(false); }}
                        style={{ padding: '8px 12px', cursor: 'pointer', color: isOcupada ? 'var(--red)' : 'black', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}
                        onMouseOver={e => e.target.style.backgroundColor = 'var(--surface)'}
                        onMouseOut={e => e.target.style.backgroundColor = 'white'}
                      >
                        <span>{m.num}</span>
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
          {carrito.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              
              <div style={{ flex: 1, paddingRight: '12px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '2px', color: 'var(--text)' }}>{item.nombre}</div>
                {item.nota && <div style={{ fontSize: '12px', color: 'var(--text-light)', fontStyle: 'italic', marginBottom: '2px' }}>📝 {item.nota}</div>}
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

            <h3 style={{ fontSize: '16px', color: 'var(--text-light)', marginBottom: '12px' }}>🍟 Adicionales Extra:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {adicionales.map(adic => {
                const isSelected = configAdicionales.some(a => a.id === adic.id);
                return (
                  <div
                    key={adic.id}
                    onClick={() => {
                      if (isSelected) setConfigAdicionales(prev => prev.filter(a => a.id !== adic.id));
                      else setConfigAdicionales(prev => [...prev, adic]);
                    }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', padding: '12px', 
                      border: `2px solid ${isSelected ? 'var(--orange)' : 'var(--border)'}`, 
                      borderRadius: '8px', cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(232,82,10,0.05)' : 'var(--surf2)'
                    }}
                  >
                    <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>{adic.nombre}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--orange)' }}>+{formatCurrency(adic.precio)}</span>
                  </div>
                );
              })}
            </div>

            <h3 style={{ fontSize: '16px', color: 'var(--text-light)', marginBottom: '12px' }}>📝 Observaciones para cocina:</h3>
            <textarea 
              value={configObservaciones}
              onChange={(e) => setConfigObservaciones(e.target.value)}
              placeholder="Ej. Sin tomate, poca salsa..."
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surf2)', color: 'var(--text)', minHeight: '80px', marginBottom: '24px', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--surf3)', borderRadius: '8px', marginBottom: '24px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Cantidad:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => setConfigCantidad(c => Math.max(1, c - 1))} style={{ width: '40px', height: '40px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--surf2)', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer' }}>-</button>
                <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{configCantidad}</span>
                <button onClick={() => setConfigCantidad(c => c + 1)} style={{ width: '40px', height: '40px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--surf2)', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
              </div>
            </div>

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
                Añadir ({formatCurrency((prodToConfig.precio + configAdicionales.reduce((s, a) => s + a.precio, 0)) * configCantidad)})
              </button>
            </div>
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
          {CATEGORIAS.map(cat => (
            <button
              key={cat.id}
              className="pos-cat-btn"
              onClick={() => setCategoriaActiva(cat.id)}
              style={{
                backgroundColor: categoriaActiva === cat.id ? 'var(--orange)' : 'white',
                color: categoriaActiva === cat.id ? 'white' : 'var(--text)',
                border: categoriaActiva === cat.id ? 'none' : '1px solid var(--border)',
                borderRadius: '50px',
                padding: '16px 12px',
                transform: categoriaActiva === cat.id ? 'scale(1.02)' : 'scale(1)',
                opacity: 1
              }}
            >
              {cat.nombre}
            </button>
          ))}
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
