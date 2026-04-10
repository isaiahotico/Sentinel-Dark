
// --- DATABASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "facebook-follow-to-follow.firebaseapp.com",
    databaseURL: "https://facebook-follow-to-follow-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facebook-follow-to-follow",
    storageBucket: "facebook-follow-to-follow.firebasestorage.app",
    messagingSenderId: "589427984313",
    appId: "1:589427984313:web:a17b8cc851efde6dd79868"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Telegram Setup
const tg = window.Telegram.WebApp;
tg.expand();
const username = tg.initDataUnsafe?.user?.username || "Guest_" + Math.floor(Math.random() * 1000);
document.getElementById('user-display').innerText = `@${username}`;

// State Management
let adsWatched = 0;
let lastPostTime = 0;
const REQUIRED_ADS = 27;
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

// User Session Logic
const userRef = db.ref('users/' + username);
const tasksRef = db.ref('tasks');
const chatRef = db.ref('chat');
const presenceRef = db.ref('presence/' + username);

// Track Presence
presenceRef.set({ status: 'online', lastSeen: Date.now() });
presenceRef.onDisconnect().remove();

// Load User Data
userRef.on('value', (snapshot) => {
    const data = snapshot.val() || {};
    adsWatched = data.adsWatched || 0;
    lastPostTime = data.lastPostTime || 0;
    
    document.getElementById('ad-count').innerText = `${adsWatched} / ${REQUIRED_ADS}`;
    updateSubmitButton();
});

// Update Color Theme
const bgPicker = document.getElementById('bgColor');
const textPicker = document.getElementById('textColor');

bgPicker.addEventListener('input', (e) => {
    document.documentElement.style.setProperty('--main-bg', e.target.value);
    localStorage.setItem('pref-bg', e.target.value);
});

textPicker.addEventListener('input', (e) => {
    document.documentElement.style.setProperty('--main-color', e.target.value);
    localStorage.setItem('pref-text', e.target.value);
});

// Watch Ads Logic
function watchAd() {
    // Open ProfitableCPM Ad in new tab
    window.open('https://www.profitablecpmratenetwork.com/i2rx8svvds?key=ec449a85ea63cb0b7adf4cd90009cbca', '_blank');

    // Trigger Interstitial Ad
    const adZones = ['show_10555663', 'show_10830602', 'show_10555746'];
    const randomZone = adZones[Math.floor(Math.random() * adZones.length)];

    window[randomZone]().then(() => {
        adsWatched++;
        userRef.update({ adsWatched: adsWatched });
        alert('Ad reward collected!');
    }).catch(e => {
        // Fallback if ad fails to load
        adsWatched++;
        userRef.update({ adsWatched: adsWatched });
    });
}

// Task Submission
function updateSubmitButton() {
    const btn = document.getElementById('btn-submit');
    const now = Date.now();
    const isCooldownActive = (now - lastPostTime) < COOLDOWN_MS;
    
    if (adsWatched >= REQUIRED_ADS && !isCooldownActive) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.classList.remove('cursor-not-allowed');
        document.getElementById('cooldown-timer').innerText = "";
    } else {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        if(isCooldownActive) {
            const remaining = Math.ceil((COOLDOWN_MS - (now - lastPostTime)) / 3600000);
            document.getElementById('cooldown-timer').innerText = `Cooldown: ${remaining} hours left`;
        }
    }
}

function submitTask() {
    const link = document.getElementById('task-link').value;
    if (!link.includes('t.me')) return alert("Enter a valid Telegram link");

    const newTaskRef = tasksRef.push();
    newTaskRef.set({
        sender: username,
        link: link,
        timestamp: Date.now()
    });

    userRef.update({ lastPostTime: Date.now() });
    document.getElementById('task-link').value = "";
    alert("Task posted successfully!");
}

// Task Rendering & Hiding
tasksRef.on('value', (snapshot) => {
    const tasks = snapshot.val();
    const container = document.getElementById('tasks-container');
    container.innerHTML = "";
    
    const hiddenTasks = JSON.parse(localStorage.getItem('hidden_tasks') || "[]");

    for (let id in tasks) {
        if (hiddenTasks.includes(id)) continue;

        const div = document.createElement('div');
        div.className = "glass p-3 rounded-lg flex justify-between items-center animate-fade-in";
        div.innerHTML = `
            <span class="text-sm">By @${tasks[id].sender}</span>
            <button onclick="handleTaskClick('${id}', '${tasks[id].link}')" class="bg-white/20 px-4 py-1 rounded">Open Link</button>
        `;
        container.appendChild(div);
    }
});

function handleTaskClick(taskId, link) {
    let hiddenTasks = JSON.parse(localStorage.getItem('hidden_tasks') || "[]");
    hiddenTasks.push(taskId);
    localStorage.setItem('hidden_tasks', JSON.stringify(hiddenTasks));
    
    window.open(link, '_blank');
    location.reload(); // Refresh to hide the clicked task
}

// Chat Logic
function sendMessage() {
    const input = document.getElementById('chat-input');
    if (input.value.trim() === "") return;

    chatRef.push({
        user: username,
        msg: input.value,
        time: Date.now()
    });
    input.value = "";
}

chatRef.limitToLast(20).on('value', (snapshot) => {
    const box = document.getElementById('chat-box');
    box.innerHTML = "";
    snapshot.forEach(child => {
        const data = child.val();
        box.innerHTML += `<div class="text-sm"><b>@${data.user}:</b> ${data.msg}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// Online Users List
db.ref('presence').on('value', (snapshot) => {
    const list = document.getElementById('online-users');
    list.innerHTML = "";
    snapshot.forEach(child => {
        list.innerHTML += `<span class="bg-green-500/20 text-green-400 border border-green-500/50 px-2 py-1 rounded">● ${child.key}</span>`;
    });
});

// Footer Time
setInterval(() => {
    const now = new Date();
    document.getElementById('footer-date').innerText = now.toLocaleString();
}, 1000);

// Load Preferences
window.onload = () => {
    const savedBg = localStorage.getItem('pref-bg');
    const savedText = localStorage.getItem('pref-text');
    if(savedBg) {
        document.documentElement.style.setProperty('--main-bg', savedBg);
        bgPicker.value = savedBg;
    }
    if(savedText) {
        document.documentElement.style.setProperty('--main-color', savedText);
        textPicker.value = savedText;
    }
};
