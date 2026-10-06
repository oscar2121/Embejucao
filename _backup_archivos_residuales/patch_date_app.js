const fs = require('fs');
let appContent = fs.readFileSync('App.js', 'utf8');

const appReplacement = `<TouchableOpacity 
                    onPress={abrirSelectorFecha}
                    style={{
                      backgroundColor: '#F5EBE1',
                      borderRadius: 8,
                      padding: 12,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: auditFechaFilter ? '#333' : '#999', fontSize: 14 }}>
                      {auditFechaFilter || 'Seleccionar fecha...'}
                    </Text>
                    <Text style={{ fontSize: 16 }}>📅</Text>
                  </TouchableOpacity>`;

const appRegex = /<TextInput[\s\r\n]*style=\{\[s\.formInput, \{ paddingVertical: 6 \}\]\}[\s\r\n]*placeholder="Ej\. 2026-06-08"[\s\r\n]*placeholderTextColor=\{C\.text3\}[\s\r\n]*value=\{auditFechaFilter\}[\s\r\n]*onChangeText=\{setAuditFechaFilter\}[\s\r\n]*\/>/;

const modalCode = `
      {/* Modal Fecha Auditoría Ligero */}
      <Modal visible={modalFechaVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFF', padding: 20, borderRadius: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Filtrar por Fecha</Text>
            
            <TouchableOpacity 
              onPress={() => { setAuditFechaFilter(new Date().toISOString().split('T')[0]); setModalFechaVisible(false); }}
              style={{ padding: 12, backgroundColor: '#F5EBE1', borderRadius: 8, marginBottom: 8 }}
            >
              <Text style={{ textAlign: 'center', color: '#333', fontWeight: 'bold' }}>Hoy</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { 
                const d = new Date(); d.setDate(d.getDate() - 1); 
                setAuditFechaFilter(d.toISOString().split('T')[0]); 
                setModalFechaVisible(false); 
              }}
              style={{ padding: 12, backgroundColor: '#F5EBE1', borderRadius: 8, marginBottom: 8 }}
            >
              <Text style={{ textAlign: 'center', color: '#333', fontWeight: 'bold' }}>Ayer</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { setAuditFechaFilter(''); setModalFechaVisible(false); }}
              style={{ padding: 12, backgroundColor: '#FFD7D7', borderRadius: 8, marginBottom: 16 }}
            >
              <Text style={{ textAlign: 'center', color: '#D32F2F', fontWeight: 'bold' }}>Borrar Filtro (Todas las fechas)</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalFechaVisible(false)} style={{ padding: 12, borderRadius: 8 }}>
              <Text style={{ textAlign: 'center', color: '#666' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
`;

if (appContent.match(appRegex)) {
  appContent = appContent.replace(appRegex, appReplacement);
  
  // Insert modal state and functions safely
  const auditStateRegex = /const \[auditFechaFilter, setAuditFechaFilter\] = useState\(''\);/;
  if (appContent.match(auditStateRegex)) {
    appContent = appContent.replace(
      auditStateRegex, 
      "const [auditFechaFilter, setAuditFechaFilter] = useState('');\\n  const [modalFechaVisible, setModalFechaVisible] = useState(false);\\n  const abrirSelectorFecha = () => setModalFechaVisible(true);"
    );
  }
  
  // Insert modal code safely
  const modalMatch = appContent.match(/\{\/\* --- CONFIRMAR CANCELAR PEDIDO MODAL --- \*\/\}/);
  if (modalMatch) {
    appContent = appContent.replace(modalMatch[0], modalCode + '\\n      ' + modalMatch[0]);
  }
  
  fs.writeFileSync('App.js', appContent, 'utf8');
  console.log("Patched App.js successfully");
} else {
  console.log("App.js target not found with regex");
}
