const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

let serverProcess = null;
let ngrokProcess = null;

function startBackend() {
  const isPackaged = app.isPackaged;
  // En desarrollo el server esta en la carpeta padre. En produccion, esta en resources
  const serverPath = isPackaged 
    ? path.join(process.resourcesPath, 'server.js')
    : path.join(__dirname, '..', 'server.js');
    
  console.log("Levantando servidor Node en:", serverPath);
  
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    stdio: 'pipe',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });
  
  serverProcess.on('error', (err) => console.error("Error al iniciar serverProcess:", err));
  serverProcess.stdout.on('data', data => console.log(`Server: ${data}`));
  serverProcess.stderr.on('data', data => console.error(`Server Error: ${data}`));

  const authtoken = '3HkZltl26m4mtrULvL9FCkU3XVZ_77k13UozCab8kvYSxoW3K';
  const url = 'https://brisket-pregnant-squiggly.ngrok-free.dev';
  
  // En desarrollo ngrok esta en extraResources, en produccion en resources
  const ngrokExe = isPackaged 
    ? path.join(process.resourcesPath, 'ngrok.exe')
    : path.join(__dirname, '..', 'ngrok.exe');

  console.log("Levantando tnel Ngrok con binario en:", ngrokExe);
  ngrokProcess = spawn(ngrokExe, ['http', `--url=${url}`, `--authtoken=${authtoken}`, '3001'], {
    stdio: 'pipe',
    shell: false
  });
  
  ngrokProcess.on('error', (err) => console.error("Error al iniciar ngrokProcess:", err));
  ngrokProcess.stdout.on('data', data => console.log(`Ngrok: ${data}`));
  ngrokProcess.stderr.on('data', data => console.error(`Ngrok Error: ${data}`));
}

function stopBackend() {
  console.log("Apagando procesos de backend...");
  if (serverProcess) serverProcess.kill();
  if (ngrokProcess) ngrokProcess.kill();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    icon: path.join(__dirname, 'icon.png'),
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
  
  // IPC Handlers
  ipcMain.handle('get-printers', async () => {
    return await mainWindow.webContents.getPrintersAsync();
  });

  ipcMain.handle('print-receipt', async (event, htmlContent, printerName) => {
    return new Promise((resolve, reject) => {
      // Usar una ventana oculta para renderizar e imprimir
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: true }
      });
      
      const content = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { margin: 0; size: 80mm 297mm; }
            body { margin: 0; padding: 10px; font-family: monospace; font-size: 12px; width: 80mm; }
          </style>
        </head>
        <body>${htmlContent}</body>
        </html>
      `;

      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);
      
      printWindow.webContents.on('did-finish-load', () => {
        printWindow.webContents.print({
          silent: true,
          deviceName: printerName || undefined,
          margins: { marginType: 'none' },
          pageSize: { width: 80000, height: 297000 } // micrones
        }, (success, failureReason) => {
          printWindow.close();
          if (success) resolve({ success: true });
          else resolve({ success: false, reason: failureReason });
        });
      });
    });
  });
  ipcMain.handle('print-ip', async (event, text, ip, port = 9100) => {
    return new Promise((resolve) => {
      const client = new net.Socket();
      client.setTimeout(5000);
      
      client.connect(port, ip, () => {
        // Send ESC/POS Init
        client.write(Buffer.from([0x1B, 0x40]));
        // Send text (should be properly encoded, assuming basic ASCII/latin1)
        client.write(text, 'latin1');
        // Feed lines and cut
        client.write(Buffer.from([0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x10]));
        client.end();
        resolve({ success: true });
      });

      client.on('error', (err) => {
        resolve({ success: false, reason: err.message });
      });
      
      client.on('timeout', () => {
        client.destroy();
        resolve({ success: false, reason: 'Timeout' });
      });
    });
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  stopBackend();
});
