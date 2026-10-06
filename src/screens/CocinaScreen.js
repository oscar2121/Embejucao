import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet
} from 'react-native';
import { C, s, obtenerMinutosTranscurridos } from '../constants/theme';
import { esItemDeCocina, esBebidaCocina } from '../utils/cocinaFilter';

export default function CocinaScreen({
  pedidos = [],
  socket,
  onActualizar,
  onDespacharMesa,
  onMarcarTodosListos,
  marcarTodoListo,
  despacharMesa
}) {
  const handleMarcarTodosListos = onMarcarTodosListos || marcarTodoListo;
  const handleDespacharMesa = onDespacharMesa || despacharMesa;
  const handleActualizar = onActualizar || ((id, idx, estado) => {
    if (socket && typeof socket.emit === 'function') {
      socket.emit('actualizar_item_cocina', { id, itemIndex: idx, estado });
    }
  });

  const [ticker, setTicker] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTicker(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const pedidosEnCocina = (pedidos || []).filter(p => 
    !['cobrado', 'cancelado', 'archivado', 'completado'].includes(String(p?.estado || '').toLowerCase())
  );

  const pedidosCocina = pedidosEnCocina.map(p => {
    const rawItems = Array.isArray(p.items) ? p.items : [];
    const itemsConIdx = rawItems.map((it, idx) => ({ ...it, originalIdx: idx }));
    // Conservamos todos los ítems de cocina (sin filtrar por estado !== 'listo') para mantener la tarjeta en pantalla
    const itemsCocina = itemsConIdx.filter(esItemDeCocina).sort((a, b) => {
      const getTipo = (it) => (esBebidaCocina(it) ? 2 : 1);
      return getTipo(a) - getTipo(b);
    });
    return { ...p, itemsFiltered: itemsCocina };
  }).filter(p => p.itemsFiltered.length > 0);

  if (!pedidosCocina.length) {
    return (
      <View style={[s.content, { alignItems: "center", justifyContent: "center", flex: 1 }]}>
        <Text style={{ fontSize: 40 }}>🎉</Text>
        <Text style={{ color: C.cream2, marginTop: 10, fontSize: 15 }}>Todo al día — sin pedidos en Cocina</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text style={[s.sectionTitle]}>Panel de Cocina</Text>
        <View style={s.badgeOrange}><Text style={s.badgeTxt}>{pedidosCocina.length} pedidos</Text></View>
      </View>
      {pedidosCocina.map(p => {
        const todosListos = p.itemsFiltered.length > 0 && p.itemsFiltered.every(it => it.estado === 'listo');
        return (
          <View key={p.uuid || p.id} style={[s.card, { marginBottom: 14 }]}>
            <View style={[s.cardHeader, { backgroundColor: C.brand, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", fontSize: 17, color: C.cream }}>Mesa {p.mesa}</Text>
                <Text style={{ fontSize: 11, color: C.cream2, opacity: 0.7 }}>🕒 {p.hora}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {(() => {
                  const mins = obtenerMinutosTranscurridos(p.hora);
                  return (
                    <>
                      <View style={s.badgeYellow}>
                        <Text style={s.badgeTxt}>En cocina</Text>
                      </View>
                      {mins >= 15 && (
                        <View style={[s.badgeBase, { backgroundColor: C.red, marginLeft: 6 }]}>
                          <Text style={s.badgeTxt}>⚠️ DESPACHAR YA</Text>
                        </View>
                      )}
                    </>
                  );
                })()}
              </View>
            </View>
            <View style={{ padding: 12 }}>
              {(() => {
                const comidas = p.itemsFiltered.filter(it => !esBebidaCocina(it));
                const bebidas = p.itemsFiltered.filter(it => esBebidaCocina(it));

                const renderItem = (it) => (
                  <View
                    key={it.originalIdx}
                    style={{
                      backgroundColor: '#EFE6D8',
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 8,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={{ color: '#EA580C', fontWeight: 'bold', fontSize: 14 }}>×{it.cantidad}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937' }}>{it.nombre}</Text>
                        {Array.isArray(it.adicionales) && it.adicionales.length > 0 && (
                          <View style={{ marginLeft: 6, marginTop: 2 }}>
                            {it.adicionales.map((adic, aIdx) => {
                              const keyUnica = adic?.id ? `adic-${adic.id}-${aIdx}` : `adic-${aIdx}`;
                              const nombre = typeof adic === 'string' ? adic : adic?.nombre;
                              const cant = typeof adic === 'object' && Number(adic?.cantidad) > 1 ? `(${adic.cantidad}x) ` : '';
                              if (!nombre) return null;
                              return (
                                <Text key={keyUnica} style={{ fontSize: 12, fontWeight: '600', color: '#d97706' }}>
                                  + {cant}{nombre}
                                </Text>
                              );
                            })}
                          </View>
                        )}
                        {!!(it.nota || it.observaciones) && (
                          <Text style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic', marginTop: 2 }}>
                            📝 {it.nota || it.observaciones}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {(!it.estado || it.estado === 'pendiente') ? (
                        <TouchableOpacity
                          onPress={() => handleActualizar(p.uuid || p.id, it.originalIdx, 'listo')}
                          style={{ backgroundColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 }}
                        >
                          <Text style={{ color: '#475569', fontSize: 12, fontWeight: '600' }}>⏳ Pendiente</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleActualizar(p.uuid || p.id, it.originalIdx, 'pendiente')}
                          style={{ backgroundColor: '#DCFCE7', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 }}
                        >
                          <Text style={{ color: '#166534', fontSize: 12, fontWeight: 'bold' }}>✓ Listo</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );

                return (
                  <>
                    {comidas.length > 0 && (
                      <>
                        <Text style={{ fontSize: 13, fontWeight: "bold", color: C.text2, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>🍔 Comidas</Text>
                        {comidas.map(renderItem)}
                      </>
                    )}
                    {bebidas.length > 0 && (
                      <>
                        <Text style={{ fontSize: 13, fontWeight: "bold", color: C.text2, marginBottom: 8, marginTop: comidas.length > 0 ? 12 : 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>🥤 Bebidas</Text>
                        {bebidas.map(renderItem)}
                      </>
                    )}
                  </>
                );
              })()}

              {(() => {
                const todosListos = p.itemsFiltered.length > 0 && p.itemsFiltered.every(it => it.estado === 'listo');
                return (
                  <View style={{ marginTop: 10 }}>
                    {!todosListos ? (
                      <TouchableOpacity
                        style={{ backgroundColor: '#e2e8f0', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 }}
                        onPress={() => handleMarcarTodosListos && handleMarcarTodosListos(p)}
                      >
                        <Text style={{ color: '#334155', fontWeight: '700', fontSize: 13 }}>✓ Marcar Todo Listo</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={{ backgroundColor: '#16a34a', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 }}
                        onPress={() => handleDespacharMesa && handleDespacharMesa(p)}
                      >
                        <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>🚀 Despachar Mesa {p.mesa}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

export const CocinaView = CocinaScreen;
