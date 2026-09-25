const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

// --- PART 1: Logic Replacement ---
const logicRegex = /([ \t]*\/\/ Lógica de agrupación de catálogo\r?\n[ \t]*const catalogoAgrupado = \(CATEGORIAS \|\| \[\]\)\.map[\s\S]*?setCatExpandida\(prev => prev === catId \? null : catId\);\r?\n[ \t]*\};)/;

const logicReplacement = `  // 1. OBTENCIÓN SEGURA DE DATOS (Tolerante a nombres y tipos)
  const catsSeguras = Array.isArray(CATEGORIAS) ? CATEGORIAS : (Array.isArray(categorias) ? categorias : []);
  const prodsSeguros = Array.isArray(productos) ? productos : [];

  // Expandir la primera categoría por defecto si catExpandida es null
  const [catExpandida, setCatExpandida] = useState(catsSeguras[0]?.id || null);

  const catalogoAgrupado = catsSeguras.map(cat => ({
    ...cat,
    items: prodsSeguros.filter(p => {
      const pCat = p.cat ?? p.categoria_id ?? p.categoria;
      return Number(pCat) === Number(cat.id);
    })
  }));

  // Productos sin categoría asignada (para que nunca se pierda un producto)
  const prodsSinCat = prodsSeguros.filter(p => {
    const pCat = p.cat ?? p.categoria_id ?? p.categoria;
    return !catsSeguras.some(c => Number(c.id) === Number(pCat));
  });`;

if (content.match(logicRegex)) {
  content = content.replace(logicRegex, logicReplacement);
  console.log("Patched Part 1 (Logic) successfully");
} else {
  console.log("Target Part 1 not found");
}

// --- PART 2: UI Replacement ---
const uiRegex = /([ \t]*<View style=\{\{ flex: 1, paddingHorizontal: 14 \}\}>\r?\n[ \t]*\{renderBackHeader\('Gestión de Menú'\)\}\r?\n[ \t]*<ScrollView style=\{\{ flex: 1 \}\} contentContainerStyle=\{\{ paddingBottom: 16 \}\}>\r?\n[\s\S]*?[ \t]*<\/ScrollView>)/;

const uiReplacement = `        <View style={{ flex: 1, width: '100%', backgroundColor: '#1A120E', paddingHorizontal: 14 }}>
          {renderBackHeader('Gestión de Menú')}
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={true}
          >
            {/* Mensaje de seguridad si la base de datos no tiene productos */}
            {prodsSeguros.length === 0 && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#A08D84', fontSize: 16 }}>No hay productos registrados en el sistema.</Text>
              </View>
            )}

            {/* Acordeón de Categorías */}
            {catalogoAgrupado.map(cat => (
              <View 
                key={cat.id} 
                style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', backgroundColor: '#2C201A', borderWidth: 1, borderColor: '#3A2A22' }}
              >
                {/* Cabecera */}
                <TouchableOpacity 
                  onPress={() => setCatExpandida(prev => prev === cat.id ? null : cat.id)}
                  style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: 16, 
                    backgroundColor: '#3A2A22' 
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FFF' }}>
                    {cat.nombre} ({cat.items.length})
                  </Text>
                  <Text style={{ fontSize: 16, color: '#FF9800', fontWeight: 'bold' }}>
                    {catExpandida === cat.id ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {/* Contenido Desplegado */}
                {catExpandida === cat.id && (
                  <View style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                    {cat.items.length === 0 ? (
                      <Text style={{ color: '#888', fontStyle: 'italic', paddingVertical: 8 }}>Sin productos en esta categoría</Text>
                    ) : (
                      cat.items.map(prod => (
                        <View 
                          key={prod.id} 
                          style={{ 
                            flexDirection: 'row', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            paddingVertical: 12, 
                            borderBottomWidth: 1, 
                            borderColor: '#3A2A22' 
                          }}
                        >
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFF' }}>{prod.nombre}</Text>
                            <Text style={{ fontSize: 13, color: '#A08D84', marginTop: 2 }}>
                              \${Number(prod.precio || 0).toLocaleString()}
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            {/* Switch Activo */}
                            <TouchableOpacity
                              onPress={() => toggleProducto(prod.id, prod.disp)}
                              style={{
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                borderRadius: 6,
                                backgroundColor: prod.disp !== false ? '#2E7D32' : '#C62828'
                              }}
                            >
                              <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>
                                {prod.disp !== false ? 'ACTIVO' : 'INACTIVO'}
                              </Text>
                            </TouchableOpacity>

                            {/* Botón Editar */}
                            <TouchableOpacity 
                              onPress={() => abrirEdicion(prod)}
                              style={{ backgroundColor: '#FF9800', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }}
                            >
                              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>✏️ Editar</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            ))}

            {/* Grupo Residual: Productos sin categoría (si existen) */}
            {prodsSinCat.length > 0 && (
              <View style={{ marginTop: 10, padding: 12, backgroundColor: '#241915', borderRadius: 8 }}>
                <Text style={{ color: '#FF9800', fontWeight: 'bold', marginBottom: 8 }}>Otros Productos ({prodsSinCat.length})</Text>
                {prodsSinCat.map(prod => (
                  <View key={prod.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                    <Text style={{ color: '#FFF' }}>{prod.nombre} - \${Number(prod.precio || 0).toLocaleString()}</Text>
                    <TouchableOpacity onPress={() => abrirEdicion(prod)} style={{ backgroundColor: '#FF9800', padding: 6, borderRadius: 6 }}>
                      <Text style={{ color: '#FFF', fontSize: 12 }}>✏️</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>`;

if (content.match(uiRegex)) {
  content = content.replace(uiRegex, uiReplacement);
  console.log("Patched Part 2 (UI) successfully");
} else {
  console.log("Target Part 2 not found");
}

fs.writeFileSync('App.js', content, 'utf8');
