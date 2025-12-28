// auth.js
import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// UI State
let isSignUpMode = false;

// --- DOM ELEMENTS ---
const authForm = document.getElementById('auth-form');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const logoutBtn = document.getElementById('logout-btn');
const profileBtn = document.getElementById('profile-btn');
const themeToggle = document.getElementById('theme-toggle');

// --- THEME MANAGEMENT FUNCTIONS ---

function applyTheme(theme) {
    // 1. Actually change the colors
    document.documentElement.setAttribute('data-theme', theme);
    
    // 2. Make sure the toggle switch matches (Checked = Dark)
    if (themeToggle) {
        themeToggle.checked = (theme === 'dark');
    }
}

// Listen for toggle switches
if (themeToggle) {
    themeToggle.addEventListener('change', async (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        
        // Apply immediately for instant feedback
        applyTheme(newTheme);

        // Save to LocalStorage (Backup for when logged out)
        localStorage.setItem('theme', newTheme);

        // Save to Cloud (If logged in)
        if (auth.currentUser) {
            try {
                await updateDoc(doc(db, "users", auth.currentUser.uid), {
                    theme: newTheme
                });
            } catch (err) {
                console.error("Error saving theme preference:", err);
            }
        }
    });
}

// --- AUTHENTICATION FUNCTIONS ---

async function handleAuth(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value.trim();

    try {
        if (isSignUpMode) {
            // 1. Create User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Create Profile (Default to light theme initially)
            await setDoc(doc(db, "users", user.uid), {
                username: username,
                email: email,
                split2k: null,
                theme: 'light', 
                createdAt: new Date().toISOString()
            });
            
            console.log("User Signed Up:", user.email);
        } else {
            // Login
            const loginEmail = isSignUpMode ? email : document.getElementById('username').value; 
            await signInWithEmailAndPassword(auth, loginEmail, password);
            console.log("User Logged In");
        }
    } catch (error) {
        console.error("Auth Error:", error);
        alert(error.message);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        // We do NOT reset the theme here, so it stays dark if they prefer that
        window.location.reload(); 
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

// --- APP STATE MANAGEMENT ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in.
        
        // 1. Get User Profile from DB
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            
            // 2. APPLY SAVED THEME (The persistence fix)
            if (userData.theme) {
                applyTheme(userData.theme);
                // Also update local storage to keep them in sync
                localStorage.setItem('theme', userData.theme);
            } else {
                // Fallback if no theme saved yet
                const localTheme = localStorage.getItem('theme') || 'light';
                applyTheme(localTheme);
            }
            
            // 3. Update UI
            document.getElementById('profile-initial').textContent = userData.username.charAt(0).toUpperCase();
            showMainApp(userData);
        }

    } else {
        // User is signed out.
        // Load whatever theme is saved on this computer
        const localTheme = localStorage.getItem('theme') || 'light';
        applyTheme(localTheme);
        
        showAuthPage();
    }
});

function showAuthPage() {
    document.getElementById('auth-page').style.display = 'block';
    document.getElementById('setup-page').style.display = 'none';
    document.getElementById('workout-page').style.display = 'none';
    document.getElementById('saved-workouts-page').style.display = 'none';
    document.getElementById('workout-details-page').style.display = 'none';
    
    // Hide nav items
    document.getElementById('saved-workouts-btn').style.display = 'none';
    document.getElementById('back-btn').style.display = 'none';
    document.getElementById('profile-dropdown').style.display = 'none';
}

function showMainApp(userData) {
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('profile-dropdown').style.display = 'block';

    window.currentUserData = userData; 
    
    // Note: script_new.js handles showing the correct page (setup vs workout)
    // based on the split2k data, so we don't need to duplicate that logic here.
}

// --- UI EVENT HANDLERS ---

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    
    const title = document.getElementById('auth-title');
    const emailGroup = document.getElementById('email-group');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    const usernameLabel = document.querySelector('label[for="username"]');
    
    if (isSignUpMode) {
        title.textContent = 'Join ReadyRow';
        emailGroup.style.display = 'block';
        usernameLabel.textContent = "Username:";
        submitBtn.textContent = 'Sign Up';
        switchText.textContent = 'Already have an account?';
        toggleBtn.textContent = 'Sign In';
    } else {
        title.textContent = 'Welcome Back';
        emailGroup.style.display = 'none'; 
        usernameLabel.textContent = "Email:"; 
        submitBtn.textContent = 'Sign In';
        switchText.textContent = "Don't have an account?";
        toggleBtn.textContent = 'Sign Up';
    }
}

// --- EVENT LISTENERS ---
if(authForm) authForm.addEventListener('submit', handleAuth);
if(authToggleBtn) authToggleBtn.addEventListener('click', toggleAuthMode);
if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
if(profileBtn) profileBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent immediate closing
    document.getElementById('dropdown-content').classList.toggle('show');
});

// Close dropdown on click outside
window.onclick = function(event) {
  if (!event.target.matches('.profile-circle') && !event.target.matches('#profile-initial')) {
    var dropdowns = document.getElementsByClassName("dropdown-content");
    for (var i = 0; i < dropdowns.length; i++) {
      var openDropdown = dropdowns[i];
      if (openDropdown.classList.contains('show')) {
        openDropdown.classList.remove('show');
      }
    }
  }
}