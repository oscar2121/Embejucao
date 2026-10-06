const fs = require('fs');
const path = require('path');

const sourceImage = 'C:\\Users\\oscar\\.gemini\\antigravity-ide\\brain\\159bae39-6bc2-4871-a969-b129900b646d\\.user_uploaded\\media_1789318387886.png';
const baseDir = __dirname;

// 1. Desktop App Icon
const desktopAppDir = path.join(baseDir, 'desktop-app');
fs.copyFileSync(sourceImage, path.join(desktopAppDir, 'icon.png'));

// Patch main.js
const mainJsPath = path.join(desktopAppDir, 'main.js');
let mainJs = fs.readFileSync(mainJsPath, 'utf8');
if (!mainJs.includes("icon: path.join(__dirname, 'icon.png')")) {
  mainJs = mainJs.replace(/const mainWindow = new BrowserWindow\({/, "const mainWindow = new BrowserWindow({\n    icon: path.join(__dirname, 'icon.png'),");
  fs.writeFileSync(mainJsPath, mainJs, 'utf8');
}

// 2. Android App Icons
const resDir = path.join(baseDir, 'android', 'app', 'src', 'main', 'res');
const mipmaps = ['mipmap-hdpi', 'mipmap-mdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];

mipmaps.forEach(folder => {
  const folderPath = path.join(resDir, folder);
  if (fs.existsSync(folderPath)) {
    fs.copyFileSync(sourceImage, path.join(folderPath, 'ic_launcher.png'));
    fs.copyFileSync(sourceImage, path.join(folderPath, 'ic_launcher_round.png'));
  }
});

console.log("Icons applied to Desktop and Android apps successfully!");
