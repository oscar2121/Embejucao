const fs = require('fs');

// Patch AdminModule.jsx
let adminContent = fs.readFileSync('desktop-app/src/AdminModule.jsx', 'utf8');

const targetAdmin = `<input
                    type="text"
                    placeholder="Ej. 2026-06-08"
                    value={auditFechaFilter}
                    onChange={(e) => setAuditFechaFilter(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', backgroundColor: 'var(--surf2)' }}
                  />`;

const replacementAdmin = `<input
                    type="date"
                    value={auditFechaFilter}
                    onChange={(e) => setAuditFechaFilter(e.target.value)}
                    style={{
                      backgroundColor: '#F5EBE1',
                      border: '1.5px solid #D4A373',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#333',
                      fontSize: '14px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  />`;

if (adminContent.includes(targetAdmin)) {
  adminContent = adminContent.replace(targetAdmin, replacementAdmin);
  fs.writeFileSync('desktop-app/src/AdminModule.jsx', adminContent);
  console.log("Patched AdminModule.jsx successfully");
} else {
  console.log("Admin target not found!");
}
