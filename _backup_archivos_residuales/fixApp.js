const fs = require('fs');

let app = fs.readFileSync('App.js', 'utf8');

// 1. Fix Imports
// Remove old Expo imports if they exist
app = app.replace(/import \{ Ionicons \} from '@expo\/vector-icons';/g, '');
app = app.replace(/import \{ Audio \} from 'expo-av';/g, '');
app = app.replace(/import \{ useKeepAwake \} from 'expo-keep-awake';/g, '');
app = app.replace(/import \* as DocumentPicker from 'expo-document-picker';/g, '');
app = app.replace(/import \* as FileSystem from 'expo-file-system';/g, '');
app = app.replace(/import \* as Notifications from 'expo-notifications';/g, '');

// Ensure correct native imports exist
const nativeImports = `
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
  requestPermissions: true,
});
`;

if (!app.includes("import Sound from 'react-native-sound'")) {
    app = app.replace(/import axios from 'axios';/g, "import axios from 'axios';\n" + nativeImports);
}

// Ensure `io` is imported since user accidentally deleted it
if (!app.includes("import io from 'socket.io-client'")) {
    app = app.replace(/import uuid/g, "import io from 'socket.io-client';\nimport uuid");
}

// 2. KeepAwake
app = app.replace(/useKeepAwake\(\);/g, 'KeepAwake.activate();');

// 3. Audio.Sound
// Replace: const { sound } = await Audio.Sound.createAsync( { uri: someUri } );
app = app.replace(/const \{ sound \} = await Audio\.Sound\.createAsync\(\s*\{\s*uri:\s*([^}]+)\s*\}\s*\);/g, `
        const sound = new Sound($1, '', (error) => {
          if (error) {
            console.log('failed to load the sound', error);
            return;
          }
          sound.play((success) => {
            if (!success) {
              console.log('playback failed due to audio decoding errors');
            }
          });
        });
`);
// Replace: const { sound } = await Audio.Sound.createAsync( require(...) );
app = app.replace(/const \{ sound \} = await Audio\.Sound\.createAsync\(\s*require\(([^)]+)\)\s*\);/g, `
        const sound = new Sound(require($1), (error) => {
          if (error) {
            console.log('failed to load the sound', error);
            return;
          }
          sound.play();
        });
`);

// Play/Stop Audio
app = app.replace(/await soundObjectRef\.current\.playAsync\(\);/g, '/* play handled in callback */');
app = app.replace(/await soundObjectRef\.current\.stopAsync\(\);/g, 'soundObjectRef.current.stop();');
app = app.replace(/await soundObjectRef\.current\.unloadAsync\(\);/g, 'soundObjectRef.current.release();');

// 4. Document Picker
app = app.replace(/await DocumentPicker\.getDocumentAsync\(\{\s*type: 'audio\/\*',\s*copyToCacheDirectory: true,\s*\}\)/g, 
  `await DocumentPicker.pickSingle({ type: [DocumentPicker.types.audio] })`);
// Fix `result.canceled` and `result.assets[0]` -> `result.uri`
app = app.replace(/if \(!result\.canceled && result\.assets && result\.assets\.length > 0\) \{/g, `if (result && result.uri) {`);
app = app.replace(/const selectedAsset = result\.assets\[0\];/g, `const selectedAsset = result;`);

// 5. FileSystem
app = app.replace(/FileSystem\.documentDirectory/g, 'RNFS.DocumentDirectoryPath + "/"');
app = app.replace(/FileSystem\.copyAsync/g, 'RNFS.copyFile');
app = app.replace(/from:/g, 'filepath:');
app = app.replace(/to:/g, 'destPath:');

// 6. Notifications
// Remove Expo notification calls
app = app.replace(/await Notifications\.getPermissionsAsync\(\);/g, '{ status: "granted" };');
app = app.replace(/await Notifications\.requestPermissionsAsync\(\);/g, '{ status: "granted" };');
app = app.replace(/Notifications\.scheduleNotificationAsync\(\{[\s\S]*?\}\);/g, `
        PushNotification.localNotification({
          title: "¡Notificación!",
          message: "Tienes una nueva alerta en el sistema.",
          playSound: true,
        });
`);

fs.writeFileSync('App.js', app);
console.log("App.js patched successfully.");
