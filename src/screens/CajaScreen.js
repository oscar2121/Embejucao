import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Switch,
  Keyboard
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { C, s, cleanNum, formatMoneyInput, calcularTotalPedido, formatearHoraPedido } from '../constants/theme';
import ModalCobroMixto from '../components/ModalCobroMixto';

export default function CajaScreen({
  pedidos = [],
  productos = [],
  setPedidos = () => {},
  mesas = [],
  setMesas = () => {},
  ventas = [],
  setVentas = () => {},
  serverIP = '',
  showToast = () => {},
  sesionActiva,
  setSesionActiva = () => {},
  loggedUser,
  onSolicitarCancelar = () => {},
  cajaCobroModalVisible,
  setCajaCobroModalVisible = () => {},
  cierreModalVisible,
  setCierreModalVisible = () => {},
  fiados = [],
  setFiados = () => {},
  imprimirTicketCaja = false,
  setImprimirTicketCaja = () => {},
  savedPrinter,
  clientesGlobales = [],
  socket
}) {
  const [pedidoSel, setPedidoSel] = useState(null);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [efectivoMixto, setEfectivoMixto] = useState('');
  const [nombreDeudor, setNombreDeudor] = useState('');
  const [showHistorialVentas, setShowHistorialVentas] = useState(false);

  // Estados para apertura y cierre de caja
  const [aperturaBase, setAperturaBase] = useState('');
  const [cierreReal, setCierreReal] = useState('');
  const [cierreReporte, setCierreReporte] = useState(null);

  useEffect(() => {
    const loadBase = async () => {
      try {
        const savedBase = await AsyncStorage.getItem('ultima_base_caja');
        if (savedBase) setAperturaBase(savedBase);
      } catch (e) {
        console.error('Error loading ultima base de caja', e);
      }
    };
    loadBase();
  }, []);

  // Estados para Liquidación Posterior
  const [liqModalVisible, setLiqModalVisible] = useState(false);
  const [deudorSel, setDeudorSel] = useState(null);
  const [metodoLiq, setMetodoLiq] = useState('efectivo');
  const [verDeudores, setVerDeudores] = useState(true);
  const [deudorExpandido, setDeudorExpandido] = useState(null);

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
    if (pedido.ordenes_historial) {
      return pedido.ordenes_historial.reduce((totalSum, orden) => {
        if (!orden.items) return totalSum;
        return totalSum + orden.items.reduce((sum, item) => {
          const price = item.precio !== undefined ? item.precio : (productos.find(p => p.nombre === item.nombre)?.precio || 0);
          return sum + (price * item.cantidad);
        }, 0);
      }, 0);
    }
    if (!pedido.items) return 0;
    return pedido.items.reduce((sum, item) => {
      const price = item.precio !== undefined ? item.precio : (productos.find(p => p.nombre === item.nombre)?.precio || 0);
      return sum + (price * item.cantidad);
    }, 0);
  };

  // PROCESAR EL COBRO DESDE UNA MESA
  const confirmarCobro = async () => {
    try {
      if (!pedidoSel) return;

      if (metodoPago === 'fiado' && !nombreDeudor.trim()) {
        showToast('⚠️ Escribe o selecciona el nombre de la persona');
        return;
      }

      const fechaActual = new Date().toISOString();

      if (metodoPago === 'fiado') {
        const deudorLimpio = nombreDeudor.trim();

        const clienteExistenteIdx = fiados.findIndex(
          f => f.deudor && f.deudor.trim().toLowerCase() === deudorLimpio.toLowerCase()
        );

        let nuevosFiados = [...fiados];
        const nuevaOrden = {
          fecha: fechaActual,
          hora: pedidoSel?.hora || '',
          created_at: pedidoSel?.created_at || fechaActual,
          mesa: String(pedidoSel?.mesa || ''),
          items: (pedidoSel?.items || []).map(it => ({
            nombre: it.nombre,
            cantidad: it.cantidad,
            precio: it.precio !== undefined ? it.precio : (productos.find(p => p.nombre === it.nombre)?.precio || 0),
            adicionales: it.adicionales || [],
            observaciones: it.observaciones || it.nota || '',
            cat: it.cat
          }))
        };

        if (clienteExistenteIdx > -1) {
          const existingFiado = fiados[clienteExistenteIdx];
          const historialActualizado = [...(existingFiado.ordenes_historial || []), nuevaOrden];

          const mesasSet = new Set();
          if (existingFiado.mesa) {
            String(existingFiado.mesa).split(',').forEach(m => {
              if (m.trim()) mesasSet.add(m.trim());
            });
          }
          if (pedidoSel?.mesa) {
            String(pedidoSel.mesa).split(',').forEach(m => {
              if (m.trim()) mesasSet.add(m.trim());
            });
          }
          const updatedMesa = Array.from(mesasSet).join(', ');

          nuevosFiados[clienteExistenteIdx] = {
            ...existingFiado,
            ordenes_historial: historialActualizado,
            items: historialActualizado,
            fecha_fiado: fechaActual,
            mesa: updatedMesa
          };

          setFiados(nuevosFiados);
          await AsyncStorage.setItem('fiados', JSON.stringify(nuevosFiados));

          setPedidos(pedidos.filter(p => p.uuid !== pedidoSel?.uuid));
          const mNum = Number(pedidoSel?.mesa);
          if (!isNaN(mNum)) setMesas(mesas.map(m => m.num === mNum ? { ...m, estado: 'libre' } : m));

          try {
            const urlFiado = `${serverIP.startsWith('http') ? serverIP : `http://${serverIP}:3001`}/api/pedidos/${existingFiado.uuid}/fiado`;
            await axios.put(urlFiado, {
              deudor: existingFiado.deudor,
              fecha_fiado: fechaActual,
              items: historialActualizado,
              mesa: updatedMesa,
              usuario: loggedUser?.nombre || 'Caja'
            }, { timeout: 15000 });
            showToast(`📌 Cuenta acumulada con éxito`);
          } catch (e) {
            console.error('Error merging fiado on server:', e.message);
            showToast("⚠️ Guardado local en Cartera (sin conexión)");
          }

          try {
            const urlDelete = `${serverIP.startsWith('http') ? serverIP : `http://${serverIP}:3001`}/api/pedidos/${pedidoSel?.uuid}`;
            await axios.delete(urlDelete, { timeout: 15000 });
          } catch (e) {
            console.error('Error completing merged order on server:', e.message);
          }

        } else {
          const nuevoRegistro = {
            uuid: pedidoSel?.uuid,
            mesa: String(pedidoSel?.mesa || ''),
            estado: 'fiado',
            deudor: deudorLimpio,
            fecha_fiado: fechaActual,
            ordenes_historial: [nuevaOrden],
            items: [nuevaOrden]
          };
          nuevosFiados = [nuevoRegistro, ...nuevosFiados];

          setFiados(nuevosFiados);
          await AsyncStorage.setItem('fiados', JSON.stringify(nuevosFiados));

          setPedidos(pedidos.filter(p => p.uuid !== pedidoSel?.uuid));
          const mNum = Number(pedidoSel?.mesa);
          if (!isNaN(mNum)) setMesas(mesas.map(m => m.num === mNum ? { ...m, estado: 'libre' } : m));

          try {
            const urlFiado = `${serverIP.startsWith('http') ? serverIP : `http://${serverIP}:3001`}/api/pedidos/${pedidoSel?.uuid}/fiado`;
            await axios.put(urlFiado, {
              deudor: deudorLimpio,
              fecha_fiado: fechaActual,
              items: [nuevaOrden],
              mesa: String(pedidoSel?.mesa || ''),
              usuario: loggedUser?.nombre || 'Caja'
            }, { timeout: 15000 });
            showToast(`📌 Cuenta creada con éxito`);
          } catch (e) {
            console.error('Error saving new fiado to server:', e.message);
            showToast("⚠️ Guardado local en Cartera");
          }
        }

        setNombreDeudor('');
        setCajaCobroModalVisible(false);
        setPedidoSel(null);
        return;
      }

      // --- COBRO NORMAL (EFECTIVO O TRANSFERENCIA O MIXTO) ---
      const liquidarCuentaSeguro = async (pedido, metodo, datosExtra = {}) => {
        const total = calcularTotalPedido(pedido?.items);
        let efec = 0, trans = 0, credito = 0;

        if (metodo === 'efectivo') {
          efec = total;
        } else if (metodo === 'transferencia') {
          trans = total;
        } else if (metodo === 'mixto') {
          const ingresado = Number(String(datosExtra.efectivoRecibir || 0).replace(/[^0-9]/g, '')) || 0;
          efec = Math.min(total, ingresado);
          trans = Math.max(0, total - efec);
        } else if (metodo === 'credito') {
          credito = total;
        }

        const payload = {
          uuid: pedido.uuid,
          total,
          metodo_pago: metodo,
          monto_efectivo: efec,
          monto_transferencia: trans,
          saldo_cartera: credito,
          cliente_credito: datosExtra.cliente || null
        };

        try {
          await axios.post(`${serverIP.startsWith('http') ? serverIP : `http://${serverIP}:3001`}/api/pedidos/cobrar`, payload);
          showToast("✅ Cobro registrado");
        } catch (e) {
          showToast("⚠️ Fallo o respaldado local");
        }
        setPedidos(prev => prev.filter(p => p.uuid !== pedido.uuid));
      };

      await liquidarCuentaSeguro(pedidoSel, metodoPago, { efectivoRecibir: efectivoMixto, cliente: nombreDeudor.trim() });

      const mesaNumero = Number(pedidoSel?.mesa);
      if (!isNaN(mesaNumero)) setMesas(mesas.map(m => m.num === mesaNumero ? { ...m, estado: 'libre' } : m));
      setCajaCobroModalVisible(false);
      setPedidoSel(null);
    } catch (err) {
      console.error("Error al procesar cobro:", err);
      Alert.alert("Aviso", "No se pudo completar el cobro: " + (err.message || "Error desconocido"));
    }
  };

  // LIQUIDAR LA TARJETA ÚNICA ACUMULADA
  const procesarLiquidacionDeuda = async () => {
    if (!deudorSel) return;
    const totalAcumulado = calcularTotal(deudorSel);
    const fechaActual = new Date().toISOString();

    const flatItems = [];
    if (deudorSel.ordenes_historial) {
      deudorSel.ordenes_historial.forEach(orden => {
        if (orden.items) {
          orden.items.forEach(it => {
            const index = flatItems.findIndex(x => x.nombre === it.nombre);
            if (index > -1) {
              flatItems[index].cantidad += it.cantidad;
            } else {
              flatItems.push({
                nombre: it.nombre,
                cantidad: it.cantidad,
                precio: it.precio !== undefined ? it.precio : (productos.find(p => p.nombre === it.nombre)?.precio || 0)
              });
            }
          });
        }
      });
    } else if (deudorSel.items) {
      deudorSel.items.forEach(it => {
        flatItems.push(it);
      });
    }

    const detallesVenta = flatItems.map(item => ({
      producto_id: productos.find(p => p.nombre === item.nombre)?.id || null,
      nombre_producto: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio,
      subtotal: item.precio * item.cantidad
    }));

    try {
      if (metodoLiq === 'mixto') {
        const montoEfectivo = Number(String(efectivoMixto || 0).replace(/[^0-9]/g, '')) || 0;
        const montoTransferencia = Math.max(0, totalAcumulado - montoEfectivo);
        await axios.post(`${serverIP.startsWith('http') ? serverIP : `http://${serverIP}:3001`}/api/ventas`, {
          fecha: fechaActual,
          tipo_origen: 'Fiado Pagado',
          mesa: `Deuda: ${deudorSel.deudor}`,
          total: totalAcumulado,
          metodo_pago: 'mixto',
          monto_efectivo: montoEfectivo,
          monto_transferencia: montoTransferencia,
          sesion_id: sesionActiva ? sesionActiva.id : null,
          detalles: detallesVenta,
          usuario: loggedUser ? loggedUser.nombre : 'Caja'
        });
      } else {
        await axios.post(`${serverIP.startsWith('http') ? serverIP : `http://${serverIP}:3001`}/api/ventas`, {
          fecha: fechaActual,
          tipo_origen: 'Fiado Pagado',
          mesa: `Deuda: ${deudorSel.deudor}`,
          total: totalAcumulado,
          metodo_pago: metodoLiq === 'efectivo' ? 'Efectivo' : 'Transferencia',
          sesion_id: sesionActiva ? sesionActiva.id : null,
          detalles: detallesVenta,
          usuario: loggedUser ? loggedUser.nombre : 'Caja'
        });
      }

      const uuidsToDelete = deudorSel.uuids || [deudorSel.uuid];
      for (const uuid of uuidsToDelete) {
        if (uuid) {
          await axios.delete(`${serverIP.startsWith('http') ? serverIP : `http://${serverIP}:3001`}/api/pedidos/${uuid}`);
        }
      }

      const carteraActualizada = fiados.filter(f => {
        if (deudorSel.uuids && deudorSel.uuids.length > 0) return !deudorSel.uuids.includes(f.uuid);
        return f.uuid !== deudorSel.uuid;
      });
      setFiados(carteraActualizada);
      await AsyncStorage.setItem('fiados', JSON.stringify(carteraActualizada));

      setVentas([{
        id: Date.now(),
        mesa: `👤 ${deudorSel.deudor}`,
        total: totalAcumulado,
        metodo: metodoLiq === 'efectivo' ? 'Efectivo' : 'Transferencia',
        hora: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
      }, ...ventas]);

      showToast("✅ Cuenta saldada por completo");
      setLiqModalVisible(false);
      setDeudorSel(null);
    } catch (e) {
      showToast("⚠️ Servidor desconectado");
    }
  };

  // RENDERS DE CAJA CERRADA
  if (!sesionActiva || sesionActiva.fecha_cierre) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <Text style={[s.sectionTitle, { marginBottom: 12 }]}>💵 Control de Caja</Text>
        <View style={[s.card, { padding: 20, backgroundColor: C.surf2, alignItems: 'center', marginTop: 10 }]}>
          <Ionicons name="lock-closed" size={56} color={C.orange} style={{ marginBottom: 14 }} />
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 10 }}>
            La caja se encuentra CERRADA
          </Text>
          <Text style={{ fontSize: 12, color: C.text2, textAlign: 'center', marginBottom: 20, lineHeight: 18 }}>
            Ingresa la base inicial de caja para abrir la sesión de cobro y poder facturar pedidos.
          </Text>

          <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, alignSelf: 'flex-start', marginBottom: 6 }}>
            Base de Caja Inicial ($)
          </Text>
          <TextInput
            style={{
              width: '100%',
              backgroundColor: C.surface,
              borderWidth: 1.5,
              borderColor: C.border,
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: C.text,
              marginBottom: 20
            }}
            placeholder="Ej. 100000"
            placeholderTextColor={C.text3}
            keyboardType="decimal-pad"
            value={String(aperturaBase || '')}
            onChangeText={(txt) => setAperturaBase(formatMoneyInput(txt))}
          />
          <TouchableOpacity
            onPress={async () => {
              const base = parseFloat(cleanNum(aperturaBase));
              if (isNaN(base) || base < 0) {
                showToast('⚠️ Ingresa una base válida');
                return;
              }
              try {
                const res = await axios.post(`${serverIP.startsWith('http') ? serverIP : `http://${serverIP}:3001`}/api/caja/abrir`, { base_inicial: base }, { timeout: 15000 });
                if (res.data && res.data.success) {
                  setSesionActiva(res.data.sesion);
                  setAperturaBase('');
                  showToast('✅ Caja abierta con éxito');
                }
              } catch (e) {
                showToast('⚠️ Error al conectar con el servidor');
              }
            }}
            style={{
              backgroundColor: C.green,
              width: '100%',
              padding: 14,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8
            }}
          >
            <Ionicons name="key" size={18} color="white" />
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>ABRIR SESIÓN DE CAJA</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.content}>
      {/* Session Header Banner */}
      <View style={{ backgroundColor: '#2C201A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#4A372D', marginVertical: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#22C55E', fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase' }}>
            🟢 SESIÓN DE CAJA ACTIVA
          </Text>
          <TouchableOpacity
            onPress={async () => {
              try {
                const res = await axios.get(`${serverIP.startsWith('http') ? serverIP : `http://${serverIP}:3001`}/api/caja/resumen-cierre/${sesionActiva.id}`, { timeout: 15000 });
                if (res.data && res.data.success) {
                  setCierreReporte(res.data);
                  setCierreReal('');
                  setCierreModalVisible(true);
                }
              } catch (e) {
                showToast('⚠️ Error al consultar el servidor');
              }
            }}
            style={{
              backgroundColor: C.orange,
              paddingVertical: 7,
              paddingHorizontal: 12,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Ionicons name="lock-closed" size={14} color="white" />
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>CERRAR CAJA</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          <View>
            <Text style={{ color: '#A08D84', fontSize: 12 }}>Base Inicial</Text>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>
              ${Number(sesionActiva?.base_inicial || 0).toLocaleString()}
            </Text>
          </View>

          <View>
            <Text style={{ color: '#A08D84', fontSize: 12 }}>Ventas Turno</Text>
            <Text style={{ color: '#38BDF8', fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>
              +${Number(sesionActiva?.ventas_turno || 0).toLocaleString()}
            </Text>
          </View>

          <View>
            <Text style={{ color: '#A08D84', fontSize: 12 }}>Total en Caja</Text>
            <Text style={{ color: '#22C55E', fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>
              ${Number(sesionActiva?.total_en_caja || (Number(sesionActiva?.base_inicial || 0) + Number(sesionActiva?.ventas_turno || 0))).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[s.sectionTitle, { marginBottom: 12 }]}>💵 Cuentas Pendientes en Mesas</Text>
      {(() => {
        const cuentasVisibles = (pedidos || []).filter(p => {
          if (!p) return false;
          const estado = String(p.estado || '').toLowerCase().trim();
          if (['cobrado', 'cancelado', 'archivado'].includes(estado)) return false;
          if (p.pagado === 1 || p.pagado === true) return false;
          if (estado === 'fiado' || p.fiado === 1) return false;
          let items = [];
          try {
            items = Array.isArray(p.items) ? p.items : (typeof p.items === 'string' ? JSON.parse(p.items || '[]') : []);
          } catch (e) {
            items = [];
          }
          return items.length > 0;
        });
        if (cuentasVisibles.length === 0) return <View style={{ padding: 15, alignItems: 'center' }}><Text style={{ color: C.cream2 }}>No hay pedidos pendientes de pago</Text></View>;
        return cuentasVisibles.map(p => {
          const totalMesa = calcularTotal(p);
          const isLlevar = typeof p.mesa === 'string' && (p.mesa.startsWith('Para') || p.mesa === 'llevar');
          let itemsLista = [];
          try {
            itemsLista = Array.isArray(p.items) ? p.items : (typeof p.items === 'string' ? JSON.parse(p.items || '[]') : []);
          } catch (e) {
            itemsLista = [];
          }
          const estado = String(p.estado || 'pendiente').toLowerCase().trim();
          const esCuenta = estado === 'cuenta';

          return (
            <View key={p.uuid} style={[s.card, { marginBottom: 12, padding: 14, backgroundColor: C.surf2, borderWidth: esCuenta ? 2 : 1, borderColor: esCuenta ? C.orange : C.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{isLlevar ? (p.mesa === 'llevar' ? `Para Llevar (#${p.id || ''})` : p.mesa) : `Mesa ${p.mesa}`}</Text>
                <Text style={{ fontSize: 12, color: C.text3 }}>🕒 {p.hora}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                <View style={{
                  backgroundColor: esCuenta ? '#FEF3C7' : estado === 'listo' ? '#DCFCE7' : estado === 'en_cocina' || estado === 'preparando' ? '#FEF3C7' : '#E0E7FF',
                  paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: esCuenta ? '#B45309' : estado === 'listo' ? '#15803D' : estado === 'en_cocina' || estado === 'preparando' ? '#B45309' : '#3730A3', textTransform: 'uppercase' }}>
                    {estado}
                  </Text>
                </View>
              </View>
              {itemsLista.map((it, idx) => (
                <Text key={idx} style={{ fontSize: 12, color: C.text2 }}>• {it.cantidad || it.cant || 1}x {it.nombre || it.titulo}</Text>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.orange }}>Total: {totalMesa.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => onSolicitarCancelar(p)}
                    style={{
                      backgroundColor: 'transparent',
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      borderWidth: 1.5,
                      borderColor: C.red,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>❌ Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.btnSmGreen}
                    onPress={() => {
                      setPedidoSel(p);
                      setMetodoPago('efectivo');
                      setNombreDeudor('');
                      setCajaCobroModalVisible(true);
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700' }}>💵 Cobrar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        });
      })()}

      {/* Botón Interruptor Discreto */}
      <TouchableOpacity
        onPress={() => setVerDeudores(!verDeudores)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(61,26,10,0.02)',
          borderColor: C.border,
          borderWidth: 1,
          borderRadius: 8,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginTop: 20,
          marginBottom: 10,
          justifyContent: 'space-between'
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name={verDeudores ? "eye-outline" : "eye-off-outline"} size={16} color={C.text2} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, letterSpacing: 0.5 }}>Cartera / Créditos</Text>
        </View>
        <Ionicons name={verDeudores ? "chevron-up" : "chevron-down"} size={16} color={C.text3} />
      </TouchableOpacity>

      {verDeudores && (
        <>
          {fiados.length === 0 ? (
            <View style={[s.card, { padding: 16, alignItems: 'center' }]}><Text style={{ fontSize: 12, color: C.cream2 }}>No hay registros pendientes.</Text></View>
          ) : (
            fiados.map(f => {
              const totalAcumulado = calcularTotal(f);
              const expandido = deudorExpandido === f.uuid;
              return (
                <View key={f.uuid} style={[s.card, { marginBottom: 12, padding: 12, backgroundColor: C.surf2, borderColor: C.border, borderWidth: 1 }]}>
                  {/* Cabecera del Acordeón */}
                  <TouchableOpacity
                    onPress={() => setDeudorExpandido(expandido ? null : f.uuid)}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 2
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>👤 {f.deudor}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.red, opacity: 0.85 }}>
                        {totalAcumulado.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}
                      </Text>
                      <Ionicons name={expandido ? "chevron-up-outline" : "chevron-down-outline"} size={16} color={C.text3} />
                    </View>
                  </TouchableOpacity>

                  {/* Detalle Expandible */}
                  {expandido && (
                    <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
                      {/* Historial de Órdenes */}
                      <View style={{ gap: 8, marginBottom: 12 }}>
                        {f.ordenes_historial && f.ordenes_historial.map((orden, oIdx) => {
                          const keyOrden = orden.uuid || orden.id ? `orden-${orden.uuid || orden.id}` : `orden-idx-${oIdx}`;
                          return (
                            <View key={keyOrden} style={{
                              padding: 8,
                              backgroundColor: 'rgba(61,26,10,0.02)',
                              borderRadius: 6,
                              borderLeftWidth: 2,
                              borderLeftColor: C.orange
                            }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748b', marginVertical: 4 }}>
                                {orden.mesa ? `Mesa ${orden.mesa} - ` : ''}
                                {orden.fecha ? (orden.fecha.includes('T') ? new Date(orden.fecha).toLocaleDateString('es-CO') : orden.fecha) : ''}
                                {Boolean(formatearHoraPedido(orden)) && ` • ${formatearHoraPedido(orden)}`}
                              </Text>
                              {orden.items && orden.items.map((it, itIdx) => (
                                <Text key={`it-${it.id || itIdx}-${oIdx}`} style={{ fontSize: 11, color: C.text, marginBottom: 2 }}>
                                  • {it.cantidad}x {it.nombre} <Text style={{ color: C.text3 }}>({((it.precio || 0) * it.cantidad).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })})</Text>
                                </Text>
                              ))}
                            </View>
                          );
                        })}
                      </View>

                      {/* Botón de Liquidación */}
                      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: C.text2 }}>Saldo: <Text style={{ color: C.orange, fontWeight: '800' }}>{totalAcumulado.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text></Text>
                        <TouchableOpacity onPress={() => { setDeudorSel(f); setMetodoLiq('efectivo'); setLiqModalVisible(true); }} style={{ backgroundColor: C.green, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }}><Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>Liquidar Deuda</Text></TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </>
      )}

      {/* HISTORIAL DE VENTAS */}
      <TouchableOpacity
        onPress={() => setShowHistorialVentas(!showHistorialVentas)}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 }}
      >
        <Text style={s.sectionTitle}>📋 Ventas del Día</Text>
        <Ionicons name={showHistorialVentas ? "chevron-up" : "chevron-down"} size={20} color={C.text} />
      </TouchableOpacity>

      {showHistorialVentas && (
        <View style={[s.card, { padding: 14, backgroundColor: C.surface }]}>
          {ventas.length === 0 ? (
            <Text style={{ fontSize: 12, color: C.text3, textAlign: 'center' }}>No hay ventas registradas</Text>
          ) : (
            ventas.map((v, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: idx < ventas.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                <View><Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{typeof v.mesa === 'string' && v.mesa.startsWith('Para') ? v.mesa : `Mesa ${v.mesa}`}</Text><Text style={{ fontSize: 10, color: C.text3 }}>{v.hora || 'Ahora'} • {v.metodo || 'Efectivo'}</Text></View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.green }}>{v.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* --- MODAL DE COBRO DE MESA (CON FILTRO DE SELECCIÓN RÁPIDA Y COBRO MIXTO) --- */}
      <ModalCobroMixto
        visible={cajaCobroModalVisible && Boolean(pedidoSel)}
        pedidoSel={pedidoSel}
        totalCuenta={pedidoSel ? calcularTotal(pedidoSel) : 0}
        metodoPago={metodoPago}
        setMetodoPago={setMetodoPago}
        efectivoMixto={efectivoMixto}
        setEfectivoMixto={setEfectivoMixto}
        nombreDeudor={nombreDeudor}
        setNombreDeudor={setNombreDeudor}
        fiados={fiados}
        clientesGlobales={clientesGlobales}
        imprimirTicketCaja={imprimirTicketCaja}
        setImprimirTicketCaja={setImprimirTicketCaja}
        onClose={() => {
          setCajaCobroModalVisible(false);
          setPedidoSel(null);
          setNombreDeudor('');
        }}
        onConfirmar={confirmarCobro}
      />

      {/* MODAL DE LIQUIDACIÓN POSTERIOR */}
      {deudorSel && (
        <Modal visible={liqModalVisible} animationType="fade" transparent={true}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: C.border }}>
              <View style={{ backgroundColor: C.brand, padding: 16 }}><Text style={{ fontSize: 16, fontWeight: '800', color: C.cream }}>💵 Saldar Cartera - {deudorSel.deudor}</Text></View>
              <View style={{ padding: 18 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: C.text, textAlign: 'center', marginBottom: 16 }}>Monto Acumulado: {calcularTotal(deudorSel).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, marginBottom: 8 }}>¿Cómo cancela la deuda hoy?</Text>
                <View style={{ gap: 10, marginBottom: metodoLiq === 'mixto' ? 10 : 20 }}>
                  <TouchableOpacity onPress={() => setMetodoLiq('efectivo')} style={[s.cajaSelect, { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }, metodoLiq === 'efectivo' && { borderColor: C.green, backgroundColor: 'rgba(45,106,63,0.05)' }]}><Text style={{ fontWeight: '700', color: C.text }}>💵 Efectivo</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setMetodoLiq('transferencia')} style={[s.cajaSelect, { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }, metodoLiq === 'transferencia' && { borderColor: C.orange, backgroundColor: 'rgba(232,82,10,0.05)' }]}><Text style={{ fontWeight: '700', color: C.text }}>📲 Transferencia</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setMetodoLiq('mixto')} style={[s.cajaSelect, { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }, metodoLiq === 'mixto' && { borderColor: C.brand, backgroundColor: 'rgba(61,26,10,0.05)' }]}><Text style={{ fontWeight: '700', color: C.text }}>💵 + 📲 Cobro Mixto</Text></TouchableOpacity>
                </View>

                {metodoLiq === 'mixto' && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.text2, marginBottom: 8 }}>Efectivo a recibir:</Text>
                    <TextInput
                      style={[s.formInput, { fontSize: 18, fontWeight: 'bold' }]}
                      placeholder="Ej. 20000"
                      placeholderTextColor={C.text3}
                      keyboardType="decimal-pad"
                      value={String(efectivoMixto || '')}
                      onChangeText={(txt) => setEfectivoMixto(formatMoneyInput(txt))}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, padding: 12, backgroundColor: C.surf3, borderRadius: 8 }}>
                      <Text style={{ fontSize: 14, color: C.text, fontWeight: '600' }}>Restante por Transferencia:</Text>
                      <Text style={{ fontSize: 16, color: C.brand, fontWeight: '800' }}>
                        {(() => {
                          const saldoPendiente = calcularTotal(deudorSel);
                          const montoEfectivo = Number(String(efectivoMixto || 0).replace(/[^0-9]/g, '')) || 0;
                          const montoTransferencia = Math.max(0, saldoPendiente - montoEfectivo);
                          return `$${montoTransferencia.toLocaleString('es-CO')}`;
                        })()}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => setLiqModalVisible(false)} style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' }}><Text style={{ color: C.text, fontWeight: '700' }}>Cerrar</Text></TouchableOpacity>
                  <TouchableOpacity onPress={procesarLiquidacionDeuda} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: C.green, alignItems: 'center' }}><Text style={{ color: 'white', fontWeight: '700' }}>Saldar Cuenta</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal de Cierre de Caja */}
      {cierreReporte && (
        <Modal
          visible={cierreModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setCierreModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
              <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setCierreModalVisible(false)}>
                  <Ionicons name="arrow-back" size={20} color={C.cream2} />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream, flex: 1 }}>
                  🔒 Cierre de Caja
                </Text>
              </View>

              <ScrollView contentContainerStyle={{ padding: 18 }}>
                <View style={{ gap: 10, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 }}>
                    <Text style={{ color: C.text2, fontSize: 13 }}>💵 Base Inicial:</Text>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{cierreReporte.base_inicial.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 }}>
                    <Text style={{ color: C.text2, fontSize: 13 }}>💵 Ventas en Efectivo:</Text>
                    <Text style={{ color: C.green, fontWeight: '700', fontSize: 13 }}>+{cierreReporte.ingresos_efectivo.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 }}>
                    <Text style={{ color: C.text2, fontSize: 13 }}>📲 Ventas en Transferencia:</Text>
                    <Text style={{ color: C.orange, fontWeight: '700', fontSize: 13 }}>+{cierreReporte.ingresos_transferencia.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 }}>
                    <Text style={{ color: C.text2, fontSize: 13 }}>💸 Gastos Registrados:</Text>
                    <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>-{cierreReporte.gastos.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6, backgroundColor: 'rgba(232,82,10,0.05)', padding: 6, borderRadius: 6 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>💵 Saldo Esperado en Caja:</Text>
                    <Text style={{ color: C.orange, fontWeight: '800', fontSize: 14 }}>{cierreReporte.saldo_final_esperado.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, marginBottom: 6 }}>Efectivo Real en Caja ($)</Text>
                <TextInput
                  style={{
                    backgroundColor: C.surf2,
                    borderWidth: 1.5,
                    borderColor: C.border,
                    borderRadius: 8,
                    padding: 10,
                    color: C.text,
                    fontSize: 16,
                    marginBottom: 20
                  }}
                  placeholder="Digita el efectivo total contado"
                  placeholderTextColor={C.text3}
                  keyboardType="decimal-pad"
                  value={String(cierreReal || '')}
                  onChangeText={(txt) => setCierreReal(formatMoneyInput(txt))}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setCierreModalVisible(false)}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1.5,
                      borderColor: C.border,
                      alignItems: 'center',
                      backgroundColor: 'transparent'
                    }}
                  >
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={async () => {
                      const realVal = parseFloat(cleanNum(cierreReal));
                      if (isNaN(realVal) || realVal < 0) {
                        showToast('⚠️ Ingresa un valor válido');
                        return;
                      }
                      try {
                        const res = await axios.post(`${serverIP.startsWith('http') ? serverIP : `http://${serverIP}:3001`}/api/caja/cerrar`, {
                          sesion_id: sesionActiva.id,
                          saldo_final_real: realVal
                        }, { timeout: 15000 });

                        if (res.data && res.data.success) {
                          setSesionActiva(null);
                          setCierreModalVisible(false);
                          setCierreReporte(null);

                          setAperturaBase(res.data.base_inicial.toString());
                          await AsyncStorage.setItem('ultima_base_caja', res.data.base_inicial.toString());

                          Alert.alert(
                            "Caja Cerrada",
                            `Arqueo de Caja Completado:\n\n` +
                            `• Base Inicial: ${res.data.base_inicial.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n` +
                            `• Ingresos Efectivo: ${res.data.ingresos_efectivo.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n` +
                            `• Gastos: ${res.data.gastos.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n` +
                            `• Esperado en Caja: ${res.data.saldo_final_esperado.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n` +
                            `• Real Contado: ${res.data.saldo_final_real.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n` +
                            `• Diferencia: ${res.data.diferencia.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n\n` +
                            `${res.data.diferencia < 0 ? '⚠️ Falta dinero' : res.data.diferencia > 0 ? '🎉 Sobra dinero' : '✅ Caja cuadrada'}`
                          );
                        }
                      } catch (e) {
                        showToast('⚠️ Error al cerrar caja');
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: C.red,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Confirmar Cierre</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

export const CajaView = CajaScreen;
