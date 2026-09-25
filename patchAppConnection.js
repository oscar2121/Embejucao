const fs = require('fs');

const appFile = 'App.js';
let content = fs.readFileSync(appFile, 'utf8');

// 1. Add Queue logic at the top level
const syncFunction = `
// --- OFFLINE QUEUE MOBILE ---
const syncOfflineQueueMobile = async () => {
  try {
    const queueStr = await AsyncStorage.getItem('@offline_queue');
    if (!queueStr) return;
    const queue = JSON.parse(queueStr);
    if (queue.length === 0) return;
    
    console.log(\`Sincronizando \${queue.length} tareas pendientes desde mvil...\`);
    const remaining = [];
    for (let req of queue) {
      try {
        await axios({
          method: req.method,
          url: req.url,
          data: req.data,
          headers: req.headers || { 'ngrok-skip-browser-warning': 'true' },
          timeout: 10000
        });
      } catch (e) {
        remaining.push(req);
      }
    }
    await AsyncStorage.setItem('@offline_queue', JSON.stringify(remaining));
  } catch (e) {}
};

setInterval(syncOfflineQueueMobile, 10000);
// ----------------------------
`;

if (!content.includes('syncOfflineQueueMobile')) {
  content = content.replace("import io from 'socket.io-client';", "import io from 'socket.io-client';\n" + syncFunction);
}

// 2. Fix handleEnviarPedido (crearPedido)
const enviarPedidoFind = `        // Enviar a servidor
        try {
          const url = \`\${serverIP.startsWith('http') ? serverIP : \\\`http://\${serverIP}:3001\\\`}/api/pedidos\`;
          await axios.post(url, {
            uuid: pedidoId,
            mesa: mesaNum,
            hora: nueva.hora,
            items: items,
            fecha: new Date().toISOString().split('T')[0],
            usuario: loggedUser ? loggedUser.nombre : 'Mesero'
          }, { timeout: 15000 });
          showToast("o. Pedido " + (typeof mesaNum === 'string' && mesaNum.startsWith('Para') ? mesaNum : "Mesa " + mesaNum) + " enviado");
          sincronizar(); // Sincronizar inmediatamente
        } catch (e) {
          showToast("s? Guardado localmente - sin conexin");
          console.error('Error sending pedido:', e.message);
        }`;

const enviarPedidoReplace = `        // Enviar a servidor con doble va de persistencia (HTTP -> Socket -> OfflineQueue)
        const payloadPedido = {
          uuid: pedidoId,
          mesa: mesaNum,
          hora: nueva.hora,
          items: items,
          fecha: new Date().toISOString().split('T')[0],
          usuario: loggedUser ? loggedUser.nombre : 'Mesero'
        };
        const url = \`\${serverIP.startsWith('http') ? serverIP : \\\`http://\${serverIP}:3001\\\`}/api/pedidos\`;

        try {
          await axios.post(url, payloadPedido, { 
            timeout: 15000, 
            headers: { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' } 
          });
          showToast("✅ Pedido enviado (HTTP)");
          sincronizar();
        } catch (e) {
          console.error('Error HTTP enviando pedido:', e.message);
          
          // Fallback a Socket.io
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('crear_pedido', payloadPedido);
            showToast("✅ Pedido enviado (Socket de respaldo)");
          } else {
            showToast("⚠️ Guardado en Cola Offline - sin conexión");
            // Guardar en Offline Queue
            try {
              const queueStr = await AsyncStorage.getItem('@offline_queue');
              const queue = queueStr ? JSON.parse(queueStr) : [];
              queue.push({
                method: 'post',
                url: url,
                data: payloadPedido,
                headers: { 'ngrok-skip-browser-warning': 'true' }
              });
              await AsyncStorage.setItem('@offline_queue', JSON.stringify(queue));
            } catch (errQ) {
              console.error('Error guardando en cola offline:', errQ);
            }
          }
        }`;

content = content.replace(enviarPedidoFind, enviarPedidoReplace);

// 3. Fix Gastos
const gastosFind = `      const res = await axios.post(\`\${baseCol}/gastos\`, {
        descripcion: formGasto.descripcion,
        categoria: formGasto.categoria,
        valor: parseFloat(cleanNum(formGasto.valor)),
        sesion_id: 1, // o dinǭmico
        usuario: loggedUser ? loggedUser.nombre : 'Mobile'
      }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      
      if (res.data.success) {
        showToast("✅ Gasto registrado");
        setFormGasto({ descripcion: '', categoria: 'Proveedores', valor: '' });
        setModalGastoVisible(false);
        sincronizar(); // Para que el dashboard se entere
      }
    } catch (e) {
      showToast("❌ Error registrando gasto: " + e.message);
    }`;

const gastosReplace = `      const gastoUuid = 'gasto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const payloadGasto = {
        uuid: gastoUuid,
        descripcion: formGasto.descripcion,
        categoria: formGasto.categoria,
        valor: parseFloat(cleanNum(formGasto.valor)),
        sesion_id: 1, // o dinámico
        usuario: loggedUser ? loggedUser.nombre : 'Mobile'
      };

      try {
        const res = await axios.post(\`\${baseCol}/gastos\`, payloadGasto, { 
          timeout: 10000,
          headers: { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' } 
        });
        
        if (res.data.success) {
          showToast("✅ Gasto registrado (HTTP)");
          setFormGasto({ descripcion: '', categoria: 'Proveedores', valor: '' });
          setModalGastoVisible(false);
          sincronizar();
        }
      } catch (e) {
        console.error('Error HTTP registrando gasto:', e.message);
        
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('registrar_gasto', payloadGasto);
          showToast("✅ Gasto registrado (Socket de respaldo)");
          setFormGasto({ descripcion: '', categoria: 'Proveedores', valor: '' });
          setModalGastoVisible(false);
        } else {
          showToast("⚠️ Gasto en Cola Offline");
          try {
            const queueStr = await AsyncStorage.getItem('@offline_queue');
            const queue = queueStr ? JSON.parse(queueStr) : [];
            queue.push({
              method: 'post',
              url: \`\${baseCol}/gastos\`,
              data: payloadGasto,
              headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            await AsyncStorage.setItem('@offline_queue', JSON.stringify(queue));
            
            setFormGasto({ descripcion: '', categoria: 'Proveedores', valor: '' });
            setModalGastoVisible(false);
          } catch (errQ) {}
        }
      }
    } catch (globalError) {
      showToast("❌ Error general: " + globalError.message);
    }`;

content = content.replace(gastosFind, gastosReplace);

// 4. Update Header Indicator
// Find: <Text style={{ color: ipConfigured ? (isOnline ? '#10B981' : '#F59E0B') : '#EF4444', marginLeft: 6, fontWeight: 'bold' }}>
//   {ipConfigured ? (isOnline ? 'Online' : 'Conectando...') : 'Sin servidor'}
// </Text>
// Wait, the user said: "const estaConectado = socket.connected || apiOnline;"
const headerIndicadorFind = `<View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ipConfigured ? (isOnline ? '#10B981' : '#F59E0B') : '#EF4444' }} />
            <Text style={{ color: ipConfigured ? (isOnline ? '#10B981' : '#F59E0B') : '#EF4444', marginLeft: 6, fontWeight: 'bold' }}>
              {ipConfigured ? (isOnline ? 'Online' : 'Conectando...') : 'Sin servidor'}
            </Text>
          </View>`;

const headerIndicadorReplace = `{(() => {
            const estaConectado = (socketRef.current?.connected) || isOnline;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ipConfigured ? (estaConectado ? '#10B981' : '#F59E0B') : '#EF4444' }} />
                <Text style={{ color: ipConfigured ? (estaConectado ? '#10B981' : '#F59E0B') : '#EF4444', marginLeft: 6, fontWeight: 'bold' }}>
                  {ipConfigured ? (estaConectado ? 'Online (Híbrido)' : 'Conectando...') : 'Sin servidor'}
                </Text>
              </View>
            );
          })()}`;

content = content.replace(headerIndicadorFind, headerIndicadorReplace);

fs.writeFileSync(appFile, content, 'utf8');
console.log('App.js connection logic patched successfully');
