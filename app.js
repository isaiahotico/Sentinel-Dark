
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram?.WebApp;

// --- User Initialization ---
let username = "Guest_" + Math.floor(Math.random() * 10000);
if (tg && tg.initDataUnsafe?.user?.username) {
    username = tg.initDataUnsafe.user.username;
}
document.getElementById('tg-username').innerText = "@" + username;

const userRef = ref(db, 'users/' + username);
let userData = { balance: 0, linksCreated: { fb:0, web:0, yt_w:0, yt_s:0 }, history: {} };

onValue(userRef, (snap) => {
    if (snap.exists()) {
        userData = snap.val();
        if (!userData.linksCreated) userData.linksCreated = { fb:0, web:0, yt_w:0, yt_s:0 };
        if (!userData.history) userData.history = {};
    } else {
        set(userRef, userData);
    }
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(3);
    document.getElementById('ref-link').innerText = `http://t.me/Sentinel_KRo_earning_bot?startapp=${username}`;
    updateQuotaText();
});

// --- UI Navigation ---
window.toggleView = (view) => {
    document.getElementById('tasks-container').classList.toggle('hidden-section', view !== 'tasks');
    document.getElementById('add-section').classList.toggle('hidden-section', view !== 'add');
};

// --- Task Processing Logic ---
let timerInterval;
let timeLeft = 0;
let currentTask = null;
let isTabActive = true;

// Monitor tab activity for Facebook logic
document.addEventListener("visibilitychange", () => {
    isTabActive = !document.hidden;
    const bubble = document.getElementById('status-bubble');
    if (bubble) bubble.innerText = isTabActive ? "TIMER RUNNING..." : "TIMER PAUSED - RETURN TO PAGE";
});

window.startTask = async (id, type, url, definition, reward, isAdmin = false) => {
    // Check Cooldown for Admin Links
    if (isAdmin && userData.history[id]) {
        const lastClick = userData.history[id];
        if (Date.now() - lastClick < 2 * 60 * 60 * 1000) {
            alert("Cooldown active! Please wait 2 hours.");
            return;
        }
    }

    currentTask = { id, type, url, reward, isAdmin };
    timeLeft = (type === 'yt_watch' || type === 'yt_sub') ? 30 : 15;
    
    if (type === 'web_visit' || isAdmin) {
        showWebModal(url, definition);
    } else {
        showTaskOverlay(url);
    }
};

function showTaskOverlay(url) {
    const overlay = document.getElementById('task-overlay');
    overlay.classList.remove('hidden');
    window.open(url, '_blank');
    
    const circle = document.getElementById('circle-progress');
    const display = document.getElementById('task-sec');
    const total = timeLeft;

    timerInterval = setInterval(() => {
        if (isTabActive) {
            timeLeft--;
            display.innerText = timeLeft;
            const offset = 502 - ((total - timeLeft) / total * 502);
            circle.style.strokeDashoffset = offset;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                completeTask();
            }
        }
    }, 1000);
}

function showWebModal(url, definition) {
    const modal = document.getElementById('web-modal');
    const timerBox = document.getElementById('modal-timer');
    const goBtn = document.getElementById('modal-go-btn');
    const defBox = document.getElementById('modal-def');
    
    modal.classList.remove('hidden');
    defBox.innerText = definition;
    goBtn.onclick = () => {
        window.open(url, '_blank');
        goBtn.classList.add('hidden');
        document.getElementById('modal-status').innerText = "Running... Do not close this app.";
        
        timerInterval = setInterval(() => {
            timeLeft--;
            timerBox.innerText = timeLeft + "s";
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                completeTask();
                modal.classList.add('hidden');
            }
        }, 1000);
    };
}

async function completeTask() {
    const { id, reward, isAdmin } = currentTask;
    const updates = {};
    
    updates[`users/${username}/balance`] = (userData.balance || 0) + reward;
    updates[`users/${username}/history/${id}`] = Date.now();
    
    if (!isAdmin) {
        const linkSnap = await get(ref(db, `links/${id}`));
        if (linkSnap.exists()) {
            updates[`links/${id}/clicks`] = (linkSnap.val().clicks || 0) + 1;
        }
    }

    await update(ref(db), updates);
    
    document.getElementById('task-overlay').classList.add('hidden');
    document.getElementById('web-modal').classList.add('hidden');
    alert(`Success! ₱${reward} credited.`);
    currentTask = null;
}

// --- Data Rendering ---
onValue(ref(db, 'links'), (snapshot) => {
    const data = snapshot.val();
    const lists = { 
        fb: document.getElementById('fb-list'),
        web: document.getElementById('web-list'),
        yt: document.getElementById('yt-list'),
        admin: document.getElementById('admin-list')
    };
    Object.values(lists).forEach(l => l.innerHTML = '');

    if (data) {
        Object.keys(data).forEach(key => {
            const link = data[key];
            if (link.clicks >= link.maxClicks && !link.isAdmin) return;
            if (userData.history[key] && !link.isAdmin) return;

            const card = document.createElement('div');
            card.className = `bg-gray-800 p-4 rounded-xl flex justify-between items-center border border-gray-700 ${link.isAdmin ? 'admin-card' : ''}`;
            card.innerHTML = `
                <div class="flex-1 pr-4">
                    <p class="text-xs font-bold text-yellow-500">${link.isAdmin ? 'SPONSORED' : link.type.toUpperCase()}</p>
                    <p class="text-sm font-medium line-clamp-1">${link.definition || 'No description'}</p>
                    <p class="text-[10px] text-gray-500 truncate">${link.url}</p>
                </div>
                <button onclick="startTask('${key}', '${link.type}', '${link.url}', '${link.definition}', ${link.reward}, ${link.isAdmin || false})" 
                        class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-xs">
                    GO (₱${link.reward})
                </button>
            `;

            if (link.isAdmin) lists.admin.appendChild(card);
            else if (link.type === 'fb_follow') lists.fb.appendChild(card);
            else if (link.type === 'web_visit') lists.web.appendChild(card);
            else lists.yt.appendChild(card);
        });
    }
});

// --- Submission Logic ---
window.handleLinkSubmission = async () => {
    const type = document.getElementById('link-type').value;
    const url = document.getElementById('link-url').value;
    const definition = document.getElementById('link-desc').value;

    if (!url || !definition) return alert("Fill all fields");

    let isFree = false;
    let cost = 1.0;
    let maxClicks = 100;
    let reward = 0.02;

    const counts = userData.linksCreated;
    if (type === 'fb_follow' && (counts.fb < 3)) isFree = true;
    if (type === 'web_visit' && (counts.web < 3)) isFree = true;
    if (type.startsWith('yt_') && (counts.yt_w + counts.yt_s < 5)) isFree = true;

    if (!isFree && userData.balance < cost) return alert("Need ₱1.00 balance");

    const newLink = {
        type, url, definition, clicks: 0, maxClicks, reward,
        creator: username, createdAt: serverTimestamp()
    };

    if (type === 'yt_watch') { newLink.reward = 0.01; newLink.maxClicks = isFree ? 100 : 120; }
    if (type === 'yt_sub') { newLink.reward = 0.03; newLink.maxClicks = isFree ? 50 : 65; }

    const updates = {};
    if (!isFree) updates[`users/${username}/balance`] = userData.balance - cost;
    
    const typeKey = type === 'fb_follow' ? 'fb' : type === 'web_visit' ? 'web' : 'yt_w';
    updates[`users/${username}/linksCreated/${typeKey}`] = (counts[typeKey] || 0) + 1;

    const newKey = push(ref(db, 'links')).key;
    updates[`links/${newKey}`] = newLink;

    await update(ref(db), updates);
    alert("Link published successfully!");
    toggleView('tasks');
};

function updateQuotaText() {
    const c = userData.linksCreated;
    document.getElementById('quota-info').innerText = `Free Remaining: FB(${3-c.fb}) Web(${3-c.web}) YT(${5-(c.yt_w+c.yt_s)})`;
}
