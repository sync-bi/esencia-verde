/* ========================================
   ESENCIA VERDE - Firebase setup
   ======================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBAqC9E3HZgq3E06iAhgfrv6w-EztYOiIU",
    authDomain: "esencia-verde.firebaseapp.com",
    projectId: "esencia-verde",
    storageBucket: "esencia-verde.firebasestorage.app",
    messagingSenderId: "124580508343",
    appId: "1:124580508343:web:005fd2ed62bfcf5a109332"
};

export const app = initializeApp(firebaseConfig);

// Caché local persistente (IndexedDB): tras la primera carga, al navegar
// entre páginas los productos y sus fotos se sirven al instante desde el
// navegador y se sincronizan en segundo plano. Evita volver a descargar
// todas las imágenes base64 en cada cambio de página.
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

export const auth = getAuth(app);
