import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal
} from 'react-native';
import { C, s } from '../constants/theme';

export default function ModalAdicionales({
  visible,
  prodToConfig,
  onClose,
  adicionalesDisponibles = [],
  configAdicionales = [],
  handleSumarAdicionalMovil,
  handleRestarAdicionalMovil,
  configObservaciones,
  setConfigObservaciones,
  configCantidad = 1,
  setConfigCantidad,
  onConfirmar
}) {
  if (!prodToConfig) return null;

  const textoAnalizar = `${prodToConfig?.categoria || ''} ${prodToConfig?.categoria_nombre || ''} ${prodToConfig?.nombre || ''}`.toLowerCase();
  const esBebida = ['bebida', 'jugo', 'cerveza', 'gaseosa', 'limonada', 'licor', 'cafe', 'agua'].some(p => textoAnalizar.includes(p));
  const tieneModificadores = (configAdicionales && configAdicionales.length > 0) || Boolean(configObservaciones && configObservaciones.trim());

  const cantidadNum = Math.max(1, Number(configCantidad) || 1);

  const totalCalculado = (
    (Number(prodToConfig?.precio || 0) + (configAdicionales || []).reduce((sum, a) => sum + (Number(a.precio || 0) * (Number(a.cantidad) || 1)), 0)) * cantidadNum
  );

  // Límite seguro y auto-correctivo para adicionales (sin alerts bloqueantes)
  const handleSumarSeguro = (adic) => {
    const itemSel = (configAdicionales || []).find(a => a.id === adic.id);
    const cantActual = itemSel ? (Number(itemSel.cantidad) || 1) : 0;
    const limiteItem = Number(adic?.limite || adic?.maximo || adic?.max) || 99;
    const limiteGlobal = Number(prodToConfig?.limite_adicionales || prodToConfig?.max_adicionales) || 99;
    const totalAdics = (configAdicionales || []).reduce((sum, a) => sum + (Number(a.cantidad) || 1), 0);

    if (cantActual >= limiteItem || totalAdics >= limiteGlobal) {
      return; // Silencioso y no bloqueante
    }

    if (handleSumarAdicionalMovil) {
      handleSumarAdicionalMovil(adic);
    }
  };

  const handleRestarSeguro = (adic) => {
    if (handleRestarAdicionalMovil) {
      handleRestarAdicionalMovil(adic);
    }
  };

  const handleCantidadManual = (txt) => {
    if (txt === '' || txt === null || txt === undefined) {
      setConfigCantidad(1);
      return;
    }
    const limpio = String(txt).replace(/[^0-9]/g, '');
    if (!limpio) {
      setConfigCantidad(1);
      return;
    }
    const val = parseInt(limpio, 10);
    setConfigCantidad(Math.min(99, Math.max(1, val || 1)));
  };

  return (
    <Modal visible={Boolean(visible)} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: C.border }}>
          <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.cream, flex: 1 }}>{prodToConfig.nombre}</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.orange }}>${(prodToConfig.precio || 0).toLocaleString("es-CO")}</Text>
          </View>
          <ScrollView style={{ padding: 18, maxHeight: 480 }} keyboardShouldPersistTaps="handled">

            {!esBebida && (
              <>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.text2, marginBottom: 8 }}>🌭 Adicionales Extra:</Text>
                <View style={{ gap: 8, marginBottom: 16 }}>
                  {(adicionalesDisponibles || []).map(adic => {
                    const itemSel = (configAdicionales || []).find(a => a.id === adic.id);
                    const cantidad = itemSel ? (Number(itemSel.cantidad) || 1) : 0;
                    const isSelected = cantidad > 0;

                    return (
                      <View
                        key={adic.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 12,
                          marginVertical: 4,
                          borderRadius: 8,
                          borderWidth: 1.5,
                          borderColor: isSelected ? C.orange : C.border,
                          backgroundColor: isSelected ? 'rgba(232,82,10,0.06)' : C.surf2
                        }}
                      >
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => handleSumarSeguro(adic)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontWeight: '700', color: C.text, fontSize: 14 }}>{adic.nombre}</Text>
                          <Text style={{ fontWeight: '700', color: C.orange, fontSize: 13, marginTop: 2 }}>
                            +${Number(adic.precio || 0).toLocaleString("es-CO")}
                          </Text>
                        </TouchableOpacity>

                        {isSelected ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => handleRestarSeguro(adic)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                backgroundColor: '#dc2626',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, lineHeight: 20 }}>-</Text>
                            </TouchableOpacity>

                            <Text style={{ minWidth: 20, textAlign: 'center', fontWeight: '700', fontSize: 15, color: C.text }}>
                              {cantidad}
                            </Text>

                            <TouchableOpacity
                              onPress={() => handleSumarSeguro(adic)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                backgroundColor: '#16a34a',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, lineHeight: 20 }}>+</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleSumarSeguro(adic)}
                            style={{
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 6,
                              backgroundColor: 'rgba(0,0,0,0.04)'
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b' }}>+ Añadir</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={{ fontSize: 13, fontWeight: '700', color: C.text2, marginBottom: 8 }}>📌 Observaciones para cocina:</Text>
            <TextInput
              style={[s.formInput, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Ej. Sin tomate, poca salsa..."
              placeholderTextColor={C.text3}
              value={configObservaciones}
              onChangeText={setConfigObservaciones}
              multiline={true}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: 12, backgroundColor: C.surf3, borderRadius: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>Cantidad:</Text>
              {tieneModificadores ? (
                <Text style={{ fontSize: 13, color: '#FF9800', fontWeight: 'bold' }}>Personalización individual (1)</Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <TouchableOpacity
                    onPress={() => setConfigCantidad(c => Math.max(1, (Number(c) || 1) - 1))}
                    style={{ padding: 8, backgroundColor: C.surf2, borderRadius: 8, width: 40, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: 'bold' }}>-</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{cantidadNum}</Text>
                  <TouchableOpacity
                    onPress={() => setConfigCantidad(c => Math.min(99, (Number(c) || 1) + 1))}
                    style={{ padding: 8, backgroundColor: C.surf2, borderRadius: 8, width: 40, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: 'bold' }}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 24, paddingBottom: 14 }}>
              <TouchableOpacity onPress={onClose} style={{ flex: 1, padding: 14, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' }}>
                <Text style={{ color: C.text, fontWeight: '700' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onConfirmar} style={{ flex: 1, padding: 14, borderRadius: 8, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
                  Añadir (${totalCalculado.toLocaleString("es-CO")})
                </Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
