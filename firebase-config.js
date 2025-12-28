// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- PASTE YOUR COPIED CONFIG BELOW THIS LINE ---
// It should look like: const firebaseConfig = { ... };
// Make sure you replace this comment and the fake variable below with what you copy from Google.

const firebaseConfig = {
    apiKey: "AIzaSyCbzg6EjV9arCy092IMjDPne0NLzmFKFyQ",
    authDomain: "readyrow-73d30.firebaseapp.com",
    projectId: "readyrow-73d30",
    storageBucket: "readyrow-73d30.firebasestorage.app",
    messagingSenderId: "57802128446",
    appId: "1:57802128446:web:edda42f20631ed4e66e56f",
    measurementId: "G-V3R91S13ZJ"
};

// ------------------------------------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export these so auth.js can use them
export { auth, db };