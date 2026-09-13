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

export function CajaModule({ pedidos, mesas, productos, serverUrl, sesionActiva, setSesionActiva, onEditPedido }) {
  const [selectedPedido, setSelectedPedido] = useState(null);

  // Filtrar pedidos que están listos para cobro o activos
  const pedidosCaja = pedidos.filter(p => p.estado !== 'completado' && p.estado !== 'cancelado');

  const getProductoInfo = (prodId) => {
    return productos.find(p => p.id === prodId) || { nombre: 'Desconocido', precio: 0, emoji: '❓' };
  };

  const calcularTotal = (pedidoOrItems) => {
    if (!pedidoOrItems) return 0;
    
    if (pedidoOrItems.ordenes_historial) {
      return pedidoOrItems.ordenes_historial.reduce((totalSum, orden) => {
        if (!orden.items) return totalSum;
        return totalSum + orden.items.reduce((sum, item) => {
          const precioItem = item.precio || getProductoInfo(item.productoId || item.id).precio;
          const cantidad = item.cantidad || 1;
          return sum + (precioItem * cantidad);
        }, 0);
      }, 0);
    }

    const items = Array.isArray(pedidoOrItems) ? pedidoOrItems : (pedidoOrItems.items || []);
    return items.reduce((total, item) => {
      const precioItem = item.precio || getProductoInfo(item.productoId || item.id).precio;
      const cantidad = item.cantidad || 1;
      return total + (precioItem * cantidad);
    }, 0);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  };

  const mapFiados = (fiadosList) => {
    if (!fiadosList) return [];
    const grouped = {};
    fiadosList.forEach(f => {
      let history = [];
      if (f.ordenes_historial) {
        history = f.ordenes_historial;
      } else if (f.items && f.items.length > 0 && (f.items[0].fecha || f.items[0].items)) {
        history = f.items;
      } else if (f.items) {
        history = [{
          fecha: f.fecha_fiado || f.fecha || new Date().toISOString(),
          mesa: String(f.mesa || ''),
          items: f.items
        }];
      }
      
      const key = f.deudor ? f.deudor.trim().toLowerCase() : 'desconocido';
      
      if (!grouped[key]) {
        grouped[key] = {
          ...f,
          uuids: [f.uuid],
          ordenes_historial: [...history],
          items: [...history]
        };
      } else {
        if (f.uuid) grouped[key].uuids.push(f.uuid);
        grouped[key].ordenes_historial.push(...history);
        grouped[key].items.push(...history);
      }
    });
    return Object.values(grouped);
  };

  const [modalPagoVisible, setModalPagoVisible] = useState(false);
  const [pedidoACobrar, setPedidoACobrar] = useState(null);
  const [isCreditoMode, setIsCreditoMode] = useState(false);
  const [isMixtoMode, setIsMixtoMode] = useState(false);
  const [efectivoMixto, setEfectivoMixto] = useState('');
  const [deudorName, setDeudorName] = useState('');
  const [listaDeudores, setListaDeudores] = useState([]);

  useEffect(() => {
    if (modalPagoVisible && isCreditoMode) {
      Promise.all([
        axios.get(`${serverUrl}/api/pedidos/fiado`, { headers: { 'ngrok-skip-browser-warning': 'true' } }),
        axios.get(`${serverUrl}/api/clientes`, { headers: { 'ngrok-skip-browser-warning': 'true' } }).catch(() => ({ data: { clientes: [] } }))
      ])
        .then(([resFiados, resClientes]) => {
          let names = [];
          if (resFiados.data && resFiados.data.fiados) {
            names = resFiados.data.fiados.map(f => f.deudor).filter(Boolean);
          }
          if (resClientes.data && resClientes.data.clientes) {
            names = [...names, ...resClientes.data.clientes];
          }
          setListaDeudores(Array.from(new Set(names)).sort((a,b) => a.localeCompare(b)));
        })
        .catch(err => console.error('Error fetching deudores:', err));
    }
  }, [modalPagoVisible, isCreditoMode, serverUrl]);

  const handleCobrarClick = (pedido) => {
    setPedidoACobrar(pedido);
    setIsCreditoMode(false);
    setIsMixtoMode(false);
    setEfectivoMixto('');
    setModalPagoVisible(true);
  };

  const confirmarCobro = async (metodo) => {
    if (!pedidoACobrar) return;
    try {
      if (metodo === 'Fiado') {
        const deudor = deudorName.trim();
        if (!deudor) {
          toast.error('Debes ingresar un nombre para el crédito.');
          return;
        }
        await axios.put(`${serverUrl}/api/pedidos/${pedidoACobrar.uuid}/fiado`, {
          deudor,
          fecha_fiado: new Date().toISOString(),
          usuario: 'Caja',
          mesa: pedidoACobrar.mesa
        }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      } else {
        // Cobro normal (Efectivo / Transferencia / Mixto)
        if (pedidoACobrar.uuids && pedidoACobrar.uuids.length > 0) {
          for (let u of pedidoACobrar.uuids) {
            await axios.delete(`${serverUrl}/api/pedidos/${u}`, {
              headers: { 'ngrok-skip-browser-warning': 'true' }
            });
          }
        } else {
          await axios.delete(`${serverUrl}/api/pedidos/${pedidoACobrar.uuid}`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
          });
        }
        
        // Registrar en la nueva tabla de ventas para reportes
        try {
           let detallesVenta = [];
           if (pedidoACobrar.ordenes_historial) {
             pedidoACobrar.ordenes_historial.forEach(orden => {
               if (orden.items) {
                 orden.items.forEach(i => detallesVenta.push(i));
               }
             });
           } else {
             detallesVenta = pedidoACobrar.items || [];
           }

           const mappedDetalles = detallesVenta.map(i => ({
              producto_id: i.productoId || i.id,
              nombre_producto: getProductoInfo(i.productoId || i.id).nombre,
              cantidad: i.cantidad || 1,
              precio_unitario: i.precio || getProductoInfo(i.productoId || i.id).precio,
              subtotal: (i.cantidad || 1) * (i.precio || getProductoInfo(i.productoId || i.id).precio)
           }));

           if (metodo.type === 'Mixto') {
              // Pago mixto: separamos en dos registros para que el cuadre de caja funcione bien
              // El efectivo lleva los detalles para no duplicar en el inventario/reportes
              await axios.post(`${serverUrl}/api/ventas`, {
                fecha: new Date().toISOString(),
                tipo_origen: pedidoACobrar.uuids ? 'Fiado Pagado' : 'Mesa',
                mesa: pedidoACobrar.uuids ? `Deuda: ${pedidoACobrar.deudor}` : pedidoACobrar.mesa,
                total: metodo.efectivo,
                metodo_pago: 'Efectivo',
                sesion_id: sesionActiva ? sesionActiva.id : null,
                usuario: 'Caja',
                detalles: mappedDetalles
              }, { headers: { 'ngrok-skip-browser-warning': 'true' } });

              if (metodo.transferencia > 0) {
                // La transferencia va sin detalles para evitar duplicidad de productos vendidos
                await axios.post(`${serverUrl}/api/ventas`, {
                  fecha: new Date().toISOString(),
                  tipo_origen: pedidoACobrar.uuids ? 'Fiado Pagado' : 'Mesa',
                  mesa: pedidoACobrar.uuids ? `Deuda: ${pedidoACobrar.deudor}` : pedidoACobrar.mesa,
                  total: metodo.transferencia,
                  metodo_pago: 'Transferencia',
                  sesion_id: sesionActiva ? sesionActiva.id : null,
                  usuario: 'Caja',
                  detalles: []
                }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
              }
           } else {
             await axios.post(`${serverUrl}/api/ventas`, {
               fecha: new Date().toISOString(),
               tipo_origen: pedidoACobrar.uuids ? 'Fiado Pagado' : 'Mesa',
               mesa: pedidoACobrar.uuids ? `Deuda: ${pedidoACobrar.deudor}` : pedidoACobrar.mesa,
               total: calcularTotal(pedidoACobrar),
               metodo_pago: metodo,
               sesion_id: sesionActiva ? sesionActiva.id : null,
               usuario: 'Caja',
               detalles: mappedDetalles
             }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
           }
        } catch(e) {
           console.warn('Omitiendo registro en tabla de ventas secundarias:', e);
        }
      }
      
      setModalPagoVisible(false);
      setIsCreditoMode(false);
      setIsMixtoMode(false);
      setEfectivoMixto('');
      setDeudorName('');
      setPedidoACobrar(null);
      setSelectedPedido(null);
      toast.success(`Pago procesado exitosamente ${metodo.type === 'Mixto' ? '(Mixto)' : '(' + metodo + ')'}`);
    } catch (error) {
      console.error('Error al cobrar:', error);
      const serverMsg = error.response && error.response.data && error.response.data.error 
        ? error.response.data.error 
        : error.message;
      toast.error(`Hubo un error al procesar el pago en el servidor.\nDetalle: ${serverMsg}`);
    }
  };

  const handlePrintReceipt = async (pedido) => {
    try {
      const pType = localStorage.getItem('printerType');
      if (!pType) {
        toast.error("Primero configura la impresora en la pestaña Configuración -> Impresora Térmica");
        return;
      }
      
      const total = formatCurrency(calcularTotal(pedido));
      const fecha = new Date().toLocaleString('es-CO');
      
      if (pType === 'ip') {
        const pIp = localStorage.getItem('printerIP');
        if (!pIp) return toast.error("Falta la IP de la impresora.");
        
        let text = `<C><B>EMBEJUCAO</B></C>\n`;
        text += `<C>Ticket de Venta</C>\n\n`;
        text += `Fecha: ${fecha}\n`;
        text += `Mesa: ${pedido.mesa || 'N/A'}\n`;
        text += `Pedido #: ${pedido.id}\n`;
        text += `------------------------------------------------\n`;
        
        pedido.items.forEach(item => {
          const prod = getProductoInfo(item.productoId || item.id);
          const name = (item.nombre || prod.nombre).substring(0, 20);
          const price = formatCurrency((item.precio || prod.precio) * (item.cantidad || 1));
          
          let line = `${item.cantidad || 1}x ${name}`;
          const spaces = 48 - line.length - price.length;
          if (spaces > 0) line += ' '.repeat(spaces) + price;
          else line = line.substring(0, 48 - price.length - 1) + ' ' + price;
          
          text += `${line}\n`;
        });
        
        text += `------------------------------------------------\n`;
        text += `<R><B>TOTAL: ${total}</B></R>\n`;
        text += `\n<C>¡Gracias por tu visita!</C>\n\n\n\n`;

        if (window.electronAPI) {
          const res = await window.electronAPI.printIp(text, pIp);
          if (!res.success) toast.error("Error imprimiendo IP: " + res.reason);
        } else {
          toast.error("La impresión directa solo funciona desde la app Electron.");
        }
      } else if (pType === 'usb') {
        const pSys = localStorage.getItem('selectedSystemPrinter');
        
        let html = `
          <div style="text-align: center;">
            <h1 style="margin:0; font-size: 16px;">EMBEJUCAO</h1>
            <p style="margin:0; font-size: 12px;">Ticket de Venta</p>
          </div>
          <br>
          <div>Fecha: ${fecha}</div>
          <div>Mesa: ${pedido.mesa || 'N/A'}</div>
          <div>Pedido #: ${pedido.id}</div>
          <hr style="border-top: 1px dashed black;">
          <table style="width: 100%; font-size: 12px;">
        `;
        
        pedido.items.forEach(item => {
          const prod = getProductoInfo(item.productoId || item.id);
          const name = item.nombre || prod.nombre;
          const price = formatCurrency((item.precio || prod.precio) * (item.cantidad || 1));
          html += `
            <tr>
              <td>${item.cantidad || 1}x ${name}</td>
              <td style="text-align: right;">${price}</td>
            </tr>
          `;
        });
        
        html += `
          </table>
          <hr style="border-top: 1px dashed black;">
          <div style="text-align: right; font-size: 14px; font-weight: bold;">TOTAL: ${total}</div>
          <br>
          <div style="text-align: center; font-size: 12px;">¡Gracias por tu visita!</div>
        `;
        
        if (window.electronAPI) {
          const res = await window.electronAPI.printReceipt(html, pSys);
          if (!res.success) toast.error("Error imprimiendo USB: " + res.reason);
        } else {
          toast.error("La impresión por USB silenciosa requiere usar la app de Electron.");
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Error inesperado al imprimir.");
    }
  };

  const [activeTab, setActiveTab] = useState('mesas'); // 'mesas' o 'creditos'
  
  // Estados para apertura y cierre
  const [aperturaBase, setAperturaBase] = useState(() => localStorage.getItem('ultima_base') || '');
  const [cierreModalVisible, setCierreModalVisible] = useState(false);
  const [cierreReporte, setCierreReporte] = useState(null);
  const [cierreReal, setCierreReal] = useState('');

  if (!sesionActiva) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>💰 Control de Caja</h2>
        <div style={{ backgroundColor: 'var(--surf2)', padding: '32px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '400px', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🔒</div>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>La caja se encuentra CERRADA</h3>
          <p style={{ color: 'var(--text-light)', textAlign: 'center', marginBottom: '24px' }}>
            Ingresa la base inicial de caja para abrir la sesión de cobro y poder facturar pedidos.
          </p>
          
          <div style={{ width: '100%', marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Base de Caja Inicial ($)</label>
            <input 
              type="text" inputMode="numeric" 
              placeholder="Ej. 100000"
              value={aperturaBase}
              onChange={(e) => setAperturaBase(formatNumberInput(e.target.value))}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)', color: 'var(--text)', fontSize: '16px'
              }}
            />
          </div>
          
          <button 
            onClick={async () => {
              const base = parseFloat(aperturaBase);
              if (isNaN(base) || base < 0) {
                toast.error('⚠️ Ingresa una base válida');
                return;
              }
              try {
                const res = await axios.post(`${serverUrl}/api/caja/abrir`, { base_inicial: base }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                if (res.data && res.data.success) {
                  setSesionActiva(res.data.sesion);
                  localStorage.setItem('ultima_base', base.toString()); // Guardar base
                  setAperturaBase('');
                }
              } catch (e) {
                toast.error('⚠️ Error al conectar con el servidor para abrir caja');
              }
            }}
            style={{
              backgroundColor: 'var(--green)', color: 'white', fontWeight: 'bold', padding: '16px',
              borderRadius: '8px', width: '100%', border: 'none', cursor: 'pointer', fontSize: '16px'
            }}
          >
            Abrir Caja
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Banner de Sesión Activa */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'rgba(76,175,112,0.1)', padding: '16px 24px', borderRadius: '12px',
        border: '2px solid var(--green)'
      }}>
        <div>
          <h3 style={{ color: 'var(--green)', fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0' }}>🟢 SESIÓN DE CAJA ACTIVA</h3>
          <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '14px' }}>
            Base Inicial: {formatCurrency(sesionActiva.base_inicial)}
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              const res = await axios.get(`${serverUrl}/api/caja/resumen-cierre/${sesionActiva.id}`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
              if (res.data && res.data.success) {
                setCierreReporte(res.data);
                setCierreReal('');
                setCierreModalVisible(true);
              }
            } catch (e) {
              toast.error('⚠️ Error al consultar el servidor');
            }
          }}
          style={{
            backgroundColor: 'var(--orange)', color: 'white', fontWeight: 'bold', padding: '10px 20px',
            borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          🔒 CERRAR CAJA
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>

      {/* Columna Izquierda: Listados */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button 
            onClick={() => setActiveTab('mesas')}
            style={{ 
              flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
              backgroundColor: activeTab === 'mesas' ? 'var(--brand)' : 'var(--surf2)',
              color: activeTab === 'mesas' ? 'white' : 'var(--text)'
            }}
          >
            📋 Activas
          </button>
          <button 
            onClick={() => setActiveTab('creditos')}
            style={{ 
              flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
              backgroundColor: activeTab === 'creditos' ? 'var(--orange)' : 'var(--surf2)',
              color: activeTab === 'creditos' ? 'white' : 'var(--text)'
            }}
          >
            📒 Créditos
          </button>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
          gap: '12px', 
          overflowY: 'auto', 
          paddingBottom: '16px' 
        }}>
          {activeTab === 'mesas' && mesas.map(m => {
            // Buscar si esta mesa tiene un pedido activo (en estado activo, pendiente o cuenta, PERO NO FIADO)
            const pedidoMesa = pedidosCaja.find(p => String(p.mesa) === String(m.num) && p.estado !== 'fiado');
            const isSelected = selectedPedido?.uuid === pedidoMesa?.uuid;
            
            // Colores por estado (Forzar ocupada visualmente si tiene un pedido activo)
            const isOcupada = m.estado === 'ocupada' || !!pedidoMesa;
            
            let bgColor = 'white';
            let textColor = 'var(--text)';
            let borderColor = 'var(--border)';

            if (isOcupada) {
              bgColor = '#FFF3ED'; 
              textColor = 'var(--orange)'; 
              borderColor = 'var(--orange)';
            }
            if (m.estado === 'cuenta' || pedidoMesa?.estado === 'cuenta') { 
              bgColor = '#E8F5E9'; 
              textColor = 'var(--green)'; 
              borderColor = 'var(--green)'; 
            }
            if (isSelected && pedidoMesa) {
              borderColor = 'var(--brand)';
              bgColor = 'var(--brand)';
              textColor = 'var(--cream)';
            }
            
            return (
              <div 
                key={m.id} 
                onClick={() => {
                  if (pedidoMesa) setSelectedPedido(pedidoMesa);
                  else {
                    setSelectedPedido(null);
                    toast.error(`La Mesa ${m.num} está libre.`);
                  }
                }}
                style={{ 
                  backgroundColor: bgColor,
                  color: textColor,
                  padding: '24px 16px', 
                  borderRadius: '16px', 
                  cursor: 'pointer',
                  border: `2px solid ${borderColor}`,
                  boxShadow: isSelected ? '0 8px 16px rgba(61, 26, 10, 0.2)' : 'var(--shadow-sm)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: '24px', fontWeight: 'bold' }}>Mesa {m.num}</span>
                <span style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9, fontWeight: '600', textTransform: 'uppercase' }}>
                  {m.estado}
                </span>
                {pedidoMesa && (
                  <span style={{ marginTop: '8px', fontSize: '14px', fontWeight: '800' }}>
                    {formatCurrency(calcularTotal(pedidoMesa))}
                  </span>
                )}
              </div>
            );
          })}
          
          {/* Renderizar pedidos que no tienen una mesa física (ej. "Para Llevar" / "Llevando") */}
          {activeTab === 'mesas' && pedidosCaja
            .filter(p => !mesas.find(m => String(m.num) === String(p.mesa)) && p.estado !== 'fiado')
            .map(pedidoExtra => {
              const isSelected = selectedPedido?.uuid === pedidoExtra.uuid;
              let bgColor = '#FFF3ED'; 
              let textColor = 'var(--orange)'; 
              let borderColor = 'var(--orange)';
              
              if (pedidoExtra.estado === 'cuenta') {
                bgColor = '#E8F5E9'; 
                textColor = 'var(--green)'; 
                borderColor = 'var(--green)'; 
              }
              if (isSelected) {
                borderColor = 'var(--brand)';
                bgColor = 'var(--brand)';
                textColor = 'var(--cream)';
              }

              return (
                <div 
                  key={pedidoExtra.uuid} 
                  onClick={() => setSelectedPedido(pedidoExtra)}
                  style={{ 
                    backgroundColor: bgColor,
                    color: textColor,
                    padding: '24px 16px', 
                    borderRadius: '16px', 
                    cursor: 'pointer',
                    border: `2px solid ${borderColor}`,
                    boxShadow: isSelected ? '0 8px 16px rgba(61, 26, 10, 0.2)' : 'var(--shadow-sm)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center'
                  }}
                >
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{pedidoExtra.mesa}</span>
                  <span style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>
                    Pedido #{pedidoExtra.id} • {pedidoExtra.hora}
                  </span>
                  <span style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9, fontWeight: '600', textTransform: 'uppercase' }}>
                    {pedidoExtra.estado}
                  </span>
                  <span style={{ marginTop: '8px', fontSize: '14px', fontWeight: '800' }}>
                    {formatCurrency(calcularTotal(pedidoExtra))}
                  </span>
                </div>
              );
            })
          }

          {/* Renderizar FIADOS/CRÉDITOS */}
          {activeTab === 'creditos' && mapFiados(pedidosCaja.filter(p => p.estado === 'fiado'))
            .map(fiado => {
              const isSelected = selectedPedido?.uuid === fiado.uuid;
              
              return (
                <div 
                  key={fiado.uuid} 
                  onClick={() => setSelectedPedido(fiado)}
                  style={{ 
                    backgroundColor: isSelected ? 'var(--orange)' : '#FFF3ED',
                    color: isSelected ? 'white' : 'var(--orange)',
                    padding: '24px 16px', 
                    borderRadius: '16px', 
                    cursor: 'pointer',
                    border: `2px solid var(--orange)`,
                    boxShadow: isSelected ? '0 8px 16px rgba(234, 88, 12, 0.2)' : 'var(--shadow-sm)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center'
                  }}
                >
                  <span style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                    {fiado.deudor || 'Sin Nombre'}
                  </span>
                  <span style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
                    Pedido #{fiado.id} • {fiado.hora}
                  </span>
                  <span style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8, fontWeight: '600' }}>
                    Origen: {fiado.mesa}
                  </span>
                  <span style={{ marginTop: '8px', fontSize: '14px', fontWeight: '800' }}>
                    {formatCurrency(calcularTotal(fiado))}
                  </span>
                </div>
              );
            })
          }
          {activeTab === 'creditos' && pedidosCaja.filter(p => p.estado === 'fiado').length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>
              No hay cuentas por cobrar registradas en este turno.
            </div>
          )}
        </div>
      </div>

      {/* Detalle de la cuenta y botones de pago */}
      <div style={{ flex: '1.2', backgroundColor: 'var(--surf2)', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        {selectedPedido ? (
          <>
            <div style={{ borderBottom: '2px dashed var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '28px', color: 'var(--brand)' }}>
                {selectedPedido.ordenes_historial ? `Crédito - ${selectedPedido.deudor}` : `Cuenta - Mesa ${selectedPedido.mesa}`}
              </h2>
              <p style={{ color: 'var(--text2)' }}>Pedido #{selectedPedido.id}</p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {selectedPedido.ordenes_historial ? (
                selectedPedido.ordenes_historial.map((orden, oIdx) => (
                  <div key={oIdx} style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                      Mesa {orden.mesa} - {new Date(orden.fecha).toLocaleDateString()}
                    </div>
                    {orden.items?.map((item, index) => {
                      const prod = getProductoInfo(item.productoId || item.id);
                      const precio = item.precio || prod.precio;
                      const cant = item.cantidad || 1;
                      return (
                        <div key={`${oIdx}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '16px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--orange)' }}>{cant}x</span>
                            <span>
                              {{
                                1: "Hamburguesa",
                                2: "Perro Caliente",
                                3: "Burrito",
                                4: "Salchipapa",
                                5: "Mazorcada",
                                6: "Jugo Natural",
                                7: "Limonada",
                                8: "Cerveza",
                                9: "Bebida Caliente"
                              }[prod.cat] || ''} {item.nombre || prod.nombre}
                            </span>
                          </div>
                          <span style={{ fontWeight: '600' }}>{formatCurrency(precio * cant)}</span>
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                selectedPedido.items?.map((item, index) => {
                  const prod = getProductoInfo(item.productoId || item.id);
                  const precio = item.precio || prod.precio;
                  const cant = item.cantidad || 1;
                  return (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '18px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--orange)' }}>{cant}x</span>
                        <span>
                          {{
                            1: "Hamburguesa",
                            2: "Perro Caliente",
                            3: "Burrito",
                            4: "Salchipapa",
                            5: "Mazorcada",
                            6: "Jugo Natural",
                            7: "Limonada",
                            8: "Cerveza",
                            9: "Bebida Caliente"
                          }[prod.cat] || ''} {item.nombre || prod.nombre}
                        </span>
                      </div>
                      <span style={{ fontWeight: '600' }}>{formatCurrency(precio * cant)}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '2px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                <span style={{ fontSize: '20px', color: 'var(--text2)' }}>Total a Pagar</span>
                <span style={{ fontSize: '40px', fontWeight: '800', color: 'var(--green)' }}>
                  {formatCurrency(calcularTotal(selectedPedido))}
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  onClick={() => handlePrintReceipt(selectedPedido)}
                  style={{ flex: 1, padding: '16px', backgroundColor: 'white', color: 'var(--brand)', border: '2px solid var(--border)', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  🖨️ Imprimir
                </button>
                <button 
                  onClick={() => onEditPedido && onEditPedido(selectedPedido)}
                  style={{ flex: 1, padding: '16px', backgroundColor: 'var(--surf3)', color: 'var(--brand)', border: '2px solid var(--border)', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  ✏️ Editar
                </button>
                <button 
                onClick={() => handleCobrarClick(selectedPedido)}
                style={{
                  flex: 1, padding: '16px', backgroundColor: 'var(--brand)', color: 'white',
                  border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(61, 26, 10, 0.2)'
                }}
              >
                Cobrar Pedido
              </button>
            </div>
            </div>
          </>
        ) : (
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <h3 style={{ fontSize: '18px' }}>Selecciona una mesa</h3>
            <p>Haz clic en una mesa para ver su cuenta.</p>
          </div>
        )}
      </div>
      </div>
      {/* Modal de Selección de Pago */}
      {modalPagoVisible && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', padding: '32px', borderRadius: '16px',
            width: '400px', boxShadow: 'var(--shadow-lg)'
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>Método de Pago</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-light)', marginBottom: '24px' }}>
              Mesa {pedidoACobrar?.mesa} - Total: {pedidoACobrar ? formatCurrency(calcularTotal(pedidoACobrar)) : '$0'}
            </p>
            
            {!isCreditoMode && !isMixtoMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                onClick={() => confirmarCobro('Efectivo')}
                style={{ padding: '16px', backgroundColor: 'white', color: 'black', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Efectivo
              </button>
              <button 
                onClick={() => confirmarCobro('Transferencia')}
                style={{ padding: '16px', backgroundColor: 'white', color: 'black', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Transferencia
              </button>
              <button 
                onClick={() => setIsCreditoMode(true)}
                style={{ padding: '16px', backgroundColor: 'white', color: 'black', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Crédito
              </button>
              <button 
                onClick={() => setIsMixtoMode(true)}
                style={{ padding: '16px', backgroundColor: 'white', color: 'black', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cobro Mixto
              </button>
                
                <button 
                  onClick={() => {
                    setModalPagoVisible(false);
                    setPedidoACobrar(null);
                  }}
                  style={{ padding: '16px', backgroundColor: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}
                >
                  Cancelar
                </button>
              </div>
            ) : isCreditoMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {listaDeudores.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text2)', width: '100%' }}>Deudores registrados:</span>
                    {listaDeudores.map(d => (
                      <button
                        key={d}
                        onClick={() => setDeudorName(d)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: deudorName === d ? '2px solid var(--orange)' : '1px solid var(--border)',
                          backgroundColor: deudorName === d ? '#FFF3ED' : 'white',
                          color: deudorName === d ? 'var(--orange)' : 'var(--text)',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          textTransform: 'capitalize'
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
                <input 
                  autoFocus
                  placeholder="... o escribe un nombre nuevo" 
                  value={deudorName} 
                  onChange={e => setDeudorName(e.target.value)}
                  style={{ padding: '16px', fontSize: '16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                />
                <button 
                  onClick={() => confirmarCobro('Fiado')}
                  style={{ padding: '16px', backgroundColor: 'var(--brand)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}
                >
                  Confirmar Crédito
                </button>
                <button 
                  onClick={() => {
                    setIsCreditoMode(false);
                    setDeudorName('');
                  }}
                  style={{ padding: '16px', backgroundColor: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Volver atrás
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text2)' }}>Efectivo a recibir:</label>
                  <input 
                    type="text" inputMode="numeric"
                    autoFocus
                    placeholder="Ej. 20000" 
                    value={efectivoMixto} 
                    onChange={(e) => setEfectivoMixto(formatNumberInput(e.target.value))}
                    style={{ width: '100%', padding: '16px', fontSize: '20px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontWeight: 'bold' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', marginBottom: '16px', padding: '12px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
                  <span>Restante por Transferencia:</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--brand)' }}>
                    {formatCurrency(Math.max(0, calcularTotal(pedidoACobrar) - (parseFloat(cleanNum(efectivoMixto)) || 0)))}
                  </span>
                </div>
                <button 
                  onClick={() => {
                  const efectivoNum = parseFloat(cleanNum(efectivoMixto)) || 0;
                  const total = calcularTotal(pedidoACobrar);
                  if (efectivoNum > total) {
                    alert("El efectivo a recibir no puede ser mayor al total en un cobro mixto.");
                    return;
                  }
                  confirmarCobro({ type: 'Mixto', efectivo: efectivoNum, transferencia: total - efectivoNum });
                }}
                  style={{ padding: '16px', backgroundColor: 'var(--brand)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}
                >
                  Confirmar Cobro Mixto
                </button>
                <button 
                  onClick={() => {
                    setIsMixtoMode(false);
                    setEfectivoMixto('');
                  }}
                  style={{ padding: '16px', backgroundColor: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Volver atrás
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Modal de Cierre de Caja */}
      {cierreModalVisible && cierreReporte && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', padding: '32px', borderRadius: '16px',
            width: '450px', boxShadow: 'var(--shadow-lg)'
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              🔒 Cierre de Caja
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-light)' }}>💵 Base Inicial:</span>
                <span style={{ fontWeight: 'bold' }}>{formatCurrency(cierreReporte.base_inicial)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-light)' }}>💵 Ventas en Efectivo:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--green)' }}>+{formatCurrency(cierreReporte.ingresos_efectivo)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-light)' }}>📲 Ventas en Transferencia:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--orange)' }}>+{formatCurrency(cierreReporte.ingresos_transferencia)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-light)' }}>💸 Gastos Registrados:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--red)' }}>-{formatCurrency(cierreReporte.gastos)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'rgba(232,82,10,0.05)', padding: '12px', borderRadius: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>💰 Saldo Esperado en Caja:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--orange)', fontSize: '18px' }}>{formatCurrency(cierreReporte.saldo_final_esperado)}</span>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-light)' }}>Efectivo Real en Caja ($)</label>
              <input 
                type="text" inputMode="numeric"
                placeholder="Digita el efectivo total contado"
                value={cierreReal}
                onChange={(e) => setCierreReal(formatNumberInput(e.target.value))}
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)',
                  backgroundColor: 'var(--surf2)', color: 'var(--text)', fontSize: '16px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setCierreModalVisible(false)}
                style={{ flex: 1, padding: '16px', backgroundColor: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  const realVal = parseFloat(cleanNum(cierreReal));
                  if (isNaN(realVal) || realVal < 0) {
                    toast.error('⚠️ Ingresa un valor válido');
                    return;
                  }
                  try {
                    const res = await axios.post(`${serverUrl}/api/caja/cerrar`, {
                      sesion_id: sesionActiva.id,
                      saldo_final_real: realVal
                    }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                    
                    if (res.data && res.data.success) {
                      setSesionActiva(null);
                      setCierreModalVisible(false);
                      setCierreReporte(null);
                      localStorage.setItem('ultima_base', res.data.base_inicial.toString()); // Pre-cargar base
                      setAperturaBase(res.data.base_inicial.toString());
                      
                      toast.error(
                        `Arqueo de Caja Completado:\n\n` +
                        `• Base Inicial: ${formatCurrency(res.data.base_inicial)}\n` +
                        `• Ingresos Efectivo: ${formatCurrency(res.data.ingresos_efectivo)}\n` +
                        `• Gastos: ${formatCurrency(res.data.gastos)}\n` +
                        `• Esperado en Caja: ${formatCurrency(res.data.saldo_final_esperado)}\n` +
                        `• Real Contado: ${formatCurrency(res.data.saldo_final_real)}\n` +
                        `• Diferencia: ${formatCurrency(res.data.diferencia)}\n\n` +
                        `${res.data.diferencia < 0 ? '⚠️ Falta dinero' : res.data.diferencia > 0 ? '🎉 Sobra dinero' : '✅ Caja cuadrada'}`
                      );
                    }
                  } catch (e) {
                    toast.error('⚠️ Error al cerrar caja');
                  }
                }}
                style={{ flex: 1, padding: '16px', backgroundColor: 'var(--red)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
