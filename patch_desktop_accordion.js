const fs = require('fs');

let content = fs.readFileSync('desktop-app/src/AdminModule.jsx', 'utf8');

// 1. Inject state
const stateRegex = /const \[modalPedidosActivosVisible, setModalPedidosActivosVisible\] = useState\(false\);/;
const stateReplacement = `const [modalPedidosActivosVisible, setModalPedidosActivosVisible] = useState(false);\n  const [catExpandida, setCatExpandida] = useState(null);`;

if(content.match(stateRegex)) {
  content = content.replace(stateRegex, stateReplacement);
}

// 2. Inject Accordion Layout
const layoutRegex = /\{productos\.map\(p => \([\s\S]*?\n\s*\}\)\}\s*<\/div>/;

const layoutReplacement = `{/* Agrupación en el componente */}
            {(() => {
              const catalogoAgrupado = (categorias || []).map(cat => ({
                ...cat,
                items: (productos || []).filter(p => Number(p.cat || p.categoria_id) === Number(cat.id))
              })).filter(cat => cat.items.length > 0);
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  {catalogoAgrupado.map(cat => (
                    <div key={cat.id} style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                      {/* Encabezado Acordeón */}
                      <div 
                        onClick={() => setCatExpandida(prev => prev === cat.id ? null : cat.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#F9FAFB', cursor: 'pointer', borderBottom: catExpandida === cat.id ? '1px solid #E5E7EB' : 'none' }}
                      >
                        <span style={{ fontWeight: '700', fontSize: '16px', color: '#1F2937' }}>
                          {cat.nombre} ({cat.items.length})
                        </span>
                        <span style={{ fontSize: '18px', color: '#6B7280' }}>
                          {catExpandida === cat.id ? '▲' : '▼'}
                        </span>
                      </div>

                      {/* Productos de la categoría expandida */}
                      {catExpandida === cat.id && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', padding: '16px' }}>
                          {cat.items.map(prod => (
                            <div key={prod.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #F3F4F6', borderRadius: '10px', background: '#FAFAFA' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '24px' }}>🍔</span>
                                <div>
                                  <div style={{ fontWeight: '600', color: '#111827' }}>{prod.nombre}</div>
                                  <div style={{ color: '#059669', fontWeight: '700', fontSize: '14px' }}>\${Number(prod.precio || 0).toLocaleString()}</div>
                                </div>
                              </div>
                              <button 
                                onClick={() => abrirModalEditar(prod)} 
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#EA580C' }}
                              >
                                ✏️
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
            </div>`;

if(content.match(layoutRegex)) {
  content = content.replace(layoutRegex, layoutReplacement);
  fs.writeFileSync('desktop-app/src/AdminModule.jsx', content, 'utf8');
  console.log("Patched AdminModule.jsx successfully");
} else {
  console.log("Target layout not found");
}
