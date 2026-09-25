const fs = require('fs');

let content = fs.readFileSync('src/AdminModule.jsx', 'utf8');

const regex = /<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fill, minmax\(280px, 1fr\)\)', gap: '16px' \}\}>\s*<div \s*onClick=\{abrirModalNuevo\}\s*style=\{\{ padding: '20px', border: '2px dashed var\(--orange\)', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var\(--orange\)', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'rgba\(232, 82, 10, 0\.05\)', transition: 'all 0\.2s' \}\}\s*>\s*\+ Agregar Nuevo Producto\s*<\/div>/;

const replacement = `{/* Barra horizontal compacta superior */}
            <div style={{ marginBottom: '20px' }}>
              <div 
                onClick={abrirModalNuevo}
                style={{
                  border: '2px dashed #EA580C',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  color: '#EA580C',
                  fontWeight: '700',
                  fontSize: '15px',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(234, 88, 12, 0.04)',
                  transition: 'all 0.2s ease',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                + Agregar Nuevo Producto
              </div>
            </div>

            {/* Acordeón de Categorías a ancho completo debajo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/AdminModule.jsx', content, 'utf8');
console.log('Patched layout');
