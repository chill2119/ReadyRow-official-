// script_new.js
import { auth, db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    deleteDoc, 
    updateDoc,
    writeBatch // New import for bulk deletion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- TEMPLATES & DATA ---
const workoutTemplates = {
    'steady-state': {
        short: ['30 minutes continuous', '2 x 20 minutes with 2 min rest'],
        medium: ['3 x 20 minutes with 3 min rest', '2 x 30 minutes with 4 min rest', '45 minutes continuous', '60 minutes continuous', '4 x 15 minutes with 2 min rest'],
        long: ['4 x 20 minutes with 3 min rest', '3 x 30 minutes with 4 min rest', '3 x 25 minutes with 3 min rest', '4 x 30 minutes with 4 min rest', '2 x 45 minutes with 5 min rest']
    },
    'ut1': {
        short: ['30 minutes continuous', '2 x 20 minutes with 2 min rest'],
        medium: ['10, 9, 8, 7, 6, 5, 4, 3, 2, 1 minutes with 1 min rest', '45 minutes continuous', '4 x 15 minutes with 3 min rest'],
        long: ['6 x 10 minutes with 2 min rest', '30, 20, 10 minutes with 3 min rest', '3 x 20 minutes with 4 min rest', '60 minutes continuous']
    },
    'threshold': {
        short: ['8 x 3 minutes with 1.5 min rest', '6 x 4 minutes with 2 min rest'],
        medium: ['10, 9, 8, 7, 6, 5, 4, 3, 2, 1 minutes with 1 min rest', '2 x 5k with 5 min rest', '2 x (7 x 3 minutes) with 1 min rest', '3 x 3k with 6 min rest'],
        long: ['3 x 20 minutes with 5 min rest']
    },
    'sprint': {
        short: ['4 x 500m with 1 min rest', '2 x 1k with 3 min rest', '8 x 250m with 1 min rest'],
        medium: ['4 x 750m with 3 min rest', '6 x 500m with 2 min rest', '3 x 1k with 4 min rest', '2 x 1250m with 4 min rest'],
        long: ['8 x 500m with 3 min rest', '4 x 1k with 4.5 min rest', '12 x 1 minute with 1 min rest']
    },
    'wod': {
        short: ['3 rounds: 500m row + 15 burpees', '4 rounds: 300m row + 20 squats', '5 rounds: 250m row + 10 push-ups'],
        medium: ['5 rounds: 500m row + 20 burpees', '4 rounds: 750m row + 30 squats', '6 rounds: 400m row + 25 sit-ups'],
        long: ['6 rounds: 750m row + 25 burpees', '5 rounds: 1000m row + 35 squats', '8 rounds: 500m row + 30 push-ups']
    }
};

const coachingTips = [
    'Focus on your catch timing', 'Drive with your legs first', 'Keep your core engaged',
    'Maintain consistent stroke length', 'Breathe rhythmically with your stroke',
    'Keep your shoulders relaxed', 'Focus on the finish position', 'Stay connected through the drive'
];

const splitOffsets = {
    'steady-state': { min: 20, max: 25 },
    'ut1': { min: 14, max: 18 },
    'threshold': { min: 5, max: 8 },
    'sprint': { min: -5, max: 2 },
    'wod': { min: 10, max: 20 }
};

const strokeRates = {
    'steady-state': { min: 18, max: 22 },
    'ut1': { min: 22, max: 26 },
    'threshold': { min: 24, max: 32 },
    'sprint': { min: 32, max: 40 },
    'wod': { min: 20, max: 30 }
};

// --- STATE VARIABLES ---
let currentWorkout = null;
let user2kSplit = null; 
let loadedWorkouts = []; 

// --- HELPER FUNCTIONS ---

function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatSplitTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseWorkoutIntervals(workout) {
    if (workout.includes('x')) {
        const match = workout.match(/(\d+)\s*x/i);
        return match ? parseInt(match[1]) : 1;
    }
    if (workout.includes(',')) return workout.split(',').length;
    return 1;
}

// --- CORE APP FUNCTIONS ---

async function setupUser() {
    const minutes = parseInt(document.getElementById('split-minutes').value);
    const seconds = parseInt(document.getElementById('split-seconds').value);
    
    if (isNaN(minutes) || isNaN(seconds)) {
        alert("Please enter valid numbers");
        return;
    }

    user2kSplit = (minutes * 60) + seconds;
    
    const user = auth.currentUser;
    if (user) {
        try {
            await updateDoc(doc(db, "users", user.uid), {
                split2k: user2kSplit
            });
            
            document.getElementById('setup-page').style.display = 'none';
            document.getElementById('menu-page').style.display = 'block';
        } catch (e) {
            console.error("Error saving split:", e);
            alert("Could not save your split time.");
        }
    }
}

function calculateTargetSplit(workoutType, strokeRate) {
    if (!user2kSplit) return 120;
    
    const offset = splitOffsets[workoutType];
    const strokeRateRange = strokeRates[workoutType];
    const midStrokeRate = (strokeRateRange.min + strokeRateRange.max) / 2;
    const strokeRateAdjustment = (strokeRate - midStrokeRate) * -1; 
    
    const baseSplit = user2kSplit + randomInRange(offset.min, offset.max);
    return Math.round(baseSplit + strokeRateAdjustment);
}

function generateWorkout() {
    const workoutType = document.getElementById('workout-type').value;
    const difficulty = document.getElementById('difficulty').value;
    
    const templates = workoutTemplates[workoutType][difficulty];
    const workout = templates[Math.floor(Math.random() * templates.length)];
    const tip = coachingTips[Math.floor(Math.random() * coachingTips.length)];
    
    const strokeRate = randomInRange(strokeRates[workoutType].min, strokeRates[workoutType].max);
    const splitTime = calculateTargetSplit(workoutType, strokeRate);
    
    currentWorkout = { type: workoutType, difficulty, workout, strokeRate, splitTime, tip };
    
    renderWorkoutResult();
}

function renderWorkoutResult() {
    const resultsDiv = document.getElementById('workout-results');
    resultsDiv.style.opacity = '0';
    
    const intervals = parseWorkoutIntervals(currentWorkout.workout);
    let splitInputs = '';
    
    for (let i = 1; i <= intervals; i++) {
        splitInputs += `
            <div class="split-input-card">
                <label class="split-label">Interval ${i}</label>
                <input type="text" placeholder="2:00.0" id="split-${i}" class="split-input-field">
            </div>`;
    }

    resultsDiv.innerHTML = `
        <div class="workout-header">
            <h2>${currentWorkout.type.replace('-', ' ').toUpperCase()}</h2>
            <span class="workout-date">${currentWorkout.difficulty.toUpperCase()}</span>
        </div>
        
        <div class="workout-cards">
            <div class="workout-card">
                <h4>Workout</h4>
                <p class="workout-description">${currentWorkout.workout}</p>
            </div>
            <div class="workout-card">
                <h4>Targets</h4>
                <div class="target-grid">
                    <div class="target-item">
                        <span class="target-label">Rate</span>
                        <span class="target-value">${currentWorkout.strokeRate} SPM</span>
                    </div>
                    <div class="target-item">
                        <span class="target-label">Split</span>
                        <span class="target-value">${formatSplitTime(currentWorkout.splitTime)}</span>
                    </div>
                </div>
            </div>
            <div class="workout-card coaching-card">
                <h4>Coaching Tip</h4>
                <p class="coaching-text">${currentWorkout.tip}</p>
            </div>
        </div>
        
        <div class="split-tracker">
            <h4>Track Your Performance</h4>
            <div class="split-inputs-grid">${splitInputs}</div>
        </div>
        
        <button class="save-btn" id="save-workout-btn">Save Workout</button>
    `;

    document.getElementById('save-workout-btn').addEventListener('click', saveWorkoutToCloud);
    
    setTimeout(() => {
        resultsDiv.style.transition = 'opacity 0.5s ease-in';
        resultsDiv.style.opacity = '1';
    }, 100);
}

async function saveWorkoutToCloud() {
    if (!currentWorkout || !auth.currentUser) return;
    
    const intervals = parseWorkoutIntervals(currentWorkout.workout);
    const recordedSplits = [];
    for (let i = 1; i <= intervals; i++) {
        const input = document.getElementById(`split-${i}`);
        if (input && input.value) recordedSplits.push(input.value);
    }

    const workoutData = {
        userId: auth.currentUser.uid,
        ...currentWorkout,
        recordedSplits: recordedSplits,
        date: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "workouts"), workoutData);
        alert("Workout Saved Successfully!");
        loadSavedWorkouts();
    } catch (e) {
        console.error("Error adding workout: ", e);
        alert("Error saving workout");
    }
}

async function loadSavedWorkouts() {
    if (!auth.currentUser) return;
    
    const listDiv = document.getElementById('saved-list');
    listDiv.innerHTML = '<p>Loading...</p>';
    
    try {
        const q = query(
            collection(db, "workouts"), 
            where("userId", "==", auth.currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        loadedWorkouts = []; 
        
        querySnapshot.forEach((doc) => {
            loadedWorkouts.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by date (newest first)
        loadedWorkouts.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (loadedWorkouts.length === 0) {
            listDiv.innerHTML = '<p>No saved workouts found.</p>';
            return;
        }

        listDiv.innerHTML = loadedWorkouts.map((workout, index) => {
            const dateObj = new Date(workout.date);
            const dateStr = dateObj.toLocaleDateString();
            
            return `
            <div class="saved-workout" style="cursor: pointer; position: relative;">
                <div onclick="window.viewWorkoutDetails(${index})" style="flex: 1;">
                    <strong>${workout.type.toUpperCase()}</strong> - ${workout.difficulty}<br>
                    ${workout.workout}<br>
                    <small>${dateStr}</small>
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); window.deleteWorkout('${workout.id}')">X</button>
            </div>
            `;
        }).join('');
        
    } catch (e) {
        console.error("Error loading workouts:", e);
        listDiv.innerHTML = '<p>Error loading workouts.</p>';
    }
}

// --- NEW FUNCTION: CLEAR ALL SAVED ---
async function clearAllWorkouts() {
    if (!confirm("Are you sure you want to delete ALL your saved workouts? This cannot be undone.")) return;
    
    try {
        const listDiv = document.getElementById('saved-list');
        listDiv.innerHTML = '<p>Deleting...</p>';

        // 1. Query all workouts for this user
        const q = query(
            collection(db, "workouts"), 
            where("userId", "==", auth.currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            loadSavedWorkouts();
            return;
        }

        // 2. Create a batch to delete them all at once
        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // 3. Commit the batch
        await batch.commit();
        
        alert("All workouts cleared.");
        loadSavedWorkouts();
        
    } catch (e) {
        console.error("Error clearing workouts:", e);
        alert("Error clearing workouts.");
    }
}

// --- GLOBAL ACTIONS ---

window.deleteWorkout = async function(docId) {
    if(!confirm("Delete this workout?")) return;
    try {
        await deleteDoc(doc(db, "workouts", docId));
        loadSavedWorkouts();
    } catch (e) {
        console.error("Error deleting:", e);
    }
}

window.viewWorkoutDetails = function(index) {
    const workout = loadedWorkouts[index];
    if (!workout) return;
    
    const detailsPage = document.getElementById('workout-details-page');
    const detailsDiv = document.getElementById('workout-details');
    
    document.getElementById('saved-workouts-page').style.display = 'none';
    detailsPage.style.display = 'flex'; 
    
    let splitsHtml = '';
    if (workout.recordedSplits && workout.recordedSplits.length > 0) {
        const splitSeconds = workout.recordedSplits.map(split => {
            const parts = split.split(':');
            let mins = 0, secs = 0;
            if (parts.length === 2) {
                mins = parseFloat(parts[0]);
                secs = parseFloat(parts[1]);
            } else {
                secs = parseFloat(parts[0]);
            }
            return (mins * 60) + secs;
        });
        
        const avgSeconds = splitSeconds.length ? splitSeconds.reduce((a, b) => a + b, 0) / splitSeconds.length : 0;
        const avgSplit = formatSplitTime(Math.round(avgSeconds));

        splitsHtml = `
            <div class="actual-splits">
                <h4>Your Performance</h4>
                <div class="splits-grid">
                    ${workout.recordedSplits.map((split, i) => `
                        <div class="split-item">
                            <span class="split-label">Interval ${i + 1}</span>
                            <span class="split-value">${split}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="average-split">
                    <span class="split-label">Average Split</span>
                    <span class="split-value">${avgSplit}</span>
                </div>
            </div>
        `;
    }

    detailsDiv.innerHTML = `
        <div class="workout-header">
            <h2>${workout.type.toUpperCase()}</h2>
            <span class="workout-date">${new Date(workout.date).toLocaleDateString()}</span>
        </div>
        
        <div class="workout-cards">
            <div class="workout-card">
                <h4>Workout</h4>
                <p class="workout-description">${workout.workout}</p>
            </div>
            
            <div class="workout-card">
                <h4>Targets</h4>
                <div class="target-grid">
                    <div class="target-item">
                        <span class="target-label">Rate</span>
                        <span class="target-value">${workout.strokeRate} SPM</span>
                    </div>
                    <div class="target-item">
                        <span class="target-label">Target Split</span>
                        <span class="target-value">${formatSplitTime(workout.splitTime)}</span>
                    </div>
                </div>
            </div>
            
            <div class="workout-card coaching-card">
                <h4>Coaching Tip</h4>
                <p class="coaching-text">${workout.tip}</p>
            </div>
        </div>
        ${splitsHtml}
    `;
}

// --- INITIALIZATION ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.split2k) {
                user2kSplit = data.split2k;
                // Show main menu rather than generator by default
                document.getElementById('menu-page').style.display = 'block';
                document.getElementById('setup-page').style.display = 'none';
                document.getElementById('workout-page').style.display = 'none';
                document.getElementById('saved-workouts-page').style.display = 'none';

                const mins = Math.floor(user2kSplit / 60);
                const secs = user2kSplit % 60;
                document.getElementById('split-minutes').value = mins;
                document.getElementById('split-seconds').value = secs;
            } else {
                document.getElementById('setup-page').style.display = 'block';
                document.getElementById('workout-page').style.display = 'none';
                document.getElementById('saved-workouts-page').style.display = 'none';
                document.getElementById('menu-page').style.display = 'none';
            }
        }
        
        // Listeners
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) generateBtn.addEventListener('click', generateWorkout);
        
        const setupBtn = document.getElementById('setup-btn');
        if (setupBtn) setupBtn.addEventListener('click', setupUser);
        
        // Connect Clear Button
        const clearBtn = document.getElementById('clear-saved-btn');
        if (clearBtn) clearBtn.addEventListener('click', clearAllWorkouts);

        // Menu navigation buttons
        const mWorkout = document.getElementById('menu-workout-btn');
        const mChange2k = document.getElementById('menu-change2k-btn');
        const mProfile = document.getElementById('menu-profile-btn');
        const mSaved = document.getElementById('menu-saved-btn');

        if (mWorkout) mWorkout.addEventListener('click', () => {
            document.getElementById('menu-page').style.display = 'none';
            document.getElementById('workout-page').style.display = 'block';
        });

        if (mChange2k) mChange2k.addEventListener('click', () => {
            document.getElementById('menu-page').style.display = 'none';
            document.getElementById('setup-page').style.display = 'block';
        });

        if (mProfile) mProfile.addEventListener('click', () => {
            document.getElementById('menu-page').style.display = 'none';
            document.getElementById('profile-page').style.display = 'block';
            // fill email
            if (window.currentUserData) {
                if (window.currentUserData.email) document.getElementById('profile-email').textContent = 'Email: ' + window.currentUserData.email;
                if (window.currentUserData.username) document.getElementById('profile-username').textContent = window.currentUserData.username;
                if (window.currentUserData.username) document.getElementById('profile-avatar').textContent = window.currentUserData.username.charAt(0).toUpperCase();
            } else if (auth.currentUser) {
                document.getElementById('profile-email').textContent = 'Email: ' + auth.currentUser.email;
                document.getElementById('profile-username').textContent = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
                document.getElementById('profile-avatar').textContent = (auth.currentUser.displayName || auth.currentUser.email || 'U').charAt(0).toUpperCase();
            }
        });

        if (mSaved) mSaved.addEventListener('click', () => {
            document.getElementById('menu-page').style.display = 'none';
            document.getElementById('saved-workouts-page').style.display = 'block';
            loadSavedWorkouts();
        });

        // Return-to-menu handlers (for all pages with that class)
        document.querySelectorAll('.return-to-menu').forEach(btn => {
            btn.addEventListener('click', () => {
                // hide all primary pages
                ['workout-page','setup-page','saved-workouts-page','workout-details-page','all-workouts-page','profile-page'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                document.getElementById('menu-page').style.display = 'block';
            });
        });
    }
});