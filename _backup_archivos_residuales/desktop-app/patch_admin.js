const fs = require('fs');
let content = fs.readFileSync('src/AdminModule.jsx', 'utf8');

// 1. Hook injection
const hookTarget = "const [adminTab, setAdminTab] = useState('dashboard');";
const hookReplacement = `const [adminTab, setAdminTab] = useState('dashboard');

  const CATEGORIAS = [
    { id: 1, nombre: "🍔 Hamburguesas" },
    { id: 2, nombre: "🌭 Perros Calientes" },
    { id: 3, nombre: "🌯 Burritos" },
    { id: 4, nombre: "🌭 Salchipapas" },
    { id: 5, nombre: "🌽 Mazorcada" },
    { id: 6, nombre: "🥤 Jugos Naturales" },
    { id: 7, nombre: " Limonadas" },
    { id: 8, nombre: " Bebidas / Cervezas" },
    { id: 9, nombre: "☕ Bebidas Calientes" },
  ];

  const catalogoAgrupado = useMemo(() => {
    return (CATEGORIAS || []).map(cat => ({
      ...cat,
      items: (productos || []).filter(p => Number(p.cat) === Number(cat.id))
    }));
  }, [productos]);

  const [catExpandida, setCatExpandida] = useState(null);
  const alternarCategoria = (catId) => {
    setCatExpandida(prev => prev === catId ? null : catId);
  };
`;
content = content.replace(hookTarget, hookReplacement);

// 2. UI replacement
const uiTargetRegex = /<div style={{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fill, minmax\(280px, 1fr\)\)', gap: '16px' }}>([\s\S]*?)<\/div>\s*<\/div>\s*\)\}/;
const uiReplacement = `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div 
                onClick={abrirModalNuevo}
                style={{ padding: '20px', border: '2px dashed var(--orange)', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--orange)', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'rgba(232, 82, 10, 0.05)', transition: 'all 0.2s' }}
              >
                + Agregar Nuevo Producto
              </div>
            </div>

            <div className="admin-catalogo-acordeon" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {catalogoAgrupado.map(cat => (
                <div key={cat.id} style={{ background: '#2C201A', borderRadius: '8px', overflow: 'hidden' }}>
                  <div 
                    onClick={() => alternarCategoria(cat.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: '#3A2A22', cursor: 'pointer' }}
                  >
                    <span style={{ fontWeight: 'bold', color: '#FFF' }}>{cat.nombre} ({cat.items.length})</span>
                    <span style={{ color: '#FF9800', fontWeight: 'bold' }}>{catExpandida === cat.id ? '▲' : '▼'}</span>
                  </div>

                  {catExpandida === cat.id && (
                    <div style={{ padding: '12px' }}>
                      {cat.items.map(prod => (
                        <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #4A372D' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', color: '#FFF' }}>{prod.nombre}</div>
                            <div style={{ color: '#A08D84', fontSize: '13px' }}>\${Number(prod.precio || 0).toLocaleString()}</div>
                          </div>
                          <button 
                            onClick={() => abrirModalEditar(prod)}
                            style={{ background: '#FF9800', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ✏️ Editar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}`;

content = content.replace(uiTargetRegex, uiReplacement);

fs.writeFileSync('src/AdminModule.jsx', content);
console.log("Patched successfully");
