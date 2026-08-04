import { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, SafeAreaView,
  StatusBar, Alert, Animated, FlatList, Modal, Switch, BackHandler, Linking,
  Vibration, AppState
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import axios from 'axios';

import Ionicons from 'react-native-vector-icons/Ionicons';
import Sound from 'react-native-sound';
Sound.setCategory('Playback');
import KeepAwake from 'react-native-keep-awake';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import io from 'socket.io-client';
import PushNotification from 'react-native-push-notification';

PushNotification.configure({
  onNotification: function (notification) {
    console.log("NOTIFICACIÓN RECIBIDA:", notification);
  },
  popInitialNotification: true,
  requestPermissions: false,
});







// ============================================================
// COLORES
// ============================================================
const C = {
  brand: "#3D1A0A",
  mid: "#7B3B1A",
  orange: "#E8520A",
  orangeL: "#FF6B2B",
  cream: "#F5E6C8",
  cream2: "#EDD9A3",
  surface: "#FBF5E8",
  surf2: "#F2E8D0",
  surf3: "#E8D8B8",
  text: "#1C0A02",
  text2: "#6B4A30",
  text3: "#A88060",
  border: "rgba(61,26,10,0.12)",
  green: "#2D6A3F",
  greenL: "#4CAF70",
  yellow: "#D97706",
  red: "#DC2626",
};

// -------------------------------------------------------------------
// UTILIDAD DE TIEMPO
// -------------------------------------------------------------------
/**
 * Calcula los minutos transcurridos desde la hora del pedido hasta el momento actual.
 * Acepta formatos de 12h (ej. "06:13 p. m.", "10:20 a. m.") o 24h ("18:30").
 */
// ============================================================
// AUXILIAR: CALCULAR MINUTOS TRANSCURRIDOS DESDE EL PEDIDO
// ============================================================
const obtenerMinutosTranscurridos = (horaPedidoString) => {
  if (!horaPedidoString) return 0;
  try {
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    let [tiempo, ampm] = horaPedidoString.toLowerCase().split(/( [ap]\.?\s*m\.?)/);
    let [horas, minutos] = tiempo.split(':').map(Number);
    if (isNaN(horas) || isNaN(minutos)) return 0;
    if (ampm) {
      if (ampm.includes('p') && horas < 12) horas += 12;
      if (ampm.includes('a') && horas === 12) horas = 0;
    }
    const minutosPedido = horas * 60 + minutos;
    const diferencia = minutosAhora - minutosPedido;
    return diferencia < 0 ? 0 : diferencia;
  } catch (e) {
    return 0;
  }
};


const APP_VERSION = "1.0.0"; // Versión actual de la app móvil (APK)

// Comparador de versiones semánticas en el cliente
const isVersionNewerMobile = (local, remote) => {
  if (!remote) return false;
  const cleanLocal = local.replace(/^v/, '').split('.').map(Number);
  const cleanRemote = remote.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const l = cleanLocal[i] || 0;
    const r = cleanRemote[i] || 0;
    if (r > l) return true;
    if (l > r) return false;
  }
  return false;
};

// API CONFIG
let API_URL = 'http://10.184.210.145/api'; // Cambiarla dinámicamente
const SYNC_INTERVAL = 5000; // Sincronizar cada 5 segundos

// Función para cambiar la IP
const setServerIP = (ip) => {
  API_URL = `http://${ip}:3001/api`;
};

// ============================================================
// DATOS INICIALES
// ============================================================
const CATEGORIAS = [
  { id: 1, nombre: "🍔 Hamburguesas" },
  { id: 2, nombre: "🌭 Perros Calientes" },
  { id: 3, nombre: "🌯 Burritos" },
  { id: 4, nombre: "🍟 Salchipapas" },
  { id: 5, nombre: "🌽 Mazorcada" },
  { id: 6, nombre: "🥤 Jugos Naturales" },
  { id: 7, nombre: "🍋 Limonadas" },
  { id: 8, nombre: "🍺 Bebidas / Cervezas" },
];

const PRODUCTOS_INICIAL = [
  { id: 101, cat: 1, nombre: "Clásica", precio: 16000, desc: "Pan artesanal, 125g carne res, queso, vegetales, cebolla en salsa, papa chip", emoji: "🍔", disp: true },
  { id: 102, cat: 1, nombre: "Especial", precio: 18000, desc: "Pan artesanal, tocineta, plátano maduro, queso, vegetales, papa chip", emoji: "🍔", disp: true },
  { id: 103, cat: 1, nombre: "Doble Carne", precio: 22000, desc: "Pan artesanal, 250g carne res, queso, vegetales, cebolla en salsa, papa chip", emoji: "🍔", disp: true },
  { id: 104, cat: 1, nombre: "Mexicana", precio: 18000, desc: "Pan artesanal, carne res, pico de gallo, nachos, jalapeños", emoji: "🍔", disp: true },
  { id: 201, cat: 2, nombre: "Sencillo", precio: 13000, desc: "Pan artesanal, salchicha, cebolla en salsa, papa chip, queso gratinado con maíz dulce", emoji: "🌭", disp: true },
  { id: 202, cat: 2, nombre: "Choriperro", precio: 14000, desc: "Pan artesanal, chorizo, tocineta, cebolla en salsa, papa chip y queso gratinado", emoji: "🌭", disp: true },
  { id: 203, cat: 2, nombre: "Especial", precio: 16000, desc: "Pan artesanal, salchicha ranchera, plátano, tocineta, papa chip, queso gratinado", emoji: "🌭", disp: true },
  { id: 301, cat: 3, nombre: "Burrito Carne", precio: 16000, desc: "Carne desmechada, plátano maduro, queso, salchicha y maíz dulce", emoji: "🌯", disp: true },
  { id: 302, cat: 3, nombre: "Burrito Pollo", precio: 16000, desc: "Pollo desmechado, plátano maduro, queso, salchicha y maíz dulce", emoji: "🌯", disp: true },
  { id: 303, cat: 3, nombre: "Burrito Mixto", precio: 16000, desc: "Carne y pollo desmechado, plátano maduro, queso, salchicha y maíz dulce", emoji: "🌯", disp: true },
  { id: 401, cat: 4, nombre: "Sencilla", precio: 13000, desc: "300g papa francesa, salchicha y queso gratinado con maíz dulce", emoji: "🍟", disp: true },
  { id: 402, cat: 4, nombre: "Especial", precio: 20000, desc: "Papa francesa, carne, pollo, lechuga, papa chip, tocineta, chorizo, queso gratinado, salsa de la casa", emoji: "🍟", disp: true },
  { id: 501, cat: 5, nombre: "Mazorcada Especial", precio: 20000, desc: "Maíz dulce, salchicha, pollo, carne desmechada, tocineta, papa chip, salsa de la casa", emoji: "🌽", disp: true },
  { id: 601, cat: 6, nombre: "Jugo Agua 12oz", precio: 9000, desc: "Mandarina, Maracuyá, Lulo, Mora, Naranja, Mango, Guanábana o Fresa", emoji: "🥤", disp: true },
  { id: 602, cat: 6, nombre: "Jugo Agua 16oz", precio: 12000, desc: "Mandarina, Maracuyá, Lulo, Mora, Naranja, Mango, Guanábana o Fresa", emoji: "🥤", disp: true },
  { id: 603, cat: 6, nombre: "Jugo Leche 12oz", precio: 11000, desc: "Mandarina, Maracuyá, Lulo, Mora, Naranja, Mango, Guanábana o Fresa", emoji: "🥛", disp: true },
  { id: 604, cat: 6, nombre: "Jugo Leche 16oz", precio: 13000, desc: "Mandarina, Maracuyá, Lulo, Mora, Naranja, Mango, Guanábana o Fresa", emoji: "🥛", disp: true },
  { id: 605, cat: 6, nombre: "Jugo Combinado", precio: 9000, desc: "Sandía-Fresa-Limón / Maracuyá-Mango / Manzana-Piña-Hierbabuena", emoji: "🍹", disp: true },
  { id: 701, cat: 7, nombre: "Limonada Mango 12oz", precio: 9000, desc: "Limonada de mango natural", emoji: "🍋", disp: true },
  { id: 702, cat: 7, nombre: "Limonada Mango 16oz", precio: 12000, desc: "Limonada de mango natural", emoji: "🍋", disp: true },
  { id: 703, cat: 7, nombre: "Limonada Hierbabuena 12oz", precio: 9000, desc: "Limonada de hierbabuena fresca", emoji: "🍋", disp: true },
  { id: 704, cat: 7, nombre: "Limonada Hierbabuena 16oz", precio: 12000, desc: "Limonada de hierbabuena fresca", emoji: "🍋", disp: true },
  { id: 705, cat: 7, nombre: "Limonada Coco 12oz", precio: 9000, desc: "Limonada de coco tropical", emoji: "🍋", disp: true },
  { id: 706, cat: 7, nombre: "Limonada Coco 16oz", precio: 12000, desc: "Limonada de coco tropical", emoji: "🍋", disp: true },
  { id: 801, cat: 8, nombre: "Cerveza Club Colombia", precio: 6000, desc: "Cerveza nacional dorada", emoji: "🍺", disp: true },
  { id: 802, cat: 8, nombre: "Cerveza Corona", precio: 8000, desc: "Cerveza importada", emoji: "🍺", disp: true },
  { id: 803, cat: 8, nombre: "Gaseosa 350ml", precio: 4000, desc: "Coca-Cola, Postobón o Pepsi", emoji: "🥤", disp: true },
];

const MESAS_INICIAL = [
  { id: 1, num: 1, estado: "libre" },
  { id: 2, num: 2, estado: "libre" },
  { id: 3, num: 3, estado: "libre" },
  { id: 4, num: 4, estado: "libre" },
];

// ============================================================
// UTILIDAD: MAPEAR FIADOS CON HISTORIAL
// ============================================================
const mapFiados = (fiadosList) => {
  if (!fiadosList) return [];
  return fiadosList.map(f => {
    let history = [];
    if (f.ordenes_historial) {
      history = f.ordenes_historial;
    } else if (f.items && f.items.length > 0 && (f.items[0].fecha || f.items[0].items)) {
      history = f.items;
    } else if (f.items) {
      // Legacy flat items array -> convert to a single history order entry
      history = [{
        fecha: f.fecha_fiado || new Date().toISOString(),
        mesa: String(f.mesa || ''),
        items: f.items
      }];
    }
    return {
      ...f,
      ordenes_historial: history,
      items: history
    };
  });
};

// ============================================================
// APP PRINCIPAL
// ============================================================
export default function App() {
  KeepAwake.activate(); // Mantener la pantalla activa durante el servicio

  const [tab, setTab] = useState("pedido");
  const [mesas, setMesas] = useState(MESAS_INICIAL);
  const [productos, setProductos] = useState(PRODUCTOS_INICIAL);
  const [pedidos, setPedidos] = useState([]);
  const [fiados, setFiados] = useState([]);
  const [nextId, setNextId] = useState(1);
  const [toast, setToast] = useState(null);
  const [isOnline, setIsOnline] = useState(true);

  // Estados y refs para Socket.io y alertas sonoras nativas
  const [customSoundUri, setCustomSoundUri] = useState(null);
  const [alertaSonando, setAlertaSonando] = useState(false);
  const soundObjectRef = useRef(null);
  const socketRef = useRef(null);

  const cargarSonidoPersonalizado = async () => {
    try {
      const savedUri = await AsyncStorage.getItem('custom_alert_uri');
      if (savedUri) {
        setCustomSoundUri(savedUri);
      }
    } catch (e) {
      console.error("Error al cargar sonido guardado:", e);
    }
  };

  const reproducirAlertaSonora = async (loop = false) => {
    try {
      if (soundObjectRef.current) {
        await soundObjectRef.current.stopAsync().catch(() => {});
        await soundObjectRef.current.unloadAsync().catch(() => {});
        soundObjectRef.current = null;
      }

      const savedUri = await AsyncStorage.getItem('custom_alert_uri');
      if (savedUri) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: savedUri },
          { shouldPlay: true, isLooping: loop, volume: 1.0 }
        );
        soundObjectRef.current = sound;
        setAlertaSonando(true);
      } else {
        try {
          const { sound } = await Audio.Sound.createAsync(
            require('./assets/new_order.mp3'),
            { shouldPlay: true, isLooping: loop, volume: 1.0 }
          );
          soundObjectRef.current = sound;
          setAlertaSonando(true);
        } catch (err) {
          console.log("No default audio resource found in assets, skipping playback");
        }
      }
    } catch (error) {
      console.warn("Error al reproducir audio:", error);
    }
  };

  const detenerAlertaSonora = async () => {
    try {
      if (soundObjectRef.current) {
        soundObjectRef.current.stop();
        soundObjectRef.current.release();
        soundObjectRef.current = null;
      }
      setAlertaSonando(false);
    } catch (e) {
      console.log("Error al detener sonido");
    }
  };

  const seleccionarAudioLocal = async () => {
    try {
      const result = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.audio] });

      if (result && result.uri) {
        const selectedAsset = result;
        const destinationPath = `${RNFS.DocumentDirectoryPath + "/"}custom_alert.mp3`;
        
        await RNFS.copyFile({
          filepath: selectedAsset.uri,
          destPath: destinationPath
        });

        await AsyncStorage.setItem('custom_alert_uri', destinationPath);
        setCustomSoundUri(destinationPath);
        showToast('🎵 Audio guardado como tono de alerta');
        
        // Reproducir prueba corta
        const { sound } = await Audio.Sound.createAsync(
          { uri: destinationPath },
          { shouldPlay: true }
        );
        setTimeout(() => {
          sound.unloadAsync().catch(() => {});
        }, 3000);
      }
    } catch (error) {
      console.error("Error al seleccionar audio:", error);
      Alert.alert("Error", "No se pudo seleccionar el archivo de audio.");
    }
  };
  const [serverIP, setServerIP] = useState("");
  const [ipConfigured, setIpConfigured] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [userRol, setUserRol] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [paraLlevarNextNum, setParaLlevarNextNum] = useState(1);
  const [sesionActiva, setSesionActiva] = useState(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [pedidoACancelar, setPedidoACancelar] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState('');

  // Nuevos estados para seguridad, auditoría y pedidos
  const [loggedUser, setLoggedUser] = useState(null); // { nombre: '', rol: '' }
  const [usuarios, setUsuarios] = useState([]); // lista de usuarios
  const [showSessionRecovery, setShowSessionRecovery] = useState(false);
  const [pendingRecoveryUser, setPendingRecoveryUser] = useState(null);
  const [selectedUserLogin, setSelectedUserLogin] = useState(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [forceChangeAdminPin, setForceChangeAdminPin] = useState(false);
  const [newAdminPin, setNewAdminPin] = useState('');
  const [confirmNewAdminPin, setConfirmNewAdminPin] = useState('');
  const [pedidoEditando, setPedidoEditando] = useState(null);
  const [borradores, setBorradores] = useState({});
  const [ajustesModalVisible, setAjustesModalVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);

  // Estados Hoisted de PedidoView
  const [paso, setPaso] = useState(1);
  const [mesaSel, setMesaSel] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [mesaActivaModalVisible, setMesaActivaModalVisible] = useState(false);
  const [mesaActivaSelected, setMesaActivaSelected] = useState(null);

  // Estados Hoisted de CajaView
  const [cajaCobroModalVisible, setCajaCobroModalVisible] = useState(false);
  const [cierreModalVisible, setCierreModalVisible] = useState(false);

  // Estados Hoisted de AdminView
  const [adminTab, setAdminTab] = useState('principal');
  const [adminProductModalVisible, setAdminProductModalVisible] = useState(false);
  const [adminGastoModalVisible, setAdminGastoModalVisible] = useState(false);
  const [adminInsumoModalVisible, setAdminInsumoModalVisible] = useState(false);
  const [adminMovimientoModalVisible, setAdminMovimientoModalVisible] = useState(false);
  const [adminUserModalVisible, setAdminUserModalVisible] = useState(false);
  const [adminChangePinModalVisible, setAdminChangePinModalVisible] = useState(false);
  const [adminVentaDetalleModalVisible, setAdminVentaDetalleModalVisible] = useState(false);

  const toastTimer = useRef(null);
  const syncTimer = useRef(null);

  const showToast = (msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // Cargar sonido al iniciar
  useEffect(() => {
    cargarSonidoPersonalizado();
  }, []);

  // Manejar conexión de Socket.io
  useEffect(() => {
    if (!ipConfigured || !serverIP) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socketUrl = `http://${serverIP}:3001`;
    console.log(`📡 Conectando a Socket.io en ${socketUrl}...`);
    
    socketRef.current = io(socketUrl, {
      transports: ['websocket'],
      forceNew: true
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Conectado al Socket Server');
      if (loggedUser) {
        const isCocina = loggedUser.rol === 'cocina' || loggedUser.rol === 'bar';
        socketRef.current.emit('registrar_dispositivo', {
          rol: isCocina ? 'cocina' : 'mesero',
          usuarioId: loggedUser.nombre
        });
      }
    });

    // Recibir nuevo pedido (cocina/bar)
    socketRef.current.on('pedido_recibido_cocina', (nuevoPedido) => {
      console.log('🔔 Pedido recibido en Cocina:', nuevoPedido.uuid);
      setPedidos(prev => {
        if (prev.some(p => p.uuid === nuevoPedido.uuid)) return prev;
        return [nuevoPedido, ...prev];
      });

      if (loggedUser && (loggedUser.rol === 'cocina' || loggedUser.rol === 'bar')) {
        reproducirAlertaSonora(true);
      }
    });

    // Recibir actualización de estado
    socketRef.current.on('pedido_estado_cambiado', (data) => {
      const { uuid, items, nuevoEstado } = data;
      setPedidos(prev => prev.map(p => p.uuid === uuid ? { ...p, items, estado: nuevoEstado } : p));
    });

    // Recibir notificación de pedido listo
    socketRef.current.on('pedido_listo_mesero', (data) => {
      const { uuid, mesa, plato } = data;
      console.log(`🛎️ Pedido listo para mesa ${mesa}:`, plato);
      
      if (loggedUser && loggedUser.rol === 'pedido') {
        reproducirAlertaSonora(false);
        Vibration.vibrate([0, 500, 250, 500]);
        Alert.alert(
          "🛎️ ¡Plato Listo!",
          `Mesa ${mesa}: El plato "${plato}" está listo para ser servido.`,
          [{ text: "Entendido", onPress: () => detenerAlertaSonora() }]
        );
      }
    });

    // Recibir pedido completado (para limpiar mesas)
    socketRef.current.on('pedido_completado_servidor', (data) => {
      const { uuid } = data;
      setPedidos(prev => prev.filter(p => p.uuid !== uuid));
    });

    // Recibir pedido cancelado
    socketRef.current.on('pedido_cancelado_servidor', (data) => {
      const { uuid } = data;
      setPedidos(prev => prev.filter(p => p.uuid !== uuid));
    });

    // Recibir pedido fiado
    socketRef.current.on('pedido_fiado_servidor', (data) => {
      const { uuid } = data;
      setPedidos(prev => prev.filter(p => p.uuid !== uuid));
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket desconectado');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [ipConfigured, serverIP, loggedUser]);

  // Manejar AppState (reconectar si vuelve a primer plano)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && socketRef.current && !socketRef.current.connected) {
        console.log('Reconectando Socket.io por AppState...');
        socketRef.current.connect();
      }
    });
    return () => subscription.remove();
  }, []);

  // Temporizador para bloqueo de login
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  // Autocorrector de estado de mesas basado en pedidos síncronos
  useEffect(() => {
    setMesas(prev => {
      return MESAS_INICIAL.map(m => {
        const pedidoActivo = pedidos.find(p => Number(p.mesa) === m.num && p.estado === 'activo');
        if (!pedidoActivo) return { ...m, estado: 'libre' };
        
        const todosListos = pedidoActivo.items && pedidoActivo.items.length > 0 && pedidoActivo.items.every(it => it.estado === 'listo');
        return { ...m, estado: todosListos ? 'cuenta' : 'ocupada' };
      });
    });
  }, [pedidos]);

  const buscarServidorAut = async () => {
    setIsSearching(true);
    const subredes = ['192.168.1', '192.168.0', '192.168.100', '192.168.8', '192.168.18', '10.0.0'];
    showToast("🔍 Buscando servidor en red local...");
    
    for (const subred of subredes) {
      const promesas = [];
      for (let i = 1; i <= 254; i++) {
        const ip = `${subred}.${i}`;
        promesas.push(
          axios.get(`http://${ip}:3001/health`, { timeout: 350 })
            .then(res => {
              if (res.status === 200 && res.data.status === 'ok') {
                return ip;
              }
              throw new Error();
            })
            .catch(() => null)
        );
      }
      const resultados = await Promise.all(promesas);
      const ipEncontrada = resultados.find(ip => ip !== null);
      if (ipEncontrada) {
        setServerIP(ipEncontrada);
        setIpConfigured(true);
        await AsyncStorage.setItem('serverIP', ipEncontrada);
        showToast("✅ Servidor conectado en " + ipEncontrada);
        setIsSearching(false);
        return true;
      }
    }
    setIsSearching(false);
    showToast("⚠️ Servidor no encontrado automáticamente");
    return false;
  };

  const seleccionarRol = async (rolSel) => {
    setUserRol(rolSel);
    await AsyncStorage.setItem('userRol', rolSel);
    setTab(rolSel);
  };

  // Comprobar si hay actualizaciones en el servidor local
  const checkForUpdates = async () => {
    if (!ipConfigured || !serverIP) return;
    try {
      const checkUrl = `http://${serverIP}:3001/api/check-update`;
      const response = await axios.get(checkUrl, { timeout: 5000 });
      if (response.data && response.data.version) {
        const { version: remoteVersion, notes, apkUrl } = response.data;
        if (isVersionNewerMobile(APP_VERSION, remoteVersion)) {
          setUpdateInfo({ version: remoteVersion, notes, apkUrl });
          setUpdateModalVisible(true);
        }
      }
    } catch (err) {
      console.log("No se pudo comprobar la actualización de la app:", err.message);
    }
  };

  // Renderizar modal de actualización si está disponible
  const renderUpdateModal = () => {
    if (!updateModalVisible || !updateInfo) return null;
    return (
      <Modal
        visible={updateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setUpdateModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
            <View style={{ backgroundColor: C.brand, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 28 }}>🚀</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.cream, marginTop: 5 }}>
                Actualización Disponible
              </Text>
            </View>
            
            <View style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, backgroundColor: C.surf2, padding: 10, borderRadius: 8 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: C.text3 }}>Versión actual</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{APP_VERSION}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: C.text3 }}>Nueva versión</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.orange }}>{updateInfo.version}</Text>
                </View>
              </View>

              {updateInfo.notes && updateInfo.notes.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, marginBottom: 8 }}>
                    Novedades:
                  </Text>
                  <ScrollView style={{ maxHeight: 120 }}>
                    {updateInfo.notes.map((note, index) => (
                      <Text key={index} style={{ fontSize: 12, color: C.text, marginBottom: 4 }}>
                        • {note}
                      </Text>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: C.surf2,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: C.border,
                    alignItems: 'center'
                  }}
                  onPress={() => setUpdateModalVisible(false)}
                >
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 12 }}>Más tarde</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: C.orange,
                    padding: 12,
                    borderRadius: 8,
                    alignItems: 'center'
                  }}
                  onPress={() => {
                    if (updateInfo.apkUrl) {
                      Linking.openURL(updateInfo.apkUrl);
                    }
                    setUpdateModalVisible(false);
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Descargar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Sincronizar pedidos del día, catálogo y sesión de caja
  const sincronizar = async () => {
    if (!ipConfigured) return;
    try {
      const baseCol = `http://${serverIP}:3001/api`;
      
      // 1. Sincronizar pedidos
      const url = `${baseCol}/pedidos/date/${new Date().toISOString().split('T')[0]}`;
      const response = await axios.get(url, { timeout: 5000 });
      if (response.data.pedidos) {
        setPedidos(response.data.pedidos);
        await AsyncStorage.setItem('pedidos', JSON.stringify(response.data.pedidos));
        setIsOnline(true);
      }

      // 1b. Sincronizar fiados
      const fiadosUrl = `${baseCol}/pedidos/fiado`;
      const fiadosRes = await axios.get(fiadosUrl, { timeout: 5000 });
      if (fiadosRes.data && fiadosRes.data.fiados) {
        const mapped = mapFiados(fiadosRes.data.fiados);
        setFiados(mapped);
        await AsyncStorage.setItem('fiados', JSON.stringify(mapped));
      }

      // 2. Sincronizar catálogo de productos
      const prodRes = await axios.get(`${baseCol}/productos`, { timeout: 2000 });
      if (prodRes.data && prodRes.data.productos) {
        setProductos(prodRes.data.productos);
      }

      // 3. Sincronizar sesión de caja
      const sesionRes = await axios.get(`${baseCol}/caja/sesion-activa`, { timeout: 2000 });
      if (sesionRes.data) {
        setSesionActiva(sesionRes.data.sesion);
      }

      // 4. Sincronizar usuarios activos
      const userRes = await axios.get(`${baseCol}/usuarios`, { timeout: 2000 });
      if (userRes.data && userRes.data.usuarios) {
        setUsuarios(userRes.data.usuarios.filter(u => u.activo));
      }
    } catch (e) {
      console.error('Sync error:', e.message);
      setIsOnline(false);
      const stored = await AsyncStorage.getItem('pedidos');
      if (stored) setPedidos(JSON.parse(stored));
      const storedFiados = await AsyncStorage.getItem('fiados');
      if (storedFiados) setFiados(mapFiados(JSON.parse(storedFiados)));
    }
  };

  // Usar pedidos guardados al iniciar y configurar sincronización
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const stored = await AsyncStorage.getItem('pedidos');
        if (stored) setPedidos(JSON.parse(stored));

        const storedFiados = await AsyncStorage.getItem('fiados');
        if (storedFiados) setFiados(mapFiados(JSON.parse(storedFiados)));

        const storedVentas = await AsyncStorage.getItem('ventas');
        if (storedVentas) setVentas(JSON.parse(storedVentas));

        const storedCounter = await AsyncStorage.getItem('paraLlevarNextNum');
        if (storedCounter) setParaLlevarNextNum(parseInt(storedCounter, 10));

        const storedBorradores = await AsyncStorage.getItem('borradores');
        if (storedBorradores) setBorradores(JSON.parse(storedBorradores));

        // Cargar Usuario Guardado para recuperación de sesión
        const savedLoggedUser = await AsyncStorage.getItem('loggedUser');
        if (savedLoggedUser) {
          setPendingRecoveryUser(JSON.parse(savedLoggedUser));
        }

        // Cargar IP guardada
        const savedIP = await AsyncStorage.getItem('serverIP');
        if (savedIP) {
          setServerIP(savedIP);
          try {
            const testUrl = `http://${savedIP}:3001/health`;
            const response = await axios.get(testUrl, { timeout: 1500 });
            if (response.status === 200) {
              setIpConfigured(true);
              
              // Cargar catálogo, sesión activa y usuarios iniciales
              const baseCol = `http://${savedIP}:3001/api`;
              const prodRes = await axios.get(`${baseCol}/productos`, { timeout: 1500 });
              if (prodRes.data && prodRes.data.productos) {
                setProductos(prodRes.data.productos);
              }
              const sesionRes = await axios.get(`${baseCol}/caja/sesion-activa`, { timeout: 1500 });
              if (sesionRes.data) {
                setSesionActiva(sesionRes.data.sesion);
              }
              const userRes = await axios.get(`${baseCol}/usuarios`, { timeout: 1500 });
              if (userRes.data && userRes.data.usuarios) {
                setUsuarios(userRes.data.usuarios.filter(u => u.activo));
              }
              return;
            }
          } catch (e) {
            // La IP no responde, procedemos a buscar
          }
        }
        const found = await buscarServidorAut();
        if (found) {
          try {
            const currentIP = await AsyncStorage.getItem('serverIP');
            const baseCol = `http://${currentIP}:3001/api`;
            const userRes = await axios.get(`${baseCol}/usuarios`, { timeout: 1500 });
            if (userRes.data && userRes.data.usuarios) {
              setUsuarios(userRes.data.usuarios.filter(u => u.activo));
            }
          } catch (e) {}
        }
      } catch (e) {
        console.error('Error loading stored data:', e);
      }
    };
    cargarDatos();
  }, []);

  // Sincronización periódica (se re-ejecuta cuando ipConfigured cambia)
  useEffect(() => {
    if (!ipConfigured) return; // No sincronizar si IP no está configurada

    sincronizar(); // Sincronizar inmediatamente al conectar
    checkForUpdates(); // Buscar actualizaciones del APK al conectar

    // Sincronizar periódicamente
    syncTimer.current = setInterval(sincronizar, SYNC_INTERVAL);
    return () => clearInterval(syncTimer.current);
  }, [ipConfigured]);

  // Manejo de BackHandler nativo (Android)
  useEffect(() => {
    const handleBackPress = () => {
      // 1. Cerrar modales (Prioridad más alta)
      if (cancelModalVisible) {
        setCancelModalVisible(false);
        return true;
      }
      if (ajustesModalVisible) {
        setAjustesModalVisible(false);
        return true;
      }
      if (cajaCobroModalVisible) {
        setCajaCobroModalVisible(false);
        return true;
      }
      if (cierreModalVisible) {
        setCierreModalVisible(false);
        return true;
      }
      if (adminProductModalVisible) {
        setAdminProductModalVisible(false);
        return true;
      }
      if (adminGastoModalVisible) {
        setAdminGastoModalVisible(false);
        return true;
      }
      if (adminInsumoModalVisible) {
        setAdminInsumoModalVisible(false);
        return true;
      }
      if (adminMovimientoModalVisible) {
        setAdminMovimientoModalVisible(false);
        return true;
      }
      if (adminUserModalVisible) {
        setAdminUserModalVisible(false);
        return true;
      }
      if (adminChangePinModalVisible) {
        setAdminChangePinModalVisible(false);
        return true;
      }
      if (adminVentaDetalleModalVisible) {
        setAdminVentaDetalleModalVisible(false);
        return true;
      }
      if (mesaActivaModalVisible) {
        setMesaActivaModalVisible(false);
        return true;
      }

      // 2. Navegación interna o cierre de sesión si hay usuario logueado
      if (loggedUser) {
        if (tab === "pedido" && paso === 2) {
          if (carrito.length > 0 && mesaSel) {
            guardarBorrador(mesaSel.num, carrito, !!pedidoEditando, pedidoEditando?.uuid);
            showToast(`📝 Borrador guardado: ${mesaSel.num}`);
          }
          setPaso(1);
          return true;
        } else if (tab === "pedido" && paso === 1) {
          setLoggedUser(null);
          setUserRol(null);
          setTab('pedido'); // Resetea al tab inicial por defecto
          return true;
        } else if (tab === "admin" && adminTab !== "principal") {
          setAdminTab("principal");
          return true;
        } else {
          // Deslogueo para Caja, Cocina, Bar o Admin en Dashboard principal
          setLoggedUser(null);
          setUserRol(null);
          setTab('pedido'); // Resetea al tab inicial por defecto
          return true;
        }
      }

      // 3. Confirmación de salida (Sólo si NO hay usuario logueado)
      if (!loggedUser) {
        Alert.alert(
          "Salir de Embejucao POS",
          "¿Está seguro de que desea cerrar la aplicación?",
          [
            { text: "No, continuar", style: "cancel" },
            { text: "Sí, salir", style: "destructive", onPress: () => BackHandler.exitApp() }
          ],
          { cancelable: false }
        );
        return true;
      }

      return true;
    };

    BackHandler.addEventListener("hardwareBackPress", handleBackPress);
    return () => BackHandler.removeEventListener("hardwareBackPress", handleBackPress);
  }, [
    loggedUser, tab, paso, adminTab, carrito, mesaSel, pedidoEditando,
    cancelModalVisible, ajustesModalVisible, cajaCobroModalVisible, cierreModalVisible,
    adminProductModalVisible, adminGastoModalVisible, adminInsumoModalVisible,
    adminMovimientoModalVisible, adminUserModalVisible, adminChangePinModalVisible,
    adminVentaDetalleModalVisible, mesaActivaModalVisible
  ]);



  const enviarPedido = async (mesaNum, items, isEditing, editUuid) => {
    try {
      if (isEditing && editUuid) {
        // Local optimistic update
        setPedidos(prev => prev.map(p => p.uuid === editUuid ? { ...p, items } : p));
        
        try {
          const url = `http://${serverIP}:3001/api/pedidos/${editUuid}`;
          await axios.put(url, {
            items: items,
            usuario: loggedUser ? loggedUser.nombre : 'Mesero'
          }, { timeout: 5000 });
          showToast("✅ Pedido actualizado");
          eliminarBorrador(mesaNum);
          sincronizar();
        } catch (e) {
          showToast("⚠️ Error al actualizar - guardado local");
          console.error('Error updating order:', e.message);
        }
        return;
      }

      const pedidoId = uuid.v4();
      
      // Fallback manual para hora si toLocaleTimeString falla
      let horaStr = "";
      try {
        horaStr = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      } catch (e) {
        const d = new Date();
        const h = d.getHours();
        const m = d.getMinutes().toString().padStart(2, '0');
        const ampm = h >= 12 ? 'p. m.' : 'a. m.';
        const h12 = h % 12 || 12;
        horaStr = `${h12}:${m} ${ampm}`;
      }

      const nueva = {
        uuid: pedidoId,
        mesa: mesaNum,
        hora: horaStr,
        items: items.map(i => ({ ...i, estado: "pendiente" })),
      };

      // Guardar localmente primero
      setPedidos(p => [...p, nueva]);
      setMesas(m => m.map(x => x.num === Number(mesaNum) ? { ...x, estado: "ocupada" } : x));
      await AsyncStorage.setItem('pedidos', JSON.stringify([...pedidos, nueva]));
      eliminarBorrador(mesaNum);

      // Incrementar contador para llevar
      if (typeof mesaNum === 'string' && mesaNum.startsWith('Para Llevar #')) {
        setParaLlevarNextNum(prev => {
          const next = prev + 1;
          AsyncStorage.setItem('paraLlevarNextNum', String(next));
          return next;
        });
      }

      // Enviar a servidor
      try {
        const url = `http://${serverIP}:3001/api/pedidos`;
        await axios.post(url, {
          uuid: pedidoId,
          mesa: mesaNum,
          hora: nueva.hora,
          items: items,
          fecha: new Date().toISOString().split('T')[0],
          usuario: loggedUser ? loggedUser.nombre : 'Mesero'
        }, { timeout: 5000 });
        showToast("✅ Pedido " + (typeof mesaNum === 'string' && mesaNum.startsWith('Para') ? mesaNum : "Mesa " + mesaNum) + " enviado");
        sincronizar(); // Sincronizar inmediatamente
      } catch (e) {
        showToast("⚠️ Guardado localmente - sin conexión");
        console.error('Error sending pedido:', e.message);
      }
    } catch (error) {
      showToast("❌ ERROR CRÍTICO: " + error.message);
      console.error("FATAL ERROR IN enviarPedido:", error);
    }
  };

  const guardarBorrador = async (mesaNum, items, isEditing, editUuid) => {
    const updated = { ...borradores, [mesaNum]: { items, isEditing, editUuid } };
    setBorradores(updated);
    await AsyncStorage.setItem('borradores', JSON.stringify(updated));
  };

  const eliminarBorrador = async (mesaNum) => {
    const updated = { ...borradores };
    delete updated[mesaNum];
    setBorradores(updated);
    await AsyncStorage.setItem('borradores', JSON.stringify(updated));
  };

  const actualizarItem = async (pedidoId, itemIdx, nuevoEstado) => {
    setPedidos(prev => {
      const updated = prev.map(p => {
        if (p.uuid !== pedidoId) return p;
        const items = p.items.map((it, i) => i === itemIdx ? { ...it, estado: nuevoEstado } : it);
        return { ...p, items };
      });

      const p = updated.find(x => x.uuid === pedidoId);
      if (p && p.items.every(it => it.estado === "listo")) {
        const mesaNum = Number(p.mesa);
        if (!isNaN(mesaNum)) {
          setMesas(m => m.map(x => x.num === mesaNum ? { ...x, estado: "cuenta" } : x));
        }
        showToast("🎉 Pedido " + p.mesa + " completado");
      }

      AsyncStorage.setItem('pedidos', JSON.stringify(updated));
      return updated;
    });

    // Actualizar en servidor
    try {
      const url = `http://${serverIP}:3001/api/pedidos/${pedidoId}/item/${itemIdx}`;
      await axios.put(url, { nuevoEstado }, { timeout: 5000 });
      sincronizar(); // Sincronizar para mostrar cambios en el otro dispositivo
    } catch (e) {
      console.error('Error updating item:', e.message);
    }
  };

  const abrirMenuConfig = () => {
    setAjustesModalVisible(true);
  };

  const cocinaPendientes = pedidos.filter(p =>
    p.items.some(it => (!(Number(it.cat) >= 6) || it.cat === undefined) && it.estado !== "listo")
  ).length;

  const barPendientes = pedidos.filter(p =>
    p.items.some(it => Number(it.cat) >= 6 && it.estado !== "listo")
  ).length;

  // PANTALLA DE CONFIGURACIÓN DE IP
  if (!ipConfigured) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.brand} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, justifyContent: "center", minHeight: "100%" }}>
          <View style={{ alignItems: "center", marginBottom: 30 }}>
            <Text style={{ fontSize: 40 }}>🍔</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: C.cream, marginBottom: 5 }}>Embejucão POS</Text>
            <Text style={{ fontSize: 12, color: C.cream2 }}>Sistema de Sincronización</Text>
          </View>

          <View style={[s.card, { padding: 20, marginBottom: 20 }]}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 12 }}>⚙️ Configuración del Servidor</Text>

            {isSearching ? (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>🔍</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: C.text, textAlign: "center", lineHeight: 18 }}>
                  Buscando la computadora del servidor en la red WiFi...
                </Text>
                <Text style={{ fontSize: 11, color: C.text3, marginTop: 8, textAlign: "center" }}>
                  Esto tomará unos segundos. Por favor espera.
                </Text>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 11, color: C.text2, marginBottom: 10 }}>
                  Ingresa la IP de la computadora donde está corriendo el servidor o presiona el botón para buscar automáticamente.
                </Text>

                <Text style={{ fontSize: 10, color: C.text3, marginBottom: 14, fontStyle: "italic" }}>
                  Windows: Abre terminal → ipconfig → busca "IPv4 Address"
                </Text>

                <Text style={{ fontSize: 11, fontWeight: "600", color: C.text, marginBottom: 6 }}>Dirección IP:</Text>
                <TextInput
                  style={[s.formInput, { fontSize: 14, marginBottom: 16 }]}
                  placeholder="Ej: 192.168.1.100"
                  placeholderTextColor={C.text3}
                  value={serverIP}
                  onChangeText={setServerIP}
                  keyboardType="numeric"
                />

                <TouchableOpacity
                  style={[s.btnPrimary, s.btnFull, { marginBottom: 10, opacity: serverIP ? 1 : 0.5 }]}
                  onPress={async () => {
                    if (!serverIP) {
                      alert("Ingresa una IP válida");
                      return;
                    }
                    try {
                      const testUrl = `http://${serverIP}:3001/health`;
                      const response = await axios.get(testUrl, { timeout: 3000 });
                      if (response.status === 200) {
                        setIpConfigured(true);
                        await AsyncStorage.setItem('serverIP', serverIP);
                        showToast("✅ Conectado al servidor");
                      }
                    } catch (e) {
                      alert("❌ No puedo conectar a " + serverIP + ":3001\n\nVerifica:\n1. La IP es correcta\n2. El servidor está corriendo\n3. Ambos están en la misma red WiFi");
                    }
                  }}
                  disabled={!serverIP}
                >
                  <Text style={s.btnPrimaryTxt}>Conectar IP Manual →</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.btnGhost, s.btnFull, { backgroundColor: "rgba(61,26,10,0.04)", borderColor: C.border }]}
                  onPress={buscarServidorAut}
                >
                  <Text style={{ color: C.text, fontWeight: "600", fontSize: 12, textAlign: "center" }}>
                    🔍 Buscar Servidor Automáticamente
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={[s.card, { padding: 16, backgroundColor: "rgba(245,230,200,0.05)" }]}>
            <Text style={{ fontSize: 10, color: C.text3, lineHeight: 14 }}>
              📡 <Text style={{ fontWeight: "600" }}>Nota:</Text> Ambos teléfonos deben estar en la MISMA red WiFi que el servidor.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (pendingRecoveryUser) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.brand} />
        <View style={{ flex: 1, padding: 20, justifyContent: "center", alignItems: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 30 }}>
            <Text style={{ fontSize: 40 }}>🍔</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: C.cream, marginBottom: 5 }}>Embejucão POS</Text>
            <Text style={{ fontSize: 13, color: C.cream2 }}>Sesión Activa Detectada</Text>
          </View>

          <View style={[s.card, { padding: 20, width: "100%", alignItems: "center" }]}>
            <Ionicons name="people-circle" size={64} color={C.orange} style={{ marginBottom: 14 }} />
            <Text style={{ fontSize: 16, fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 6 }}>
              ¿Continuar como {pendingRecoveryUser.nombre}?
            </Text>
            <Text style={{ fontSize: 12, color: C.text2, textAlign: "center", marginBottom: 20 }}>
              Rol: {pendingRecoveryUser.rol === 'admin' ? 'Administrador' : pendingRecoveryUser.rol === 'pedido' ? 'Mesero' : pendingRecoveryUser.rol}
            </Text>

            <TouchableOpacity
              style={[s.btnPrimary, s.btnFull, { backgroundColor: C.green, marginBottom: 10, width: '100%' }]}
              onPress={async () => {
                setLoggedUser(pendingRecoveryUser);
                setUserRol(pendingRecoveryUser.rol);
                setTab(pendingRecoveryUser.rol);
                setPendingRecoveryUser(null);
                showToast(`✅ Sesión recuperada: ${pendingRecoveryUser.nombre}`);
              }}
            >
              <Text style={s.btnPrimaryTxt}>Continuar como {pendingRecoveryUser.nombre}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btnGhost, s.btnFull, { borderColor: C.red, width: '100%' }]}
              onPress={async () => {
                await AsyncStorage.removeItem('loggedUser');
                setPendingRecoveryUser(null);
              }}
            >
              <Text style={{ color: C.red, fontWeight: "700", textAlign: "center" }}>Iniciar con otro usuario</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (forceChangeAdminPin) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.brand} />
        <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 30 }}>
            <Text style={{ fontSize: 40 }}>🔒</Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.cream, marginBottom: 5 }}>Cambio de PIN Obligatorio</Text>
            <Text style={{ fontSize: 12, color: C.cream2, textAlign: "center" }}>
              Por seguridad, debes cambiar el PIN por defecto del Administrador.
            </Text>
          </View>

          <View style={[s.card, { padding: 20 }]}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: C.text, marginBottom: 6 }}>Nuevo PIN (4 a 6 dígitos)</Text>
            <TextInput
              style={[s.formInput, { marginBottom: 14, letterSpacing: 5, fontSize: 18, textAlign: 'center' }]}
              placeholder="••••••"
              placeholderTextColor={C.text3}
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
              value={newAdminPin}
              onChangeText={setNewAdminPin}
            />

            <Text style={{ fontSize: 12, fontWeight: "700", color: C.text, marginBottom: 6 }}>Confirmar Nuevo PIN</Text>
            <TextInput
              style={[s.formInput, { marginBottom: 20, letterSpacing: 5, fontSize: 18, textAlign: 'center' }]}
              placeholder="••••••"
              placeholderTextColor={C.text3}
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
              value={confirmNewAdminPin}
              onChangeText={setConfirmNewAdminPin}
            />

            <TouchableOpacity
              style={[s.btnPrimary, s.btnFull, { backgroundColor: C.orange }]}
              onPress={async () => {
                if (newAdminPin.length < 4 || newAdminPin.length > 6 || isNaN(Number(newAdminPin))) {
                  Alert.alert("Error", "El PIN debe tener entre 4 y 6 dígitos numéricos.");
                  return;
                }
                if (newAdminPin !== confirmNewAdminPin) {
                  Alert.alert("Error", "Los PINs ingresados no coinciden.");
                  return;
                }
                try {
                  const url = `http://${serverIP}:3001/api/usuarios`;
                  const res = await axios.post(url, {
                    id: selectedUserLogin.id,
                    nombre: "Administrador",
                    pin: newAdminPin,
                    rol: "admin",
                    administrador_usuario: "Administrador"
                  }, { timeout: 3000 });

                  if (res.data && res.data.success) {
                    setForceChangeAdminPin(false);
                    const userSes = { nombre: "Administrador", rol: "admin" };
                    setLoggedUser(userSes);
                    setUserRol("admin");
                    setTab("admin");
                    await AsyncStorage.setItem('loggedUser', JSON.stringify(userSes));
                    showToast("✅ PIN cambiado y sesión iniciada");
                    setNewAdminPin('');
                    setConfirmNewAdminPin('');
                    setSelectedUserLogin(null);
                  }
                } catch (e) {
                  Alert.alert("Error", "No se pudo actualizar el PIN. Intente de nuevo.");
                }
              }}
            >
              <Text style={s.btnPrimaryTxt}>Actualizar PIN e Ingresar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!loggedUser) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.brand} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, justifyContent: "center", minHeight: "100%" }}>
          <View style={{ alignItems: "center", marginBottom: 25 }}>
            <Text style={{ fontSize: 44 }}>🍔</Text>
            <Text style={{ fontSize: 26, fontWeight: "900", color: C.cream, marginBottom: 5, letterSpacing: 0.8 }}>
              EMBEJUCAO <Text style={{ color: C.orange }}>POS</Text>
            </Text>
            <Text style={{ fontSize: 12, color: C.cream2 }}>Ráquira, Boyacá</Text>
          </View>

          {/* LISTA DE USUARIOS (Ingreso Directo) */}
          <View style={[s.card, { padding: 20, gap: 12 }]}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 6, textAlign: "center" }}>
              👥 Seleccionar Usuario
            </Text>
            {usuarios.length === 0 ? (
              <Text style={{ fontSize: 12, color: C.text3, textAlign: 'center', paddingVertical: 10 }}>
                Cargando usuarios desde el servidor...
              </Text>
            ) : (
              usuarios.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={[s.btnGhost, s.btnFull, {
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 14,
                    backgroundColor: "rgba(61,26,10,0.03)",
                    borderColor: C.border,
                    borderWidth: 1
                  }]}
                  onPress={() => {
                    setLoggedUser({ nombre: u.nombre, rol: u.rol });
                    setUserRol(u.rol);
                    setTab(u.rol);
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{u.nombre}</Text>
                    <Text style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>
                      Rol: {u.rol === 'admin' ? 'Administrador' : u.rol === 'pedido' ? 'Mesero' : u.rol}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.text3} />
                </TouchableOpacity>
              ))
            )}
          </View>

          <TouchableOpacity
            onPress={() => setIpConfigured(false)}
            style={{ alignSelf: "center", marginTop: 25 }}
          >
            <Text style={{ fontSize: 12, color: C.cream2, textDecorationLine: "underline" }}>
              ⚙️ Cambiar IP del Servidor ({serverIP})
            </Text>
          </TouchableOpacity>
        </ScrollView>
        {renderUpdateModal()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.brand} />

      {/* NAV */}
      <View style={{
        backgroundColor: C.brand,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(245,230,200,0.1)",
      }}>
        {/* Row 1: Brand + Settings */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 22 }}>🍔</Text>
            <View>
              <Text style={{ fontSize: 17, fontWeight: "900", color: C.cream, letterSpacing: 0.4 }}>
                Embejucao <Text style={{ color: C.orange, fontWeight: "800" }}>POS</Text>
              </Text>
              <Text style={{ fontSize: 9, color: C.text3, letterSpacing: 0.5, marginTop: 1 }}>
                Ráquira, Boyacá
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {alertaSonando && (
              <TouchableOpacity
                onPress={detenerAlertaSonora}
                style={{
                  backgroundColor: C.red,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <Ionicons name="volume-mute-outline" size={14} color="white" />
                <Text style={{ color: "white", fontSize: 11, fontWeight: "800" }}>Silenciar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={abrirMenuConfig}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 1.5,
                borderColor: "rgba(245,230,200,0.2)",
                backgroundColor: "rgba(245,230,200,0.06)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="settings-outline" size={16} color={C.cream2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: Connection + Module badge */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          {isOnline ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.greenL }} />
              <Text style={{ fontSize: 10, color: C.greenL, fontWeight: "600" }}>Conectado</Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.red }} />
              <Text style={{ fontSize: 10, color: C.red, fontWeight: "600" }}>Sin conexión</Text>
            </View>
          )}

          <View style={{
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 14,
            backgroundColor: C.orange,
          }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: "white", letterSpacing: 0.3 }}>
              {userRol === "pedido" ? "🧾 Mesero" :
               userRol === "cocina" ? `👨‍🍳 Cocina (${cocinaPendientes})` :
               userRol === "bar" ? `🍹 Bar (${barPendientes})` :
               userRol === "caja" ? "💰 Caja" :
               "⚙️ Admin"}
            </Text>
          </View>
        </View>
      </View>

      {/* VISTAS */}
      <View style={{ flex: 1, backgroundColor: C.brand }}>
        {tab === "pedido" && (
          <PedidoView
            mesas={mesas}
            productos={productos}
            pedidos={pedidos}
            onEnviar={enviarPedido}
            showToast={showToast}
            paraLlevarNextNum={paraLlevarNextNum}
            pedidoEditando={pedidoEditando}
            setPedidoEditando={setPedidoEditando}
            borradores={borradores}
            guardarBorrador={guardarBorrador}
            eliminarBorrador={eliminarBorrador}
            paso={paso}
            setPaso={setPaso}
            mesaSel={mesaSel}
            setMesaSel={setMesaSel}
            carrito={carrito}
            setCarrito={setCarrito}
            mesaActivaModalVisible={mesaActivaModalVisible}
            setMesaActivaModalVisible={setMesaActivaModalVisible}
            mesaActivaSelected={mesaActivaSelected}
            setMesaActivaSelected={setMesaActivaSelected}
          />
        )}
        {tab === "cocina" && (
          <CocinaView pedidos={pedidos} onActualizar={actualizarItem} />
        )}
        {tab === "bar" && (
          <BarView pedidos={pedidos} onActualizar={actualizarItem} />
        )}
        {tab === "caja" && (
          <CajaView
            pedidos={pedidos}
            productos={productos}
            setPedidos={setPedidos}
            mesas={mesas}
            setMesas={setMesas}
            ventas={ventas}
            setVentas={setVentas}
            serverIP={serverIP}
            showToast={showToast}
            sesionActiva={sesionActiva}
            setSesionActiva={setSesionActiva}
            loggedUser={loggedUser}
            onSolicitarCancelar={(p) => {
              if (p.estado === 'completado') {
                Alert.alert("Error", "Este pedido ya fue facturado y no puede eliminarse.");
                return;
              }
              setPedidoACancelar(p);
              setCancelMotivo('');
              setCancelModalVisible(true);
            }}
            cajaCobroModalVisible={cajaCobroModalVisible}
            setCajaCobroModalVisible={setCajaCobroModalVisible}
            cierreModalVisible={cierreModalVisible}
            setCierreModalVisible={setCierreModalVisible}
            fiados={fiados}
            setFiados={setFiados}
          />
        )}
        {tab === "admin" && (
          <AdminView
            productos={productos}
            setProductos={setProductos}
            mesas={mesas}
            setMesas={setMesas}
            pedidos={pedidos}
            setPedidos={setPedidos}
            showToast={showToast}
            serverIP={serverIP}
            sincronizar={sincronizar}
            userRol={userRol}
            sesionActiva={sesionActiva}
            usuarios={usuarios}
            setUsuarios={setUsuarios}
            loggedUser={loggedUser}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            adminProductModalVisible={adminProductModalVisible}
            setAdminProductModalVisible={setAdminProductModalVisible}
            adminGastoModalVisible={adminGastoModalVisible}
            setAdminGastoModalVisible={setAdminGastoModalVisible}
            adminInsumoModalVisible={adminInsumoModalVisible}
            setAdminInsumoModalVisible={setAdminInsumoModalVisible}
            adminMovimientoModalVisible={adminMovimientoModalVisible}
            setAdminMovimientoModalVisible={setAdminMovimientoModalVisible}
            adminUserModalVisible={adminUserModalVisible}
            setAdminUserModalVisible={setAdminUserModalVisible}
            adminChangePinModalVisible={adminChangePinModalVisible}
            setAdminChangePinModalVisible={setAdminChangePinModalVisible}
            adminVentaDetalleModalVisible={adminVentaDetalleModalVisible}
            setAdminVentaDetalleModalVisible={setAdminVentaDetalleModalVisible}
          />
        )}
      </View>

      {/* TOAST */}
      {toast && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastTxt}>{toast}</Text>
        </View>
      )}

      {/* Modal de Cancelación de Pedidos */}
      {cancelModalVisible && pedidoACancelar && (
        <Modal
          visible={cancelModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setCancelModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
              <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setCancelModalVisible(false)}>
                  <Ionicons name="arrow-back" size={20} color={C.cream2} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream }}>
                    ⚠️ ¿Desea cancelar este pedido?
                  </Text>
                  <Text style={{ fontSize: 12, color: C.cream2, marginTop: 2 }}>
                    Mesa: {pedidoACancelar.mesa}
                  </Text>
                </View>
              </View>
              
              <View style={{ padding: 18 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, marginBottom: 8 }}>
                  Ingresa el motivo de cancelación (Obligatorio):
                </Text>
                <TextInput
                  style={{
                    backgroundColor: C.surf2,
                    borderWidth: 1.5,
                    borderColor: C.border,
                    borderRadius: 8,
                    padding: 10,
                    color: C.text,
                    fontSize: 14,
                    minHeight: 60,
                    textAlignVertical: 'top',
                    marginBottom: 20
                  }}
                  placeholder="Ej. Error al digitar / Mesa equivocada / Cliente cancela"
                  placeholderTextColor={C.text3}
                  multiline={true}
                  numberOfLines={3}
                  value={cancelMotivo}
                  onChangeText={setCancelMotivo}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setCancelModalVisible(false)}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1.5,
                      borderColor: C.border,
                      alignItems: 'center',
                      backgroundColor: 'transparent'
                    }}
                  >
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>No</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={async () => {
                      if (!cancelMotivo.trim()) {
                        showToast('⚠️ Ingresa el motivo');
                        return;
                      }
                      try {
                        const url = `http://${serverIP}:3001/api/pedidos/${pedidoACancelar.uuid}/cancelar`;
                        const res = await axios.post(url, {
                          motivo: cancelMotivo.trim(),
                          usuario: userRol || 'Desconocido'
                        }, { timeout: 3000 });

                        if (res.data && res.data.success) {
                          // Liberar mesa localmente si es física
                          const mesaNum = Number(pedidoACancelar.mesa);
                          if (!isNaN(mesaNum)) {
                            setMesas(prev => prev.map(m => m.num === mesaNum ? { ...m, estado: 'libre' } : m));
                          }
                          // Quitar de pedidos locales
                          setPedidos(prev => prev.filter(p => p.uuid !== pedidoACancelar.uuid));
                          showToast('✅ Pedido cancelado');
                          setCancelModalVisible(false);
                          sincronizar();
                        }
                      } catch (e) {
                        showToast('⚠️ Error al cancelar pedido');
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: C.red,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Sí, Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal Ajustes Simplificado */}
      {ajustesModalVisible && (
        <Modal
          visible={ajustesModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setAjustesModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', maxWidth: 320, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
              <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setAjustesModalVisible(false)}>
                  <Ionicons name="arrow-back" size={20} color={C.cream2} />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream, flex: 1 }}>⚙️ Ajustes</Text>
              </View>

              <View style={{ padding: 18, gap: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    setAjustesModalVisible(false);
                    setIpConfigured(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: C.surf2,
                    padding: 14,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: C.border,
                    gap: 10
                  }}
                >
                  <Text style={{ fontSize: 18 }}>🔌</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>Cambiar IP del Servidor</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    await seleccionarAudioLocal();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: C.surf2,
                    padding: 14,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: C.border,
                    gap: 10
                  }}
                >
                  <Text style={{ fontSize: 18 }}>🎵</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>Tono de Alerta</Text>
                    <Text style={{ fontSize: 10, color: C.text3, marginTop: 2 }} numberOfLines={1}>
                      {customSoundUri ? "Personalizado cargado" : "Tono por defecto"}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setAjustesModalVisible(false);
                    Alert.alert(
                      "¿Deseas cerrar sesión?",
                      "",
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Cerrar Sesión",
                          style: "destructive",
                          onPress: async () => {
                            const currentName = loggedUser ? loggedUser.nombre : '';
                            setUserRol(null);
                            setLoggedUser(null);
                            await AsyncStorage.removeItem('loggedUser');
                            await AsyncStorage.removeItem('userRol');
                            try {
                              await axios.post(`http://${serverIP}:3001/api/logout`, { usuario: currentName }, { timeout: 2000 });
                            } catch (e) {}
                            showToast("🚪 Sesión cerrada");
                          }
                        }
                      ]
                    );
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: C.surf2,
                    padding: 14,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: C.border,
                    gap: 10
                  }}
                >
                  <Text style={{ fontSize: 18 }}>🚪</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>Cerrar Sesión</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {renderUpdateModal()}
    </SafeAreaView>
  );
}
// â”€â”€â”€ VISTA PEDIDO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PedidoView({
  mesas, productos, pedidos, onEnviar, showToast, paraLlevarNextNum, pedidoEditando, setPedidoEditando, borradores, guardarBorrador, eliminarBorrador,
  paso, setPaso, mesaSel, setMesaSel, carrito, setCarrito, mesaActivaModalVisible, setMesaActivaModalVisible, mesaActivaSelected, setMesaActivaSelected
}) {
  const [catActiva, setCatActiva] = useState(1);

  useEffect(() => {
    if (productos && productos.length > 0) {
      const activeStr = String(catActiva);
      const availableCatsStr = Array.from(new Set(productos.map(p => String(p.cat))));
      if (!availableCatsStr.includes(activeStr) && availableCatsStr.length > 0) {
        setCatActiva(availableCatsStr[0]);
      }
    }
  }, [productos]);

  const seleccionarMesa = (m) => {
    const draft = borradores[m.num];
    if (draft) {
      Alert.alert(
        "Pedido en borrador encontrado",
        `Se encontró un pedido en borrador para la Mesa ${m.num}. ¿Deseas continuarlo?`,
        [
          {
            text: "Continuar",
            onPress: () => {
              setCarrito(draft.items);
              if (draft.editUuid) {
                const activeOrder = pedidos.find(p => p.uuid === draft.editUuid);
                setPedidoEditando(activeOrder || null);
              } else {
                setPedidoEditando(null);
              }
              setMesaSel(m);
              setPaso(2);
            }
          },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: () => {
              eliminarBorrador(m.num);
              if (m.estado !== 'libre') {
                setMesaActivaSelected(m);
                setMesaActivaModalVisible(true);
              } else {
                setCarrito([]);
                setPedidoEditando(null);
                setMesaSel(m);
                setPaso(2);
              }
            }
          }
        ]
      );
    } else {
      if (m.estado !== 'libre') {
        setMesaActivaSelected(m);
        setMesaActivaModalVisible(true);
      } else {
        if (mesaSel && mesaSel.num !== m.num && carrito.length > 0) {
          Alert.alert(
            "Cambiar de Mesa",
            `¿Deseas descartar el pedido actual de la ${mesaSel.num}?`,
            [
              {
                text: "Sí, descartar",
                onPress: () => {
                  setCarrito([]);
                  setPedidoEditando(null);
                  setMesaSel(m);
                  setPaso(2);
                }
              },
              { text: "Cancelar", style: "cancel" }
            ]
          );
        } else {
          setMesaSel(m);
          setPaso(2);
        }
      }
    }
  };

  const agregarAlCarrito = (prod) => {
    setCarrito(c => {
      const isEditing = !!pedidoEditando;
      const ex = c.find(i => i.id === prod.id && (!isEditing || i.estado !== 'listo'));
      if (ex) {
        return c.map(i => (i.id === prod.id && (!isEditing || i.estado !== 'listo'))
          ? { ...i, cantidad: i.cantidad + 1 }
          : i
        );
      }
      return [...c, { ...prod, cantidad: 1, estado: 'pendiente', nota: '' }];
    });
    showToast("➕ " + prod.nombre);
  };

  const cambiarQty = (id, estado, delta) => {
    setCarrito(c => {
      const updated = c.map(i => (i.id === id && i.estado === estado) ? { ...i, cantidad: i.cantidad + delta } : i);
      return updated.filter(i => i.cantidad > 0);
    });
  };

  const total = carrito.reduce((a, i) => a + i.precio * i.cantidad, 0);
  const count = carrito.reduce((a, i) => a + i.cantidad, 0);

  const enviar = () => {
    if (!carrito.length) return;
    const items = carrito.map(i => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      nota: i.nota || "",
      cat: i.cat,
      precio: i.precio,
      estado: i.estado || 'pendiente'
    }));
    onEnviar(mesaSel.num, items, !!pedidoEditando, pedidoEditando?.uuid);
    setCarrito([]);
    setPaso(1);
    setMesaSel(null);
    setPedidoEditando(null);
  };

  const prods = productos.filter(p => String(p.cat) === String(catActiva) && p.disp);

  // PASO 1: Mesas
  if (paso === 1) {
    return (
      <View style={{ flex: 1, padding: 14 }}>
        {/* Compact step indicator */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "rgba(245,230,200,0.06)",
          borderRadius: 10,
          paddingVertical: 8,
          paddingHorizontal: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: "rgba(245,230,200,0.08)",
        }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.orange, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: "white" }}>1</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.cream, marginLeft: 6 }}>Elegir mesa</Text>
          <View style={{ flex: 1, height: 1.5, backgroundColor: "rgba(245,230,200,0.15)", marginHorizontal: 10 }} />
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(245,230,200,0.1)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: C.text3 }}>2</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: "500", color: C.text3, marginLeft: 6 }}>Pedido</Text>
        </View>

        {/* Legend */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4CAF70" }} />
            <Text style={{ fontSize: 10, color: C.cream2 }}>Libre</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#DC2626" }} />
            <Text style={{ fontSize: 10, color: C.cream2 }}>Ocupada</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#D97706" }} />
            <Text style={{ fontSize: 10, color: C.cream2 }}>Cuenta</Text>
          </View>
        </View>

        {/* Tables grid — 2 columns */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 10 }}>
          {mesas.map(m => {
            const sel = mesaSel?.id === m.id;
            const bgColor = m.estado === "libre" ? "#F0FDF4" : m.estado === "ocupada" ? "#FEF2F2" : "#FFFBEB";
            const borderColor = sel ? C.orange : m.estado === "libre" ? "#86EFAC" : m.estado === "ocupada" ? "#FCA5A5" : "#FCD34D";
            const statusColor = m.estado === "libre" ? "#15803D" : m.estado === "ocupada" ? "#DC2626" : "#D97706";
            const statusBg = m.estado === "libre" ? "#DCFCE7" : m.estado === "ocupada" ? "#FEE2E2" : "#FEF3C7";

            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => seleccionarMesa(m)}
                style={{
                  width: '48%',
                  aspectRatio: 1,
                  backgroundColor: bgColor,
                  borderRadius: 12,
                  borderWidth: sel ? 3 : 2,
                  borderColor: borderColor,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  marginBottom: 14,
                  ...(sel ? { shadowColor: C.orange, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 } : {}),
                }}
              >
                <Text style={{ fontSize: 50, fontWeight: "900", color: C.text, marginBottom: 6 }}>{m.num}</Text>
                <View style={{ backgroundColor: statusBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: statusColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {m.estado}
                  </Text>
                </View>
                {borradores[m.num] && (
                  <Text style={{ fontSize: 10, fontWeight: "700", color: C.orange, marginTop: 4 }}>
                    📝 Borrador
                  </Text>
                )}
                {sel && (
                  <View style={{ position: "absolute", top: 8, right: 8 }}>
                    <Ionicons name="checkmark-circle" size={22} color={C.orange} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Para Llevar card */}
        <TouchableOpacity
          onPress={() => {
            const numParaLlevar = 'Para Llevar #' + String(paraLlevarNextNum).padStart(3, '0');
            const targetMesa = { id: 'para_llevar_' + Date.now(), num: numParaLlevar, estado: 'libre', isParaLlevar: true };
            const draft = borradores[numParaLlevar];
            if (draft) {
              Alert.alert(
                "Pedido en borrador encontrado",
                `Se encontró un pedido en borrador para ${numParaLlevar}. ¿Deseas continuarlo?`,
                [
                  {
                    text: "Continuar",
                    onPress: () => {
                      setCarrito(draft.items);
                      setPedidoEditando(null);
                      setMesaSel(targetMesa);
                      setPaso(2);
                    }
                  },
                  {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: () => {
                      eliminarBorrador(numParaLlevar);
                      setCarrito([]);
                      setPedidoEditando(null);
                      setMesaSel(targetMesa);
                      setPaso(2);
                    }
                  }
                ]
              );
            } else {
              if (mesaSel && mesaSel.num !== numParaLlevar && carrito.length > 0) {
                Alert.alert(
                  "Cambiar de Mesa",
                  `¿Deseas descartar el pedido actual de la ${mesaSel.num}?`,
                  [
                    {
                      text: "Sí, descartar",
                      onPress: () => {
                        setCarrito([]);
                        setPedidoEditando(null);
                        setMesaSel(targetMesa);
                        setPaso(2);
                      }
                    },
                    { text: "Cancelar", style: "cancel" }
                  ]
                );
              } else {
                setMesaSel(targetMesa);
                setPaso(2);
              }
            }
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(232,82,10,0.08)",
            borderWidth: 1.5,
            borderColor: C.orange,
            borderRadius: 12,
            padding: 14,
            marginTop: 10,
            gap: 10,
          }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(232,82,10,0.15)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 18 }}>🛍️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: C.orange }}>Pedido Para Llevar</Text>
              {borradores['Para Llevar #' + String(paraLlevarNextNum).padStart(3, '0')] && (
                <Text style={{ fontSize: 10, fontWeight: "700", color: C.orange }}>
                  (📝 Pedido en Borrador)
                </Text>
              )}
            </View>
            <Text style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>Crear nuevo pedido sin mesa</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={C.orange} />
        </TouchableOpacity>

        {/* Continue button */}
        <TouchableOpacity
          style={{
            backgroundColor: mesaSel ? C.orange : "rgba(232,82,10,0.3)",
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            marginTop: 10,
          }}
          onPress={() => mesaSel && setPaso(2)}
          disabled={!mesaSel}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>
            {mesaSel ? `Continuar con Mesa ${mesaSel.num} →` : "Selecciona una mesa"}
          </Text>
        </TouchableOpacity>

        {/* Modal para Mesas Ocupadas (Ver / Editar) */}
        {mesaActivaModalVisible && mesaActivaSelected && (
          <Modal
            visible={mesaActivaModalVisible}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setMesaActivaModalVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
                <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={() => setMesaActivaModalVisible(false)}>
                    <Ionicons name="arrow-back" size={20} color={C.cream2} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream }}>
                      Mesa {mesaActivaSelected.num}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.cream2, marginTop: 2 }}>
                      Estado: {mesaActivaSelected.estado}
                    </Text>
                  </View>
                </View>

                <View style={{ padding: 18 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 8 }}>Productos pedidos:</Text>
                  <ScrollView style={{ maxHeight: 150, marginBottom: 18 }}>
                    {(() => {
                      const activeOrder = pedidos.find(p => Number(p.mesa) === mesaActivaSelected.num && p.estado === 'activo');
                      if (!activeOrder || !activeOrder.items) {
                        return <Text style={{ fontSize: 12, color: C.text3 }}>No hay productos en este pedido.</Text>;
                      }
                      return activeOrder.items.map((it, idx) => (
                        <Text key={idx} style={{ fontSize: 12, color: C.text2, marginBottom: 4 }}>
                          • {it.cantidad}x {it.nombre} ({it.estado === 'listo' ? '✅ Listo' : it.estado === 'preparando' ? '🔥 Prep.' : '⏳ Pend.'}) {it.nota ? `- 📝 ${it.nota}` : ''}
                        </Text>
                      ));
                    })()}
                  </ScrollView>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => setMesaActivaModalVisible(false)}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: C.border,
                        alignItems: 'center',
                        backgroundColor: 'transparent'
                      }}
                    >
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>Cerrar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        const activeOrder = pedidos.find(p => Number(p.mesa) === mesaActivaSelected.num && p.estado === 'activo');
                        if (activeOrder) {
                          const loadAndEdit = () => {
                            setPedidoEditando(activeOrder);
                            // Map items
                            const itemsForCart = activeOrder.items.map(item => {
                              const prod = productos.find(p => p.nombre === item.nombre) || {};
                              return {
                                id: prod.id || ('temp_' + item.nombre),
                                cat: item.cat || prod.cat,
                                nombre: item.nombre,
                                precio: item.precio || prod.precio || 0,
                                desc: prod.desc || '',
                                emoji: prod.emoji || '🍽️',
                                cantidad: item.cantidad,
                                nota: item.nota || '',
                                estado: item.estado || 'pendiente'
                              };
                            });
                            setCarrito(itemsForCart);
                            setMesaSel(mesaActivaSelected);
                            setPaso(2);
                            setMesaActivaModalVisible(false);
                          };

                          if (mesaSel && mesaSel.num !== mesaActivaSelected.num && carrito.length > 0) {
                            Alert.alert(
                              "Cambiar de Mesa",
                              `¿Deseas descartar el pedido actual de la ${mesaSel.num}?`,
                              [
                                {
                                  text: "Sí, descartar",
                                  onPress: loadAndEdit
                                },
                                { text: "Cancelar", style: "cancel" }
                              ]
                            );
                          } else {
                            loadAndEdit();
                          }
                        } else {
                          setMesaActivaModalVisible(false);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 8,
                        backgroundColor: C.orange,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>✏️ Editar Pedido</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  }

  // PASO 2: Menú + Carrito
  return (
    <View style={{ flex: 1 }}>
      {/* Barra sup */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 8 }}>
        <TouchableOpacity
          style={s.btnGhost}
          onPress={() => {
            if (carrito.length > 0 && mesaSel) {
              guardarBorrador(mesaSel.num, carrito, !!pedidoEditando, pedidoEditando?.uuid);
              showToast(`📝 Borrador guardado: ${mesaSel.num}`);
            }
            setPaso(1);
          }}
        >
          <Text style={{ color: C.cream, fontSize: 13 }}>
            {pedidoEditando ? '⬅ Volver' : '⬅ Volver a Mesas'}
          </Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: undefined, fontWeight: "800", fontSize: 16, color: C.cream }}>
          Mesa {mesaSel?.num} {pedidoEditando ? '(Editando)' : ''}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Categorías scroll horizontal */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 10, gap: 8 }}
          style={{ flexGrow: 0 }}
        >
          {Array.from(new Set(productos.map(p => p.cat))).map(catVal => {
            const origCat = CATEGORIAS.find(c => c.id === Number(catVal));
            const catName = origCat ? origCat.nombre : String(catVal);
            return (
              <TouchableOpacity
                key={String(catVal)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: String(catActiva) === String(catVal) ? C.orange : "rgba(245,230,200,0.2)",
                  backgroundColor: String(catActiva) === String(catVal) ? C.orange : "rgba(245,230,200,0.07)",
                }}
                onPress={() => setCatActiva(catVal)}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: String(catActiva) === String(catVal) ? "700" : "500",
                    color: String(catActiva) === String(catVal) ? "white" : "rgba(245,230,200,0.7)",
                  }}
                  numberOfLines={1}
                >
                  {catName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Productos */}
        <View style={s.prodsGrid}>
          {prods.map(p => (
            <TouchableOpacity key={p.id} style={s.prodCard} onPress={() => agregarAlCarrito(p)}>
              <Text style={{ fontSize: 28 }}>{p.emoji}</Text>
              <Text style={s.prodNombre}>{p.nombre}</Text>
              <Text style={s.prodDesc} numberOfLines={2}>{p.desc}</Text>
              <Text style={s.prodPrecio}>${p.precio.toLocaleString("es-CO")}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Carrito */}
        {carrito.length > 0 && (
          <View style={[s.card, { margin: 14, marginTop: 8 }]}>
            <View style={s.cardHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={s.cardTitle}>🛒 Pedido</Text>
                <View style={s.badgeOrange}><Text style={s.badgeTxt}>{count} ítems</Text></View>
              </View>
              {!pedidoEditando && (
                <TouchableOpacity
                  onPress={() => setCarrito([])}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: "rgba(220,38,38,0.1)", borderRadius: 6 }}
                >
                  <Ionicons name="trash-bin-outline" size={14} color={C.red} />
                  <Text style={{ fontSize: 11, color: C.red, fontWeight: "700" }}>Vaciar</Text>
                </TouchableOpacity>
              )}
            </View>
            {carrito.map((item, idx) => {
              const isLocked = item.estado === 'listo';
              return (
                <View key={idx}>
                  <View style={s.carritoItem}>
                    <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={s.carritoNombre}>{item.nombre}</Text>
                      {item.estado && (
                        <Text style={{ fontSize: 9, color: isLocked ? C.green : item.estado === 'preparando' ? C.orange : C.yellow, fontWeight: '700' }}>
                          {isLocked ? '✅ Listo' : item.estado === 'preparando' ? '🔥 Preparando' : '⏳ Pendiente'}
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => !isLocked && setCarrito(c => c.filter((_, i) => i !== idx))}
                        style={{ marginRight: 4, opacity: isLocked ? 0.3 : 1 }}
                        disabled={isLocked}
                      >
                        <Ionicons name="trash-outline" size={16} color={C.red} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.qtyBtn, { opacity: isLocked ? 0.3 : 1 }]}
                        onPress={() => !isLocked && cambiarQty(item.id, item.estado, -1)}
                        disabled={isLocked}
                      >
                        <Text style={s.qtyBtnTxt}>−</Text>
                      </TouchableOpacity>
                      <Text style={s.qtyNum}>{item.cantidad}</Text>
                      <TouchableOpacity
                        style={[s.qtyBtn, { opacity: isLocked ? 0.3 : 1 }]}
                        onPress={() => !isLocked && cambiarQty(item.id, item.estado, 1)}
                        disabled={isLocked}
                      >
                        <Text style={s.qtyBtnTxt}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 12, color: C.text2, minWidth: 64, textAlign: "right" }}>
                      ${(item.precio * item.cantidad).toLocaleString("es-CO")}
                    </Text>
                  </View>
                  <TextInput
                    style={[s.notaInput, { opacity: isLocked ? 0.6 : 1 }]}
                    placeholder={isLocked ? "Sin notas" : "Nota para cocina..."}
                    placeholderTextColor={C.text3}
                    value={item.nota}
                    editable={!isLocked}
                    onChangeText={t => setCarrito(c => c.map((it, i) => i === idx ? { ...it, nota: t } : it))}
                  />
                </View>
              );
            })}
            <View style={s.carritoTotal}>
              <Text style={{ fontSize: 13, color: C.text2 }}>Total</Text>
              <Text style={s.carritoTotalNum}>${total.toLocaleString("es-CO")}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, margin: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 1.5,
                  borderColor: C.border,
                  borderRadius: 10,
                  padding: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: 'transparent'
                }}
                onPress={() => {
                  if (mesaSel) {
                    eliminarBorrador(mesaSel.num);
                  }
                  setCarrito([]);
                  setPaso(1);
                  setMesaSel(null);
                  setPedidoEditando(null);
                }}
              >
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>❌ Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnPrimary, { flex: 2 }]} onPress={enviar}>
                <Text style={s.btnPrimaryTxt}>
                  {pedidoEditando ? 'Guardar Cambios ✏️' : 'Enviar a cocina 🔥'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── VISTA COCINA ─────────────────────────────────────────
function CocinaView({ pedidos, onActualizar }) {
  const [ticker, setTicker] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTicker(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);
  const estadoBadge = { pendiente: C.surf3, preparando: "#FEF3C7", lisdestPath: "#DCFCE7" };
  const estadoColor = { pendiente: C.text2, preparando: "#92400E", lisdestPath: "#15803D" };
  const estadoLabel = { pendiente: "⏳ Pendiente", preparando: "🔥 Preparando", lisdestPath: "✅ Listo" };

  const pedidosCocina = pedidos.map(p => {
    const itemsConIdx = p.items.map((it, idx) => ({ ...it, originalIdx: idx }));
    const itemsCocina = itemsConIdx.filter(it => (!(Number(it.cat) >= 6) || it.cat === undefined) && it.estado !== "listo");
    return { ...p, itemsFiltered: itemsCocina };
  }).filter(p => p.itemsFiltered.length > 0);

  if (!pedidosCocina.length) {
    return (
      <View style={[s.content, { alignItems: "center", justifyContent: "center", flex: 1 }]}>
        <Text style={{ fontSize: 40 }}>🎉</Text>
        <Text style={{ color: C.cream2, marginTop: 10, fontSize: 15 }}>Todo al día — sin pedidos en Cocina</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text style={[s.sectionTitle]}>Panel de Cocina</Text>
        <View style={s.badgeOrange}><Text style={s.badgeTxt}>{pedidosCocina.length} pedidos</Text></View>
      </View>
      {pedidosCocina.map(p => (
        <View key={p.uuid} style={[s.card, { marginBottom: 14 }]}>
          <View style={[s.cardHeader, { backgroundColor: C.brand, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", fontSize: 17, color: C.cream }}>Mesa {p.mesa}</Text>
              <Text style={{ fontSize: 11, color: C.cream2, opacity: 0.7 }}>🕒 {p.hora}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {p.itemsFiltered.some(it => it.estado === "pendiente") && (
                <TouchableOpacity
                  style={{
                    backgroundColor: C.orange,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 6,
                    marginRight: 6
                  }}
                  onPress={() => {
                    p.itemsFiltered.forEach(it => {
                      if (it.estado === "pendiente") {
                        onActualizar(p.uuid, it.originalIdx, "preparando");
                      }
                    });
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>🔥 Iniciar Mesa</Text>
                </TouchableOpacity>
              )}
              {(() => {
                const mins = obtenerMinutosTranscurridos(p.hora);
                return (
                  <>
                    <View style={s.badgeYellow}>
                      <Text style={s.badgeTxt}>En cocina</Text>
                    </View>
                    {mins >= 15 && (
                      <View style={[s.badgeBase, { backgroundColor: C.red, marginLeft: 6 }]}>
                        <Text style={s.badgeTxt}>⚠️ DESPACHAR YA</Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </View>
          </View>
          <View style={{ padding: 12 }}>
            {p.itemsFiltered.map((it) => (
              <View key={it.originalIdx} style={s.itemCocina}>
                <Text style={s.itemQty}>×{it.cantidad}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: C.text }}>{it.nombre}</Text>
                  {!!it.nota && <Text style={{ fontSize: 11, color: C.text2 }}>📝 {it.nota}</Text>}
                </View>
                <View style={[s.badgeBase, { backgroundColor: estadoBadge[it.estado] }]}>
                  <Text style={{ fontSize: 11, fontWeight: "500", color: estadoColor[it.estado] }}>
                    {estadoLabel[it.estado]}
                  </Text>
                </View>
                {it.estado === "preparando" && (
                  <TouchableOpacity style={[s.btnSmGreen, { marginLeft: 6 }]} onPress={() => onActualizar(p.uuid, it.originalIdx, "listo")}>
                    <Text style={{ color: "white", fontSize: 12 }}>✅ Listo</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── VISTA BAR ────────────────────────────────────────────
function BarView({ pedidos, onActualizar }) {
  const estadoBadge = { pendiente: C.surf3, preparando: "#FEF3C7", lisdestPath: "#DCFCE7" };
  const estadoColor = { pendiente: C.text2, preparando: "#92400E", lisdestPath: "#15803D" };
  const estadoLabel = { pendiente: "⏳ Pendiente", preparando: "🔥 Preparando", lisdestPath: "✅ Listo" };

  const pedidosBar = pedidos.map(p => {
    const itemsConIdx = p.items.map((it, idx) => ({ ...it, originalIdx: idx }));
    const itemsBar = itemsConIdx.filter(it => Number(it.cat) >= 6 && it.estado !== "listo");
    return { ...p, itemsFiltered: itemsBar };
  }).filter(p => p.itemsFiltered.length > 0);

  if (!pedidosBar.length) {
    return (
      <View style={[s.content, { alignItems: "center", justifyContent: "center", flex: 1 }]}>
        <Text style={{ fontSize: 40 }}>🍹</Text>
        <Text style={{ color: C.cream2, marginTop: 10, fontSize: 15 }}>Todo al día — sin pedidos en Bar</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text style={[s.sectionTitle]}>Panel de Bar</Text>
        <View style={s.badgeOrange}><Text style={s.badgeTxt}>{pedidosBar.length} pedidos</Text></View>
      </View>
      {pedidosBar.map(p => (
        <View key={p.uuid} style={[s.card, { marginBottom: 14 }]}>
          <View style={[s.cardHeader, { backgroundColor: C.brand }]}>
            <View>
              <Text style={{ fontWeight: "800", fontSize: 17, color: C.cream }}>Mesa {p.mesa}</Text>
              <Text style={{ fontSize: 11, color: C.cream2, opacity: 0.7 }}>🕒 {p.hora}</Text>
            </View>
            <View style={s.badgeYellow}><Text style={s.badgeTxt}>En bar</Text></View>
          </View>
          <View style={{ padding: 12 }}>
            {p.itemsFiltered.map((it) => (
              <View key={it.originalIdx} style={s.itemCocina}>
                <Text style={s.itemQty}>×{it.cantidad}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: C.text }}>{it.nombre}</Text>
                  {!!it.nota && <Text style={{ fontSize: 11, color: C.text2 }}>📝 {it.nota}</Text>}
                </View>
                <View style={[s.badgeBase, { backgroundColor: estadoBadge[it.estado] }]}>
                  <Text style={{ fontSize: 11, fontWeight: "500", color: estadoColor[it.estado] }}>
                    {estadoLabel[it.estado]}
                  </Text>
                </View>
                {it.estado === "pendiente" && (
                  <TouchableOpacity style={[s.btnSmDark, { marginLeft: 6 }]} onPress={() => onActualizar(p.uuid, it.originalIdx, "preparando")}>
                    <Text style={{ color: C.cream, fontSize: 12 }}>🔥 Iniciar</Text>
                  </TouchableOpacity>
                )}
                {it.estado === "preparando" && (
                  <TouchableOpacity style={[s.btnSmGreen, { marginLeft: 6 }]} onPress={() => onActualizar(p.uuid, it.originalIdx, "listo")}>
                    <Text style={{ color: "white", fontSize: 12 }}>✅ Listo</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── VISTA CAJA (CON ACUMULACIÓN REAL, SUGERENCIAS Y CORRECCIÓN DE SIMBOLO) ───
function CajaView({
  pedidos, productos, setPedidos, mesas, setMesas, ventas, setVentas, serverIP, showToast, sesionActiva, setSesionActiva, loggedUser, onSolicitarCancelar,
  cajaCobroModalVisible, setCajaCobroModalVisible, cierreModalVisible, setCierreModalVisible,
  fiados, setFiados
}) {
  const [pedidoSel, setPedidoSel] = useState(null);
  const [metodoPago, setMetodoPago] = useState('efectivo'); 
  const [nombreDeudor, setNombreDeudor] = useState('');

  // Estados para apertura y cierre de caja
  const [aperturaBase, setAperturaBase] = useState('');
  const [cierreReal, setCierreReal] = useState('');
  const [cierreReporte, setCierreReporte] = useState(null);

  // Estados para Liquidación Posterior
  const [liqModalVisible, setLiqModalVisible] = useState(false);
  const [deudorSel, setDeudorSel] = useState(null);
  const [metodoLiq, setMetodoLiq] = useState('efectivo');
  const [verDeudores, setVerDeudores] = useState(false);
  const [deudorExpandido, setDeudorExpandido] = useState(null);

  // Función para calcular el valor total de cualquier pedido o cuenta acumulada
  const calcularTotal = (pedido) => {
    if (!pedido) return 0;
    if (pedido.ordenes_historial) {
      return pedido.ordenes_historial.reduce((totalSum, orden) => {
        if (!orden.items) return totalSum;
        return totalSum + orden.items.reduce((sum, item) => {
          const price = item.precio !== undefined ? item.precio : (productos.find(p => p.nombre === item.nombre)?.precio || 0);
          return sum + (price * item.cantidad);
        }, 0);
      }, 0);
    }
    if (!pedido.items) return 0;
    return pedido.items.reduce((sum, item) => {
      const price = item.precio !== undefined ? item.precio : (productos.find(p => p.nombre === item.nombre)?.precio || 0);
      return sum + (price * item.cantidad);
    }, 0);
  };

  // PROCESAR EL COBRO DESDE UNA MESA
  const confirmarCobro = async () => {
    if (!pedidoSel) return;

    if (metodoPago === 'fiado' && !nombreDeudor.trim()) {
      showToast('⚠️ Escribe o selecciona el nombre de la persona');
      return;
    }

    const fechaActual = new Date().toISOString();

    if (metodoPago === 'fiado') {
      const deudorLimpio = nombreDeudor.trim();
      
      // BUSQUEDA ESTRICTA: Ignora mayúsculas, minúsculas y espacios invisibles
      const clienteExistenteIdx = fiados.findIndex(
        f => f.deudor && f.deudor.trim().toLowerCase() === deudorLimpio.toLowerCase()
      );
      
      let nuevosFiados = [...fiados];
      const nuevaOrden = {
        fecha: fechaActual,
        mesa: String(pedidoSel.mesa),
        items: pedidoSel.items.map(it => ({
          nombre: it.nombre,
          cantidad: it.cantidad,
          precio: it.precio !== undefined ? it.precio : (productos.find(p => p.nombre === it.nombre)?.precio || 0),
          cat: it.cat
        }))
      };

      if (clienteExistenteIdx > -1) {
        // ─── CLIENTE EXISTENTE: REGISTRAR EN EL HISTORIAL DE ÓRDENES ───
        const existingFiado = fiados[clienteExistenteIdx];
        const historialActualizado = [...(existingFiado.ordenes_historial || []), nuevaOrden];

        // Evita duplicar el número de la mesa si vuelve a pedir de la misma
        const mesasSet = new Set();
        if (existingFiado.mesa) {
          String(existingFiado.mesa).split(',').forEach(m => {
            if (m.trim()) mesasSet.add(m.trim());
          });
        }
        if (pedidoSel.mesa) {
          String(pedidoSel.mesa).split(',').forEach(m => {
            if (m.trim()) mesasSet.add(m.trim());
          });
        }
        const updatedMesa = Array.from(mesasSet).join(', ');

        nuevosFiados[clienteExistenteIdx] = {
          ...existingFiado,
          ordenes_historial: historialActualizado,
          items: historialActualizado,
          fecha_fiado: fechaActual,
          mesa: updatedMesa
        };

        // Guardar estados y persistencia en caché del celular
        setFiados(nuevosFiados);
        await AsyncStorage.setItem('fiados', JSON.stringify(nuevosFiados));

        // Liberar la mesa para el mapa de meseros
        setPedidos(pedidos.filter(p => p.uuid !== pedidoSel.uuid));
        const mNum = Number(pedidoSel.mesa);
        if (!isNaN(mNum)) setMesas(mesas.map(m => m.num === mNum ? { ...m, estado: 'libre' } : m));

        // Petición PUT al servidor SQLite
        try {
          const urlFiado = `http://${serverIP}:3001/api/pedidos/${existingFiado.uuid}/fiado`;
          await axios.put(urlFiado, {
            deudor: existingFiado.deudor, // Conserva la capitalización original
            fecha_fiado: fechaActual,
            items: historialActualizado,
            mesa: updatedMesa,
            usuario: loggedUser ? loggedUser.nombre : 'Caja'
          }, { timeout: 3000 });
          showToast(`📝 Cuenta acumulada con éxito`);
        } catch (e) {
          console.error('Error merging fiado on server:', e.message);
          showToast("⚠️ Guardado local en Cartera (sin conexión)");
        }

        // Completar/Eliminar el nuevo pedido en el servidor (DELETE)
        try {
          const urlDelete = `http://${serverIP}:3001/api/pedidos/${pedidoSel.uuid}`;
          await axios.delete(urlDelete, { timeout: 5000 });
        } catch (e) {
          console.error('Error completing merged order on server:', e.message);
        }

      } else {
        // ─── CLIENTE NUEVO: CREAR REGISTRO ÚNICO DESDE CERO CON HISTORIAL ───
        const nuevoRegistro = {
          uuid: pedidoSel.uuid, // Mantiene el id para el mapeo con el servidor
          mesa: String(pedidoSel.mesa),
          estado: 'fiado',
          deudor: deudorLimpio,
          fecha_fiado: fechaActual,
          ordenes_historial: [nuevaOrden],
          items: [nuevaOrden]
        };
        nuevosFiados = [nuevoRegistro, ...nuevosFiados];

        // Guardar estados y persistencia en caché del celular
        setFiados(nuevosFiados);
        await AsyncStorage.setItem('fiados', JSON.stringify(nuevosFiados));

        // Liberar la mesa para el mapa de meseros
        setPedidos(pedidos.filter(p => p.uuid !== pedidoSel.uuid));
        const mNum = Number(pedidoSel.mesa);
        if (!isNaN(mNum)) setMesas(mesas.map(m => m.num === mNum ? { ...m, estado: 'libre' } : m));

        // Petición PUT al servidor SQLite
        try {
          const urlFiado = `http://${serverIP}:3001/api/pedidos/${pedidoSel.uuid}/fiado`;
          await axios.put(urlFiado, {
            deudor: deudorLimpio,
            fecha_fiado: fechaActual,
            items: [nuevaOrden],
            mesa: String(pedidoSel.mesa),
            usuario: loggedUser ? loggedUser.nombre : 'Caja'
          }, { timeout: 3000 });
          showToast(`📝 Cuenta creada con éxito`);
        } catch (e) {
          console.error('Error saving new fiado to server:', e.message);
          showToast("⚠️ Guardado local en Cartera");
        }
      }

      setNombreDeudor('');
      setCajaCobroModalVisible(false);
      setPedidoSel(null);
      return;
    }

    // ─── COBRO NORMAL (EFECTIVO O TRANSFERENCIA) ───
    const total = calcularTotal(pedidoSel);
    const detallesVenta = pedidoSel.items.map(item => ({
      producto_id: productos.find(p => p.nombre === item.nombre)?.id || null,
      nombre_producdestPath: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio !== undefined ? item.precio : (productos.find(p => p.nombre === item.nombre)?.precio || 0),
      subtotal: (item.precio !== undefined ? item.precio : (productos.find(p => p.nombre === item.nombre)?.precio || 0)) * item.cantidad
    }));

    try {
      await axios.post(`http://${serverIP}:3001/api/ventas`, { fecha: fechaActual, tipo_origen: 'Mesa', mesa: String(pedidoSel.mesa), total, metodo_pago: metodoPago === 'efectivo' ? 'Efectivo' : 'Transferencia', sesion_id: sesionActiva ? sesionActiva.id : null, detalles: detallesVenta, usuario: loggedUser ? loggedUser.nombre : 'Caja' });
      await axios.delete(`http://${serverIP}:3001/api/pedidos/${pedidoSel.uuid}`);
      showToast("✅ Cobro registrado");
    } catch (e) {
      showToast("⚠️ Respaldado en memoria local");
    }

    setVentas([{ id: Date.now(), mesa: pedidoSel.mesa, total, metodo: metodoPago === 'efectivo' ? 'Efectivo' : 'Transferencia', hora: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) }, ...ventas]);
    setPedidos(pedidos.filter(p => p.uuid !== pedidoSel.uuid));
    const mesaNumero = Number(pedidoSel.mesa);
    if (!isNaN(mesaNumero)) setMesas(mesas.map(m => m.num === mesaNumero ? { ...m, estado: 'libre' } : m));
    setCajaCobroModalVisible(false);
    setPedidoSel(null);
  };

  // LIQUIDAR LA TARJETA ÚNICA ACUMULADA
  const procesarLiquidacionDeuda = async () => {
    if (!deudorSel) return;
    const totalAcumulado = calcularTotal(deudorSel);
    const fechaActual = new Date().toISOString();

    const flatItems = [];
    if (deudorSel.ordenes_historial) {
      deudorSel.ordenes_historial.forEach(orden => {
        if (orden.items) {
          orden.items.forEach(it => {
            const index = flatItems.findIndex(x => x.nombre === it.nombre);
            if (index > -1) {
              flatItems[index].cantidad += it.cantidad;
            } else {
              flatItems.push({
                nombre: it.nombre,
                cantidad: it.cantidad,
                precio: it.precio !== undefined ? it.precio : (productos.find(p => p.nombre === it.nombre)?.precio || 0)
              });
            }
          });
        }
      });
    } else if (deudorSel.items) {
      deudorSel.items.forEach(it => {
        flatItems.push(it);
      });
    }

    const detallesVenta = flatItems.map(item => ({
      producto_id: productos.find(p => p.nombre === item.nombre)?.id || null,
      nombre_producdestPath: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio,
      subtotal: item.precio * item.cantidad
    }));

    try {
      await axios.post(`http://${serverIP}:3001/api/ventas`, { fecha: fechaActual, tipo_origen: 'Fiado Pagado', mesa: `Deuda: ${deudorSel.deudor}`, total: totalAcumulado, metodo_pago: metodoLiq === 'efectivo' ? 'Efectivo' : 'Transferencia', sesion_id: sesionActiva ? sesionActiva.id : null, detalles: detallesVenta, usuario: loggedUser ? loggedUser.nombre : 'Caja' });
      await axios.delete(`http://${serverIP}:3001/api/pedidos/${deudorSel.uuid}`);

      const carteraActualizada = fiados.filter(f => f.uuid !== deudorSel.uuid);
      setFiados(carteraActualizada);
      await AsyncStorage.setItem('fiados', JSON.stringify(carteraActualizada));

      setVentas([{ id: Date.now(), mesa: `👤 ${deudorSel.deudor}`, total: totalAcumulado, metodo: metodoLiq === 'efectivo' ? 'Efectivo' : 'Transferencia', hora: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) }, ...ventas]);
      showToast("✅ Cuenta saldada por completo");
      setLiqModalVisible(false);
      setDeudorSel(null);
    } catch (e) {
      showToast("⚠️ Servidor desconectado");
    }
  };

  // RENDERS DE CAJA CERRADA
  if (!sesionActiva) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <Text style={[s.sectionTitle, { marginBottom: 12 }]}>💰 Control de Caja</Text>
        <View style={[s.card, { padding: 20, backgroundColor: C.surf2, alignItems: 'center', marginTop: 10 }]}>
          <Ionicons name="lock-closed" size={56} color={C.orange} style={{ marginBottom: 14 }} />
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 10 }}>
            La caja se encuentra CERRADA
          </Text>
          <Text style={{ fontSize: 12, color: C.text2, textAlign: 'center', marginBottom: 20, lineHeight: 18 }}>
            Ingresa la base inicial de caja para abrir la sesión de cobro y poder facturar pedidos.
          </Text>
          
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, alignSelf: 'flex-start', marginBottom: 6 }}>
            Base de Caja Inicial ($)
          </Text>
          <TextInput
            style={{
              width: '100%',
              backgroundColor: C.surface,
              borderWidth: 1.5,
              borderColor: C.border,
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: C.text,
              marginBottom: 20
            }}
            placeholder="Ej. 100000"
            placeholderTextColor={C.text3}
            keyboardType="numeric"
            value={aperturaBase}
            onChangeText={setAperturaBase}
          />
          <TouchableOpacity
            onPress={async () => {
              const base = parseFloat(aperturaBase);
              if (isNaN(base) || base < 0) {
                showToast('⚠️ Ingresa una base válida');
                return;
              }
              try {
                const res = await axios.post(`http://${serverIP}:3001/api/caja/abrir`, { base_inicial: base }, { timeout: 3000 });
                if (res.data && res.data.success) {
                  setSesionActiva(res.data.sesion);
                  setAperturaBase('');
                  showToast('✅ Caja abierta con éxito');
                }
              } catch (e) {
                showToast('⚠️ Error al conectar con el servidor');
              }
            }}
            style={{
              backgroundColor: C.green,
              width: '100%',
              padding: 14,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8
            }}
          >
            <Ionicons name="key" size={18} color="white" />
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>ABRIR SESIÓN DE CAJA</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.content}>
      {/* Session Header Banner */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(76,175,112,0.1)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: C.green
      }}>
        <View>
          <Text style={{ color: C.cream, fontSize: 13, fontWeight: '800' }}>🟢 SESIÓN DE CAJA ACTIVA</Text>
          <Text style={{ color: C.cream2, fontSize: 11, marginTop: 2 }}>
            Base Inicial: {sesionActiva.base_inicial.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={async () => {
            try {
              const res = await axios.get(`http://${serverIP}:3001/api/caja/resumen-cierre/${sesionActiva.id}`, { timeout: 3000 });
              if (res.data && res.data.success) {
                setCierreReporte(res.data);
                setCierreReal('');
                setCierreModalVisible(true);
              }
            } catch (e) {
              showToast('⚠️ Error al consultar el servidor');
            }
          }}
          style={{
            backgroundColor: C.orange,
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4
          }}
        >
          <Ionicons name="lock-closed" size={14} color="white" />
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>CERRAR CAJA</Text>
        </TouchableOpacity>
      </View>

      <Text style={[s.sectionTitle, { marginBottom: 12 }]}>💰 Cuentas Pendientes en Mesas</Text>
      {pedidos.length === 0 ? (
        <View style={{ padding: 15, alignItems: 'center' }}><Text style={{ color: C.cream2 }}>No hay mesas pendientes de pago</Text></View>
      ) : (
        pedidos.map(p => {
          const totalMesa = calcularTotal(p);
          const isLlevar = typeof p.mesa === 'string' && p.mesa.startsWith('Para');
          return (
            <View key={p.uuid} style={[s.card, { marginBottom: 12, padding: 14, backgroundColor: C.surf2 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{isLlevar ? p.mesa : `Mesa ${p.mesa}`}</Text>
                <Text style={{ fontSize: 12, color: C.text3 }}>🕒 {p.hora}</Text>
              </View>
              {p.items.map((it, idx) => (
                <Text key={idx} style={{ fontSize: 12, color: C.text2 }}>• {it.cantidad}x {it.nombre}</Text>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.orange }}>Total: {totalMesa.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => onSolicitarCancelar(p)}
                    style={{
                      backgroundColor: 'transparent',
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      borderWidth: 1.5,
                      borderColor: C.red,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>❌ Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={s.btnSmGreen} onPress={() => { setPedidoSel(p); setMetodoPago('efectivo'); setNombreDeudor(''); setCajaCobroModalVisible(true); }}><Text style={{ color: 'white', fontWeight: '700' }}>💰 Cobrar</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}

      {/* Botón Interruptor Discreto */}
      <TouchableOpacity
        onPress={() => setVerDeudores(!verDeudores)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(61,26,10,0.02)',
          borderColor: C.border,
          borderWidth: 1,
          borderRadius: 8,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginTop: 20,
          marginBottom: 10,
          justifyContent: 'space-between'
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name={verDeudores ? "eye-outline" : "eye-off-outline"} size={16} color={C.text2} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, letterSpacing: 0.5 }}>Control de Registro</Text>
        </View>
        <Ionicons name={verDeudores ? "chevron-up" : "chevron-down"} size={16} color={C.text3} />
      </TouchableOpacity>

      {verDeudores && (
        <>
          {fiados.length === 0 ? (
            <View style={[s.card, { padding: 16, alignItems: 'center' }]}><Text style={{ fontSize: 12, color: C.cream2 }}>No hay registros pendientes.</Text></View>
          ) : (
            fiados.map(f => {
              const totalAcumulado = calcularTotal(f);
              const expandido = deudorExpandido === f.uuid;
              return (
                <View key={f.uuid} style={[s.card, { marginBottom: 12, padding: 12, backgroundColor: C.surf2, borderColor: C.border, borderWidth: 1 }]}>
                  {/* Cabecera del Acordeón */}
                  <TouchableOpacity
                    onPress={() => setDeudorExpandido(expandido ? null : f.uuid)}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 2
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>👤 {f.deudor}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.red, opacity: 0.85 }}>
                        {totalAcumulado.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}
                      </Text>
                      <Ionicons name={expandido ? "chevron-up-outline" : "chevron-down-outline"} size={16} color={C.text3} />
                    </View>
                  </TouchableOpacity>

                  {/* Detalle Expandible */}
                  {expandido && (
                    <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
                      {/* Historial de Órdenes */}
                      <View style={{ gap: 8, marginBottom: 12 }}>
                        {f.ordenes_historial && f.ordenes_historial.map((orden, oIdx) => {
                          const fechaOrd = orden.fecha ? new Date(orden.fecha).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A';
                          return (
                            <View key={oIdx} style={{
                              padding: 8,
                              backgroundColor: 'rgba(61,26,10,0.02)',
                              borderRadius: 6,
                              borderLeftWidth: 2,
                              borderLeftColor: C.orange
                            }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: C.text2 }}>📅 {fechaOrd}</Text>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: C.text3 }}>📍 Mesa: {orden.mesa || 'N/A'}</Text>
                              </View>
                              {orden.items && orden.items.map((it, itIdx) => (
                                <Text key={itIdx} style={{ fontSize: 11, color: C.text, marginBottom: 2 }}>
                                  • {it.cantidad}x {it.nombre} <Text style={{ color: C.text3 }}>({((it.precio || 0) * it.cantidad).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })})</Text>
                                </Text>
                              ))}
                            </View>
                          );
                        })}
                      </View>

                      {/* Botón de Liquidación */}
                      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: C.text2 }}>Saldo: <Text style={{ color: C.orange, fontWeight: '800' }}>{totalAcumulado.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text></Text>
                        <TouchableOpacity onPress={() => { setDeudorSel(f); setMetodoLiq('efectivo'); setLiqModalVisible(true); }} style={{ backgroundColor: C.green, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }}><Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>Liquidar Deuda</Text></TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </>
      )}

      {/* HISTORIAL DE VENTAS */}
      <Text style={[s.sectionTitle, { marginTop: 22, marginBottom: 10 }]}>📋 Ventas del Día</Text>
      <View style={[s.card, { padding: 14, backgroundColor: C.surface }]}>
        {ventas.length === 0 ? (
          <Text style={{ fontSize: 12, color: C.text3, textAlign: 'center' }}>No hay ventas registradas</Text>
        ) : (
          ventas.map((v, idx) => (
            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: idx < ventas.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
              <View><Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{typeof v.mesa === 'string' && v.mesa.startsWith('Para') ? v.mesa : `Mesa ${v.mesa}`}</Text><Text style={{ fontSize: 10, color: C.text3 }}>{v.hora || 'Ahora'} • {v.metodo || 'Efectivo'}</Text></View>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.green }}>{v.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
            </View>
          ))
        )}
      </View>

      {/* ─── MODAL DE COBRO DE MESA (CON FILTRO DE SELECCIÓN RÁPIDA) ─── */}
      {pedidoSel && (
        <Modal visible={cajaCobroModalVisible} animationType="fade" transparent={true}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: C.border }}>
              <View style={{ backgroundColor: C.brand, padding: 16 }}><Text style={{ fontSize: 16, fontWeight: '800', color: C.cream }}>Registrar Pago - Mesa {pedidoSel.mesa}</Text></View>
              <ScrollView style={{ padding: 18, maxHeight: 420 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 14 }}>Total Cuenta: {calcularTotal(pedidoSel).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                
                <View style={{ gap: 8 }}>
                  <TouchableOpacity onPress={() => setMetodoPago('efectivo')} style={[{ padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surf2 }, metodoPago === 'efectivo' && { borderColor: C.green, backgroundColor: 'rgba(45,106,63,0.05)' }]}><Text style={{ fontWeight: '700', color: C.text }}>💵 Efectivo</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setMetodoPago('transferencia')} style={[{ padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surf2 }, metodoPago === 'transferencia' && { borderColor: C.orange, backgroundColor: 'rgba(232,82,10,0.05)' }]}><Text style={{ fontWeight: '700', color: C.text }}>📲 Transferencia</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setMetodoPago('fiado')} style={[{ padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surf2 }, metodoPago === 'fiado' && { borderColor: C.yellow, backgroundColor: 'rgba(217,119,6,0.05)' }]}><Text style={{ fontWeight: '700', color: C.text }}>👤 Dejar Fiado (Anotar en Cuenta)</Text></TouchableOpacity>
                </View>

                {metodoPago === 'fiado' && (
                  <View style={{ marginTop: 14, paddingBottom: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.text2, marginBottom: 4 }}>Nombre del Cliente Deudor:</Text>
                    <TextInput style={s.formInput} placeholder="Escribe el nombre del cliente..." placeholderTextColor={C.text3} value={nombreDeudor} onChangeText={setNombreDeudor} />
                    
                    {/* SELECCIÓN RÁPIDA DE DEUDORES ACTUALES */}
                    {(() => {
                      const deudoresExistentes = Array.from(
                        new Set(
                          fiados
                            .map(f => f.deudor ? f.deudor.trim() : '')
                            .filter(d => d.length > 0)
                        )
                      );
                      
                      if (deudoresExistentes.length > 0) {
                        return (
                          <View style={{ marginTop: 10 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: C.text3, marginBottom: 6 }}>👥 Clientes con cuenta activa (Toca para seleccionar):</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                              {deudoresExistentes.map((name, idx) => (
                                <TouchableOpacity key={idx} onPress={() => setNombreDeudor(name)} style={{ backgroundColor: C.surf3, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.brand }}><Text style={{ fontSize: 12, color: C.text, fontWeight: '700' }}>👤 {name}</Text></TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        );
                      }
                      return null;
                    })()}
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, paddingBottom: 14 }}>
                  <TouchableOpacity onPress={() => { setCajaCobroModalVisible(false); setPedidoSel(null); setNombreDeudor(''); }} style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' }}><Text style={{ color: C.text, fontWeight: '700' }}>Cancelar</Text></TouchableOpacity>
                  <TouchableOpacity onPress={confirmarCobro} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: 'white', fontWeight: '700' }}>Confirmar</Text></TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* MODAL DE LIQUIDACIÓN POSTERIOR */}
      {deudorSel && (
        <Modal visible={liqModalVisible} animationType="fade" transparent={true}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: C.border }}>
              <View style={{ backgroundColor: C.brand, padding: 16 }}><Text style={{ fontSize: 16, fontWeight: '800', color: C.cream }}>💰 Saldar Cartera - {deudorSel.deudor}</Text></View>
              <View style={{ padding: 18 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: C.text, textAlign: 'center', marginBottom: 16 }}>Monto Acumulado: {calcularTotal(deudorSel).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, marginBottom: 8 }}>¿Cómo cancela la deuda hoy?</Text>
                <View style={{ gap: 10, marginBottom: 20 }}>
                  <TouchableOpacity onPress={() => setMetodoLiq('efectivo')} style={[s.cajaSelect, { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }, metodoLiq === 'efectivo' && { borderColor: C.green, backgroundColor: 'rgba(45,106,63,0.05)' }]}><Text style={{ fontWeight: '700', color: C.text }}>💵 Pagó en Efectivo</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setMetodoLiq('transferencia')} style={[s.cajaSelect, { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }, metodoLiq === 'transferencia' && { borderColor: C.orange, backgroundColor: 'rgba(232,82,10,0.05)' }]}><Text style={{ fontWeight: '700', color: C.text }}>📲 Pagó por Transferencia</Text></TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => setLiqModalVisible(false)} style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' }}><Text style={{ color: C.text, fontWeight: '700' }}>Cerrar</Text></TouchableOpacity>
                  <TouchableOpacity onPress={procesarLiquidacionDeuda} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: C.green, alignItems: 'center' }}><Text style={{ color: 'white', fontWeight: '700' }}>Saldar Cuenta</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal de Cierre de Caja */}
      {cierreReporte && (
        <Modal
          visible={cierreModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setCierreModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
              <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setCierreModalVisible(false)}>
                  <Ionicons name="arrow-back" size={20} color={C.cream2} />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream, flex: 1 }}>
                  🔒 Cierre de Caja
                </Text>
              </View>
              
              <ScrollView contentContainerStyle={{ padding: 18 }}>
                <View style={{ gap: 10, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 }}>
                    <Text style={{ color: C.text2, fontSize: 13 }}>💵 Base Inicial:</Text>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{cierreReporte.base_inicial.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 }}>
                    <Text style={{ color: C.text2, fontSize: 13 }}>💵 Ventas en Efectivo:</Text>
                    <Text style={{ color: C.green, fontWeight: '700', fontSize: 13 }}>+{cierreReporte.ingresos_efectivo.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 }}>
                    <Text style={{ color: C.text2, fontSize: 13 }}>📲 Ventas en Transferencia:</Text>
                    <Text style={{ color: C.orange, fontWeight: '700', fontSize: 13 }}>+{cierreReporte.ingresos_transferencia.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 }}>
                    <Text style={{ color: C.text2, fontSize: 13 }}>💸 Gastos Registrados:</Text>
                    <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>-{cierreReporte.gastos.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6, backgroundColor: 'rgba(232,82,10,0.05)', padding: 6, borderRadius: 6 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>💰 Saldo Esperado en Caja:</Text>
                    <Text style={{ color: C.orange, fontWeight: '800', fontSize: 14 }}>{cierreReporte.saldo_final_esperado.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, marginBottom: 6 }}>Efectivo Real en Caja ($)</Text>
                <TextInput
                  style={{
                    backgroundColor: C.surf2,
                    borderWidth: 1.5,
                    borderColor: C.border,
                    borderRadius: 8,
                    padding: 10,
                    color: C.text,
                    fontSize: 16,
                    marginBottom: 20
                  }}
                  placeholder="Digita el efectivo total contado"
                  placeholderTextColor={C.text3}
                  keyboardType="numeric"
                  value={cierreReal}
                  onChangeText={setCierreReal}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setCierreModalVisible(false)}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1.5,
                      borderColor: C.border,
                      alignItems: 'center',
                      backgroundColor: 'transparent'
                    }}
                  >
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={async () => {
                      const realVal = parseFloat(cierreReal);
                      if (isNaN(realVal) || realVal < 0) {
                        showToast('⚠️ Ingresa un valor válido');
                        return;
                      }
                      try {
                        const res = await axios.post(`http://${serverIP}:3001/api/caja/cerrar`, {
                          sesion_id: sesionActiva.id,
                          saldo_final_real: realVal
                        }, { timeout: 3000 });
                        
                        if (res.data && res.data.success) {
                          setSesionActiva(null);
                          setCierreModalVisible(false);
                          setCierreReporte(null);
                          Alert.alert(
                            "Caja Cerrada",
                            `Arqueo de Caja Completado:\n\n` +
                            `• Base Inicial: ${res.data.base_inicial.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n` +
                            `• Ingresos Efectivo: ${res.data.ingresos_efectivo.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n` +
                            `• Gastos: ${res.data.gastos.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n` +
                            `• Esperado en Caja: ${res.data.saldo_final_esperado.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n` +
                            `• Real Contado: ${res.data.saldo_final_real.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n` +
                            `• Diferencia: ${res.data.diferencia.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}\n\n` +
                            `${res.data.diferencia < 0 ? '⚠️ Falta dinero' : res.data.diferencia > 0 ? '🎉 Sobra dinero' : '✅ Caja cuadrada'}`
                          );
                        }
                      } catch (e) {
                        showToast('⚠️ Error al cerrar caja');
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: C.red,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Confirmar Cierre</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

function AdminView({ productos, setProductos: realSetProductos, mesas, setMesas, pedidos, setPedidos, showToast, serverIP, sincronizar, userRol, sesionActiva, usuarios, setUsuarios, loggedUser,
  adminTab, setAdminTab,
  adminProductModalVisible, setAdminProductModalVisible,
  adminGastoModalVisible, setAdminGastoModalVisible,
  adminInsumoModalVisible, setAdminInsumoModalVisible,
  adminMovimientoModalVisible, setAdminMovimientoModalVisible,
  adminUserModalVisible, setAdminUserModalVisible,
  adminChangePinModalVisible, setAdminChangePinModalVisible,
  adminVentaDetalleModalVisible, setAdminVentaDetalleModalVisible
}) {
  
  // ─── ESTADOS MENÚ ───
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCat, setNewProdCat] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdDisp, setNewProdDisp] = useState(true);

  // Estados dinámicos para categorías
  const [categorias, setCategorias] = useState(['Hamburguesas', 'Perros', 'Bebidas']);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [creandoNuevaCat, setCreandoNuevaCat] = useState(false);

  // ─── ESTADOS FINANZAS Y GASTOS ───
  const [finanzasReporte, setFinanzasReporte] = useState(null);
  const [gastoModalVisible, setGastoModalVisible] = useState(false);
  const [gastoDesc, setGastoDesc] = useState('');
  const [gastoCat, setGastoCat] = useState('Otros');
  const [gastoValor, setGastoValor] = useState('');
  const [gastoFechaFilter, setGastoFechaFilter] = useState('');

  // ─── ESTADOS INVENTARIO ───
  const [insumos, setInsumos] = useState([]);
  const [insumoModalVisible, setInsumoModalVisible] = useState(false);
  const [movimientoModalVisible, setMovimientoModalVisible] = useState(false);
  const [insumoSel, setInsumoSel] = useState(null);
  
  const [insumoNombre, setInsumoNombre] = useState('');
  const [insumoUnidad, setInsumoUnidad] = useState('Kg');
  const [insumoCant, setInsumoCant] = useState('');
  const [insumoMin, setInsumoMin] = useState('');
  const [insumoCompra, setInsumoCompra] = useState('');

  const [movTipo, setMovTipo] = useState('entrada'); // 'entrada' | 'ajuste'
  const [movCant, setMovCant] = useState('');
  const [movMotivo, setMovMotivo] = useState('');
  const [movimientosLog, setMovimientosLog] = useState([]);

  // ─── ESTADOS CANCELACIONES ───
  const [pedidosCancelados, setPedidosCancelados] = useState([]);
  const [cancelFilterFecha, setCancelFilterFecha] = useState('');
  const [cancelFilterMesa, setCancelFilterMesa] = useState('');
  const [cancelFilterUsuario, setCancelFilterUsuario] = useState('');

  // ─── ESTADOS USUARIOS (CRUD) ───
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [editUserSel, setEditUserSel] = useState(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRol, setNewUserRol] = useState('pedido');
  const [newUserActivo, setNewUserActivo] = useState(true);

  const [changePinModalVisible, setChangePinModalVisible] = useState(false);
  const [changePinUserSel, setChangePinUserSel] = useState(null);
  const [newPinVal, setNewPinVal] = useState('');

  // ─── ESTADOS AUDITORÍA ───
  const [auditoriaLogs, setAuditoriaLogs] = useState([]);
  const [auditUserFilter, setAuditUserFilter] = useState('');
  const [auditAccionFilter, setAuditAccionFilter] = useState('');
  const [auditFechaFilter, setAuditFechaFilter] = useState('');

  // ─── ESTADOS DETALLES DE VENTAS ───
  const [ventaDetalleModalVisible, setVentaDetalleModalVisible] = useState(false);
  const [ventaDetalleSelected, setVentaDetalleSelected] = useState(null);
  const [ventaDetallesItems, setVentaDetallesItems] = useState([]);

  const emojiPorCategoria = {
    1: "🍔",
    2: "🌭",
    3: "🌯",
    4: "🍟",
    5: "🌽",
    6: "🥤",
    7: "🍋",
    8: "🍺"
  };

  const getEmojiForCategory = (catId) => {
    const cat = CATEGORIAS.find(c => c.id === Number(catId));
    if (cat && cat.nombre) {
      const parts = cat.nombre.split(' ');
      if (parts[0]) return parts[0];
    }
    return emojiPorCategoria[catId] || "🍽️";
  };

  // ─── EFECTOS DE TAB Y AUTO-ACTUALIZACIÓN ───
  useEffect(() => {
    if (!serverIP) return;
    
    const cargarTodo = () => {
      if (adminTab === 'principal') {
        cargarFinanzas();
        cargarInventario();
        cargarUsuarios();
        cargarCancelados();
      } else if (adminTab === 'finanzas') {
        cargarFinanzas();
      } else if (adminTab === 'inventario') {
        cargarInventario();
      } else if (adminTab === 'cancelados') {
        cargarCancelados();
      } else if (adminTab === 'usuarios') {
        cargarUsuarios();
      } else if (adminTab === 'auditoria') {
        cargarAuditoria();
      }
    };

    cargarTodo();

    const timer = setInterval(cargarTodo, 30000);
    return () => clearInterval(timer);
  }, [adminTab, serverIP]);

  // Sincronizar categorías locales de forma dinámica desde los productos cargados
  useEffect(() => {
    if (productos && productos.length > 0) {
      const cleanNameMap = {
        1: 'Hamburguesas',
        2: 'Perros',
        3: 'Burritos',
        4: 'Salchipapas',
        5: 'Mazorcada',
        6: 'Jugos Naturales',
        7: 'Limonadas',
        8: 'Bebidas'
      };
      const uniqueCats = Array.from(new Set(productos.map(p => {
        const num = Number(p.cat);
        if (!isNaN(num) && cleanNameMap[num]) {
          return cleanNameMap[num];
        }
        return String(p.cat).trim();
      }).filter(Boolean)));
      
      setCategorias(prev => {
        const merged = Array.from(new Set([...prev, ...uniqueCats]));
        return merged;
      });
    }
  }, [productos]);

  const getCatValueFromName = (name) => {
    const map = {
      'hamburguesas': 1,
      'perros': 2,
      'burritos': 3,
      'salchipapas': 4,
      'mazorcada': 5,
      'jugos naturales': 6,
      'limonadas': 7,
      'bebidas': 8
    };
    const key = String(name).toLowerCase().trim();
    return map[key] !== undefined ? map[key] : name;
  };

  const getDisplayNameForCat = (catVal) => {
    const num = Number(catVal);
    if (!isNaN(num)) {
      const origCat = CATEGORIAS.find(c => c.id === num);
      if (origCat) return origCat.nombre;
    }
    const cleanNameMap = {
      'hamburguesas': '🍔 Hamburguesas',
      'perros': '🌭 Perros Calientes',
      'burritos': '🌯 Burritos',
      'salchipapas': '🍟 Salchipapas',
      'mazorcada': '🌽 Mazorcada',
      'jugos naturales': '🥤 Jugos Naturales',
      'limonadas': '🍋 Limonadas',
      'bebidas': '🍺 Bebidas / Cervezas'
    };
    const key = String(catVal).toLowerCase().trim();
    return cleanNameMap[key] || String(catVal);
  };

  // ─── METODOS DE LLAMADAS API ───

  // MENÚ: Agregar producto en SQLite
  const addProducto = async () => {
    if (!newProdName.trim()) { showToast('⚠️ Nombre requerido'); return; }
    const precioNum = parseFloat(newProdPrice);
    if (newProdPrice && isNaN(precioNum)) { showToast('⚠️ Precio inválido'); return; }
    
    let catVal = creandoNuevaCat ? nuevaCategoria.trim() : newProdCat;
    if (!catVal) { showToast('⚠️ Categoría requerida'); return; }

    const catIsNumeric = !isNaN(Number(catVal));
    const catId = catIsNumeric ? Number(catVal) : catVal;

    const nuevo = {
      cat: catId,
      nombre: newProdName.trim(),
      precio: precioNum || 0,
      desc: newProdDesc.trim(),
      emoji: getEmojiForCategory(catId),
      disp: newProdDisp ? 1 : 0
    };

    try {
      const res = await axios.post(`http://${serverIP}:3001/api/productos`, nuevo, { timeout: 3000 });
      if (res.data && res.data.success) {
        showToast('✅ Producto guardado en SQLite');
        
        if (creandoNuevaCat && !categorias.includes(nuevaCategoria.trim())) {
          setCategorias(prev => [...prev, nuevaCategoria.trim()]);
        }
        
        setNewProdName('');
        setNewProdPrice('');
        setNewProdDesc('');
        setNuevaCategoria('');
        setCreandoNuevaCat(false);
        setModalVisible(false);
        sincronizar();
      }
    } catch (e) {
      showToast('⚠️ Error al guardar producto');
    }
  };

  // MENÚ: Alternar disponibilidad
  const toggleProducto = async (id, currentDisp) => {
    try {
      const res = await axios.put(`http://${serverIP}:3001/api/productos/${id}/disponibilidad`, { disp: !currentDisp }, { timeout: 3000 });
      if (res.data && res.data.success) {
        showToast('✅ Disponibilidad actualizada');
        sincronizar();
      }
    } catch (e) {
      showToast('⚠️ Error al actualizar disponibilidad');
    }
  };

  // FINANZAS: Cargar reporte agrupado
  const cargarFinanzas = async () => {
    try {
      const res = await axios.get(`http://${serverIP}:3001/api/finanzas/reporte`, { timeout: 3000 });
      if (res.data) {
        setFinanzasReporte(res.data);
      }
    } catch (e) {
      console.error('Error loading finance report:', e.message);
    }
  };

  // USUARIOS: Cargar usuarios
  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`http://${serverIP}:3001/api/usuarios`, { timeout: 3000 });
      if (res.data && res.data.usuarios) {
        setUsuarios(res.data.usuarios);
      }
    } catch (e) {
      console.error('Error loading users:', e.message);
    }
  };

  // USUARIOS: Crear/Editar usuario
  const guardarUsuario = async () => {
    if (!newUserName.trim()) { showToast('⚠️ Nombre requerido'); return; }
    if (!editUserSel && (!newUserPin || newUserPin.length < 4 || newUserPin.length > 6)) {
      showToast('⚠️ PIN debe tener entre 4 y 6 dígitos numéricos');
      return;
    }
    if (newUserPin && (newUserPin.length < 4 || newUserPin.length > 6 || isNaN(Number(newUserPin)))) {
      showToast('⚠️ PIN inválido (4 a 6 dígitos)');
      return;
    }

    const payload = {
      id: editUserSel ? editUserSel.id : undefined,
      nombre: newUserName.trim(),
      pin: newUserPin ? newUserPin : undefined,
      rol: newUserRol,
      activo: newUserActivo ? 1 : 0,
      administrador_usuario: loggedUser ? loggedUser.nombre : 'Admin'
    };

    try {
      const res = await axios.post(`http://${serverIP}:3001/api/usuarios`, payload, { timeout: 3000 });
      if (res.data && res.data.success) {
        showToast(editUserSel ? '✅ Usuario actualizado' : '✅ Usuario creado');
        setUserModalVisible(false);
        setEditUserSel(null);
        setNewUserName('');
        setNewUserPin('');
        cargarUsuarios();
      }
    } catch (e) {
      showToast('⚠️ Error al guardar usuario');
    }
  };

  // USUARIOS: Guardar nuevo PIN
  const guardarNuevoPin = async () => {
    if (!newPinVal || newPinVal.length < 4 || newPinVal.length > 6 || isNaN(Number(newPinVal))) {
      showToast('⚠️ PIN debe tener entre 4 y 6 dígitos numéricos');
      return;
    }

    const payload = {
      id: changePinUserSel.id,
      nombre: changePinUserSel.nombre,
      pin: newPinVal,
      rol: changePinUserSel.rol,
      administrador_usuario: loggedUser ? loggedUser.nombre : 'Admin'
    };

    try {
      const res = await axios.post(`http://${serverIP}:3001/api/usuarios`, payload, { timeout: 3000 });
      if (res.data && res.data.success) {
        showToast('✅ PIN actualizado con éxito');
        setChangePinModalVisible(false);
        setChangePinUserSel(null);
        setNewPinVal('');
        cargarUsuarios();
      }
    } catch (e) {
      showToast('⚠️ Error al actualizar PIN');
    }
  };

  // AUDITORÍA: Cargar logs de auditoría con filtros
  const cargarAuditoria = async () => {
    try {
      const res = await axios.get(`http://${serverIP}:3001/api/auditoria`, {
        params: {
          usuario: auditUserFilter.trim() || undefined,
          accion: auditAccionFilter || undefined,
          fecha: auditFechaFilter.trim() || undefined
        },
        timeout: 3000
      });
      if (res.data && res.data.logs) {
        setAuditoriaLogs(res.data.logs);
      }
    } catch (e) {
      console.error('Error loading audit logs:', e.message);
    }
  };

  // FINANZAS: Registrar Gasto
  const registrarGasto = async () => {
    if (!gastoDesc.trim()) { showToast('⚠️ Descripción requerida'); return; }
    const valorNum = parseFloat(gastoValor);
    if (isNaN(valorNum) || valorNum <= 0) { showToast('⚠️ Valor de gasto inválido'); return; }

    const nuevoGasto = {
      descripcion: gastoDesc.trim(),
      categoria: gastoCat,
      valor: valorNum,
      sesion_id: sesionActiva ? sesionActiva.id : null
    };

    try {
      const res = await axios.post(`http://${serverIP}:3001/api/gastos`, nuevoGasto, { timeout: 3000 });
      if (res.data && res.data.success) {
        showToast('✅ Gasto registrado con éxito');
        setGastoDesc('');
        setGastoValor('');
        setGastoModalVisible(false);
        cargarFinanzas();
      }
    } catch (e) {
      showToast('⚠️ Error al registrar gasto');
    }
  };

  // INVENTARIO: Cargar insumos y Kardex
  const cargarInventario = async () => {
    try {
      const resInsumos = await axios.get(`http://${serverIP}:3001/api/inventario/insumos`, { timeout: 3000 });
      if (resInsumos.data) setInsumos(resInsumos.data.insumos);

      const resMov = await axios.get(`http://${serverIP}:3001/api/inventario/movimientos`, { timeout: 3000 });
      if (resMov.data) setMovimientosLog(resMov.data.movimientos);
    } catch (e) {
      console.error('Error loading inventory:', e.message);
    }
  };

  // INVENTARIO: Crear Insumo
  const registrarInsumo = async () => {
    if (!insumoNombre.trim()) { showToast('⚠️ Nombre del insumo requerido'); return; }
    const cantVal = parseFloat(insumoCant);
    const minVal = parseFloat(insumoMin);
    const compVal = parseFloat(insumoCompra);

    const nuevoInsumo = {
      nombre: insumoNombre.trim(),
      unidad: insumoUnidad,
      cantidad_actual: isNaN(cantVal) ? 0 : cantVal,
      stock_minimo: isNaN(minVal) ? 0 : minVal,
      precio_compra: isNaN(compVal) ? 0 : compVal
    };

    try {
      const res = await axios.post(`http://${serverIP}:3001/api/inventario/insumos`, nuevoInsumo, { timeout: 3000 });
      if (res.data && res.data.success) {
        showToast('✅ Insumo registrado con éxito');
        setInsumoNombre('');
        setInsumoCant('');
        setInsumoMin('');
        setInsumoCompra('');
        setInsumoModalVisible(false);
        cargarInventario();
      }
    } catch (e) {
      showToast('⚠️ Error: Insumo ya registrado o de red');
    }
  };

  // INVENTARIO: Registrar Movimiento Kardex
  const registrarMovimiento = async () => {
    const cantVal = parseFloat(movCant);
    if (isNaN(cantVal) || cantVal <= 0) { showToast('⚠️ Cantidad inválida'); return; }

    const movimiento = {
      tipo: movTipo,
      cantidad: cantVal,
      motivo: movMotivo.trim() || (movTipo === 'entrada' ? 'Entrada manual' : 'Ajuste de inventario')
    };

    try {
      const res = await axios.post(`http://${serverIP}:3001/api/inventario/insumos/${insumoSel.id}/movimiento`, movimiento, { timeout: 3000 });
      if (res.data && res.data.success) {
        showToast('✅ Movimiento registrado con éxito');
        setMovCant('');
        setMovMotivo('');
        setInsumoSel(null);
        setMovimientoModalVisible(false);
        cargarInventario();
      }
    } catch (e) {
      showToast('⚠️ Error al registrar movimiento');
    }
  };

  // CANCELACIONES: Cargar historial de cancelados
  const cargarCancelados = async () => {
    try {
      const res = await axios.get(`http://${serverIP}:3001/api/pedidos-cancelados`, { timeout: 3000 });
      if (res.data) setPedidosCancelados(res.data.cancelados);
    } catch (e) {
      console.error('Error loading cancelled orders:', e.message);
    }
  };

  const renderBackHeader = (title) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 }}>
      <TouchableOpacity
        onPress={() => setAdminTab('principal')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(245,230,200,0.08)',
          borderWidth: 1.5,
          borderColor: 'rgba(245,230,200,0.2)',
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 5,
        }}
      >
        <Ionicons name="arrow-back" size={14} color={C.cream2} />
        <Text style={{ color: C.cream, fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Volver</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 15, fontWeight: '800', color: C.cream }}>{title}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>

      {/* ─── TAB PRINCIPAL: DASHBOARD ─── */}
      {adminTab === 'principal' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream, marginBottom: 12 }}>
            ⚙️ Panel de Administración
          </Text>

          {/* Tarjetas KPI */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
            {/* Ventas Hoy */}
            <View style={[s.statCard, { flex: 1, minWidth: '45%' }]}>
              <Text style={{ fontSize: 24 }}>💰</Text>
              <Text style={[s.statValue, { color: C.green, marginTop: 4 }]}>
                ${finanzasReporte ? finanzasReporte.ventasHoy.toLocaleString('es-CO') : '0'}
              </Text>
              <Text style={s.statLabel}>Ventas Hoy</Text>
            </View>

            {/* Insumos con Stock Bajo */}
            <View style={[s.statCard, { flex: 1, minWidth: '45%' }]}>
              <Text style={{ fontSize: 24 }}>📦</Text>
              <Text style={[s.statValue, { color: insumos.filter(i => i.cantidad_actual < i.stock_minimo).length > 0 ? C.red : C.text, marginTop: 4 }]}>
                {insumos.filter(i => i.cantidad_actual < i.stock_minimo).length}
              </Text>
              <Text style={s.statLabel}>Stock Bajo</Text>
            </View>

            {/* Pedidos Activos */}
            <View style={[s.statCard, { flex: 1, minWidth: '45%' }]}>
              <Text style={{ fontSize: 24 }}>🍔</Text>
              <Text style={[s.statValue, { color: C.orange, marginTop: 4 }]}>
                {pedidos.filter(p => p.estado === 'activo').length}
              </Text>
              <Text style={s.statLabel}>Pedidos Activos</Text>
            </View>

            {/* Pedidos Cancelados */}
            <View style={[s.statCard, { flex: 1, minWidth: '45%' }]}>
              <Text style={{ fontSize: 24 }}>❌</Text>
              <Text style={[s.statValue, { color: C.red, marginTop: 4 }]}>
                {pedidosCancelados.length}
              </Text>
              <Text style={s.statLabel}>Pedidos Cancelados</Text>
            </View>

            {/* Gastos del Día */}
            <View style={[s.statCard, { flex: 1, minWidth: '45%' }]}>
              <Text style={{ fontSize: 24 }}>💸</Text>
              <Text style={[s.statValue, { color: C.red, marginTop: 4 }]}>
                ${finanzasReporte ? (finanzasReporte.gastosHoy || 0).toLocaleString('es-CO') : '0'}
              </Text>
              <Text style={s.statLabel}>Gastos del Día</Text>
            </View>

            {/* Balance Actual */}
            <View style={[s.statCard, { flex: 1, minWidth: '45%' }]}>
              <Text style={{ fontSize: 24 }}>🏦</Text>
              <Text style={[s.statValue, { color: finanzasReporte && finanzasReporte.balanceActual >= 0 ? C.green : C.red, marginTop: 4 }]}>
                ${finanzasReporte ? finanzasReporte.balanceActual.toLocaleString('es-CO') : '0'}
              </Text>
              <Text style={s.statLabel}>Balance Actual</Text>
            </View>
          </View>

          {/* Grid de submódulos */}
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.cream, marginBottom: 10 }}>
            Secciones disponibles
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 }}>
            {[
              { id: 'menu', label: '🍔 Gestión de Menú', desc: 'Platos, precios y disponibilidad' },
              { id: 'finanzas', label: '📊 Finanzas / Gastos', desc: 'Ventas, balance y registrar egresos' },
              { id: 'inventario', label: '📦 Inventario Kardex', desc: 'Stock de insumos y movimientos' },
              { id: 'usuarios', label: '👤 Gestión de Usuarios', desc: 'Roles, PINs y accesos' },
              { id: 'auditoria', label: '📋 Log de Auditoría', desc: 'Registro de todas las acciones' },
              { id: 'cancelados', label: '📋 Pedidos Cancelados', desc: 'Historial de cancelaciones' },
            ].map(item => (
              <TouchableOpacity
                key={item.id}
                onPress={() => setAdminTab(item.id)}
                style={{
                  width: '48%',
                  backgroundColor: C.surf2,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: C.border,
                  padding: 16,
                  minHeight: 110,
                  justifyContent: 'center'
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 4 }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 10, color: C.text2 }}>
                  {item.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ─── TAB 1: PRODUCTOS / MENU ─── */}
      {adminTab === 'menu' && (
        <View style={{ flex: 1, paddingHorizontal: 14 }}>
          {renderBackHeader('Gestión de Menú')}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {Object.entries(productos.reduce((acc, p) => {
              const catObj = CATEGORIAS.find(c => c.id === Number(p.cat));
              const catName = catObj ? catObj.nombre : (p.cat ? String(p.cat) : 'Sin categoría');
              (acc[catName] = acc[catName] || []).push(p);
              return acc;
            }, {})).map(([cat, items]) => (
              <View key={cat} style={s.catSection}>
                <Text style={s.catHeader}>{cat}</Text>
                {items.map((p, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surf2, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <Text style={{ fontSize: 24, marginRight: 12 }}>{p.emoji || '🍽️'}</Text>
                    
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, color: C.text, fontWeight: '500' }}>{p.nombre}</Text>
                      <Text style={{ fontSize: 14, color: C.text2, marginTop: 2 }}>{p.precio ? `$${p.precio.toLocaleString('es-CO')}` : ''}</Text>
                    </View>

                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: p.disp !== false ? C.green : C.text3, fontWeight: '700', fontSize: 10, marginBottom: 6 }}>
                        {p.disp !== false ? 'ACTIVO' : 'INACTIVO'}
                      </Text>
                      <TouchableOpacity
                        onPress={() => toggleProducto(p.id, p.disp)}
                        style={{
                          width: 40,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: p.disp !== false ? C.green : '#D1D5DB',
                          justifyContent: 'center',
                          alignItems: p.disp !== false ? 'flex-end' : 'flex-start',
                          padding: 2,
                        }}
                      >
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' }} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          {/* Botón flotante (+) */}
          <TouchableOpacity
            onPress={() => {
              setNewProdName('');
              setNewProdPrice('');
              setNewProdCat(String(CATEGORIAS[0]?.id || 1));
              setNewProdDesc('');
              setNewProdDisp(true);
              setCreandoNuevaCat(false);
              setNuevaCategoria('');
              setModalVisible(true);
            }}
            style={{
              position: 'absolute',
              bottom: 24,
              right: 24,
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: C.orange,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 6,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
            }}
          >
            <Ionicons name="add" size={32} color="#fff" />
          </TouchableOpacity>

          {/* Modal Nuevo Producto */}
          <Modal
            visible={modalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden', maxHeight: '85%' }}>
                <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="arrow-back" size={20} color={C.cream2} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream, flex: 1 }}>✨ Nuevo Producto (DB)</Text>
                </View>

                <ScrollView contentContainerStyle={{ padding: 18 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 6 }}>Nombre del producto</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="Ej. Hamburguesa doble"
                    placeholderTextColor={C.text3}
                    value={newProdName}
                    onChangeText={setNewProdName}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>Precio ($)</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="Ej. 18000"
                    placeholderTextColor={C.text3}
                    keyboardType="numeric"
                    value={newProdPrice}
                    onChangeText={setNewProdPrice}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>Descripción</Text>
                  <TextInput
                    style={[s.formInput, { minHeight: 60, textAlignVertical: 'top' }]}
                    placeholder="Ingredientes o detalles..."
                    placeholderTextColor={C.text3}
                    multiline={true}
                    numberOfLines={3}
                    value={newProdDesc}
                    onChangeText={setNewProdDesc}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>Categoría</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {categorias.map(catName => {
                      const catValue = getCatValueFromName(catName);
                      const isSelected = !creandoNuevaCat && String(newProdCat) === String(catValue);
                      const displayName = getDisplayNameForCat(catValue);
                      return (
                        <TouchableOpacity
                          key={catName}
                          onPress={() => {
                            setCreandoNuevaCat(false);
                            setNewProdCat(String(catValue));
                          }}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 20,
                            borderWidth: 1.5,
                            borderColor: isSelected ? C.orange : C.border,
                            backgroundColor: isSelected ? C.orange : C.surf2,
                          }}
                        >
                          <Text style={{ fontSize: 11, color: isSelected ? '#fff' : C.text, fontWeight: '600' }}>
                            {displayName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      onPress={() => {
                        setCreandoNuevaCat(true);
                      }}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 20,
                        borderWidth: 1.5,
                        borderColor: creandoNuevaCat ? C.orange : C.border,
                        backgroundColor: creandoNuevaCat ? C.orange : C.surf2,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: creandoNuevaCat ? '#fff' : C.text, fontWeight: '600' }}>
                        ➕ Agregar nueva categoría...
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {creandoNuevaCat && (
                    <View style={{ marginTop: 8, marginBottom: 14 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 6 }}>Nombre de la nueva categoría</Text>
                      <TextInput
                        style={s.formInput}
                        placeholder="Ej: Empanadas"
                        placeholderTextColor={C.text3}
                        value={nuevaCategoria}
                        onChangeText={setNuevaCategoria}
                      />
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.surf2, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 20 }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>Disponible</Text>
                      <Text style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{newProdDisp ? 'Activo' : 'Oculto'}</Text>
                    </View>
                    <Switch
                      value={newProdDisp}
                      onValueChange={setNewProdDisp}
                      trackColor={{ false: '#D1D5DB', true: C.greenL }}
                      thumbColor={newProdDisp ? C.green : '#F4F3F4'}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                    <TouchableOpacity
                      onPress={() => setModalVisible(false)}
                      style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' }}
                    >
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={addProducto}
                      style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Guardar</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      )}

      {/* ─── TAB 2: FINANZAS Y GASTOS ─── */}
      {adminTab === 'finanzas' && (
        <View style={{ flex: 1, paddingHorizontal: 14 }}>
          {renderBackHeader('Finanzas y Gastos')}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={s.sectionTitle}>📊 Reporte de Finanzas</Text>
            <TouchableOpacity
              onPress={() => setGastoModalVisible(true)}
              style={{
                backgroundColor: C.orange,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Ionicons name="add-circle" size={16} color="white" />
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>REGISTRAR GASTO</Text>
            </TouchableOpacity>
          </View>

          {finanzasReporte ? (
            <View style={{ gap: 14 }}>
              {/* Dashboard Grid */}
              <View style={s.statsGrid}>
                <View style={s.statCard}>
                  <Text style={s.statLabel}>Ventas Hoy</Text>
                  <Text style={[s.statValue, { color: C.green }]}>${finanzasReporte.ventasHoy.toLocaleString('es-CO')}</Text>
                  <Text style={s.statSub}>Jornada actual</Text>
                </View>

                <View style={s.statCard}>
                  <Text style={s.statLabel}>Ventas Semana</Text>
                  <Text style={s.statValue}>${finanzasReporte.ventasSemana.toLocaleString('es-CO')}</Text>
                  <Text style={s.statSub}>Últimos 7 días</Text>
                </View>
                
                <View style={s.statCard}>
                  <Text style={s.statLabel}>Ventas Mes</Text>
                  <Text style={s.statValue}>${finanzasReporte.ventasMes.toLocaleString('es-CO')}</Text>
                  <Text style={s.statSub}>Mes en curso</Text>
                </View>

                <View style={s.statCard}>
                  <Text style={s.statLabel}>Ticket Promedio</Text>
                  <Text style={[s.statValue, { color: C.orange }]}>${Math.round(finanzasReporte.ticketPromedio).toLocaleString('es-CO')}</Text>
                  <Text style={s.statSub}>Por transacción</Text>
                </View>

                <View style={s.statCard}>
                  <Text style={s.statLabel}>Promedio Diario</Text>
                  <Text style={s.statValue}>${Math.round(finanzasReporte.promedioDiario).toLocaleString('es-CO')}</Text>
                  <Text style={s.statSub}>Días operativos</Text>
                </View>

                <View style={s.statCard}>
                  <Text style={s.statLabel}>Promedio Semanal</Text>
                  <Text style={s.statValue}>${Math.round(finanzasReporte.promedioSemanal).toLocaleString('es-CO')}</Text>
                  <Text style={s.statSub}>Por semana activa</Text>
                </View>
              </View>

              {/* Payment Methods */}
              <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 10 }]}>💳 Métodos de Pago (Histórico)</Text>
              <View style={[s.card, { padding: 14, backgroundColor: C.surf2 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: C.text2, fontSize: 13 }}>💵 Efectivo:</Text>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>${finanzasReporte.pagoEfectivo.toLocaleString('es-CO')}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.text2, fontSize: 13 }}>📲 Transferencia:</Text>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>${finanzasReporte.pagoTransferencia.toLocaleString('es-CO')}</Text>
                </View>
              </View>

              {/* General Balance */}
              <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 10 }]}>⚖️ Balance General</Text>
              <View style={[s.card, { padding: 14, backgroundColor: C.surf2 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: C.text2, fontSize: 13 }}>Ingresos Totales:</Text>
                  <Text style={{ color: C.green, fontWeight: '700', fontSize: 13 }}>+${finanzasReporte.ingresosTotales.toLocaleString('es-CO')}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: C.text2, fontSize: 13 }}>Gastos Totales:</Text>
                  <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>-${finanzasReporte.gastosTotales.toLocaleString('es-CO')}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>Balance NedestPath:</Text>
                  <Text style={{ color: finanzasReporte.balanceActual >= 0 ? C.green : C.red, fontWeight: '800', fontSize: 14 }}>
                    ${finanzasReporte.balanceActual.toLocaleString('es-CO')}
                  </Text>
                </View>
              </View>

              {/* Recent Expenses List */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 8 }}>
                <Text style={[s.sectionTitle, { fontSize: 14 }]}>💸 Egresos Recientes</Text>
                <TextInput
                  style={[s.formInput, { paddingVertical: 4, paddingHorizontal: 10, fontSize: 11, minWidth: 120, height: 28, backgroundColor: C.surface }]}
                  placeholder="Filtrar fecha (AAAA-MM-DD)"
                  placeholderTextColor={C.text3}
                  value={gastoFechaFilter}
                  onChangeText={setGastoFechaFilter}
                />
              </View>
              <View style={[s.card, { padding: 14, backgroundColor: C.surface }]}>
                {(() => {
                  const filteredGastos = finanzasReporte.gastos.filter(g => !gastoFechaFilter || g.fecha.includes(gastoFechaFilter));
                  if (filteredGastos.length === 0) {
                    return <Text style={{ fontSize: 12, color: C.text3, textAlign: 'center', paddingVertical: 10 }}>No hay gastos registrados</Text>;
                  }
                  return filteredGastos.map((g, idx) => (
                    <View key={g.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: idx < filteredGastos.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{g.descripcion}</Text>
                        <Text style={{ fontSize: 10, color: C.text3 }}>🏷️ {g.categoria} • 📅 {g.fecha}</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: C.red }}>
                        -${g.valor.toLocaleString('es-CO')}
                      </Text>
                    </View>
                  ));
                })()}
              </View>

              {/* Recent Sales List */}
              <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 10 }]}>💰 Ventas Recientes</Text>
              <View style={[s.card, { padding: 14, backgroundColor: C.surface, marginBottom: 14 }]}>
                {finanzasReporte.ventas.length === 0 ? (
                  <Text style={{ fontSize: 12, color: C.text3, textAlign: 'center', paddingVertical: 10 }}>No hay ventas registradas</Text>
                ) : (
                  finanzasReporte.ventas.map((v, idx) => (
                    <TouchableOpacity
                      key={v.id || idx}
                      onPress={async () => {
                        try {
                          const res = await axios.get(`http://${serverIP}:3001/api/ventas/${v.id}/detalles`, { timeout: 3000 });
                          if (res.data && res.data.detalles) {
                            setVentaDetalleSelected(v);
                            setVentaDetallesItems(res.data.detalles);
                            setVentaDetalleModalVisible(true);
                          }
                        } catch (e) {
                          showToast('⚠️ Error al cargar detalles de venta');
                        }
                      }}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: idx < finanzasReporte.ventas.length - 1 ? 1 : 0,
                        borderBottomColor: C.border
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>
                          {v.tipo_origen === 'Para Llevar' ? v.mesa : `Mesa ${v.mesa}`}
                        </Text>
                        <Text style={{ fontSize: 10, color: C.text3 }}>
                          🕒 {new Date(v.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} • 💳 {v.metodo_pago}
                        </Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: C.green }}>
                          ${v.total.toLocaleString('es-CO')}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={C.text3} />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          ) : (
            <Text style={{ color: C.cream2, textAlign: 'center', padding: 20 }}>Cargando datos financieros...</Text>
          )}

          {/* Modal para Registrar Gasto */}
          <Modal
            visible={gastoModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setGastoModalVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
                <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={() => setGastoModalVisible(false)}>
                    <Ionicons name="arrow-back" size={20} color={C.cream2} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream, flex: 1 }}>💸 Registrar Gasto</Text>
                </View>

                <ScrollView contentContainerStyle={{ padding: 18 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 6 }}>Descripción del gasto</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="Ej. Compra de tomate y cebolla"
                    placeholderTextColor={C.text3}
                    value={gastoDesc}
                    onChangeText={setGastoDesc}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>Valor ($)</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="Ej. 25000"
                    placeholderTextColor={C.text3}
                    keyboardType="numeric"
                    value={gastoValor}
                    onChangeText={setGastoValor}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>Categoría del Gasto</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {['Carne', 'Pollo', 'Verduras', 'Pan', 'Queso', 'Bebidas', 'Gas', 'Servicios', 'Limpieza', 'Otros'].map(cat => {
                      const isSelected = gastoCat === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setGastoCat(cat)}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: isSelected ? C.orange : C.border,
                            backgroundColor: isSelected ? C.orange : C.surf2,
                          }}
                        >
                          <Text style={{ fontSize: 11, color: isSelected ? '#fff' : C.text, fontWeight: '600' }}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {!sesionActiva && (
                    <Text style={{ color: C.yellow, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' }}>
                      ⚠️ La caja está cerrada. El gasto se registrará sin sesión activa.
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity
                      onPress={() => setGastoModalVisible(false)}
                      style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' }}
                    >
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={registrarGasto}
                      style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Guardar Gasto</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </ScrollView>
        </View>
      )}

      {/* ─── TAB 3: INVENTARIO (INSUMOS) ─── */}
      {adminTab === 'inventario' && (
        <View style={{ flex: 1, paddingHorizontal: 14 }}>
          {renderBackHeader('Control de Inventario')}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={s.sectionTitle}>📦 Insumos del Sistema</Text>
              <TouchableOpacity
                onPress={() => setInsumoModalVisible(true)}
                style={{
                  backgroundColor: C.orange,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Ionicons name="add-circle" size={16} color="white" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>NUEVO INSUMO</Text>
              </TouchableOpacity>
            </View>

            {/* Insumos List */}
            {insumos.length === 0 ? (
              <View style={[s.card, { padding: 20, alignItems: 'center', backgroundColor: C.surf2 }]}>
                <Ionicons name="cube-outline" size={40} color={C.text3} />
                <Text style={{ fontSize: 13, color: C.text2, marginTop: 8 }}>No hay insumos registrados en inventario</Text>
              </View>
            ) : (
              insumos.map((ins) => {
                const stockBajo = ins.cantidad_actual < ins.stock_minimo;
                return (
                  <View key={ins.id} style={[s.card, { marginBottom: 12, padding: 14, backgroundColor: C.surf2, borderWidth: stockBajo ? 2 : 1, borderColor: stockBajo ? C.red : C.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{ins.nombre}</Text>
                      {stockBajo && (
                        <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#EF4444' }}>
                          <Text style={{ fontSize: 9, color: '#DC2626', fontWeight: '800' }}>⚠️ STOCK BAJO</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text style={{ fontSize: 12, color: C.text2 }}>
                        Stock Actual: <Text style={{ fontWeight: '700', color: stockBajo ? C.red : C.text }}>{ins.cantidad_actual} {ins.unidad}</Text> (Min: {ins.stock_minimo} {ins.unidad})
                      </Text>
                      <Text style={{ fontSize: 12, color: C.text3 }}>
                        Costo Compra: ${ins.precio_compra.toLocaleString('es-CO')}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setInsumoSel(ins);
                          setMovTipo('entrada');
                          setMovimientoModalVisible(true);
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: C.green,
                          paddingVertical: 6,
                          borderRadius: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 4
                        }}
                      >
                        <Ionicons name="add" size={14} color="white" />
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>➕ Entrada</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setInsumoSel(ins);
                          setMovTipo('ajuste');
                          setMovimientoModalVisible(true);
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: C.orange,
                          paddingVertical: 6,
                          borderRadius: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 4
                        }}
                      >
                        <Ionicons name="options-outline" size={14} color="white" />
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>➖ Ajuste</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}

            {/* Kardex Movements Logs */}
            <Text style={[s.sectionTitle, { marginTop: 20, marginBottom: 10 }]}>📋 Movimientos Recientes (Kardex)</Text>
            <View style={[s.card, { padding: 14, backgroundColor: C.surface }]}>
              {movimientosLog.length === 0 ? (
                <Text style={{ fontSize: 12, color: C.text3, textAlign: 'center', paddingVertical: 10 }}>No se han registrado movimientos</Text>
              ) : (
                movimientosLog.map((m, idx) => (
                  <View key={m.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: idx < movimientosLog.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>
                        {m.insumo_nombre}
                      </Text>
                      <Text style={{ fontSize: 10, color: C.text3 }}>📝 {m.motivo} • 📅 {m.fecha}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: m.tipo === 'entrada' ? C.green : C.orange }}>
                      {m.tipo === 'entrada' ? '+' : '⚙️ '}{m.cantidad} {m.unidad}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {/* Modal de Nuevo Insumo */}
          <Modal
            visible={insumoModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setInsumoModalVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
                <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={() => setInsumoModalVisible(false)}>
                    <Ionicons name="arrow-back" size={20} color={C.cream2} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream, flex: 1 }}>📦 Nuevo Insumo</Text>
                </View>

                <ScrollView contentContainerStyle={{ padding: 18 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 6 }}>Nombre del Insumo</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="Ej. Carne de Res (hamburguesa)"
                    placeholderTextColor={C.text3}
                    value={insumoNombre}
                    onChangeText={setInsumoNombre}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>Unidad de Medida</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {['Kg', 'Gr', 'Litros', 'Ml', 'Unidad', 'Caja', 'Paquete'].map(u => (
                      <TouchableOpacity
                        key={u}
                        onPress={() => setInsumoUnidad(u)}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: insumoUnidad === u ? C.orange : C.border,
                          backgroundColor: insumoUnidad === u ? C.orange : C.surf2,
                          marginBottom: 4
                        }}
                      >
                        <Text style={{ fontSize: 11, color: insumoUnidad === u ? 'white' : C.text, fontWeight: '600' }}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 6 }}>Cantidad Inicial</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="Ej. 10"
                    placeholderTextColor={C.text3}
                    keyboardType="numeric"
                    value={insumoCant}
                    onChangeText={setInsumoCant}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>Stock Mínimo Alerta</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="Ej. 5"
                    placeholderTextColor={C.text3}
                    keyboardType="numeric"
                    value={insumoMin}
                    onChangeText={setInsumoMin}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>Precio de Compra Unitario ($)</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="Ej. 12000"
                    placeholderTextColor={C.text3}
                    keyboardType="numeric"
                    value={insumoCompra}
                    onChangeText={setInsumoCompra}
                  />

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <TouchableOpacity
                      onPress={() => setInsumoModalVisible(false)}
                      style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' }}
                    >
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={registrarInsumo}
                      style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Crear Insumo</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Modal de Movimiento Kardex */}
          {insumoSel && (
            <Modal
              visible={movimientoModalVisible}
              animationType="fade"
              transparent={true}
              onRequestClose={() => { setInsumoSel(null); setMovimientoModalVisible(false); }}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => { setInsumoSel(null); setMovimientoModalVisible(false); }}>
                      <Ionicons name="arrow-back" size={20} color={C.cream2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream }}>
                        {movTipo === 'entrada' ? '➕ Registrar Entrada' : '⚙️ Ajuste de Stock'}
                      </Text>
                      <Text style={{ fontSize: 12, color: C.cream2, marginTop: 2 }}>Insumo: {insumoSel.nombre}</Text>
                    </View>
                  </View>

                  <View style={{ padding: 18 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, marginBottom: 6 }}>
                      {movTipo === 'entrada' ? 'Cantidad a ingresar:' : 'Nueva cantidad de stock física:'} ({insumoSel.unidad})
                    </Text>
                    <TextInput
                      style={s.formInput}
                      placeholder={movTipo === 'entrada' ? "Ej. 5" : `Actual: ${insumoSel.cantidad_actual}`}
                      placeholderTextColor={C.text3}
                      keyboardType="numeric"
                      value={movCant}
                      onChangeText={setMovCant}
                    />

                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, marginTop: 14, marginBottom: 6 }}>Motivo / Observación:</Text>
                    <TextInput
                      style={s.formInput}
                      placeholder="Ej. Compra de inventario / conteo semanal"
                      placeholderTextColor={C.text3}
                      value={movMotivo}
                      onChangeText={setMovMotivo}
                    />

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                      <TouchableOpacity
                        onPress={() => { setInsumoSel(null); setMovimientoModalVisible(false); }}
                        style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' }}
                      >
                        <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={registrarMovimiento}
                        style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: movTipo === 'entrada' ? C.green : C.orange, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Guardar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </View>
      )}

      {/* ─── TAB 4: PEDIDOS CANCELADOS (HISTORIAL) ─── */}
      {adminTab === 'cancelados' && (
        <View style={{ flex: 1, paddingHorizontal: 14 }}>
          {renderBackHeader('Historial de Cancelados')}
          
          {/* Filtros de Cancelación */}
          <View style={[s.card, { padding: 14, backgroundColor: C.surf2, marginBottom: 14 }]}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, marginBottom: 6 }}>🔍 Filtrar Cancelaciones:</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 90 }}>
                <Text style={{ fontSize: 10, color: C.text3, marginBottom: 3 }}>Fecha:</Text>
                <TextInput
                  style={[s.formInput, { paddingVertical: 5, fontSize: 12, height: 32 }]}
                  placeholder="Ej. 2026-06-08"
                  placeholderTextColor={C.text3}
                  value={cancelFilterFecha}
                  onChangeText={setCancelFilterFecha}
                />
              </View>
              <View style={{ flex: 1, minWidth: 60 }}>
                <Text style={{ fontSize: 10, color: C.text3, marginBottom: 3 }}>Mesa / Origen:</Text>
                <TextInput
                  style={[s.formInput, { paddingVertical: 5, fontSize: 12, height: 32 }]}
                  placeholder="Ej. 3 o Para"
                  placeholderTextColor={C.text3}
                  value={cancelFilterMesa}
                  onChangeText={setCancelFilterMesa}
                />
              </View>
              <View style={{ flex: 1, minWidth: 80 }}>
                <Text style={{ fontSize: 10, color: C.text3, marginBottom: 3 }}>Usuario:</Text>
                <TextInput
                  style={[s.formInput, { paddingVertical: 5, fontSize: 12, height: 32 }]}
                  placeholder="Ej. Mesero"
                  placeholderTextColor={C.text3}
                  value={cancelFilterUsuario}
                  onChangeText={setCancelFilterUsuario}
                />
              </View>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
          <Text style={[s.sectionTitle, { marginBottom: 12 }]}>📋 Historial de Cancelaciones</Text>

          {(() => {
            const filteredCancelados = pedidosCancelados.filter(c => {
              const matchFecha = !cancelFilterFecha || new Date(c.fecha).toISOString().split('T')[0].includes(cancelFilterFecha) || new Date(c.fecha).toLocaleString('es-CO').includes(cancelFilterFecha);
              const matchMesa = !cancelFilterMesa || String(c.mesa).toLowerCase().includes(cancelFilterMesa.toLowerCase());
              const matchUsuario = !cancelFilterUsuario || String(c.usuario).toLowerCase().includes(cancelFilterUsuario.toLowerCase());
              return matchFecha && matchMesa && matchUsuario;
            });

            if (filteredCancelados.length === 0) {
              return (
                <View style={[s.card, { padding: 20, alignItems: 'center', backgroundColor: C.surf2 }]}>
                  <Ionicons name="receipt-outline" size={40} color={C.text3} />
                  <Text style={{ fontSize: 13, color: C.text2, marginTop: 8 }}>No se encontraron registros</Text>
                </View>
              );
            }

            return filteredCancelados.map((c) => {
              const valorCancelado = c.items.reduce((sum, item) => sum + (item.precio || 0) * (item.cantidad || 0), 0);
              return (
                <View key={c.id} style={[s.card, { marginBottom: 12, padding: 14, backgroundColor: C.surf2 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>
                      {typeof c.mesa === 'string' && c.mesa.startsWith('Para') ? c.mesa : `Mesa ${c.mesa}`}
                    </Text>
                    <Text style={{ fontSize: 10, color: C.text3 }}>📅 {new Date(c.fecha).toLocaleString('es-CO')}</Text>
                  </View>

                  {/* Items */}
                  <View style={{ marginBottom: 8, paddingLeft: 6 }}>
                    {c.items.map((it, idx) => (
                      <Text key={idx} style={{ fontSize: 12, color: C.text2 }}>
                        • {it.cantidad}x {it.nombre} {it.nota ? `(📝 ${it.nota})` : ''}
                      </Text>
                    ))}
                  </View>

                  <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, color: C.text, fontWeight: '700' }}>
                        Motivo: <Text style={{ fontWeight: '500', color: C.text2 }}>{c.motivo}</Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: C.red, fontWeight: '800' }}>
                        Valor: ${valorCancelado.toLocaleString('es-CO')}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: C.text3 }}>
                      Usuario: {c.usuario} • Estado: <Text style={{ color: C.red, fontWeight: '700' }}>{c.estado.toUpperCase()}</Text>
                    </Text>
                  </View>
                </View>
              );
            });
          })()}
        </ScrollView>
        </View>
      )}

      {/* ─── TAB 5: USUARIOS ─── */}
      {adminTab === 'usuarios' && (
        <View style={{ flex: 1, paddingHorizontal: 14 }}>
          {renderBackHeader('Gestión de Usuarios')}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={s.sectionTitle}>👤 Usuarios del Sistema</Text>
              <TouchableOpacity
                onPress={() => {
                  setEditUserSel(null);
                  setNewUserName('');
                  setNewUserPin('');
                  setNewUserRol('pedido');
                  setNewUserActivo(true);
                  setUserModalVisible(true);
                }}
                style={{
                  backgroundColor: C.orange,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Ionicons name="add-circle" size={16} color="white" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>NUEVO USUARIO</Text>
              </TouchableOpacity>
            </View>

            {usuarios.length === 0 ? (
              <View style={[s.card, { padding: 20, alignItems: 'center', backgroundColor: C.surf2 }]}>
                <Ionicons name="people-outline" size={40} color={C.text3} />
                <Text style={{ fontSize: 13, color: C.text2, marginTop: 8 }}>No hay usuarios registrados</Text>
              </View>
            ) : (
              usuarios.map((u) => (
                <View key={u.id} style={[s.card, { marginBottom: 12, padding: 14, backgroundColor: C.surf2 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{u.nombre}</Text>
                      <Text style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                        Rol: {u.rol === 'admin' ? 'Administrador' : u.rol === 'pedido' ? 'Mesero' : u.rol}
                      </Text>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: u.activo ? C.green : C.text3 }}>
                        {u.activo ? 'ACTIVO' : 'INACTIVO'}
                      </Text>
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            const res = await axios.put(`http://${serverIP}:3001/api/usuarios/${u.id}/estado`, {
                              activo: !u.activo,
                              administrador_usuario: loggedUser ? loggedUser.nombre : 'Admin'
                            }, { timeout: 3000 });
                            if (res.data && res.data.success) {
                              showToast('✅ Estado de usuario actualizado');
                              cargarUsuarios();
                            }
                          } catch (e) {
                            showToast('⚠️ Error al cambiar estado');
                          }
                        }}
                        style={{
                          width: 40,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: u.activo ? C.green : '#D1D5DB',
                          justifyContent: 'center',
                          alignItems: u.activo ? 'flex-end' : 'flex-start',
                          padding: 2,
                        }}
                      >
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' }} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 6 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditUserSel(u);
                        setNewUserName(u.nombre);
                        setNewUserPin('');
                        setNewUserRol(u.rol);
                        setNewUserActivo(!!u.activo);
                        setUserModalVisible(true);
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: C.orange,
                        paddingVertical: 6,
                        borderRadius: 6,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 4
                      }}
                    >
                      <Ionicons name="create-outline" size={14} color="white" />
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setChangePinUserSel(u);
                        setNewPinVal('');
                        setChangePinModalVisible(true);
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: C.brand,
                        paddingVertical: 6,
                        borderRadius: 6,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 4
                      }}
                    >
                      <Ionicons name="key-outline" size={14} color="white" />
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>Cambiar PIN</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* ─── TAB 6: AUDITORÍA ─── */}
      {adminTab === 'auditoria' && (
        <View style={{ flex: 1, paddingHorizontal: 14 }}>
          {renderBackHeader('Log de Auditoría')}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            <Text style={[s.sectionTitle, { marginBottom: 10 }]}>📋 Filtros de Auditoría</Text>
            <View style={[s.card, { padding: 14, backgroundColor: C.surf2, marginBottom: 14 }]}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: C.text2, marginBottom: 4 }}>Usuario:</Text>
                  <TextInput
                    style={[s.formInput, { paddingVertical: 6 }]}
                    placeholder="Ej. Admin"
                    placeholderTextColor={C.text3}
                    value={auditUserFilter}
                    onChangeText={setAuditUserFilter}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: C.text2, marginBottom: 4 }}>Fecha (AAAA-MM-DD):</Text>
                  <TextInput
                    style={[s.formInput, { paddingVertical: 6 }]}
                    placeholder="Ej. 2026-06-08"
                    placeholderTextColor={C.text3}
                    value={auditFechaFilter}
                    onChangeText={setAuditFechaFilter}
                  />
                </View>
              </View>

              <Text style={{ fontSize: 11, color: C.text2, marginBottom: 4 }}>Acción:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {[
                  { id: '', label: 'Todos' },
                  { id: 'login', label: 'Login' },
                  { id: 'login_fallido', label: 'Login fallido' },
                  { id: 'logout', label: 'Logout' },
                  { id: 'pedido_creado', label: 'Pedido creado' },
                  { id: 'pedido_editado', label: 'Pedido editado' },
                  { id: 'pedido_cancelado', label: 'Pedido cancelado' },
                  { id: 'pedido_cobrado', label: 'Pedido cobrado' },
                  { id: 'gasto_registrado', label: 'Gasto registrado' },
                  { id: 'insumo_creado', label: 'Insumo creado' },
                  { id: 'entrada_inventario', label: 'Entrada inventario' },
                  { id: 'ajuste_inventario', label: 'Ajuste inventario' },
                  { id: 'usuario_creado', label: 'Usuario creado' },
                  { id: 'usuario_editado', label: 'Usuario editado' },
                  { id: 'pin_cambiado', label: 'PIN cambiado' }
                ].map(a => {
                  const isSelected = auditAccionFilter === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => setAuditAccionFilter(a.id)}
                      style={{
                        paddingVertical: 5,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: isSelected ? C.orange : C.border,
                        backgroundColor: isSelected ? C.orange : C.surface
                      }}
                    >
                      <Text style={{ fontSize: 10, color: isSelected ? 'white' : C.text, fontWeight: '600' }}>
                        {a.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                onPress={cargarAuditoria}
                style={[s.btnPrimary, { marginTop: 12, paddingVertical: 8 }]}
              >
                <Ionicons name="filter" size={14} color="white" />
                <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>APLICAR FILTROS</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.sectionTitle, { marginBottom: 10 }]}>Log de Eventos (Máx. 200)</Text>
            {auditoriaLogs.length === 0 ? (
              <View style={[s.card, { padding: 20, alignItems: 'center', backgroundColor: C.surface }]}>
                <Text style={{ fontSize: 12, color: C.text3 }}>No se encontraron registros de auditoría</Text>
              </View>
            ) : (
              auditoriaLogs.map((l) => {
                let badgeBg = '#E5E7EB';
                let badgeText = '#4B5563';
                if (l.accion.includes('fallido') || l.accion.includes('cancelado')) {
                  badgeBg = '#FEE2E2';
                  badgeText = '#DC2626';
                } else if (l.accion.includes('creado') || l.accion.includes('cobrado') || l.accion === 'login') {
                  badgeBg = '#DCFCE7';
                  badgeText = '#15803D';
                } else if (l.accion.includes('editado') || l.accion.includes('cambiado')) {
                  badgeBg = '#FEF3C7';
                  badgeText = '#D97706';
                } else if (l.accion.includes('gasto')) {
                  badgeBg = '#F3E8FF';
                  badgeText = '#7E22CE';
                }

                return (
                  <View key={l.id} style={[s.card, { marginBottom: 10, padding: 12, backgroundColor: C.surface }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 11, color: C.text2, fontWeight: '700' }}>
                        👤 {l.usuario}
                      </Text>
                      <Text style={{ fontSize: 9, color: C.text3 }}>
                        🕒 {new Date(l.fecha).toLocaleString('es-CO')}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <View style={{ backgroundColor: badgeBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: badgeText, textTransform: 'uppercase' }}>
                          {l.accion}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 12, color: C.text }}>
                      {l.detalle}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* Modal Detalle de Venta */}
      {ventaDetalleModalVisible && ventaDetalleSelected && (
        <Modal
          visible={ventaDetalleModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setVentaDetalleModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
              <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setVentaDetalleModalVisible(false)}>
                  <Ionicons name="arrow-back" size={20} color={C.cream2} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream }}>📋 Detalle de Venta</Text>
                  <Text style={{ fontSize: 11, color: C.cream2, marginTop: 2 }}>
                    ID Venta: #{ventaDetalleSelected.id}
                  </Text>
                </View>
              </View>

              <View style={{ padding: 18 }}>
                <View style={{ gap: 6, marginBottom: 14, borderBottomWidth: 1.5, borderBottomColor: C.border, paddingBottom: 10 }}>
                  <Text style={{ fontSize: 12, color: C.text2 }}>
                    📅 Fecha: <Text style={{ fontWeight: '700', color: C.text }}>{new Date(ventaDetalleSelected.fecha).toLocaleString('es-CO')}</Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: C.text2 }}>
                    📍 Origen: <Text style={{ fontWeight: '700', color: C.text }}>{ventaDetalleSelected.tipo_origen === 'Para Llevar' ? ventaDetalleSelected.mesa : `Mesa ${ventaDetalleSelected.mesa}`}</Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: C.text2 }}>
                    💳 Método Pago: <Text style={{ fontWeight: '700', color: C.text }}>{ventaDetalleSelected.metodo_pago}</Text>
                  </Text>
                </View>

                <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 8 }}>Artículos vendidos:</Text>
                <ScrollView style={{ maxHeight: 200, marginBottom: 18 }}>
                  <View style={{ gap: 8 }}>
                    {ventaDetallesItems.map((det) => (
                      <View key={det.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.surf2, padding: 10, borderRadius: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{det.nombre_producto}</Text>
                          <Text style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{det.cantidad}x ${det.precio_unitario.toLocaleString('es-CO')}</Text>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: C.orange }}>
                          ${det.subtotal.toLocaleString('es-CO')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1.5, borderTopColor: C.border, paddingTop: 10, marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>Total Facturado:</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: C.green }}>
                    ${ventaDetalleSelected.total.toLocaleString('es-CO')}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setVentaDetalleModalVisible(false)}
                  style={[s.btnPrimary, { width: '100%' }]}
                >
                  <Text style={{ color: 'white', fontWeight: '800' }}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal Crear/Editar Usuario */}
      {userModalVisible && (
        <Modal
          visible={userModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setUserModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
              <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setUserModalVisible(false)}>
                  <Ionicons name="arrow-back" size={20} color={C.cream2} />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream, flex: 1 }}>
                  {editUserSel ? '👤 Editar Usuario' : '👤 Nuevo Usuario'}
                </Text>
              </View>

              <ScrollView contentContainerStyle={{ padding: 18 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 6 }}>Nombre del usuario</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="Ej. Juan Pérez"
                  placeholderTextColor={C.text3}
                  value={newUserName}
                  onChangeText={setNewUserName}
                />

                {!editUserSel && (
                  <>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>PIN Inicial (4 a 6 dígitos)</Text>
                    <TextInput
                      style={s.formInput}
                      placeholder="Ej. 1234"
                      placeholderTextColor={C.text3}
                      keyboardType="numeric"
                      maxLength={6}
                      value={newUserPin}
                      onChangeText={setNewUserPin}
                    />
                  </>
                )}

                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>Rol</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {[
                    { id: 'admin', label: 'Administrador' },
                    { id: 'caja', label: 'Caja' },
                    { id: 'pedido', label: 'Mesero' },
                    { id: 'cocina', label: 'Cocina' },
                    { id: 'bar', label: 'Bar' }
                  ].map(r => {
                    const isSelected = newUserRol === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => setNewUserRol(r.id)}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 20,
                          borderWidth: 1.5,
                          borderColor: isSelected ? C.orange : C.border,
                          backgroundColor: isSelected ? C.orange : C.surf2,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: isSelected ? '#fff' : C.text, fontWeight: '600' }}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {editUserSel && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.surf2, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 20 }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>Activo</Text>
                      <Text style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{newUserActivo ? 'Habilitado' : 'Deshabilitado'}</Text>
                    </View>
                    <Switch
                      value={newUserActivo}
                      onValueChange={setNewUserActivo}
                      trackColor={{ false: '#D1D5DB', true: C.greenL }}
                      thumbColor={newUserActivo ? C.green : '#F4F3F4'}
                    />
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    onPress={() => setUserModalVisible(false)}
                    style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' }}
                  >
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={guardarUsuario}
                    style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal Cambiar PIN */}
      {changePinModalVisible && changePinUserSel && (
        <Modal
          visible={changePinModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setChangePinModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' }}>
              <View style={{ backgroundColor: C.brand, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setChangePinModalVisible(false)}>
                  <Ionicons name="arrow-back" size={20} color={C.cream2} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.cream }}>🔑 Cambiar PIN de Usuario</Text>
                  <Text style={{ fontSize: 12, color: C.cream2, marginTop: 2 }}>Usuario: {changePinUserSel.nombre}</Text>
                </View>
              </View>

              <View style={{ padding: 18 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text2, marginBottom: 6 }}>Nuevo PIN (4 a 6 dígitos)</Text>
                <TextInput
                  style={[s.formInput, { letterSpacing: 4, textAlign: 'center', fontSize: 18 }]}
                  placeholder="••••••"
                  placeholderTextColor={C.text3}
                  keyboardType="numeric"
                  maxLength={6}
                  value={newPinVal}
                  onChangeText={setNewPinVal}
                  secureTextEntry
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                  <TouchableOpacity
                    onPress={() => setChangePinModalVisible(false)}
                    style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' }}
                  >
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={guardarNuevoPin}
                    style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Actualizar PIN</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── ESTILOS ───────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.brand },
  content: { padding: 14 },

  // NAV
  nav: { backgroundColor: C.brand, flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 54, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "rgba(245,230,200,0.1)" },
  navBrand: { fontSize: 17, fontWeight: "800", color: C.cream, letterSpacing: 0.5 },
  navTabs: { flexDirection: "row", gap: 4 },
  navTab: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  // ADMIN NAVIGATION
  adminNav: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, backgroundColor: C.brand },
  adminNavBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  adminNavBtnActive: { backgroundColor: C.orange },
  adminNavTxt: { color: C.cream, fontWeight: '600' },
  navTabActive: { backgroundColor: C.orange },
  navTabTxt: { fontSize: 12, fontWeight: "500", color: "rgba(245,230,200,0.5)" },
  navTabTxtActive: { color: "white" },
  navBadge: { backgroundColor: C.orange, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 3 },
  navBadgeTxt: { fontSize: 9, color: "white", fontWeight: "700" },

  // STEPS
  stepsRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.surf3, alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: C.orange },
  stepDotTxt: { fontSize: 11, fontWeight: "700", color: "white" },
  stepLine: { flex: 1, height: 2, backgroundColor: C.surf3, marginHorizontal: 10 },
  stepLabel: { fontSize: 12, color: C.text2, fontWeight: "500", marginLeft: 8 },

  // CARD
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  cardHeader: { padding: 14, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: C.text },

  // MESAS
  mesasGrid: { flexDirection: "row", flexWrap: "wrap", padding: 16, gap: 12 },
  mesaBtn: { width: "22%", aspectRatio: 1, borderRadius: 12, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center", backgroundColor: C.surf2, gap: 3 },
  mesaLibre: { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" },
  mesaOcupada: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  mesaCuenta: { borderColor: "#FCD34D", backgroundColor: "#FFFBEB" },
  mesaSel: { borderColor: C.orange, shadowColor: C.orange, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  mesaNum: { fontSize: 24, fontWeight: "800", color: C.text },
  mesaLabel: { fontSize: 9, color: C.text2, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },

  // CATEGORÍAS CARRUSEL
  catRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.brand, paddingHorizontal: 10, paddingVertical: 10, gap: 6 },
  catArrow: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: "rgba(245,230,200,0.25)", backgroundColor: "rgba(245,230,200,0.08)", alignItems: "center", justifyContent: "center" },
  catArrowTxt: { fontSize: 20, color: C.cream, lineHeight: 22 },
  catChip: { paddingVertical: 8, paddingHorizontal: 6, borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(245,230,200,0.2)", backgroundColor: "rgba(245,230,200,0.07)", alignItems: "center" },
  catChipActive: { backgroundColor: C.orange, borderColor: C.orange },
  catChipTxt: { fontSize: 11, fontWeight: "500", color: "rgba(245,230,200,0.7)" },
  catChipTxtActive: { color: "white" },

  // PRODUCTOS
  prodsGrid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  prodCard: { width: "47%", backgroundColor: C.surf2, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, padding: 12 },
  prodNombre: { fontWeight: "600", fontSize: 13, color: C.text, marginTop: 6, marginBottom: 2 },
  prodDesc: { fontSize: 11, color: C.text2, lineHeight: 16, marginBottom: 6 },
  prodPrecio: { fontWeight: "700", fontSize: 13, color: C.orange },

  // NEW PRODUCT FORM & CATEGORY SECTIONS
  prodForm: { marginBottom: 16, padding: 12, backgroundColor: C.surf2, borderRadius: 8 },
  prodInput: { backgroundColor: C.surf3, padding: 8, marginBottom: 8, borderRadius: 6, color: C.text },
  catSection: { marginBottom: 20 },
  catHeader: { fontSize: 18, fontWeight: "700", color: C.orange, marginBottom: 8 },

  // CARRITO
  carritoItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  carritoNombre: { fontSize: 13, fontWeight: "500", color: C.text },
  qtyBtn: { width: 26, height: 26, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.surf2, alignItems: "center", justifyContent: "center" },
  qtyBtnTxt: { fontSize: 15, color: C.text, lineHeight: 18 },
  qtyNum: { fontWeight: "600", fontSize: 13, color: C.text, minWidth: 20, textAlign: "center" },
  notaInput: { fontSize: 11, color: C.text3, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  carritoTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, backgroundColor: C.surf2 },
  carritoTotalNum: { fontWeight: "800", fontSize: 20, color: C.orange },

  // COCINA
  itemCocina: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surf2, borderRadius: 10, padding: 10, marginBottom: 8 },
  itemQty: { fontWeight: "700", fontSize: 14, color: C.orange, minWidth: 28 },

  // BADGES
  badgeBase: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeOrange: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: "#FFEDD5" },
  badgeYellow: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: "#FEF3C7" },
  badgeTxt: { fontSize: 11, fontWeight: "500", color: C.text2 },

  // BUTTONS
  btnPrimary: { backgroundColor: C.orange, borderRadius: 10, padding: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  btnPrimaryTxt: { color: "white", fontWeight: "600", fontSize: 14 },
  btnFull: { marginHorizontal: 0 },
  btnGhost: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "rgba(245,230,200,0.2)" },
  btnSmDark: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.brand },
  btnSmGreen: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.green },
  btnSmOrange: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: C.orange },

  // ADMIN
  adminTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: "rgba(245,230,200,0.2)", backgroundColor: "transparent" },
  adminTabActive: { backgroundColor: C.orange, borderColor: C.orange },
  adminTabTxt: { fontSize: 13, fontWeight: "500", color: "rgba(245,230,200,0.6)" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statCard: { flex: 1, minWidth: "45%", backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14 },
  statLabel: { fontSize: 11, color: C.text2, marginBottom: 4 },
  statValue: { fontWeight: "800", fontSize: 20, color: C.text },
  statSub: { fontSize: 10, color: C.text3, marginTop: 2 },
  sectionTitle: { fontWeight: "800", fontSize: 15, color: C.cream },

  // CAJA ROW
  cajaRow: { flexDirection: "column", backgroundColor: C.surf2, borderRadius: 8, padding: 12, marginBottom: 12 },
  cajaSelect: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  cajaSelectActive: { backgroundColor: C.orange, borderColor: C.orange },
  cajaSelectTxt: { color: C.text, fontWeight: "600" },
  cajaButton: { backgroundColor: C.green, borderRadius: 6, paddingVertical: 8, alignItems: "center", marginTop: 8 },
  cajaButtonTxt: { color: "white", fontWeight: "600" },
  cajaInput: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 8, marginTop: 6 },

  // PRODUCTO ROW
  productoRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  formLabel: { fontSize: 12, fontWeight: "500", color: C.text2, marginBottom: 4 },
  formInput: { fontSize: 13, padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surf2, color: C.text },

  // TOGGLE
  toggle: { width: 38, height: 22, borderRadius: 11, backgroundColor: C.surf3, justifyContent: "center", paddingHorizontal: 3 },
  toggleOn: { backgroundColor: C.green },
  toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: "white", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: "flex-end" },

  // TOAST
  toast: { position: "absolute", bottom: 28, alignSelf: "center", backgroundColor: C.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "rgba(245,230,200,0.15)" },
  toastTxt: { color: C.cream, fontSize: 13, fontWeight: "500" },
});
