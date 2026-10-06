const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

// The block starts around line 1071
const targetBlock = `        const savedIP = await AsyncStorage.getItem('serverIP');
        if (savedIP) {
          setServerIP(savedIP);
          updateGlobalApiUrl(savedIP);
          try {
            let testUrl = \`http://\${savedIP}:3001/health\`;
            if (savedIP.startsWith('http')) testUrl = \`\${savedIP}/health\`;
            const res = await axios.get(testUrl, { timeout: 1000 });
            if (res.status === 200 && res.data.status === 'ok') {
              setIpConfigured(true);
            }
          } catch (e) {
            console.log('Error conectando a la IP guardada:', e.message);
          }
        }`;

const replacementBlock = `        const savedIP = await AsyncStorage.getItem('serverIP');
        const defaultIP = "https://brisket-pregnant-squiggly.ngrok-free.dev";
        const ipToUse = savedIP || defaultIP;
        
        setServerIP(ipToUse);
        updateGlobalApiUrl(ipToUse);
        
        try {
          let testUrl = \`http://\${ipToUse}:3001/health\`;
          if (ipToUse.startsWith('http')) testUrl = \`\${ipToUse}/health\`;
          const res = await axios.get(testUrl, { timeout: 1500 });
          if (res.status === 200 && res.data.status === 'ok') {
            setIpConfigured(true);
          }
        } catch (e) {
          console.log('Error conectando a la IP guardada:', e.message);
        }`;

content = content.replace(targetBlock, replacementBlock);

fs.writeFileSync('App.js', content);
console.log('App.js fixed');
