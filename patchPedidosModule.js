const fs = require('fs');
const path = 'desktop-app/src/PedidosModule.jsx';
let code = fs.readFileSync(path, 'utf8');

const targetRegex = /<h3 style={{ fontSize: '16px', color: 'var\(--text-light\)', marginBottom: '12px' }}>🍟 Adicionales Extra:<\/h3>[\s\S]*?<\/div>/;

const replacement = `{(!prodToConfig.cat || Number(prodToConfig.cat) < 6) && (
              <>
                <h3 style={{ fontSize: '16px', color: 'var(--text-light)', marginBottom: '12px' }}>🍟 Adicionales Extra:</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  {adicionales.map(adic => {
                    const isSelected = configAdicionales.some(a => a.id === adic.id);
                    return (
                      <div
                        key={adic.id}
                        onClick={() => {
                          if (isSelected) setConfigAdicionales(prev => prev.filter(a => a.id !== adic.id));
                          else setConfigAdicionales(prev => [...prev, adic]);
                        }}
                        style={{
                          display: 'flex', justifyContent: 'space-between', padding: '12px', 
                          border: \`2px solid \${isSelected ? 'var(--orange)' : 'var(--border)'}\`, 
                          borderRadius: '8px', cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(232,82,10,0.05)' : 'var(--surf2)'
                        }}
                      >
                        <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>{adic.nombre}</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--orange)' }}>+{formatCurrency(adic.precio)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}`;

if (targetRegex.test(code)) {
  code = code.replace(targetRegex, replacement);
  fs.writeFileSync(path, code);
  console.log("Success");
} else {
  console.log("Target section not found");
}
