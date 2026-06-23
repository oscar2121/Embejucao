const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// ─── CONFIGURACIÓN E INICIALIZACIÓN ───────────────────────

const LOG_FILE = path.join(__dirname, 'update_log.txt');
const CONFIG_FILE = path.join(__dirname, 'config.js');
const ENV_FILE = path.join(__dirname, '.env');
const PACKAGE_FILE = path.join(__dirname, 'package.json');

// Cargar variables de entorno desde .env manual
function loadEnv() {
  if (fs.existsSync(ENV_FILE)) {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        const key = parts[0].trim();
        let val = parts.slice(1).join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
}
loadEnv();

const GITHUB_OWNER = 'oscar2121';
const GITHUB_REPO = 'Embejucao';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Sistema de logging simple
function log(msg) {
  const timestamp = new Date().toISOString();
  const formattedMsg = `[${timestamp}] ${msg}\n`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, formattedMsg, 'utf8');
}

// ─── FUNCIONES AUXILIARES DE ACTUALIZACIÓN ─────────────────

// Comparador semántico de versiones (SemVer)
function isVersionNewer(local, remote) {
  const cleanLocal = local.replace(/^v/, '').split('.').map(Number);
  const cleanRemote = remote.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const l = cleanLocal[i] || 0;
    const r = cleanRemote[i] || 0;
    if (r > l) return true;
    if (l > r) return false;
  }
  return false;
}

// Petición GET HTTP/HTTPS nativa que retorna JSON
function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'Node-Updater',
        'Accept': 'application/vnd.github.v3+json',
        ...headers
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Error parseando JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

// Descarga de archivos binarios siguiendo redirecciones de S3 de forma segura
function downloadFile(url, destPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    function get(targetUrl) {
      const parsedUrl = new URL(targetUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'User-Agent': 'Node-Updater',
          ...headers
        }
      };

      https.get(options, (res) => {
        // Seguir redirección (común en S3 y GitHub assets)
        if (res.statusCode === 301 || res.statusCode === 302) {
          // IMPORTANTE: Al ser redirigido a AWS S3, debemos eliminar la cabecera Authorization.
          // Si enviamos la cabecera de GitHub a S3, este rechazará la descarga con un error 400.
          const redirectHeaders = { ...headers };
          delete redirectHeaders['Authorization'];
          get(res.headers.location);
        } else if (res.statusCode === 200) {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        } else {
          fs.unlink(destPath, () => {});
          reject(new Error(`Descarga fallida con código HTTP ${res.statusCode}`));
        }
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    get(url);
  });
}

// Extraer archivos usando PowerShell nativo en Windows
function extractZipWindows(zipPath, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  // Ejecutar comando de PowerShell para extraer y sobreescribir de forma silenciosa
  const command = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
  execSync(command, { stdio: 'ignore' });
}

// Copiar archivos de forma recursiva
function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  files.forEach((file) => {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  });
}

// Eliminar carpeta de forma recursiva (seguro en Node antiguo y nuevo)
function deleteFolderRecursiveSync(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursiveSync(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

// ─── PROCESO PRINCIPAL DE ACTUALIZACIÓN ───────────────────

async function run() {
  log('Checking for updates...');

  // 1. Obtener versión local
  if (!fs.existsSync(PACKAGE_FILE)) {
    log('❌ Error: No se encontró el archivo package.json local.');
    return;
  }
  const localPackage = require(PACKAGE_FILE);
  const localVersion = localPackage.version || '0.0.0';
  log(`Local Version: ${localVersion}`);

  // 2. Validar token
  if (!GITHUB_TOKEN || GITHUB_TOKEN === 'tu_token_personal_de_github_aqui') {
    log('⚠️ GITHUB_TOKEN no configurado en .env. Se saltará la comprobación de actualización.');
    return;
  }

  try {
    // 3. Consultar GitHub Releases
    const headers = { 'Authorization': `Bearer ${GITHUB_TOKEN}` };
    const latestRelease = await fetchJson(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      headers
    );

    const remoteTag = latestRelease.tag_name;
    const remoteVersion = remoteTag.replace(/^v/, '');
    log(`GitHub Latest Version: ${remoteVersion}`);

    // 4. Comparar versiones
    if (!isVersionNewer(localVersion, remoteVersion)) {
      log('✅ System is up to date.');
      return;
    }

    log(`🆕 Nueva versión disponible: v${remoteVersion}. Iniciando proceso de actualización...`);

    // 5. Encontrar el asset del servidor (.zip)
    const zipAsset = latestRelease.assets.find(a => a.name.toLowerCase().endsWith('.zip'));
    if (!zipAsset) {
      log('❌ Error: No se encontró ningún archivo .zip en la última release de GitHub.');
      return;
    }

    const tempZipPath = path.join(__dirname, 'temp_update.zip');
    const tempExtractDir = path.join(__dirname, 'temp_extracted');
    const backupsDir = path.join(__dirname, 'backups');
    const currentBackupDir = path.join(backupsDir, `backup_v${localVersion}_${Date.now()}`);

    // 6. Descargar el archivo ZIP
    log(`📥 Descargando actualización: ${zipAsset.name}...`);
    await downloadFile(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/assets/${zipAsset.id}`,
      tempZipPath,
      { ...headers, 'Accept': 'application/octet-stream' }
    );
    log('📥 Descarga completa.');

    // 7. Extraer ZIP en carpeta temporal
    log('📦 Extrayendo archivos...');
    extractZipWindows(tempZipPath, tempExtractDir);
    log('📦 Extracción completa.');

    // 8. Crear carpeta de Backup
    log(`💾 Creando copia de seguridad en: backups/${path.basename(currentBackupDir)}`);
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir);
    }
    fs.mkdirSync(currentBackupDir);

    // 9. Reemplazar archivos de forma segura
    // Leemos el contenido de los archivos extraídos y los movemos a la raíz
    const extractedFiles = fs.readdirSync(tempExtractDir);
    
    // Archivos y carpetas protegidos que NUNCA deben sobreescribirse ni borrarse
    const PROTECTED_FILES = [
      '.env',
      'embejucao.db',
      'node_modules',
      'backups',
      'update_log.txt',
      'temp_update.zip',
      'temp_extracted'
    ];

    extractedFiles.forEach(file => {
      // Ignorar si por error viene un archivo protegido
      if (PROTECTED_FILES.includes(file.toLowerCase())) {
        return;
      }

      const localPath = path.join(__dirname, file);
      const extractedPath = path.join(tempExtractDir, file);

      // Si el archivo ya existía localmente, le hacemos backup antes de sobreescribir
      if (fs.existsSync(localPath)) {
        const backupPath = path.join(currentBackupDir, file);
        if (fs.lstatSync(localPath).isDirectory()) {
          copyFolderRecursiveSync(localPath, backupPath);
        } else {
          fs.copyFileSync(localPath, backupPath);
        }
      }

      // Reemplazar local con el extraído
      if (fs.lstatSync(extractedPath).isDirectory()) {
        copyFolderRecursiveSync(extractedPath, localPath);
      } else {
        fs.copyFileSync(extractedPath, localPath);
      }
      log(`🔄 Actualizado: ${file}`);
    });

    // 10. Limpieza
    log('🧹 Limpiando archivos temporales...');
    fs.unlinkSync(tempZipPath);
    deleteFolderRecursiveSync(tempExtractDir);

    // 11. Ejecutar npm install si package.json cambió para instalar posibles dependencias nuevas
    const hasPackageBackup = fs.existsSync(path.join(currentBackupDir, 'package.json'));
    if (hasPackageBackup) {
      log('⚡ Detectado cambio en package.json. Instalando nuevas dependencias...');
      try {
        execSync('npm install', { stdio: 'inherit', cwd: __dirname });
        log('✅ Dependencias actualizadas con éxito.');
      } catch (errNpm) {
        log(`⚠️ Advertencia: Error ejecutando npm install: ${errNpm.message}`);
      }
    }

    log(`🎉 ¡Actualización a v${remoteVersion} completada con éxito! El sistema se reiniciará ahora.`);
    
    // Provocar salida con código especial 10 para indicar al script batch que se ha actualizado y debe reiniciar los servicios
    process.exit(10);

  } catch (error) {
    log(`❌ Error durante el proceso de actualización: ${error.message}`);
    // En caso de error, intentamos limpiar archivos temporales
    try {
      const tempZip = path.join(__dirname, 'temp_update.zip');
      const tempDir = path.join(__dirname, 'temp_extracted');
      if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
      if (fs.existsSync(tempDir)) deleteFolderRecursiveSync(tempDir);
    } catch (cleanError) {}
    process.exit(1);
  }
}

run();
