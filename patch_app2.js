const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Hook injection
const hookTarget = "const [adminTab, setAdminTab] = useState('principal');";
const hookReplacement = `const [adminTab, setAdminTab] = useState('principal');

  // Lógica de agrupación de catálogo
  const catalogoAgrupado = useMemo(() => {
    return (CATEGORIAS || []).map(cat => ({
      ...cat,
      items: (productos || []).filter(p => Number(p.cat) === Number(cat.id))
    }));
  }, [CATEGORIAS, productos]);

  const [catExpandida, setCatExpandida] = useState(null);
  const alternarCategoria = (catId) => {
    setCatExpandida(prev => prev === catId ? null : catId);
  };
  
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [prodEditando, setProdEditando] = useState(null);
  const [formEditNombre, setFormEditNombre] = useState('');
  const [formEditPrecio, setFormEditPrecio] = useState('');
  const [formEditCat, setFormEditCat] = useState('');
  const [formEditActivo, setFormEditActivo] = useState(1);

  const abrirEdicion = (prod) => {
    setProdEditando(prod);
    setFormEditNombre(prod.nombre || '');
    setFormEditPrecio(String(prod.precio || prod.precio_unitario || 0));
    setFormEditCat(String(prod.cat || ''));
    setFormEditActivo(prod.disp !== false ? 1 : 0);
    setModalEditarVisible(true);
  };

  const guardarCambiosProducto = async () => {
    if (!prodEditando) return;
    const precioSaneado = Number(formEditPrecio.replace(/[^0-9]/g, '')) || 0;
    
    const payload = {
      ...prodEditando,
      nombre: formEditNombre.trim(),
      precio: precioSaneado,
      cat: Number(formEditCat) || prodEditando.cat,
      activo: formEditActivo
    };

    try {
      await axios.put(\`http://\${serverIP}:3001/api/productos/\${prodEditando.id}\`, payload);
      setProductos(prev => prev.map(p => p.id === prodEditando.id ? { ...p, nombre: payload.nombre, precio: payload.precio, cat: payload.cat, disp: payload.activo === 1 } : p));
      setModalEditarVisible(false);
      setProdEditando(null);
      showToast("✅ Producto actualizado correctamente");
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      showToast("⚠️ Error al guardar producto");
    }
  };`;

content = content.replace(hookTarget, hookReplacement);

// 2. UI replacement (lines 4800 to 4845)
// The original App.js has this block:
const uiRegex = /<ScrollView style=\{\{ flex: 1 \}\} contentContainerStyle=\{\{ paddingBottom: 16 \}\}>\s*\{Object\.entries\([\s\S]*?<\/ScrollView>/;

const uiReplacement = `<ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {catalogoAgrupado.map(cat => (
              <View key={cat.id} style={{ marginBottom: 10, borderRadius: 8, overflow: 'hidden', backgroundColor: '#2C201A' }}>
                <TouchableOpacity 
                  onPress={() => alternarCategoria(cat.id)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#3A2A22' }}
                >
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FFF' }}>
                    {cat.nombre} ({cat.items.length})
                  </Text>
                  <Text style={{ fontSize: 16, color: '#FF9800', fontWeight: 'bold' }}>
                    {catExpandida === cat.id ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {catExpandida === cat.id && (
                  <View style={{ padding: 10 }}>
                    {cat.items.map(prod => (
                      <View key={prod.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#4A372D' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFF' }}>{prod.nombre}</Text>
                          <Text style={{ fontSize: 13, color: '#A08D84' }}>\${Number(prod.precio || 0).toLocaleString()}</Text>
                        </View>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: prod.disp !== false ? C.green : C.text3, fontWeight: '700', fontSize: 10, marginBottom: 6 }}>
                              {prod.disp !== false ? 'ACTIVO' : 'INACTIVO'}
                            </Text>
                            <TouchableOpacity
                              onPress={() => toggleProducto(prod.id, prod.disp)}
                              style={{
                                width: 40,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: prod.disp !== false ? C.green : '#D1D5DB',
                                justifyContent: 'center',
                                alignItems: prod.disp !== false ? 'flex-end' : 'flex-start',
                                padding: 2,
                              }}
                            >
                              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' }} />
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity 
                            onPress={() => abrirEdicion(prod)}
                            style={{ backgroundColor: '#FF9800', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }}
                          >
                            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>✏️ Editar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>`;

content = content.replace(uiRegex, uiReplacement);

// 3. Modal injection
const modalTarget = "{/* --- CONFIRMAR CANCELAR PEDIDO MODAL --- */}";
const modalReplacement = `{/* Modal de Edición Móvil */}
      <Modal visible={modalEditarVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#241915', padding: 20, borderRadius: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 16 }}>Editar Producto</Text>
            
            <Text style={{ color: '#A08D84', marginBottom: 4 }}>Nombre:</Text>
            <TextInput 
              value={formEditNombre} 
              onChangeText={setFormEditNombre} 
              style={{ backgroundColor: '#3A2A22', color: '#FFF', padding: 10, borderRadius: 8, marginBottom: 14 }} 
            />
            
            <Text style={{ color: '#A08D84', marginBottom: 4 }}>Precio:</Text>
            <TextInput 
              value={formEditPrecio} 
              keyboardType="numeric" 
              onChangeText={setFormEditPrecio} 
              style={{ backgroundColor: '#3A2A22', color: '#FFF', padding: 10, borderRadius: 8, marginBottom: 18 }} 
            />

            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => setModalEditarVisible(false)} style={{ padding: 10, borderRadius: 8, backgroundColor: '#4A372D' }}>
                <Text style={{ color: '#FFF' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={guardarCambiosProducto} style={{ padding: 10, borderRadius: 8, backgroundColor: '#FF9800' }}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- CONFIRMAR CANCELAR PEDIDO MODAL --- */}`;

content = content.replace(modalTarget, modalReplacement);

fs.writeFileSync('App.js', content);
console.log("Patched successfully");
