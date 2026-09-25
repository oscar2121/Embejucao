const fs = require('fs');

let content = fs.readFileSync('src/AdminModule.jsx', 'utf8');

const regex = /\{\(\(\) => \{\r?\n[ \t]*const catalogoAgrupado = \(categorias \|\| \[\]\)\.map[\s\S]*?\r?\n[ \t]*\}\)\(\)\}/;

const replacement = `{(() => {
              const listaCategorias = Array.isArray(categorias) ? categorias : [];
              const listaProductos = Array.isArray(productos) ? productos : [];

              // Agrupación tolerante de productos
              const catalogoAgrupado = listaCategorias.map(cat => {
                const prodsDeCat = listaProductos.filter(p => {
                  const prodCatId = p.cat ?? p.categoria_id ?? p.categoria;
                  return Number(prodCatId) === Number(cat.id);
                });
                return {
                  ...cat,
                  items: prodsDeCat
                };
              });

              // Productos huérfanos o sin categoría asignada para no perder ninguno
              const productosSinCategoria = listaProductos.filter(p => {
                const prodCatId = p.cat ?? p.categoria_id ?? p.categoria;
                return !listaCategorias.some(c => Number(c.id) === Number(prodCatId));
              });

              return (
                <div className="admin-catalogo-contenedor" style={{ padding: '20px', width: '100%', boxSizing: 'border-box' }}>
                  {/* Si no hay productos en absoluto */}
                  {listaProductos.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                      <p style={{ fontSize: '16px' }}>No hay productos cargados en el sistema.</p>
                    </div>
                  )}

                  {/* Renderizado de Categorías en Acordeón */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {catalogoAgrupado.map(cat => (
                      <div key={cat.id} style={{ background: '#FFF', borderRadius: '10px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                        <div 
                          onClick={() => setCatExpandida(prev => prev === cat.id ? null : cat.id)}
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '14px 18px', 
                            background: '#F9FAFB', 
                            cursor: 'pointer',
                            borderBottom: catExpandida === cat.id ? '1px solid #E5E7EB' : 'none'
                          }}
                        >
                          <span style={{ fontWeight: '700', fontSize: '15px', color: '#111827' }}>
                            {cat.nombre} ({cat.items.length})
                          </span>
                          <span style={{ fontSize: '16px', color: '#4B5563' }}>
                            {catExpandida === cat.id ? '▲' : '▼'}
                          </span>
                        </div>

                        {catExpandida === cat.id && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', padding: '14px' }}>
                            {cat.items.length === 0 ? (
                              <p style={{ color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>Sin productos en esta categoría.</p>
                            ) : (
                              cat.items.map(prod => (
                                <div key={prod.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FAFAFA', borderRadius: '8px', border: '1px solid #F3F4F6' }}>
                                  <div>
                                    <div style={{ fontWeight: '600', color: '#1F2937' }}>{prod.nombre}</div>
                                    <div style={{ color: '#059669', fontWeight: '700', fontSize: '13px' }}>\${Number(prod.precio || 0).toLocaleString()}</div>
                                  </div>
                                  <button 
                                    onClick={() => abrirModalEditar(prod)} 
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#EA580C' }}
                                  >
                                    ✏️
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Grupo de productos sin categoría asignada si existen */}
                    {productosSinCategoria.length > 0 && (
                      <div style={{ background: '#FFF', borderRadius: '10px', border: '1px solid #E5E7EB', padding: '14px' }}>
                        <span style={{ fontWeight: '700', color: '#B45309' }}>Otros Productos sin categoría ({productosSinCategoria.length})</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginTop: '10px' }}>
                          {productosSinCategoria.map(prod => (
                            <div key={prod.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FAFAFA', borderRadius: '8px', border: '1px solid #F3F4F6' }}>
                              <div>
                                <div style={{ fontWeight: '600', color: '#1F2937' }}>{prod.nombre}</div>
                                <div style={{ color: '#059669', fontWeight: '700', fontSize: '13px' }}>\${Number(prod.precio || 0).toLocaleString()}</div>
                              </div>
                              <button onClick={() => abrirModalEditar(prod)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#EA580C' }}>✏️</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync('src/AdminModule.jsx', content, 'utf8');
  console.log("Patched AdminModule.jsx");
} else {
  console.log("Target not found");
}
