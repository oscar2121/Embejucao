import { BLEPrinter, NetPrinter } from "react-native-thermal-receipt-printer-image-qr";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ToastAndroid } from 'react-native';

const showToast = (msg) => ToastAndroid.show(msg, ToastAndroid.SHORT);

export const initPrinter = async () => {
  try {
    await BLEPrinter.init();
    await NetPrinter.init();
    const savedPrinter = await AsyncStorage.getItem('configuredPrinter');
    if (savedPrinter) {
      const printer = JSON.parse(savedPrinter);
      if (printer.type === 'ble') {
        connectBluetoothPrinter(printer.inner_mac_address || printer.mac_address);
      } else if (printer.type === 'net') {
        connectNetPrinter(printer.host, printer.port || 9100);
      }
    }
  } catch (error) {
    console.log("Printer init error", error);
  }
};

export const getBluetoothPrinters = async () => {
  try {
    const devices = await BLEPrinter.getDeviceList();
    return devices;
  } catch (error) {
    if (String(error).includes("bluetooth is not enabled")) {
      showToast("Por favor, enciende el Bluetooth primero.");
    } else {
      console.log("Error buscando impresoras:", error);
    }
    return [];
  }
};

export const connectBluetoothPrinter = async (macAddress) => {
  try {
    await BLEPrinter.connectPrinter(macAddress);
    showToast("Impresora conectada exitosamente (Bluetooth)");
    return true;
  } catch (error) {
    showToast("Error conectando a impresora Bluetooth");
    return false;
  }
};

export const connectNetPrinter = async (ip, port = 9100) => {
  try {
    await NetPrinter.connectPrinter(ip, port);
    showToast("Impresora conectada exitosamente (WiFi/IP)");
    return true;
  } catch (error) {
    showToast("Error conectando a impresora IP");
    return false;
  }
};

// Funciones para formato
const formatLine = (left, right = "", width = 48) => {
  if (!right) return left.padEnd(width, ' ');
  const spaces = width - left.length - right.length;
  if (spaces > 0) {
    return left + ' '.repeat(spaces) + right;
  }
  return left.substring(0, width - right.length - 1) + ' ' + right;
};

// ─── TICKET DE COCINA ───
export const printKitchenReceipt = async (pedido, mesaName, printerType = 'ble') => {
  try {
    const isNet = printerType === 'net';
    
    // Configurar texto para impresora 80mm
    let text = "<C><B>*** COCINA ***</B></C>\n\n";
    text += `Mesa: ${mesaName || 'Barra/Para Llevar'}\n`;
    text += `Fecha: ${new Date().toLocaleString('es-CO')}\n`;
    text += `------------------------------------------------\n`;

    // Agrupar Comidas y Bebidas
    const comidas = pedido.filter(p => !p.categoria || p.categoria < 6);
    const bebidas = pedido.filter(p => p.categoria >= 6);

    if (comidas.length > 0) {
      text += "<C>--- COMIDAS ---</C>\n";
      comidas.forEach(item => {
        text += `[${item.cantidad}] ${item.nombre}\n`;
        if (item.observaciones) {
          text += `    Nota: ${item.observaciones}\n`;
        }
      });
      text += "\n";
    }

    if (bebidas.length > 0) {
      text += "<C>--- BEBIDAS ---</C>\n";
      bebidas.forEach(item => {
        text += `[${item.cantidad}] ${item.nombre}\n`;
        if (item.observaciones) {
          text += `    Nota: ${item.observaciones}\n`;
        }
      });
    }

    text += "\n\n\n"; // Espacio para corte

    if (isNet) await NetPrinter.printText(text);
    else await BLEPrinter.printText(text);
    
  } catch (error) {
    console.error("Error imprimiendo cocina:", error);
  }
};

// ─── TICKET DE CLIENTE ───
export const printCustomerReceipt = async (total, metodoPago, detallesVenta, mesa, printerType = 'ble') => {
  try {
    const isNet = printerType === 'net';
    
    let text = "<C><B>EMBEJUCAO</B></C>\n";
    text += "<C>Ticket de Venta</C>\n\n";
    text += `Fecha: ${new Date().toLocaleString('es-CO')}\n`;
    text += `Mesa: ${mesa || 'N/A'}\n`;
    text += `Pago: ${metodoPago.toUpperCase()}\n`;
    text += `------------------------------------------------\n`;
    
    if (detallesVenta) {
      const items = JSON.parse(detallesVenta);
      items.forEach(item => {
        const line = formatLine(`${item.cantidad}x ${item.nombre.substring(0, 20)}`, `$${(item.precio * item.cantidad).toLocaleString('es-CO')}`);
        text += `${line}\n`;
      });
    }
    
    text += `------------------------------------------------\n`;
    text += `<R><B>TOTAL: $${total.toLocaleString('es-CO')}</B></R>\n`;
    text += `\n<C>¡Gracias por tu visita!</C>\n\n\n\n`;

    if (isNet) await NetPrinter.printText(text);
    else await BLEPrinter.printText(text);
  } catch (error) {
    console.error("Error imprimiendo cliente:", error);
  }
};
