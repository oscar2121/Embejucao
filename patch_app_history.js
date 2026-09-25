const fs = require('fs');
let code = fs.readFileSync('App.js', 'utf8');

const stateInjection = `const [modalHistorialCajasVisible, setModalHistorialCajasVisible] = useState(false);
  const [historialCajas, setHistorialCajas] = useState([]);
  const [historialCajasFecha, setHistorialCajasFecha] = useState('');
  const [cajaSeleccionada, setCajaSeleccionada] = useState(null);
  const [modalCajaDetalleVisible, setModalCajaDetalleVisible] = useState(false);

  const cargarHistorialCajas = async () => {
    try {
      let url = \`\${serverIP}/api/caja/historial-sesiones\`;
      if (historialCajasFecha) url += \`?fecha=\${historialCajasFecha}\`;
      const res = await axios.get(url);
      setHistorialCajas(res.data.sesiones || []);
    } catch (e) {
      console.warn('Error al cargar historial cajas', e);
    }
  };

  const abrirDetalleCaja = async (sesionId) => {
    try {
      const res = await axios.get(\`\${serverIP}/api/caja/sesion/\${sesionId}/detalle\`);
      setCajaSeleccionada(res.data);
      setModalCajaDetalleVisible(true);
    } catch (e) {
      Alert.alert('Error', 'No se pudo cargar el detalle del turno');
    }
  };

  useEffect(() => {
    if (modalHistorialCajasVisible) {
      cargarHistorialCajas();
    }
  }, [modalHistorialCajasVisible, historialCajasFecha]);
`;

code = code.replace("const [modalGastoVisible, setModalGastoVisible] = useState(false);", "const [modalGastoVisible, setModalGastoVisible] = useState(false);\n  " + stateInjection);

const targetButtons = `<TouchableOpacity
              onPress={() => setModalGastoVisible(true)}
              style={{ backgroundColor: C.orange, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}`;

const injectedButtons = `<View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setModalHistorialCajasVisible(true)}
                style={{ backgroundColor: C.surf, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="time-outline" size={16} color={C.text2} />
                <Text style={{ color: C.text2, fontWeight: '700', fontSize: 12 }}>HISTORIAL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setModalGastoVisible(true)}
                style={{ backgroundColor: C.orange, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}`;

if (code.includes(targetButtons)) {
  code = code.replace(targetButtons, injectedButtons);
} else {
  console.log("targetButtons not found!");
}

const modalInjection = `
      {/* ─── MODAL HISTORIAL DE CAJAS ─── */}
      <Modal visible={modalHistorialCajasVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', height: '80%', backgroundColor: C.bg, borderRadius: 16, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: C.brand }}>Historial de Turnos</Text>
              <TouchableOpacity onPress={() => setModalHistorialCajasVisible(false)}>
                <Ionicons name="close" size={24} color={C.text3} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16, flexDirection: 'row', gap: 8, alignItems: 'center', borderBottomWidth: 1, borderColor: C.border }}>
              <TextInput
                style={{ flex: 1, backgroundColor: C.surf, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: C.text }}
                placeholder="Filtrar fecha (YYYY-MM-DD)..."
                placeholderTextColor={C.text3}
                value={historialCajasFecha}
                onChangeText={setHistorialCajasFecha}
              />
              <TouchableOpacity onPress={() => setHistorialCajasFecha('')} style={{ padding: 8, backgroundColor: C.border, borderRadius: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold' }}>Limpiar</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={historialCajas}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => abrirDetalleCaja(item.id)} style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: C.border, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: C.brand }}>Turno #{item.id}</Text>
                    <View style={{ backgroundColor: item.estado === 'abierta' ? C.green : C.border, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: item.estado === 'abierta' ? 'white' : C.text2 }}>{item.estado.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: C.text2 }}>Apertura: {item.fecha_apertura}</Text>
                  {item.fecha_cierre && <Text style={{ fontSize: 12, color: C.text2 }}>Cierre: {item.fecha_cierre}</Text>}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border, borderStyle: 'dashed' }}>
                    <Text style={{ fontSize: 12, color: C.text3 }}>Ventas: {formatCurrency(item.total_ventas)}</Text>
                    <Text style={{ fontSize: 12, color: C.text3 }}>Gastos: {formatCurrency(item.total_gastos)}</Text>
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: item.balance_neto >= 0 ? C.green : C.red, marginTop: 4 }}>
                    Balance: {formatCurrency(item.balance_neto)}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={{ textAlign: 'center', color: C.text3, marginTop: 40 }}>No hay turnos registrados</Text>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ─── MODAL DETALLE DE CAJA (HISTORIAL) ─── */}
      <Modal visible={modalCajaDetalleVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', height: '85%', backgroundColor: '#fdfdfd', borderRadius: 16, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: C.brand }}>Detalle Turno #{cajaSeleccionada?.sesion?.id}</Text>
              <TouchableOpacity onPress={() => setModalCajaDetalleVisible(false)}>
                <Ionicons name="close" size={24} color={C.text3} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
              {cajaSeleccionada && (
                <>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1, backgroundColor: C.surf, padding: 16, borderRadius: 12 }}>
                      <Text style={{ fontSize: 10, color: C.text2, fontWeight: 'bold', marginBottom: 4 }}>INGRESOS</Text>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: C.green }}>{formatCurrency(cajaSeleccionada.sesion.total_ventas)}</Text>
                      <Text style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Efectivo: {formatCurrency(cajaSeleccionada.sesion.total_efectivo)}</Text>
                      <Text style={{ fontSize: 11, color: C.text3 }}>Transf: {formatCurrency(cajaSeleccionada.sesion.total_transferencia)}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: C.surf, padding: 16, borderRadius: 12 }}>
                      <Text style={{ fontSize: 10, color: C.text2, fontWeight: 'bold', marginBottom: 4 }}>EGRESOS</Text>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: C.red }}>{formatCurrency(cajaSeleccionada.sesion.total_gastos)}</Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: cajaSeleccionada.sesion.balance_neto >= 0 ? '#f0fdf4' : '#fef2f2', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: cajaSeleccionada.sesion.balance_neto >= 0 ? '#bbf7d0' : '#fecaca', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: cajaSeleccionada.sesion.balance_neto >= 0 ? '#166534' : '#991b1b' }}>BALANCE NETO</Text>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: cajaSeleccionada.sesion.balance_neto >= 0 ? '#166534' : '#991b1b' }}>{formatCurrency(cajaSeleccionada.sesion.balance_neto)}</Text>
                  </View>

                  {cajaSeleccionada.gastos && cajaSeleccionada.gastos.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.brand, marginBottom: 8 }}>Gastos Registrados</Text>
                      {cajaSeleccionada.gastos.map(g => (
                        <View key={g.id} style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 8 }}>
                          <Text style={{ fontSize: 13, color: C.text }}>{g.descripcion}</Text>
                          <Text style={{ fontSize: 13, fontWeight: 'bold', color: C.red }}>{formatCurrency(g.valor)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
`;

// Insert the modals before the end of the return statement
code = code.replace("{/* ─── MODAL FIAR PEDIDO ─── */}", modalInjection + "\n      {/* ─── MODAL FIAR PEDIDO ─── */}");

fs.writeFileSync('App.js', code);
console.log('App.js successfully updated');
