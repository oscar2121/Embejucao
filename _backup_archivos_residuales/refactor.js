const fs = require('fs');

const path = 'c:/Users/oscar/OneDrive/Desktop/files/App.js';
let content = fs.readFileSync(path, 'utf8');

// Imports
content = content.replace(/import \{ Audio \} from 'expo-av';/, "import Sound from 'react-native-sound';\nSound.setCategory('Playback');");
content = content.replace(/import \{ useKeepAwake \} from 'expo-keep-awake';/, "import KeepAwake from 'react-native-keep-awake';");
content = content.replace(/import \* as DocumentPicker from 'expo-document-picker';/, "import DocumentPicker from 'react-native-document-picker';");
content = content.replace(/import \* as FileSystem from 'expo-file-system';/, "import RNFS from 'react-native-fs';");
content = content.replace(/import \* as Notifications from 'expo-notifications';/, "import PushNotification from 'react-native-push-notification';");
content = content.replace(/Notifications\.setNotificationHandler\(\{\n.*?\n.*?\n.*?\n.*?\n\}\);/s, "");

// useKeepAwake hook
content = content.replace(/  useKeepAwake\(\);\s*\/\/\s*Mantener la pantalla activa durante el servicio/, "  KeepAwake.activate(); // Mantener la pantalla activa durante el servicio");

// reproducirAlertaSonora
const oldReproducir = `  const reproducirAlertaSonora = async (loop = false) => {
    try {
      if (sound) await sound.unloadAsync();
      const savedUri = await AsyncStorage.getItem('custom_alert_uri');
      if (savedUri) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: savedUri },
          { shouldPlay: true, isLooping: loop, volume: 1.0 }
        );
        setSound(sound);
      } else {
        try {
          const { sound } = await Audio.Sound.createAsync(
            require('./assets/new_order.mp3'),
            { shouldPlay: true, isLooping: loop, volume: 1.0 }
          );
          setSound(sound);
        } catch (e) {
          console.warn('Audio por defecto no encontrado, vibrando...');
          Vibration.vibrate(loop ? [0, 1000, 500, 1000] : [0, 500]);
        }
      }
    } catch (error) {
      console.log('Error reproduciendo sonido:', error);
    }
  };`;

const newReproducir = `  const reproducirAlertaSonora = async (loop = false) => {
    try {
      if (sound) {
        sound.stop();
        sound.release();
      }
      const savedUri = await AsyncStorage.getItem('custom_alert_uri');
      
      const playSound = (audioPath, isRequire) => {
        const s = new Sound(audioPath, isRequire ? Sound.MAIN_BUNDLE : '', (error) => {
          if (error) {
            console.log('failed to load the sound', error);
            Vibration.vibrate(loop ? [0, 1000, 500, 1000] : [0, 500]);
            return;
          }
          if (loop) s.setNumberOfLoops(-1);
          s.play((success) => {
            if (!success) {
              console.log('playback failed due to audio decoding errors');
            }
          });
        });
        setSound(s);
      };

      if (savedUri) {
        playSound(savedUri, false);
      } else {
        playSound(require('./assets/new_order.mp3'), true);
      }
    } catch (error) {
      console.log('Error reproduciendo sonido:', error);
    }
  };`;

content = content.replace(oldReproducir, newReproducir);

// detenerAlertaSonora
const oldDetener = `  const detenerAlertaSonora = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
  };`;

const newDetener = `  const detenerAlertaSonora = async () => {
    if (sound) {
      sound.stop();
      sound.release();
      setSound(null);
    }
  };`;
content = content.replace(oldDetener, newDetener);

// seleccionarAudioLocal
const oldSeleccionar = `  const seleccionarAudioLocal = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        const destinationPath = \`\${FileSystem.documentDirectory}custom_alert.mp3\`;
        
        await FileSystem.copyAsync({
          from: selectedAsset.uri,
          to: destinationPath
        });

        await AsyncStorage.setItem('custom_alert_uri', destinationPath);
        Alert.alert("Éxito", "Tono de alerta actualizado correctamente.");
        
        // Probar el nuevo sonido
        const { sound } = await Audio.Sound.createAsync(
          { uri: destinationPath },
          { shouldPlay: true }
        );
        setTimeout(() => sound.unloadAsync(), 3000);
      }
    } catch (error) {
      console.log('Error seleccionando audio:', error);
      Alert.alert("Error", "No se pudo seleccionar el archivo de audio.");
    }
  };`;

const newSeleccionar = `  const seleccionarAudioLocal = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.audio],
        copyTo: 'cachesDirectory',
      });

      if (result && result.uri) {
        const destinationPath = \`\${RNFS.DocumentDirectoryPath}/custom_alert.mp3\`;
        
        if (await RNFS.exists(destinationPath)) {
          await RNFS.unlink(destinationPath);
        }
        await RNFS.copyFile(result.fileCopyUri || result.uri, destinationPath);

        await AsyncStorage.setItem('custom_alert_uri', destinationPath);
        Alert.alert("Éxito", "Tono de alerta actualizado correctamente.");
        
        // Probar el nuevo sonido
        const s = new Sound(destinationPath, '', (error) => {
          if (!error) {
            s.play();
            setTimeout(() => { s.stop(); s.release(); }, 3000);
          }
        });
      }
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        console.log('Error seleccionando audio:', error);
        Alert.alert("Error", "No se pudo seleccionar el archivo de audio.");
      }
    }
  };`;
content = content.replace(oldSeleccionar, newSeleccionar);

// Notifications Request Permission
const oldPerms = `    (async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Permisos de notificación no otorgados');
      }
    })();`;
const newPerms = `    PushNotification.requestPermissions();`;
content = content.replace(oldPerms, newPerms);

// Notifications.scheduleNotificationAsync
const oldNotify1 = `        Notifications.scheduleNotificationAsync({
          content: {
            title: "🔔 ¡Nuevo Pedido!",
            body: \`Mesa \${nuevoPedido.mesa} tiene un nuevo pedido.\`,
            sound: true
          },
          trigger: null
        });`;
const newNotify1 = `        PushNotification.localNotification({
          title: "🔔 ¡Nuevo Pedido!",
          message: \`Mesa \${nuevoPedido.mesa} tiene un nuevo pedido.\`,
          playSound: true,
        });`;
content = content.replace(oldNotify1, newNotify1);

const oldNotify2 = `        Notifications.scheduleNotificationAsync({
          content: {
            title: "🛎️ ¡Plato Listo!",
            body: \`Mesa \${mesa}: El plato "\${plato}" está listo para ser servido.\`,
            sound: true
          },
          trigger: null
        });`;
const newNotify2 = `        PushNotification.localNotification({
          title: "🛎️ ¡Plato Listo!",
          message: \`Mesa \${mesa}: El plato "\${plato}" está listo para ser servido.\`,
          playSound: true,
        });`;
content = content.replace(oldNotify2, newNotify2);

fs.writeFileSync(path, content, 'utf8');
console.log('App.js patched successfully');
