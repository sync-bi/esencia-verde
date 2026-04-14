/* ========================================
   ESENCIA VERDE - Firebase setup
   ======================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
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
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
