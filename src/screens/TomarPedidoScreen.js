import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Image
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { C, s, CATEGORIAS } from '../constants/theme';
import ModalAdicionales from '../components/ModalAdicionales';

export default function TomarPedidoScreen({
  mesas = [],
  productos = [],
  pedidos = [],
  onEnviar,
  serverIP,
  showToast = () => {},
  paraLlevarNextNum = 1,
  pedidoEditando,
  setPedidoEditando,
  borradores = {},
  guardarBorrador = () => {},
  eliminarBorrador = () => {},
  paso = 1,
  setPaso,
  mesaSel,
  setMesaSel,
  carrito = [],
  setCarrito,
  mesaActivaModalVisible,
  setMesaActivaModalVisible,
  mesaActivaSelected,
  setMesaActivaSelected,
  prodConfigModalVisible,
  setProdConfigModalVisible,
  prodToConfig,
  setProdToConfig,
  configObservaciones,
  setConfigObservaciones,
  configAdicionales,
  setConfigAdicionales,
  configCantidad,
  setConfigCantidad,
  adicionalesDisponibles = [],
  setAdicionalesDisponibles,
  setDeudorAbonoSelected,
  setMontoAbono,
  setMetodoAbono,
  setAbonoModalVisible
}) {
  const [catActiva, setCatActiva] = useState(1);

  useEffect(() => {
    if (productos && productos.length > 0) {
      const activeStr = String(catActiva);
      const availableCatsStr = Array.from(new Set(productos.map(p => String(p.cat))));
      if (!availableCatsStr.includes(activeStr) && availableCatsStr.length > 0) {
        setCatActiva(availableCatsStr[0]);
      }
    }
  }, [productos]);

  const seleccionarMesa = (m) => {
    const mesaNumStr = String(m.num || m.id || m.numero || '');
    const tieneComandaActiva = (pedidos || []).some(p => 
      (String(p.mesa_id || p.mesa) === mesaNumStr || String(p.mesa_id || p.mesa) === `Mesa ${mesaNumStr}`) &&
      !['cobrado', 'cancelado', 'archivado'].includes(String(p.estado || '').toLowerCase())
    );

    const estaOcupada = m.estado === 'ocupada' || m.estado === 'cuenta' || tieneComandaActiva;

    if (estaOcupada) {
      const pedidosActivosDeMesa = (pedidos || []).filter(p => {
        const estadoValido = !['cobrado', 'cancelado', 'archivado', 'completado'].includes(String(p.estado || '').toLowerCase());
        const mesaMatch = String(p.mesa || '').trim().toLowerCase() === mesaNumStr.toLowerCase()
          || String(p.mesa || '').trim().toLowerCase() === `mesa ${mesaNumStr}`.toLowerCase()
          || Number(p.mesa) === Number(mesaNumStr);
        return estadoValido && mesaMatch;
      });
      const activeOrder = pedidosActivosDeMesa[0];

      Alert.alert(
        "Mesa Ocupada",
        `La Mesa ${m.num} ya tiene una comanda activa. No se puede crear un pedido nuevo duplicado.`,
        [
          activeOrder ? {
            text: "Cargar comanda activa para añadir productos",
            onPress: () => {
              setPedidoEditando(activeOrder);
              const itemsForCart = (activeOrder.items || []).map(item => {
                const prod = productos.find(p => p.nombre === item.nombre) || {};
                return {
                  id: prod.id || ('temp_' + item.nombre),
                  cat: item.cat || prod.cat,
                  nombre: item.nombre,
                  precio: item.precio || prod.precio || 0,
                  precio_base: item.precio_base || prod.precio || 0,
                  adicionales: item.adicionales || [],
                  observaciones: item.observaciones || item.nota || '',
                  desc: prod.desc || '',
                  emoji: prod.emoji || '🍽️',
                  cantidad: item.cantidad || 1,
                  nota: item.nota || item.observaciones || '',
                  estado: item.estado || 'pendiente'
                };
              });
              setCarrito(itemsForCart);
              setMesaSel(m);
              setPaso(2);
            }
          } : {
            text: "Ver detalles de la mesa",
            onPress: () => {
              setMesaActivaSelected(m);
              setMesaActivaModalVisible(true);
            }
          },
          {
            text: "Cerrar / Volver",
            style: "cancel"
          }
        ]
      );
      return;
    }

    const draft = borradores[m.num];
    if (draft) {
      Alert.alert(
        "Pedido en borrador encontrado",
        `Se encontró un pedido en borrador para la Mesa ${m.num}. ¿Deseas continuarlo?`,
        [
          {
            text: "Continuar",
            onPress: () => {
              setCarrito(draft.items);
              if (draft.editUuid) {
                const activeOrder = pedidos.find(p => p.uuid === draft.editUuid);
                setPedidoEditando(activeOrder || null);
              } else {
                setPedidoEditando(null);
              }
              setMesaSel(m);
              setPaso(2);
            }
          },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: () => {
              eliminarBorrador(m.num);
              setCarrito([]);
              setPedidoEditando(null);
              setMesaSel(m);
              setPaso(2);
            }
          }
        ]
      );
    } else {
      if (mesaSel && mesaSel.num !== m.num && carrito.length > 0) {
        Alert.alert(
          "Cambiar de Mesa",
          `¿Deseas descartar el pedido actual de la ${mesaSel.num}?`,
          [
            {
              text: "Sí, descartar",
              onPress: () => {
                setCarrito([]);
                setPedidoEditando(null);
                setMesaSel(m);
                setPaso(2);
              }
            },
            { text: "Cancelar", style: "cancel" }
          ]
        );
      } else {
        setMesaSel(m);
        setPaso(2);
      }
    }
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
    if (esProductoBebida(prod)) {
      agregarProductoSeguro(prod, [], '', 1);
      showToast(`➕ Añadido ${prod.nombre}`);
      return;
    }
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
        const idx = prev.findIndex(it => it.id === producto.id && (!it.adicionales || it.adicionales.length === 0) && !it.notas);
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

      const precioBase = Number(producto.precio || producto.precio_unitario || 0) || 0;
      const totalAdics = (adicionales || []).reduce((acc, a) => acc + (Number(a.precio || 0) || 0), 0);

      const nuevaLinea = {
        lineId: `line_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        id: producto.id,
        nombre: producto.nombre,
        precio: precioBase,
        cantidad: cantidadFinal,
        adicionales: adicionales.map(a => ({
          id: a.id,
          nombre: a.nombre,
          precio: Number(a.precio || 0) || 0
        })),
        notas: notas ? notas.trim() : '',
        subtotal: (precioBase + totalAdics) * cantidadFinal
      };

      return [...prev, nuevaLinea];
    });
  };

  const handleSumarAdicionalMovil = (adic) => {
    const limiteItem = Number(adic?.limite || adic?.maximo || adic?.max) || 99;
    const limiteGlobal = Number(prodToConfig?.limite_adicionales || prodToConfig?.max_adicionales) || 99;

    setConfigAdicionales(prev => {
      const totalAdics = prev.reduce((sum, a) => sum + (Number(a.cantidad) || 1), 0);
      if (totalAdics >= limiteGlobal) return prev;

      const existe = prev.find(a => a.id === adic.id);
      if (existe) {
        if ((Number(existe.cantidad) || 1) >= limiteItem) return prev;
        return prev.map(a => a.id === adic.id ? { ...a, cantidad: (a.cantidad || 1) + 1 } : a);
      }
      return [...prev, { ...adic, cantidad: 1 }];
    });
  };

  const handleRestarAdicionalMovil = (adic) => {
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

    // 1. Mapear adicionales con su cantidad y calcular suma total
    const adicionalesParaGuardar = (configAdicionales || []).map(a => ({
      id: a.id,
      nombre: a.nombre,
      precio: Number(a.precio || 0),
      cantidad: Number(a.cantidad || 1)
    }));

    const totalAdicionales = adicionalesParaGuardar.reduce(
      (acc, a) => acc + (a.precio * a.cantidad),
      0
    );

    const precioUnitarioConExtras = Number(prodToConfig?.precio || 0) + totalAdicionales;

    // 2. Estructurar ítem completo
    const nuevoItem = {
      ...prodToConfig,
      uuid: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      precio: precioUnitarioConExtras,
      precio_base: Number(prodToConfig?.precio || 0),
      adicionales: adicionalesParaGuardar,
      observaciones: (configObservaciones || '').trim(),
      nota: (configObservaciones || '').trim(),
      cantidad: Number(configCantidad || 1)
    };

    // Agregar al carrito/orden y resetear estados
    setCarrito(prev => [...prev, nuevoItem]);
    showToast(`➕ Añadido ${prodToConfig.nombre}`);
    setConfigAdicionales([]);
    setConfigObservaciones('');
    setConfigCantidad(1);
    setProdConfigModalVisible(false);
    setProdToConfig(null);
  };

  const cambiarQty = (idx, estado, delta) => {
    setCarrito(c => {
      const updated = c.map((i, index) => (index === idx && i.estado === estado) ? { ...i, cantidad: i.cantidad + delta } : i);
      return updated.filter(i => i.cantidad > 0);
    });
  };

  const total = carrito.reduce((a, i) => a + i.precio * i.cantidad, 0);
  const count = carrito.reduce((a, i) => a + i.cantidad, 0);

  const enviar = () => {
    if (!carrito.length) return;
    const items = carrito.map(i => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      nota: i.nota || i.observaciones || "",
      observaciones: i.observaciones || i.nota || "",
      cat: i.cat,
      precio: i.precio,
      precio_base: i.precio_base || i.precio,
      adicionales: i.adicionales || [],
      estado: i.estado || 'pendiente'
    }));
    onEnviar(mesaSel.num, items, !!pedidoEditando, pedidoEditando?.uuid);
    setCarrito([]);
    setPaso(1);
    setMesaSel(null);
    setPedidoEditando(null);
  };

  const prods = productos.filter(p => String(p.cat) === String(catActiva) && p.disp);

  // PASO 1: Mesas
  if (paso === 1) {
    return (
      <View style={{ flex: 1, padding: 14 }}>
        {/* Compact step indicator */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "rgba(245,230,200,0.06)",
          borderRadius: 10,
          paddingVertical: 8,
          paddingHorizontal: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: "rgba(245,230,200,0.08)",
        }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.orange, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: "white" }}>1</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.cream, marginLeft: 6 }}>Elegir mesa</Text>
          <View style={{ flex: 1, height: 1.5, backgroundColor: "rgba(245,230,200,0.15)", marginHorizontal: 10 }} />
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(245,230,200,0.1)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: C.text3 }}>2</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: "500", color: C.text3, marginLeft: 6 }}>Pedido</Text>
        </View>

        {/* Legend */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4CAF70" }} />
            <Text style={{ fontSize: 10, color: C.cream2 }}>Libre</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#DC2626" }} />
            <Text style={{ fontSize: 10, color: C.cream2 }}>Ocupada</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#D97706" }} />
            <Text style={{ fontSize: 10, color: C.cream2 }}>Cuenta</Text>
          </View>
        </View>

        {/* Tables grid — 2 columns */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 10 }}>
          {mesas.map(m => {
            const mesaNumStr = String(m.num || m.id || m.numero || '');
            const tieneComandaActiva = (pedidos || []).some(p => 
              (String(p.mesa_id || p.mesa) === mesaNumStr || String(p.mesa_id || p.mesa) === `Mesa ${mesaNumStr}`) &&
              !['cobrado', 'cancelado', 'archivado'].includes(String(p.estado || '').toLowerCase())
            );
            const estaOcupada = m.estado === 'ocupada' || m.estado === 'cuenta' || tieneComandaActiva;
            const estadoVisual = estaOcupada ? (m.estado === 'cuenta' ? 'cuenta' : 'ocupada') : 'libre';

            const sel = mesaSel?.id === m.id;
            const bgColor = estadoVisual === "libre" ? "#F0FDF4" : estadoVisual === "ocupada" ? "#FEF2F2" : "#FFFBEB";
            const borderColor = sel ? C.orange : estadoVisual === "libre" ? "#86EFAC" : estadoVisual === "ocupada" ? "#FCA5A5" : "#FCD34D";
            const statusColor = estadoVisual === "libre" ? "#15803D" : estadoVisual === "ocupada" ? "#DC2626" : "#D97706";
            const statusBg = estadoVisual === "libre" ? "#DCFCE7" : estadoVisual === "ocupada" ? "#FEE2E2" : "#FEF3C7";

            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => seleccionarMesa(m)}
                style={{
                  width: '48%',
                  aspectRatio: 1,
                  backgroundColor: bgColor,
                  borderRadius: 12,
                  borderWidth: sel ? 3 : 2,
                  borderColor: borderColor,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  marginBottom: 14,
                  ...(sel ? { shadowColor: C.orange, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 } : {}),
                }}
              >
                <Text style={{ fontSize: 50, fontWeight: "900", color: C.text, marginBottom: 6 }}>{m.num}</Text>
                <View style={{ backgroundColor: statusBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: statusColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {estadoVisual}
                  </Text>
                </View>
                {borradores[m.num] && (
                  <Text style={{ fontSize: 10, fontWeight: "700", color: C.orange, marginTop: 4 }}>
                    📌 Borrador
                  </Text>
                )}
                {sel && (
                  <View style={{ position: "absolute", top: 8, right: 8 }}>
                    <Ionicons name="checkmark-circle" size={22} color={C.orange} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Para Llevar card */}
        <TouchableOpacity
          onPress={() => {
            const numParaLlevar = 'Para Llevar #' + String(paraLlevarNextNum).padStart(3, '0');
            const targetMesa = { id: 'para_llevar_' + Date.now(), num: numParaLlevar, estado: 'libre', isParaLlevar: true };
            const draft = borradores[numParaLlevar];
            if (draft) {
              Alert.alert(
                "Pedido en borrador encontrado",
                `Se encontró un pedido en borrador para ${numParaLlevar}. ¿Deseas continuarlo?`,
                [
                  {
                    text: "Continuar",
                    onPress: () => {
                      setCarrito(draft.items);
                      setPedidoEditando(null);
                      setMesaSel(targetMesa);
                      setPaso(2);
                    }
                  },
                  {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: () => {
                      eliminarBorrador(numParaLlevar);
                      setCarrito([]);
                      setPedidoEditando(null);
                      setMesaSel(targetMesa);
                      setPaso(2);
                    }
                  }
                ]
              );
            } else {
              if (mesaSel && mesaSel.num !== numParaLlevar && carrito.length > 0) {
                Alert.alert(
                  "Cambiar de Mesa",
                  `¿Deseas descartar el pedido actual de la ${mesaSel.num}?`,
                  [
                    {
                      text: "Sí, descartar",
                      onPress: () => {
                        setCarrito([]);
                        setPedidoEditando(null);
                        setMesaSel(targetMesa);
                        setPaso(2);
                      }
                    },
                    { text: "Cancelar", style: "cancel" }
                  ]
                );
              } else {
                setMesaSel(targetMesa);
                setPaso(2);
              }
            }
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(232,82,10,0.08)",
            borderWidth: 1.5,
            borderColor: C.orange,
            borderRadius: 12,
            padding: 14,
            marginTop: 10,
            gap: 10,
          }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(232,82,10,0.15)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 18 }}>👥 </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: C.orange }}>Pedido Para Llevar</Text>
              {borradores['Para Llevar #' + String(paraLlevarNextNum).padStart(3, '0')] && (
                <Text style={{ fontSize: 10, fontWeight: "700", color: C.orange }}>
                  (📌 Pedido en Borrador)
                </Text>
              )}
            </View>
            <Text style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>Crear nuevo pedido sin mesa</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={C.orange} />
        </TouchableOpacity>

        {/* Continue button */}
        <TouchableOpacity
          style={{
            backgroundColor: mesaSel ? C.orange : "rgba(232,82,10,0.3)",
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            marginTop: 10,
          }}
          onPress={() => {
            if (!mesaSel) return;
            const mesaNumStr = String(mesaSel.num || mesaSel.id || mesaSel.numero || '');
            const tieneComandaActiva = (pedidos || []).some(p => 
              (String(p.mesa_id || p.mesa) === mesaNumStr || String(p.mesa_id || p.mesa) === `Mesa ${mesaNumStr}`) &&
              !['cobrado', 'cancelado', 'archivado'].includes(String(p.estado || '').toLowerCase())
            );
            const estaOcupada = mesaSel.estado === 'ocupada' || mesaSel.estado === 'cuenta' || tieneComandaActiva;
            if (estaOcupada && !pedidoEditando) {
              Alert.alert(
                "Mesa Ocupada", 
                `La Mesa ${mesaSel.num} ya tiene una comanda activa. No se puede crear un pedido nuevo duplicado.`
              );
              return;
            }
            setPaso(2);
          }}
          disabled={!mesaSel}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>
            {mesaSel ? `Continuar con Mesa ${mesaSel.num} →` : "Selecciona una mesa"}
          </Text>
        </TouchableOpacity>

        {/* Modal para Mesas Ocupadas (Ver / Editar) */}
        {mesaActivaModalVisible && mesaActivaSelected && (
          <Modal
            visible={mesaActivaModalVisible}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setMesaActivaModalVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
                <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={() => setMesaActivaModalVisible(false)}>
                    <Ionicons name="arrow-back" size={20} color={C.cream2} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream }}>
                      Mesa {mesaActivaSelected.num}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.cream2, marginTop: 2 }}>
                      Estado: {mesaActivaSelected.estado}
                    </Text>
                  </View>
                </View>

                {/* Banner de advertencia */}
                <View style={{ backgroundColor: '#FEF2F2', padding: 10, marginHorizontal: 16, marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>
                    ⚠️ Esta mesa ya tiene una comanda activa. No se puede crear un pedido nuevo duplicado.
                  </Text>
                </View>

                <View style={{ padding: 18 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 8 }}>Productos pedidos:</Text>
                  <ScrollView style={{ maxHeight: 150, marginBottom: 18 }}>
                    {(() => {
                      const pedidosActivosDeMesa = (pedidos || []).filter(p => {
                        const estadoValido = !['cobrado', 'cancelado', 'archivado', 'completado'].includes(String(p.estado || '').toLowerCase());
                        const mesaMatch = String(p.mesa || '').trim().toLowerCase() === String(mesaActivaSelected.num || mesaActivaSelected.id).trim().toLowerCase()
                          || Number(p.mesa) === Number(mesaActivaSelected.num || mesaActivaSelected.id);
                        return estadoValido && mesaMatch;
                      });
                      const activeOrder = pedidosActivosDeMesa[0];

                      const obtenerItemsPedido = (pedido) => {
                        if (!pedido) return [];
                        const fuente = pedido.items || pedido.productos || [];
                        if (Array.isArray(fuente)) return fuente;
                        if (typeof fuente === 'string') {
                          try {
                            return JSON.parse(fuente);
                          } catch (e) {
                            console.log('Error parseando items en detalle:', e.message);
                            return [];
                          }
                        }
                        return [];
                      };

                      const itemsSeguros = obtenerItemsPedido(activeOrder);

                      if (!activeOrder || itemsSeguros.length === 0) {
                        return <Text style={{ fontSize: 12, color: C.text3 }}>No hay productos en este pedido.</Text>;
                      }

                      return itemsSeguros.map((item, idx) => (
                        <View
                          key={item.id || item.lineId || idx}
                          style={{
                            paddingVertical: 8,
                            borderBottomWidth: 1,
                            borderBottomColor: '#3A2E27'
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#FFF', fontSize: 14 }}>
                                <Text style={{ color: '#EA580C', fontWeight: 'bold' }}>
                                  {item.cant || item.cantidad || 1}x{' '}
                                </Text>
                                {item.nombre || item.titulo}
                                {item.estado && <Text style={{ color: C.text3, fontSize: 11 }}> ({item.estado})</Text>}
                              </Text>

                              {/* Lista de Adicionales en el ítem */}
                              {Array.isArray(item.adicionales) && item.adicionales.length > 0 && (
                                <View style={{ marginLeft: 10, marginTop: 2 }}>
                                  {item.adicionales.map((adic, aIdx) => {
                                    const keyUnica = adic?.id ? `adic-${adic.id}-${aIdx}` : `adic-${aIdx}`;
                                    const nombre = typeof adic === 'string' ? adic : adic?.nombre;
                                    const cant = typeof adic === 'object' && Number(adic?.cantidad) > 1 ? `(${adic.cantidad}x) ` : '';
                                    if (!nombre) return null;
                                    return (
                                      <Text 
                                        key={keyUnica} 
                                        style={{ 
                                          fontSize: 12, 
                                          fontWeight: '600', 
                                          color: C.orange || '#d97706', 
                                          lineHeight: 16 
                                        }}
                                      >
                                        + {cant}{nombre}
                                      </Text>
                                    );
                                  })}
                                </View>
                              )}

                              {/* Observaciones para cocina */}
                              {Boolean(item.observaciones || item.nota) && (
                                <Text style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginLeft: 10, marginTop: 2 }}>
                                  📝 {item.observaciones || item.nota}
                                </Text>
                              )}
                            </View>

                            <Text style={{ color: '#E0D4C3', fontWeight: 'bold', fontSize: 14, marginLeft: 8 }}>
                              ${Number(item.precio || item.total || 0).toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      ));
                    })()}
                  </ScrollView>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => setMesaActivaModalVisible(false)}
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
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>Cerrar</Text>
                    </TouchableOpacity>

                    {(() => {
                      const pedidosActivosDeMesa = (pedidos || []).filter(p => {
                        const estadoValido = !['cobrado', 'cancelado', 'archivado', 'completado']
                          .includes(String(p.estado || '').toLowerCase());
                        const mesaMatch = String(p.mesa || '').trim().toLowerCase() ===
                          String(mesaActivaSelected?.num || mesaActivaSelected?.id).trim().toLowerCase()
                          || Number(p.mesa) === Number(mesaActivaSelected?.num || mesaActivaSelected?.id);
                        return estadoValido && mesaMatch;
                      });
                      const activeOrder = pedidosActivosDeMesa[0];
                      const esCredito = Boolean(activeOrder?.deudor || activeOrder?.es_credito || activeOrder?.tipo === 'credito' || mesaActivaSelected?.deudor);

                      if (esCredito) {
                        return (
                          <TouchableOpacity
                            onPress={() => {
                              if (setDeudorAbonoSelected) setDeudorAbonoSelected(mesaActivaSelected?.deudor || activeOrder?.deudor);
                              if (setMontoAbono) setMontoAbono('');
                              if (setMetodoAbono) setMetodoAbono('Efectivo');
                              if (setAbonoModalVisible) setAbonoModalVisible(true);
                            }}
                            style={{
                              flex: 1,
                              backgroundColor: '#2563EB',
                              paddingVertical: 12,
                              borderRadius: 8,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginHorizontal: 4
                            }}
                          >
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>💵 Abonar</Text>
                          </TouchableOpacity>
                        );
                      }

                      return (
                        <TouchableOpacity
                          onPress={() => {
                            if (activeOrder) {
                              const loadAndEdit = () => {
                                setPedidoEditando(activeOrder);
                                const itemsForCart = (activeOrder.items || []).map(item => {
                                  const prod = productos.find(p => p.nombre === item.nombre) || {};
                                  return {
                                    id: prod.id || ('temp_' + item.nombre),
                                    cat: item.cat || prod.cat,
                                    nombre: item.nombre,
                                    precio: item.precio || prod.precio || 0,
                                    precio_base: item.precio_base || prod.precio || 0,
                                    adicionales: item.adicionales || [],
                                    observaciones: item.observaciones || item.nota || '',
                                    desc: prod.desc || '',
                                    emoji: prod.emoji || '🍽️',
                                    cantidad: item.cantidad,
                                    nota: item.nota || item.observaciones || '',
                                    estado: item.estado || 'pendiente'
                                  };
                                });
                                setCarrito(itemsForCart);
                                setMesaSel(mesaActivaSelected);
                                setPaso(2);
                                setMesaActivaModalVisible(false);
                              };

                              if (mesaSel && mesaSel.num !== mesaActivaSelected.num && carrito.length > 0) {
                                Alert.alert(
                                  "Cambiar de Mesa",
                                  `¿Deseas descartar el pedido actual de la ${mesaSel.num}?`,
                                  [
                                    {
                                      text: "Sí, descartar",
                                      onPress: loadAndEdit
                                    },
                                    { text: "Cancelar", style: "cancel" }
                                  ]
                                );
                              } else {
                                loadAndEdit();
                              }
                            } else {
                              setMesaActivaModalVisible(false);
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: C.orange,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: 'white', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>✏️ Cargar comanda para añadir productos</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  }

  // PASO 2: Menú + Carrito
  return (
    <View style={{ flex: 1 }}>
      {/* Barra sup */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 8 }}>
        <TouchableOpacity
          style={s.btnGhost}
          onPress={() => {
            if (carrito.length > 0 && mesaSel) {
              guardarBorrador(mesaSel.num, carrito, !!pedidoEditando, pedidoEditando?.uuid);
              showToast(`📌 Borrador guardado: ${mesaSel.num}`);
            }
            setPaso(1);
          }}
        >
          <Text style={{ color: C.cream, fontSize: 13 }}>
            {pedidoEditando ? '⬅ Volver' : '⬅ Volver a Mesas'}
          </Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: undefined, fontWeight: "800", fontSize: 16, color: C.cream }}>
          Mesa {mesaSel?.num} {pedidoEditando ? '(Editando)' : ''}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Categorías scroll horizontal */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 10, gap: 8 }}
          style={{ flexGrow: 0 }}
        >
          {Array.from(new Set(productos.map(p => p.cat))).map(catVal => {
            const origCat = CATEGORIAS.find(c => c.id === Number(catVal));
            const catName = origCat ? origCat.nombre : String(catVal);
            return (
              <TouchableOpacity
                key={String(catVal)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: String(catActiva) === String(catVal) ? C.orange : "rgba(245,230,200,0.2)",
                  backgroundColor: String(catActiva) === String(catVal) ? C.orange : "rgba(245,230,200,0.07)",
                }}
                onPress={() => setCatActiva(catVal)}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: String(catActiva) === String(catVal) ? "700" : "500",
                    color: String(catActiva) === String(catVal) ? "white" : "rgba(245,230,200,0.7)",
                  }}
                  numberOfLines={1}
                >
                  {catName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Productos */}
        <View style={s.prodsGrid}>
          {prods.map(p => (
            <TouchableOpacity key={p.id} style={s.prodCard} onPress={() => iniciarAgregarProducto(p)}>
              {p.imagen ? (
                <Image
                  source={{ uri: `http://${serverIP}:3001${p.imagen}` }}
                  style={{ width: 80, height: 80, borderRadius: 12, marginBottom: 8 }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ fontSize: 28 }}>{p.emoji}</Text>
              )}
              <Text style={s.prodNombre}>{p.nombre}</Text>
              <Text style={s.prodDesc} numberOfLines={2}>{p.desc}</Text>
              <Text style={s.prodPrecio}>${p.precio.toLocaleString("es-CO")}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Carrito */}
        {carrito.length > 0 && (
          <View style={[s.card, { margin: 14, marginTop: 8 }]}>
            <View style={s.cardHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={s.cardTitle}>🛒 Pedido</Text>
                <View style={s.badgeOrange}><Text style={s.badgeTxt}>{count} ítems</Text></View>
              </View>
              {!pedidoEditando && (
                <TouchableOpacity
                  onPress={() => setCarrito([])}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: "rgba(220,38,38,0.1)", borderRadius: 6 }}
                >
                  <Ionicons name="trash-bin-outline" size={14} color={C.red} />
                  <Text style={{ fontSize: 11, color: C.red, fontWeight: "700" }}>Vaciar</Text>
                </TouchableOpacity>
              )}
            </View>
            {carrito.map((item, idx) => {
              const isLocked = item.estado === 'listo';
              return (
                <View key={idx}>
                  <View style={s.carritoItem}>
                    <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={s.carritoNombre}>{item.nombre}</Text>
                      {/* Lista de Adicionales en el ítem */}
                      {Array.isArray(item.adicionales) && item.adicionales.length > 0 && (
                        <View style={{ marginLeft: 6, marginTop: 2 }}>
                          {item.adicionales.map((adic, aIdx) => {
                            const keyUnica = adic?.id ? `adic-${adic.id}-${aIdx}` : `adic-${aIdx}`;
                            const nombre = typeof adic === 'string' ? adic : adic?.nombre;
                            const cant = typeof adic === 'object' && Number(adic?.cantidad) > 1 ? `(${adic.cantidad}x) ` : '';
                            if (!nombre) return null;
                            return (
                              <Text 
                                key={keyUnica} 
                                style={{ 
                                  fontSize: 12, 
                                  fontWeight: '600', 
                                  color: C.orange || '#d97706', 
                                  lineHeight: 16 
                                }}
                              >
                                + {cant}{nombre}
                              </Text>
                            );
                          })}
                        </View>
                      )}

                      {/* Observaciones para cocina */}
                      {Boolean(item.observaciones) && (
                        <Text style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginLeft: 6, marginTop: 2 }}>
                          📝 {item.observaciones}
                        </Text>
                      )}

                      {item.estado && (
                        <Text style={{ fontSize: 9, color: isLocked ? C.green : item.estado === 'preparando' ? C.orange : C.yellow, fontWeight: '700' }}>
                          {isLocked ? '✅ Listo' : item.estado === 'preparando' ? '🔥 Preparando' : '⏳ Pendiente'}
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => !isLocked && setCarrito(c => c.filter((_, i) => i !== idx))}
                        style={{ marginRight: 4, opacity: isLocked ? 0.3 : 1 }}
                        disabled={isLocked}
                      >
                        <Ionicons name="trash-outline" size={16} color={C.red} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.qtyBtn, { opacity: isLocked ? 0.3 : 1 }]}
                        onPress={() => !isLocked && cambiarQty(idx, item.estado, -1)}
                        disabled={isLocked}
                      >
                        <Text style={s.qtyBtnTxt}>−</Text>
                      </TouchableOpacity>
                      <Text style={s.qtyNum}>{item.cantidad}</Text>
                      <TouchableOpacity
                        style={[s.qtyBtn, { opacity: isLocked ? 0.3 : 1 }]}
                        onPress={() => !isLocked && cambiarQty(idx, item.estado, 1)}
                        disabled={isLocked}
                      >
                        <Text style={s.qtyBtnTxt}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 12, color: C.text2, minWidth: 64, textAlign: "right" }}>
                      ${(item.precio * item.cantidad).toLocaleString("es-CO")}
                    </Text>
                  </View>
                  <TextInput
                    style={[s.notaInput, { opacity: isLocked ? 0.6 : 1 }]}
                    placeholder={isLocked ? "Sin notas" : "Nota para cocina..."}
                    placeholderTextColor={C.text3}
                    value={item.nota}
                    editable={!isLocked}
                    onChangeText={t => setCarrito(c => c.map((it, i) => i === idx ? { ...it, nota: t } : it))}
                  />
                </View>
              );
            })}
            <View style={s.carritoTotal}>
              <Text style={{ fontSize: 13, color: C.text2 }}>Total</Text>
              <Text style={s.carritoTotalNum}>${total.toLocaleString("es-CO")}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, margin: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 1.5,
                  borderColor: C.border,
                  borderRadius: 10,
                  padding: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: 'transparent'
                }}
                onPress={() => {
                  if (mesaSel) {
                    eliminarBorrador(mesaSel.num);
                  }
                  setCarrito([]);
                  setPaso(1);
                  setMesaSel(null);
                  setPedidoEditando(null);
                }}
              >
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>❌ Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnPrimary, { flex: 2 }]} onPress={enviar}>
                <Text style={s.btnPrimaryTxt}>
                  {pedidoEditando ? 'Guardar Cambios ✏️' : 'Enviar a cocina 🔥'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* --- MODAL DE CONFIGURAR PRODUCTO (ADICIONALES Y NOTAS) --- */}
      <ModalAdicionales
        visible={prodConfigModalVisible}
        prodToConfig={prodToConfig}
        onClose={() => {
          setProdConfigModalVisible(false);
          setProdToConfig(null);
        }}
        adicionalesDisponibles={adicionalesDisponibles}
        configAdicionales={configAdicionales}
        handleSumarAdicionalMovil={handleSumarAdicionalMovil}
        handleRestarAdicionalMovil={handleRestarAdicionalMovil}
        configObservaciones={configObservaciones}
        setConfigObservaciones={setConfigObservaciones}
        configCantidad={configCantidad}
        setConfigCantidad={setConfigCantidad}
        onConfirmar={confirmarAgregarProducto}
      />
    </View>
  );
}

export const PedidoView = TomarPedidoScreen;
