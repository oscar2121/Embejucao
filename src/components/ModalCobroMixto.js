import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Switch,
  Keyboard
} from 'react-native';
import { C, s } from '../constants/theme';

export default function ModalCobroMixto({
  visible,
  pedidoSel,
  totalCuenta = 0,
  metodoPago = 'efectivo',
  setMetodoPago,
  efectivoMixto = '',
  setEfectivoMixto,
  nombreDeudor = '',
  setNombreDeudor,
  fiados = [],
  clientesGlobales = [],
  imprimirTicketCaja = false,
  setImprimirTicketCaja,
  onClose,
  onConfirmar
}) {
  const [efectivoEntregado, setEfectivoEntregado] = useState('');

  if (!pedidoSel) return null;

  // Cálculos dinámicos seguros en render
  const totalNum = Number(totalCuenta || pedidoSel?.total || 0);
  const efectivoNum = Number(efectivoMixto) || 0;
  const restanteTransferencia = Math.max(0, totalNum - efectivoNum);
  const errorEfectivoMixto = (metodoPago === 'mixto' && efectivoNum > totalNum) 
    ? 'El efectivo no puede ser mayor al total' 
    : '';
  const botonConfirmarDeshabilitado = metodoPago === 'mixto' && (efectivoNum <= 0 || efectivoNum > totalNum);

  // Cálculo de devuelta para efectivo normal
  const recibidoNum = Number(efectivoEntregado) || 0;
  const devueltaEfectivo = Math.max(0, recibidoNum - totalNum);

  const handleCambioEfectivo = (texto) => {
    // Permitir que el usuario borre todo el campo sin congelar el estado
    if (texto === '' || texto === null || texto === undefined) {
      setEfectivoMixto('');
      return;
    }

    // Limpiar todo lo que no sea número
    const soloNumeros = String(texto).replace(/[^0-9]/g, '');

    if (!soloNumeros) {
      setEfectivoMixto('');
      return;
    }

    // Guardar el número limpio. El cálculo de devuelta o restante
    // se hace dinámicamente en el render.
    setEfectivoMixto(soloNumeros);
  };

  const handleCambioEfectivoEntregado = (texto) => {
    if (texto === '' || texto === null || texto === undefined) {
      setEfectivoEntregado('');
      return;
    }
    const soloNumeros = String(texto).replace(/[^0-9]/g, '');
    setEfectivoEntregado(soloNumeros || '');
  };

  return (
    <Modal visible={Boolean(visible)} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: C.border }}>
          
          {/* Header */}
          <View style={{ backgroundColor: C.brand, padding: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream }}>
              Registrar Pago - {typeof pedidoSel.mesa === 'string' && pedidoSel.mesa.startsWith('Para') ? pedidoSel.mesa : `Mesa ${pedidoSel.mesa}`}
            </Text>
          </View>

          <ScrollView style={{ padding: 18, maxHeight: 480 }} keyboardShouldPersistTaps="handled">
            {/* Total */}
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 14 }}>
              Total Cuenta: {totalNum.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}
            </Text>

            {/* Selector de Métodos de Pago */}
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setMetodoPago('efectivo'); setEfectivoMixto(''); setNombreDeudor(''); Keyboard.dismiss(); }}
                style={[{ padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surf2 }, metodoPago === 'efectivo' && { borderColor: C.green, backgroundColor: 'rgba(45,106,63,0.05)' }]}
              >
                <Text style={{ fontWeight: '700', color: C.text }}>💵 Efectivo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setMetodoPago('transferencia'); setEfectivoMixto(''); setNombreDeudor(''); Keyboard.dismiss(); }}
                style={[{ padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surf2 }, metodoPago === 'transferencia' && { borderColor: C.orange, backgroundColor: 'rgba(232,82,10,0.05)' }]}
              >
                <Text style={{ fontWeight: '700', color: C.text }}>📲 Transferencia</Text>
              </TouchableOpacity>

              {!Boolean(pedidoSel?.deudor || pedidoSel?.uuids) && (
                <TouchableOpacity
                  onPress={() => { setMetodoPago('cortesia'); setEfectivoMixto(''); setNombreDeudor(''); Keyboard.dismiss(); }}
                  style={[{ padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surf2 }, metodoPago === 'cortesia' && { borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,0.1)' }]}
                >
                  <Text style={{ fontWeight: '700', color: C.text }}>🎁 Cortesía (Consumo Neutro)</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => { setMetodoPago('mixto'); setNombreDeudor(''); Keyboard.dismiss(); }}
                style={[{ padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surf2 }, metodoPago === 'mixto' && { borderColor: C.brand, backgroundColor: 'rgba(61,26,10,0.05)' }]}
              >
                <Text style={{ fontWeight: '700', color: C.text }}>💵 + 📲 Cobro Mixto</Text>
              </TouchableOpacity>

              {!Boolean(pedidoSel?.deudor || pedidoSel?.uuids) && (
                <TouchableOpacity
                  onPress={() => { setMetodoPago('fiado'); setEfectivoMixto(''); Keyboard.dismiss(); }}
                  style={[{ padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surf2 }, metodoPago === 'fiado' && { borderColor: C.yellow, backgroundColor: 'rgba(217,119,6,0.05)' }]}
                >
                  <Text style={{ fontWeight: '700', color: C.text }}>👤 Dar a Crédito (Anotar en Cuenta)</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Detalle para Cortesía */}
            {metodoPago === 'cortesia' && (
              <View style={{ marginTop: 14, padding: 12, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E', textAlign: 'center' }}>
                  🎁 Consumo de Cortesía
                </Text>
                <Text style={{ fontSize: 12, color: '#B45309', textAlign: 'center', marginTop: 4 }}>
                  El pedido se marcará como cobrado y se descontará del inventario. El ingreso a la caja será neutro ($0.00).
                </Text>
              </View>
            )}

            {/* Detalle para Efectivo (con cálculo de devuelta) */}
            {metodoPago === 'efectivo' && (
              <View style={{ marginTop: 14, paddingBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.text2, marginBottom: 8 }}>Efectivo entregado por cliente (opcional para cambio):</Text>
                <TextInput
                  style={[s.formInput, { fontSize: 18, fontWeight: 'bold' }]}
                  placeholder={`Ej. ${(totalNum + 10000).toLocaleString('es-CO')}`}
                  placeholderTextColor={C.text3}
                  keyboardType="numeric"
                  value={efectivoEntregado ? Number(efectivoEntregado).toLocaleString('es-CO') : ''}
                  onChangeText={handleCambioEfectivoEntregado}
                />
                {recibidoNum > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, padding: 12, backgroundColor: C.surf3, borderRadius: 8 }}>
                    <Text style={{ fontSize: 14, color: C.text, fontWeight: '600' }}>Cambio Entregado:</Text>
                    <Text style={{ fontSize: 16, color: devueltaEfectivo >= 0 ? C.green : C.red, fontWeight: '800' }}>
                      ${devueltaEfectivo.toLocaleString('es-CO')}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Detalle para Cobro Mixto */}
            {metodoPago === 'mixto' && (
              <View style={{ marginTop: 14, paddingBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.text2, marginBottom: 8 }}>Efectivo a recibir:</Text>
                <TextInput
                  style={[s.formInput, { fontSize: 18, fontWeight: 'bold' }, Boolean(errorEfectivoMixto) && { borderColor: C.red, borderWidth: 2 }]}
                  placeholder="Ej. 20000"
                  placeholderTextColor={C.text3}
                  keyboardType="numeric"
                  value={efectivoMixto ? Number(efectivoMixto).toLocaleString('es-CO') : ''}
                  onChangeText={handleCambioEfectivo}
                />
                {Boolean(errorEfectivoMixto) && (
                  <Text style={{ color: C.red, fontSize: 13, fontWeight: '700', marginTop: 6 }}>
                    ⚠️ {errorEfectivoMixto}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, padding: 12, backgroundColor: C.surf3, borderRadius: 8 }}>
                  <Text style={{ fontSize: 14, color: C.text, fontWeight: '600' }}>Restante por Transferencia:</Text>
                  <Text style={{ fontSize: 16, color: C.brand, fontWeight: '800' }}>
                    ${restanteTransferencia.toLocaleString('es-CO')}
                  </Text>
                </View>
              </View>
            )}

            {/* Detalle para Crédito / Fiado */}
            {metodoPago === 'fiado' && (
              <View style={{ marginTop: 14, paddingBottom: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.text2, marginBottom: 4 }}>Nombre del Cliente Deudor:</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="Escribe el nombre del cliente..."
                  placeholderTextColor={C.text3}
                  value={nombreDeudor}
                  onChangeText={setNombreDeudor}
                />

                {/* Selección Rápida de Clientes */}
                {(() => {
                  try {
                    const fiadosArr = Array.isArray(fiados) ? fiados : [];
                    const deudoresActivos = fiadosArr.map(f => (f && typeof f === 'object' && f.deudor) ? String(f.deudor).trim() : '').filter(d => d.length > 0);
                    const globalesSeguros = Array.isArray(clientesGlobales) ? clientesGlobales : [];
                    const deudoresExistentes = Array.from(new Set([...deudoresActivos, ...globalesSeguros]))
                      .filter(d => d && typeof d === 'string' && d.trim().length > 0)
                      .sort((a, b) => String(a).localeCompare(String(b)));

                    if (deudoresExistentes.length > 0) {
                      return (
                        <View style={{ marginTop: 10 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: C.text3, marginBottom: 6 }}>👥 Clientes registrados (Toca para seleccionar):</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                            {deudoresExistentes.map((name, idx) => (
                              <TouchableOpacity
                                key={idx}
                                onPress={() => { setNombreDeudor(String(name)); Keyboard.dismiss(); }}
                                style={{ backgroundColor: C.surf3, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.brand }}
                              >
                                <Text style={{ fontSize: 12, color: C.text, fontWeight: '700' }}>👤 {String(name)}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      );
                    }
                  } catch (e) {
                    console.error('Error render deudores:', e);
                  }
                  return null;
                })()}
              </View>
            )}

            {/* Imprimir Ticket */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>🧾 Imprimir recibo para cliente</Text>
              <Switch
                value={Boolean(imprimirTicketCaja)}
                onValueChange={setImprimirTicketCaja}
                thumbColor={imprimirTicketCaja ? C.green : '#f4f3f4'}
                trackColor={{ false: '#767577', true: 'rgba(45,106,63,0.5)' }}
              />
            </View>

            {/* Botones Acción */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, paddingBottom: 14 }}>
              <TouchableOpacity
                onPress={onClose}
                style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' }}
              >
                <Text style={{ color: C.text, fontWeight: '700' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={botonConfirmarDeshabilitado}
                onPress={onConfirmar}
                style={[
                  { flex: 1, padding: 12, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
                  botonConfirmarDeshabilitado && { backgroundColor: '#94a3b8', opacity: 0.6 }
                ]}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Confirmar</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
