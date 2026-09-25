const fs = require('fs');

let appContent = fs.readFileSync('App.js', 'utf8');

const targetAccordion = /<ScrollView style=\{\{ flex: 1 \}\} contentContainerStyle=\{\{ paddingBottom: 16 \}\}>[\s\S]*?<\/ScrollView>/;

const replacementAccordion = `<ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
  {catalogoAgrupado.map(cat => (
    <View key={cat.id} style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', backgroundColor: '#2C201A' }}>
      {/* Cabecera de la Categoría */}
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

      {/* Lista de Productos de la Categoría */}
      {catExpandida === cat.id && (
        <View style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
          {cat.items.map(prod => (
            <View 
              key={prod.id} 
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#4A372D' }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFF' }}>{prod.nombre}</Text>
                <Text style={{ fontSize: 13, color: '#A08D84' }}>\${Number(prod.precio || 0).toLocaleString()}</Text>
              </View>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {/* Switch Activo / Inactivo */}
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: prod.disp !== false ? '#4CAF50' : '#A08D84', fontWeight: '700', fontSize: 10, marginBottom: 4 }}>
                    {prod.disp !== false ? 'ACTIVO' : 'INACTIVO'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleProducto(prod.id, prod.disp)}
                    style={{
                      width: 38,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: prod.disp !== false ? '#4CAF50' : '#757575',
                      justifyContent: 'center',
                      alignItems: prod.disp !== false ? 'flex-end' : 'flex-start',
                      padding: 2,
                    }}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF' }} />
                  </TouchableOpacity>
                </View>

                {/* Botón Editar */}
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

if(appContent.match(targetAccordion)) {
  appContent = appContent.replace(targetAccordion, replacementAccordion);
  fs.writeFileSync('App.js', appContent, 'utf8');
  console.log("Patched successfully");
} else {
  console.log("Not found");
}
