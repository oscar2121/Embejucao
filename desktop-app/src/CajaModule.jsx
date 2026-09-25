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

export function CajaModule({ pedidos, mesas, productos, serverUrl, sesionActiva, setSesionActiva, onEditPedido }) {
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [activeTab, setActiveTab] = useState('mesas'); // 'mesas' o 'creditos'

  const obtenerItemsSeguros = (pedidoOrItems) => {
    if (!pedidoOrItems) return [];
    if (Array.isArray(pedidoOrItems)) return pedidoOrItems;
    let items = pedidoOrItems.items;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        items = [];
      }
    }
    return Array.isArray(items) ? items : [];
  };

  // Filtrar todas las comandas que están listas para cobrar o activas en mesas
  const pedidosPendientesPago = (pedidos || []).filter(p => {
    if (!p) return false;
    const estado = String(p.estado || '').toLowerCase().trim();
    if (['cobrado', 'cancelado', 'archivado'].includes(estado)) return false;
    if (p.pagado === 1 || p.pagado === true) return false;
    if (estado === 'fiado' || estado === 'credito' || p.fiado === 1) return false;
    return ['cuenta', 'por_cobrar', 'pendiente_pago', 'entregado', 'completado', 'activo', 'listo', 'en_cocina', 'preparando', 'pendiente'].includes(estado);
  });

  const pedidosCaja = pedidosPendientesPago;

  // Cargar fiados directamente del servidor para garantizar que no se pierda ningún crédito
  const [fiadosDirectos, setFiadosDirectos] = useState([]);

  useEffect(() => {
    if (serverUrl) {
      axios.get(`${serverUrl}/api/pedidos/fiado`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
        .then(res => {
          if (res.data && res.data.fiados) {
            setFiadosDirectos(res.data.fiados);
          }
        })
        .catch(err => console.error('Error cargando fiados en Caja:', err));
    }
  }, [serverUrl, pedidos, activeTab]);

  // Consolidar todos los créditos/fiados (de pedidos y del endpoint directo)
  const todosLosFiados = [
    ...(pedidos || []).filter(p => {
      if (!p) return false;
      const estado = String(p.estado || '').toLowerCase().trim();
      if (['cobrado', 'cancelado', 'archivado'].includes(estado)) return false;
      if (p.pagado === 1 || p.pagado === true) return false;
      return estado === 'fiado' || estado === 'credito' || p.fiado === 1 || p.fiado === true;
    }),
    ...fiadosDirectos.filter(f => {
      if (!f) return false;
      const estado = String(f.estado || '').toLowerCase().trim();
      if (['cobrado', 'cancelado', 'archivado'].includes(estado)) return false;
      if (f.pagado === 1 || f.pagado === true) return false;
      return true;
    })
  ];

  const fiadosMap = new Map();
  todosLosFiados.forEach(f => {
    const key = f.uuid || f.id || `${f.deudor}-${f.fecha}`;
    if (!fiadosMap.has(key)) {
      fiadosMap.set(key, f);
    }
  });
  const listaFiados = Array.from(fiadosMap.values());

  // Mesas que tienen pedidos pendientes de cobro o están en estado cuenta/ocupada
  const mesasPorCobrar = (mesas || []).filter(m => {
    const idMesa = String(m.numero || m.num || m.id || '').replace(/\D/g, '');
    const mText = String(m.numero || m.num || m.id || '').trim().toLowerCase();
    const tienePedido = (pedidos || []).some(p => {
      const pedidoMesa = String(p.mesa_id || p.mesa || '').replace(/\D/g, '');
      const coincideMesa = Boolean(idMesa && pedidoMesa && idMesa === pedidoMesa) ||
        (String(p.mesa_id || p.mesa || '').trim().toLowerCase() === mText);
      const estadoValido = !['cobrado', 'cancelado', 'archivado', 'fiado'].includes(String(p.estado || '').toLowerCase());
      const noPagado = (p.pagado === 0 || p.pagado === null || p.pagado === undefined || p.pagado === false);
      return coincideMesa && estadoValido && noPagado;
    });
    return m.estado === 'cuenta' || m.estado === 'ocupada' || tienePedido;
  });

  // Búsqueda robusta del pedido para la mesa seleccionada:
  const pedidoSeleccionado = mesaSeleccionada 
    ? (pedidos || []).find(p => {
        const idMesa = String(mesaSeleccionada.id || mesaSeleccionada.numero || mesaSeleccionada.num || '').replace(/\D/g, '');
        const pedidoMesa = String(p.mesa_id || p.mesa || '').replace(/\D/g, '');
        const coincideMesa = Boolean(idMesa && pedidoMesa && idMesa === pedidoMesa) ||
          (String(p.mesa_id || p.mesa || '').trim().toLowerCase() === String(mesaSeleccionada.numero || mesaSeleccionada.num || mesaSeleccionada.id || '').trim().toLowerCase());
        const estadoValido = !['cobrado', 'cancelado', 'archivado', 'credito', 'fiado'].includes(String(p.estado || '').toLowerCase());
        const noPagado = (p.pagado === 0 || p.pagado === null || p.pagado === undefined || p.pagado === false);
        return coincideMesa && estadoValido && noPagado;
      }) || null
    : null;

  const pedidoActivoDisplay = activeTab === 'creditos' 
    ? selectedPedido 
    : (pedidoSeleccionado || selectedPedido);

  // Auto-selección al abrir Caja o cambiar de pestaña:
  useEffect(() => {
    if (!mesaSeleccionada && mesasPorCobrar.length > 0 && activeTab === 'mesas') {
      const mesaPrioritaria = mesasPorCobrar.find(m => m.estado === 'cuenta') || mesasPorCobrar[0];
      setMesaSeleccionada(mesaPrioritaria);
    }
  }, [mesasPorCobrar, activeTab]);

  // Si la mesa seleccionada está libre y sin pedidos pendientes activos, deseleccionarla inmediatamente
  useEffect(() => {
    if (mesaSeleccionada && activeTab === 'mesas') {
      const idMesa = String(mesaSeleccionada.id || mesaSeleccionada.numero || mesaSeleccionada.num || '').replace(/\D/g, '');
      const mText = String(mesaSeleccionada.numero || mesaSeleccionada.num || mesaSeleccionada.id || '').trim().toLowerCase();
      const currentMesa = (mesas || []).find(m => {
        const mDigits = String(m.numero || m.num || m.id || '').replace(/\D/g, '');
        return (idMesa && mDigits && idMesa === mDigits) || String(m.numero || m.num || m.id || '').trim().toLowerCase() === mText;
      });
      const tieneCuenta = (pedidos || []).some(p => {
        const pDigits = String(p.mesa_id || p.mesa || '').replace(/\D/g, '');
        const pText = String(p.mesa_id || p.mesa || '').trim().toLowerCase();
        const coincide = (idMesa && pDigits && idMesa === pDigits) || (mText && pText && mText === pText);
        return coincide && !['cobrado', 'cancelado', 'archivado', 'credito', 'fiado'].includes(String(p.estado || '').toLowerCase()) && (p.pagado === 0 || p.pagado === null || p.pagado === undefined || p.pagado === false);
      });
      if ((!currentMesa || currentMesa.estado === 'libre') && !tieneCuenta) {
        setMesaSeleccionada(null);
        setSelectedPedido(null);
      }
    }
  }, [mesas, pedidos, activeTab, mesaSeleccionada]);

  useEffect(() => {
    if (activeTab === 'creditos' && !selectedPedido && listaFiados.length > 0) {
      const grouped = mapFiados(listaFiados);
      if (grouped.length > 0) {
        setSelectedPedido(grouped[0]);
      }
    }
  }, [activeTab, listaFiados, selectedPedido]);

  useEffect(() => {
    if (selectedPedido && !selectedPedido.uuids && activeTab === 'mesas') {
      const refreshed = pedidosCaja.find(p => p.uuid === selectedPedido.uuid);
      if (refreshed && refreshed !== selectedPedido) {
        setSelectedPedido(refreshed);
      }
    }
  }, [pedidosCaja, activeTab]);

  const getProductoInfo = (prodId) => {
    return productos.find(p => p.id === prodId) || { nombre: 'Desconocido', precio: 0, emoji: '❓' };
  };

  const calcularTotal = (pedidoOrItems) => {
    if (!pedidoOrItems) return 0;
    
    const abono = (!Array.isArray(pedidoOrItems) && pedidoOrItems.abono_parcial)
      ? Number(pedidoOrItems.abono_parcial || 0)
      : 0;

    if (pedidoOrItems.ordenes_historial) {
      const total = pedidoOrItems.ordenes_historial.reduce((totalSum, orden) => {
        const items = obtenerItemsSeguros(orden);
        return totalSum + items.reduce((sum, item) => {
          const precioItem = item.precio || getProductoInfo(item.productoId || item.id).precio;
          const cantidad = item.cantidad || 1;
          return sum + (precioItem * cantidad);
        }, 0);
      }, 0);
      return Math.max(0, total - abono);
    }

    const items = obtenerItemsSeguros(pedidoOrItems);
    const total = items.reduce((total, item) => {
      const precioItem = item.precio || getProductoInfo(item.productoId || item.id).precio;
      const cantidad = item.cantidad || 1;
      return total + (precioItem * cantidad);
    }, 0);
    return Math.max(0, total - abono);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  };

  const mapFiados = (fiadosList) => {
    if (!fiadosList) return [];
    const grouped = {};
    fiadosList.forEach(f => {
      let history = [];
      const fItems = obtenerItemsSeguros(f);
      if (f.ordenes_historial) {
        history = f.ordenes_historial.map(o => ({
          ...o,
          items: obtenerItemsSeguros(o),
          hora: o.hora || f.hora || '',
          created_at: o.created_at || f.created_at || ''
        }));
      } else if (fItems && fItems.length > 0 && (fItems[0].fecha || fItems[0].items)) {
        history = fItems.map(o => ({
          ...o,
          items: obtenerItemsSeguros(o),
          hora: o.hora || f.hora || '',
          created_at: o.created_at || f.created_at || ''
        }));
      } else if (fItems && fItems.length > 0) {
        history = [{
          fecha: f.fecha_fiado || f.fecha || new Date().toISOString(),
          hora: f.hora || '',
          created_at: f.created_at || '',
          mesa: String(f.mesa || ''),
          items: fItems
        }];
      }
      
      const key = f.deudor ? f.deudor.trim().toLowerCase() : 'desconocido';
      
      if (!grouped[key]) {
        grouped[key] = {
          ...f,
          uuids: f.uuid ? [f.uuid] : (f.uuids || []),
          ordenes_historial: [...history],
          items: [...history],
          abono_parcial: Number(f.abono_parcial || 0)
        };
      } else {
        if (f.uuid && !grouped[key].uuids.includes(f.uuid)) grouped[key].uuids.push(f.uuid);
        grouped[key].ordenes_historial.push(...history);
        grouped[key].items.push(...history);
        grouped[key].abono_parcial = (Number(grouped[key].abono_parcial) || 0) + Number(f.abono_parcial || 0);
      }
    });
    return Object.values(grouped);
  };

  const [modalPagoVisible, setModalPagoVisible] = useState(false);
  const [pedidoACobrar, setPedidoACobrar] = useState(null);
  const [isCreditoMode, setIsCreditoMode] = useState(false);
  const [isMixtoMode, setIsMixtoMode] = useState(false);
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [deudorName, setDeudorName] = useState('');
  const [listaDeudores, setListaDeudores] = useState([]);

  const handleCambioEfectivo = (e) => {
    const valorIngresado = e.target.value;

    // 1. Si el usuario borra todo el campo, permitir dejarlo vacío sin bloquear
    if (valorIngresado === '' || valorIngresado === null) {
      setEfectivoRecibido('');
      return;
    }

    // 2. Extraer únicamente los dígitos numéricos (elimina puntos, comas o caracteres raros)
    const soloNumeros = valorIngresado.replace(/\D/g, '');

    // Si al limpiar queda vacío, permitimos borrar
    if (!soloNumeros) {
      setEfectivoRecibido('');
      return;
    }

    // 3. Formatear como entero seguro sin romper el estado
    const numeroLimpio = parseInt(soloNumeros, 10);
    if (isNaN(numeroLimpio)) return;

    // Guardamos el número formateado con separadores de miles para visualización clara
    setEfectivoRecibido(numeroLimpio.toLocaleString('es-CO'));
  };

  const totalCuenta = Number(pedidoACobrar ? calcularTotal(pedidoACobrar) : (selectedPedido ? calcularTotal(selectedPedido) : (mesaSeleccionada?.total || 0)));
  // Obtener el valor numérico real sin puntos:
  const efectivoNumerico = Number(String(efectivoRecibido || '0').replace(/\D/g, ''));

  // Restante por transferencia (nunca menor a 0):
  const restanteTransferencia = Math.max(0, totalCuenta - efectivoNumerico);

  // Devuelta / Cambio si paga más en efectivo:
  const cambioDevuelta = Math.max(0, efectivoNumerico - totalCuenta);

  // Estados para modal de abono a fiados/créditos
  const [abonoModalVisible, setAbonoModalVisible] = useState(false);
  const [montoAbonoInput, setMontoAbonoInput] = useState('');
  const [metodoAbono, setMetodoAbono] = useState('Efectivo');
  const [loadingAbono, setLoadingAbono] = useState(false);

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
    setEfectivoRecibido('');
    setModalPagoVisible(true);
  };

  const confirmarCobro = async (metodo) => {
    if (!pedidoACobrar) return;
    try {
      if (metodo === 'Crédito') {
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
               obtenerItemsSeguros(orden).forEach(i => detallesVenta.push(i));
             });
           } else {
             detallesVenta = obtenerItemsSeguros(pedidoACobrar);
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
                tipo_origen: pedidoACobrar.uuids ? 'Crédito Pagado' : 'Mesa',
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
                  tipo_origen: pedidoACobrar.uuids ? 'Crédito Pagado' : 'Mesa',
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
               tipo_origen: pedidoACobrar.uuids ? 'Crédito Pagado' : 'Mesa',
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
      setEfectivoRecibido('');
      setDeudorName('');
      setPedidoACobrar(null);
      setSelectedPedido(null);
      setMesaSeleccionada(null);
      toast.success(`Pago procesado exitosamente ${metodo.type === 'Mixto' ? '(Mixto)' : '(' + metodo + ')'}`);
    } catch (error) {
      console.error('Error al cobrar:', error);
      const serverMsg = error.response && error.response.data && error.response.data.error 
        ? error.response.data.error 
        : error.message;
      toast.error(`Hubo un error al procesar el pago en el servidor.\nDetalle: ${serverMsg}`);
    }
  };

  const handleConfirmarAbono = async () => {
    const rawVal = cleanNum(montoAbonoInput);
    const monto = parseFloat(rawVal);
    if (isNaN(monto) || monto <= 0) {
      toast.error('⚠️ Ingresa un monto de abono válido.');
      return;
    }

    const deudor = selectedPedido?.deudor;
    if (!deudor) {
      toast.error('⚠️ No se ha seleccionado un deudor válido.');
      return;
    }

    try {
      setLoadingAbono(true);
      const res = await axios.post(`${serverUrl}/api/fiados/abono`, {
        deudor,
        monto,
        metodo_pago: metodoAbono,
        sesion_id: sesionActiva ? sesionActiva.id : null
      }, { headers: { 'ngrok-skip-browser-warning': 'true' } });

      if (res.data && res.data.success) {
        toast.success(`✅ Abono de ${formatCurrency(monto)} registrado correctamente.`);
        setAbonoModalVisible(false);
        setMontoAbonoInput('');
        setSelectedPedido(null);
      }
    } catch (err) {
      console.error('Error al registrar abono:', err);
      const msg = err.response?.data?.error || err.message || 'Error al procesar el abono';
      toast.error(`⚠️ ${msg}`);
    } finally {
      setLoadingAbono(false);
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
        
        obtenerItemsSeguros(pedido).forEach(item => {
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
        
        obtenerItemsSeguros(pedido).forEach(item => {
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
              const base = parseInt(String(aperturaBase).replace(/\D/g, ''), 10);
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
            onClick={() => {
              setActiveTab('mesas');
              if (mesasPorCobrar.length > 0) {
                const mesaPrioritaria = mesasPorCobrar.find(m => m.estado === 'cuenta') || mesasPorCobrar[0];
                setMesaSeleccionada(mesaPrioritaria);
              }
            }}
            style={{ 
              flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
              backgroundColor: activeTab === 'mesas' ? 'var(--brand)' : 'var(--surf2)',
              color: activeTab === 'mesas' ? 'white' : 'var(--text)'
            }}
          >
            📋 Activas
          </button>
          <button 
            onClick={() => {
              setActiveTab('creditos');
              setMesaSeleccionada(null);
              const grouped = mapFiados(listaFiados);
              if (grouped.length > 0) setSelectedPedido(grouped[0]);
              else setSelectedPedido(null);
            }}
            style={{ 
              flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
              backgroundColor: activeTab === 'creditos' ? 'var(--orange)' : 'var(--surf2)',
              color: activeTab === 'creditos' ? 'white' : 'var(--text)'
            }}
          >
            📒 Créditos {mapFiados(listaFiados).length > 0 ? `(${mapFiados(listaFiados).length})` : ''}
          </button>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '10px', 
          overflowY: 'auto', 
          paddingBottom: '16px' 
        }}>
          {activeTab === 'mesas' && mesas.map(m => {
            const idMesaDigits = String(m.numero || m.num || m.id || '').replace(/\D/g, '');
            const mText = String(m.numero || m.num || m.id || '').trim().toLowerCase();

            // Verificar si esta mesa tiene cuenta pendiente activa (no cobrado, cancelado, archivado, credito, fiado)
            const tieneCuentaPendiente = (pedidos || []).some(p => {
              const pedidoMesaDigits = String(p.mesa_id || p.mesa || '').replace(/\D/g, '');
              const coincideDigits = Boolean(idMesaDigits && pedidoMesaDigits && idMesaDigits === pedidoMesaDigits);
              const coincideText = String(p.mesa_id || p.mesa || '').trim().toLowerCase() === mText;
              const estado = String(p.estado || '').toLowerCase().trim();
              const estadoValido = !['cobrado', 'cancelado', 'archivado', 'credito', 'fiado'].includes(estado);
              const noPagado = (p.pagado === 0 || p.pagado === null || p.pagado === undefined || p.pagado === false);
              return (coincideDigits || coincideText) && estadoValido && noPagado;
            });

            const pedidoMesa = tieneCuentaPendiente ? (pedidosCaja || []).find(p => {
              const pedidoMesaDigits = String(p.mesa_id || p.mesa || '').replace(/\D/g, '');
              const coincideDigits = Boolean(idMesaDigits && pedidoMesaDigits && idMesaDigits === pedidoMesaDigits);
              const coincideText = String(p.mesa_id || p.mesa || '').trim().toLowerCase() === mText;
              return coincideDigits || coincideText;
            }) : null;

            const esLibre = m.estado === 'libre' && !tieneCuentaPendiente;

            const isSelected = !esLibre && Boolean(
              (mesaSeleccionada && (
                (idMesaDigits && String(mesaSeleccionada.numero || mesaSeleccionada.num || mesaSeleccionada.id || '').replace(/\D/g, '') === idMesaDigits) ||
                mesaSeleccionada.id === m.id
              )) || (pedidoMesa && pedidoActivoDisplay?.uuid === pedidoMesa.uuid)
            );
            
            // Colores por estado
            const pedidoEstado = String(pedidoMesa?.estado || '').toLowerCase().trim();
            const esCuenta = !esLibre && (m.estado === 'cuenta' || pedidoEstado === 'cuenta');
            const isOcupada = !esLibre && (m.estado === 'ocupada' || esCuenta || Boolean(pedidoMesa));
            
            let bgColor = isSelected ? '#e0f2fe' : '#ffffff';
            let textColor = '#0f172a';
            let borderColor = isSelected ? '#0284c7' : '#e2e8f0';

            if (!isSelected) {
              if (esLibre) {
                bgColor = '#ffffff';
                textColor = '#64748b';
                borderColor = '#e2e8f0';
              } else if (esCuenta) { 
                bgColor = '#FEF3C7'; 
                textColor = '#B45309'; 
                borderColor = '#F59E0B'; 
              } else if (isOcupada) {
                bgColor = '#FFF3ED'; 
                textColor = 'var(--orange)'; 
                borderColor = 'var(--orange)';
              }
            }
            
            return (
              <div 
                key={m.id || m.num || m.numero} 
                onClick={() => {
                  if (m.estado === 'libre' && !tieneCuentaPendiente) {
                    return; // Bloqueo: No hacer nada si está libre y sin pedidos activos
                  }
                  setMesaSeleccionada(m);
                  if (pedidoMesa) {
                    setSelectedPedido(pedidoMesa);
                  }
                }}
                style={{ 
                  backgroundColor: bgColor,
                  color: textColor,
                  padding: '24px 16px', 
                  borderRadius: '16px', 
                  cursor: esLibre ? 'not-allowed' : 'pointer',
                  opacity: esLibre ? 0.6 : 1,
                  border: isSelected ? '2px solid #0284c7' : `2px solid ${borderColor}`,
                  boxShadow: isSelected ? '0 4px 14px rgba(2, 132, 199, 0.25)' : 'var(--shadow-sm)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: textColor }}>
                  Mesa {m.num || m.numero || m.id}
                </span>
                <span style={{ 
                  fontSize: '11px', 
                  marginTop: '4px', 
                  padding: '2px 8px',
                  borderRadius: '10px', 
                  fontWeight: '700', 
                  textTransform: 'uppercase',
                  backgroundColor: esCuenta ? '#FDE68A' : isOcupada ? '#FED7AA' : '#DCFCE7',
                  color: esCuenta ? '#92400E' : isOcupada ? '#C2410C' : '#15803D'
                }}>
                  {esCuenta ? 'Cuenta' : isOcupada ? 'Ocupada' : 'Libre'}
                </span>
                {pedidoMesa && (
                  <span style={{ marginTop: '8px', fontSize: '14px', fontWeight: '800', color: textColor }}>
                    {formatCurrency(calcularTotal(pedidoMesa))}
                  </span>
                )}
              </div>
            );
          })}
          
          {/* Renderizar pedidos que no tienen una mesa física (ej. "Para Llevar" / "Llevando") */}
          {activeTab === 'mesas' && pedidosCaja
            .filter(p => !mesas.find(m => {
              const idMesaDigits = String(m.numero || m.num || m.id || '').replace(/\D/g, '');
              const pDigits = String(p.mesa_id || p.mesa || '').replace(/\D/g, '');
              return idMesaDigits && pDigits && idMesaDigits === pDigits;
            }) && p.estado !== 'fiado')
            .map(pedidoExtra => {
              const isSelected = pedidoActivoDisplay?.uuid === pedidoExtra.uuid;
              let bgColor = '#FFF3ED'; 
              let textColor = 'var(--orange)'; 
              let borderColor = 'var(--orange)';
              
              if (pedidoExtra.estado === 'cuenta') {
                bgColor = '#E8F5E9'; 
                textColor = 'var(--green)'; 
                borderColor = 'var(--green)'; 
              }
              if (isSelected) {
                borderColor = '#0284c7';
                bgColor = '#e0f2fe';
                textColor = '#0f172a';
              }

              return (
                <div 
                  key={pedidoExtra.uuid || pedidoExtra.id} 
                  onClick={() => {
                    setMesaSeleccionada({ id: pedidoExtra.id, numero: pedidoExtra.mesa, num: pedidoExtra.mesa, pedido: pedidoExtra });
                    setSelectedPedido(pedidoExtra);
                  }}
                  style={{ 
                    backgroundColor: bgColor,
                    color: textColor,
                    padding: '24px 16px', 
                    borderRadius: '16px', 
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #0284c7' : `2px solid ${borderColor}`,
                    boxShadow: isSelected ? '0 4px 14px rgba(2, 132, 199, 0.25)' : 'var(--shadow-sm)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center'
                  }}
                >
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: textColor }}>{pedidoExtra.mesa}</span>
                  <span style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7, color: textColor }}>
                    Pedido #{pedidoExtra.id} • {pedidoExtra.hora}
                  </span>
                  <span style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9, fontWeight: '600', textTransform: 'uppercase', color: textColor }}>
                    {pedidoExtra.estado}
                  </span>
                  <span style={{ marginTop: '8px', fontSize: '14px', fontWeight: '800', color: textColor }}>
                    {formatCurrency(calcularTotal(pedidoExtra))}
                  </span>
                </div>
              );
            })
          }

          {/* Renderizar FIADOS/CRÉDITOS */}
          {activeTab === 'creditos' && mapFiados(listaFiados)
            .map(fiado => {
              const isSelected = selectedPedido?.uuid === fiado.uuid || (selectedPedido?.deudor && fiado.deudor && selectedPedido.deudor.trim().toLowerCase() === fiado.deudor.trim().toLowerCase());
              
              return (
                <div 
                  key={fiado.uuid || fiado.deudor} 
                  onClick={() => {
                    setSelectedPedido(fiado);
                    setMesaSeleccionada(null);
                  }}
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
                    Pedido #{fiado.id || (fiado.uuids ? fiado.uuids.length + ' órdenes' : '')} • {fiado.hora}
                  </span>
                  <span style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8, fontWeight: '600' }}>
                    Origen: {fiado.mesa || 'Mesa'}
                  </span>
                  <span style={{ marginTop: '8px', fontSize: '14px', fontWeight: '800' }}>
                    {formatCurrency(calcularTotal(fiado))}
                  </span>
                </div>
              );
            })
          }
          {activeTab === 'creditos' && mapFiados(listaFiados).length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>
              No hay cuentas por cobrar registradas en este turno.
            </div>
          )}
        </div>
      </div>

      {/* Detalle de la cuenta y botones de pago */}
      <div style={{ flex: '1.2', backgroundColor: 'var(--surf2)', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        {pedidoActivoDisplay ? (
          <>
            <div style={{ borderBottom: '2px dashed var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '28px', color: 'var(--brand)' }}>
                {pedidoActivoDisplay.ordenes_historial 
                  ? `Crédito - ${pedidoActivoDisplay.deudor}` 
                  : `Cobro Mesa ${mesaSeleccionada?.numero || mesaSeleccionada?.num || mesaSeleccionada?.id || pedidoActivoDisplay.mesa}`}
              </h2>
              <p style={{ color: 'var(--text2)' }}>
                Pedido #{pedidoActivoDisplay.id || pedidoActivoDisplay.uuid?.substring(0, 8) || 'S/N'}
                {pedidoActivoDisplay.hora ? ` • ${pedidoActivoDisplay.hora}` : ''}
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {pedidoActivoDisplay.ordenes_historial ? (
                pedidoActivoDisplay.ordenes_historial.map((orden, oIdx) => (
                  <div key={oIdx} style={{ marginBottom: '20px' }}>
                    {/* Encabezado de orden en historial de créditos con Hora */}
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', margin: '8px 0 4px 0', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                      {orden.mesa ? `Mesa ${orden.mesa} - ` : ''}
                      {orden.fecha ? (orden.fecha.includes('T') ? new Date(orden.fecha).toLocaleDateString('es-CO') : orden.fecha) : ''}
                      {Boolean(orden.hora || orden.created_at || orden.fecha) && (
                        <span>
                          {' • '}
                          {orden.hora 
                            ? orden.hora 
                            : (orden.created_at || orden.fecha 
                                ? new Date(orden.created_at || orden.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) 
                                : '')}
                        </span>
                      )}
                    </div>
                    {obtenerItemsSeguros(orden).map((item, index) => {
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
                obtenerItemsSeguros(pedidoActivoDisplay).map((item, index) => {
                  const prod = getProductoInfo(item.productoId || item.id);
                  const precio = item.precio || prod.precio;
                  const cant = item.cantidad || 1;
                  return (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '18px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--orange)' }}>{cant}x</span>
                          <span style={{ fontWeight: '600' }}>
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
                        {item.adicionales && item.adicionales.length > 0 && (
                          <div style={{ fontSize: '13px', color: 'var(--text2)', paddingLeft: '32px' }}>
                            + {item.adicionales.map(a => typeof a === 'string' ? a : a.nombre).join(', ')}
                          </div>
                        )}
                        {item.nota && (
                          <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', paddingLeft: '32px' }}>
                            "{item.nota}"
                          </div>
                        )}
                      </div>
                      <span style={{ fontWeight: '600' }}>{formatCurrency(precio * cant)}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '2px solid var(--border)' }}>
              {Number(pedidoActivoDisplay.abono_parcial || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '15px', color: 'var(--text2)' }}>Abonado previamente</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#2563EB' }}>
                    - {formatCurrency(pedidoActivoDisplay.abono_parcial)}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                <span style={{ fontSize: '20px', color: 'var(--text2)' }}>Total a Pagar</span>
                <span style={{ fontSize: '40px', fontWeight: '800', color: 'var(--green)' }}>
                  {formatCurrency(calcularTotal(pedidoActivoDisplay))}
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  onClick={() => handlePrintReceipt(pedidoActivoDisplay)}
                  style={{ flex: 1, padding: '16px', backgroundColor: 'white', color: 'var(--brand)', border: '2px solid var(--border)', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  🖨️ Imprimir
                </button>
                {activeTab !== 'creditos' && !pedidoActivoDisplay?.deudor && (
                  <button 
                    onClick={() => onEditPedido && onEditPedido(pedidoActivoDisplay)}
                    style={{ flex: 1, padding: '16px', backgroundColor: 'var(--surf3)', color: 'var(--brand)', border: '2px solid var(--border)', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    ✏️ Editar
                  </button>
                )}
                {(activeTab === 'creditos' || pedidoActivoDisplay?.deudor) && (
                  <button
                    onClick={() => {
                      setMontoAbonoInput('');
                      setAbonoModalVisible(true);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#2563EB',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '15px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    💵 Abonar
                  </button>
                )}
                <button 
                  onClick={() => handleCobrarClick(pedidoActivoDisplay)}
                  style={{
                    flex: 1, padding: '16px', backgroundColor: 'var(--brand)', color: 'white',
                    border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(61, 26, 10, 0.2)'
                  }}
                >
                  💳 Procesar Pago
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)', textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>💳</div>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--brand)', marginBottom: '8px' }}>
              {activeTab === 'creditos'
                ? (listaFiados.length > 0 ? 'Selecciona un crédito' : 'No hay cuentas por cobrar')
                : (mesasPorCobrar.length > 0 ? 'Selecciona una mesa' : 'No hay mesas pendientes de pago')}
            </h3>
            <p style={{ color: 'var(--text2)', maxWidth: '300px' }}>
              {activeTab === 'creditos'
                ? (listaFiados.length > 0 ? 'Haz clic en un cliente de la lista para ver su deuda o registrar un abono.' : 'No hay créditos registrados pendientes de cobro.')
                : (mesasPorCobrar.length > 0 ? 'Haz clic en una de las mesas de la lista izquierda para procesar el cobro.' : 'Todas las cuentas están al día. Cuando una mesa pida la cuenta aparecerá aquí.')}
            </p>
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
                onClick={() => {
                  setIsMixtoMode(true);
                  setEfectivoRecibido('');
                }}
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
                  onClick={() => confirmarCobro('Crédito')}
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
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 20.000"
                    value={efectivoRecibido}
                    onChange={handleCambioEfectivo}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '18px',
                      fontWeight: '700',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />

                  {/* Desglose claro para el cajero */}
                  <div style={{ marginTop: '12px', fontSize: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span>Restante por Transferencia:</span>
                      <strong style={{ color: restanteTransferencia > 0 ? '#2563eb' : '#16a34a' }}>
                        $ {restanteTransferencia.toLocaleString('es-CO')}
                      </strong>
                    </div>

                    {cambioDevuelta > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: '800' }}>
                        <span>Cambio / Devuelta:</span>
                        <span>$ {cambioDevuelta.toLocaleString('es-CO')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const efectivoFinal = Math.min(efectivoNumerico, totalCuenta);
                    confirmarCobro({ type: 'Mixto', efectivo: efectivoFinal, transferencia: restanteTransferencia });
                  }}
                  style={{ padding: '16px', backgroundColor: 'var(--brand)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}
                >
                  Confirmar Cobro Mixto
                </button>
                <button 
                  onClick={() => {
                    setIsMixtoMode(false);
                    setEfectivoRecibido('');
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

      {/* Modal de Abono a Crédito / Fiados */}
      {abonoModalVisible && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--brand)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              💵 Abonar a Crédito
            </h3>
            <p style={{ color: 'var(--text-light)', fontSize: '14px', marginBottom: '20px' }}>
              Deudor: <strong style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{selectedPedido?.deudor || 'Cliente'}</strong>
              <br />
              Saldo pendiente: <strong style={{ color: 'var(--orange)' }}>{formatCurrency(calcularTotal(selectedPedido))}</strong>
            </p>

            {/* Selector de Método de Pago */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-light)', fontSize: '14px' }}>
                Método de Pago
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setMetodoAbono('Efectivo')}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: metodoAbono === 'Efectivo' ? '2px solid var(--green)' : '1px solid var(--border)',
                    backgroundColor: metodoAbono === 'Efectivo' ? '#E8F5E9' : 'var(--surf2)',
                    color: metodoAbono === 'Efectivo' ? 'var(--green)' : 'var(--text)',
                    fontWeight: 'bold', cursor: 'pointer', fontSize: '15px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  💵 Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setMetodoAbono('Transferencia')}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: metodoAbono === 'Transferencia' ? '2px solid var(--orange)' : '1px solid var(--border)',
                    backgroundColor: metodoAbono === 'Transferencia' ? '#FFF3ED' : 'var(--surf2)',
                    color: metodoAbono === 'Transferencia' ? 'var(--orange)' : 'var(--text)',
                    fontWeight: 'bold', cursor: 'pointer', fontSize: '15px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  📲 Transferencia
                </button>
              </div>
            </div>

            {/* Input de Monto */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-light)', fontSize: '14px' }}>
                Monto a Abonar ($)
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                placeholder="Ej. 20.000"
                value={montoAbonoInput}
                onChange={(e) => setMontoAbonoInput(formatNumberInput(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmarAbono();
                }}
                style={{
                  width: '100%', padding: '14px', borderRadius: '10px',
                  border: '1px solid var(--border)', backgroundColor: 'var(--surf2)',
                  color: 'var(--text)', fontSize: '20px', fontWeight: 'bold', textAlign: 'right',
                  outline: 'none'
                }}
              />
            </div>

            {/* Botones de Acción */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setAbonoModalVisible(false)}
                disabled={loadingAbono}
                style={{
                  flex: 1, padding: '14px', backgroundColor: 'transparent',
                  color: 'var(--text)', border: '1px solid var(--border)',
                  borderRadius: '10px', fontSize: '16px', fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarAbono}
                disabled={loadingAbono}
                style={{
                  flex: 1, padding: '14px', backgroundColor: '#2563EB',
                  color: 'white', border: 'none', borderRadius: '10px',
                  fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(37, 99, 235, 0.3)',
                  opacity: loadingAbono ? 0.7 : 1
                }}
              >
                {loadingAbono ? 'Aplicando...' : 'Confirmar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
