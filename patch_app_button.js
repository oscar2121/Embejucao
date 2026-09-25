const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');
const search = '<TouchableOpacity\\r\\n              onPress={() => setModalGastoVisible(true)}\\r\\n              style={{ backgroundColor: C.orange, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: \\'row\\', alignItems: \\'center\\', gap: 4 }}\\r\\n            >\\r\\n              <Ionicons name="add-circle" size={16} color="white" />\\r\\n              <Text style={{ color: \\'white\\', fontWeight: \\'700\\', fontSize: 12 }}>NUEVO GASTO</Text>\\r\\n            </TouchableOpacity>';
const replacement = \`<View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setModalHistorialCajasVisible(true)}
                style={{ backgroundColor: C.surf, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="time-outline" size={16} color={C.text2} />
                <Text style={{ color: C.text2, fontWeight: '700', fontSize: 12 }}>VER TURNOS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setModalGastoVisible(true)}
                style={{ backgroundColor: C.orange, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="add-circle" size={16} color="white" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>NUEVO GASTO</Text>
              </TouchableOpacity>
            </View>\`;
if (c.includes(search)) {
    c = c.replace(search, replacement);
    fs.writeFileSync('App.js', c);
    console.log('App.js updated successfully!');
} else {
    // try with regex
    c = c.replace(/<TouchableOpacity[\\s\\r\\n]+onPress=\{\(\) => setModalGastoVisible\(true\)\}[\\s\\r\\n]+style=\{\{ backgroundColor: C\.orange, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 \}\}[\\s\\r\\n]+>[\\s\\r\\n]+<Ionicons name="add-circle" size=\{16\} color="white" \/>[\\s\\r\\n]+<Text style=\{\{ color: 'white', fontWeight: '700', fontSize: 12 \}\}>NUEVO GASTO<\/Text>[\\s\\r\\n]+<\/TouchableOpacity>/, replacement);
    fs.writeFileSync('App.js', c);
    console.log('App.js updated successfully via regex!');
}
