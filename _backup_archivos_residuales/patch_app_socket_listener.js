const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

const regex = /socketRef\.current\.on\('mesas_actualizadas', \(nuevasMesas\) => \{\s*setMesas\(nuevasMesas\);\s*\}\);/;

const replacement = `socketRef.current.on('mesas_actualizadas', (nuevasMesas) => {
      setMesas(nuevasMesas);
    });

    socketRef.current.on('caja:estado', (data) => {
      setDashboardData(prev => ({
        ...prev,
        sesion: data.turno || { abierta: false }
      }));
    });`;

content = content.replace(regex, replacement);

fs.writeFileSync('App.js', content, 'utf8');
console.log('Patched App.js socket listener');
