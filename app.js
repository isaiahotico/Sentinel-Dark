
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
let userData = { balance: 0, counts: { fb:0, web:0, yt:0 }, history: {} };

onValue(userRef, (snap) => {
    if (snap.exists()) {
        userData = snap.val();
        if (!userData.counts) userData.counts = { fb:0, web:0, yt:0 };
        if (!userData.history) userData.history = {};
    } else {
        set(userRef, userData);
    }
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(3);
    document.getElementById('wallet-balance').innerText = (userData.balance || 0).toFixed(2);
    updateQuotaUI();
});

// --- Tab Controller ---
window.switchTab = (tab) => {
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden-section'));
    document.getElementById('section-' + tab).classList.remove('hidden-section');
};

// --- Core Task Logic ---
let activeTimer;
let timeLeft = 0;
let currentTask = null;
let isTabFocused = true;

// Facebook / Tab Focus Logic
document.addEventListener("visibilitychange", () => {
    isTabFocused = !document.hidden;
    if (currentTask && (currentTask.type === 'fb_follow' || currentTask.type.startsWith('yt'))) {
        const status = document.getElementById('task-status');
        if (!isTabFocused) {
            status.innerText = "TIMER PAUSED - RETURN TO APP";
            status.classList.add('text-red-500');
        } else {
            status.innerText = "TASK IN PROGRESS...";
            status.classList.remove('text-red-500');
        }
    }
});

window.startTask = (id, type, url, reward, definition, isAdmin = false) => {
    // Cooldown check for Admin links
    if (isAdmin && userData.history[id]) {
        if (Date.now() - userData.history[id] < 2 * 60 * 60 * 1000) {
            return alert("Cooldown: You can visit this admin link again in 2 hours.");
        }
    }

    currentTask = { id, type, reward, isAdmin };
    timeLeft = (type === 'fb_follow' || type === 'web_visit' || isAdmin) ? 15 : 30;

    if (type === 'web_visit' || isAdmin) {
        openWebCard(url, definition);
    } else {
        openSocialOverlay(url);
    }
};

function openWebCard(url, definition) {
    const modal = document.getElementById('web-modal');
    const frame = document.getElementById('web-frame');
    const trigger = document.getElementById('click-trigger');
    const timerBox = document.getElementById('modal-timer');
    
    modal.classList.remove('hidden');
    frame.src = url;
    trigger.classList.remove('hidden');
    timerBox.innerText = "CLICK SITE TO START";

    trigger.onclick = () => {
        trigger.classList.add('hidden');
        runTimer(timerBox, () => {
            modal.classList.add('hidden');
            frame.src = "";
            completeTask();
        });
    };
}

function openSocialOverlay(url) {
    const overlay = document.getElementById('task-overlay');
    const timerText = document.getElementById('timer-text');
    overlay.classList.remove('hidden');
    window.open(url, '_blank');
    
    runTimer(timerText, () => {
        overlay.classList.add('hidden');
        completeTask();
    });
}

function runTimer(displayElement, onFinish) {
    const total = timeLeft;
    const circle = document.getElementById('progress-circle');
    
    activeTimer = setInterval(() => {
        if (isTabFocused) {
            timeLeft--;
            displayElement.innerText = timeLeft + "s";
            
            if (circle) {
                const offset = 377 - ((total - timeLeft) / total * 377);
                circle.style.strokeDashoffset = offset;
            }

            if (timeLeft <= 0) {
                clearInterval(activeTimer);
                onFinish();
            }
        }
    }, 1000);
}

async function completeTask() {
    const { id, reward } = currentTask;
    const updates = {};
    updates[`users/${username}/balance`] = (userData.balance || 0) + reward;
    updates[`users/${username}/history/${id}`] = Date.now();
    
    if (!currentTask.isAdmin) {
        const snap = await get(ref(db, `links/${id}`));
        if (snap.exists()) updates[`links/${id}/clicks`] = (snap.val().clicks || 0) + 1;
    }

    await update(ref(db), updates);
    alert(`Reward Added: ₱${reward}`);
    currentTask = null;
}

// --- Submit Links ---
window.createNewLink = async () => {
    const type = document.getElementById('link-type').value;
    const url = document.getElementById('link-url').value;
    const definition = document.getElementById('link-def').value;
    
    if (!url || !definition) return alert("Fill all fields");

    let isFree = false;
    let cost = 1.0;
    let maxClicks = 100;
    let reward = 0.02;

    if (type === 'fb_follow' && userData.counts.fb < 3) isFree = true;
    if (type === 'web_visit' && userData.counts.web < 3) isFree = true;
    if (type.startsWith('yt') && userData.counts.yt < 5) isFree = true;

    if (!isFree && userData.balance < cost) return alert("Insufficient Balance (₱1.00 required)");

    const newLink = {
        type, url, definition, reward, maxClicks, clicks: 0, 
        creator: username, createdAt: serverTimestamp()
    };

    if (type === 'yt_watch') { newLink.reward = 0.01; newLink.maxClicks = isFree ? 100 : 120; }
    if (type === 'yt_sub') { newLink.reward = 0.03; newLink.maxClicks = isFree ? 50 : 65; }

    const updates = {};
    const key = push(ref(db, 'links')).key;
    updates[`links/${key}`] = newLink;
    if (!isFree) updates[`users/${username}/balance`] = userData.balance - cost;
    
    const countKey = type === 'fb_follow' ? 'fb' : type === 'web_visit' ? 'web' : 'yt';
    updates[`users/${username}/counts/${countKey}`] = userData.counts[countKey] + 1;

    await update(ref(db), updates);
    alert("Link published!");
    switchTab('earn');
};

// --- Withdrawals ---
window.requestWithdrawal = async () => {
    const method = document.getElementById('wd-method').value;
    const account = document.getElementById('wd-account').value;
    const amount = parseFloat(document.getElementById('wd-amount').value);

    if (amount < 1) return alert("Minimum ₱1.00");
    if (amount > userData.balance) return alert("Insufficient balance");
    if (!account) return alert("Enter account details");

    const wdKey = push(ref(db, 'withdrawals')).key;
    const request = { username, method, account, amount, status: 'pending', date: serverTimestamp() };
    
    const updates = {};
    updates[`withdrawals/${wdKey}`] = request;
    updates[`users/${username}/balance`] = userData.balance - amount;
    
    await update(ref(db), updates);
    alert("Withdrawal submitted for approval.");
};

// --- Realtime UI Updates ---
onValue(ref(db, 'links'), (snap) => {
    const adminList = document.getElementById('admin-list');
    const taskList = document.getElementById('task-list');
    adminList.innerHTML = ""; taskList.innerHTML = "";

    const data = snap.val();
    if (data) {
        Object.keys(data).forEach(id => {
            const link = data[id];
            if (link.clicks >= link.maxClicks && !link.isAdmin) return;
            if (userData.history[id] && !link.isAdmin) return;

            const card = document.createElement('div');
            card.className = `bg-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-center ${link.isAdmin ? 'admin-task' : ''}`;
            card.innerHTML = `
                <div class="flex-1 pr-2">
                    <p class="text-[10px] uppercase font-bold text-gray-500">${link.type.replace('_',' ')}</p>
                    <p class="text-sm font-medium line-clamp-1">${link.definition}</p>
                </div>
                <button onclick="startTask('${id}', '${link.type}', '${link.url}', ${link.reward}, '${link.definition}', ${link.isAdmin || false})" class="bg-blue-600 px-4 py-2 rounded-lg font-bold text-xs shrink-0">
                    ₱${link.reward}
                </button>
            `;
            if (link.isAdmin) adminList.appendChild(card);
            else taskList.appendChild(card);
        });
    }
});

function updateQuotaUI() {
    const q = userData.counts;
    document.getElementById('quota-info').innerText = `Free Remaining: FB(${3-q.fb}) WEB(${3-q.web}) YT(${5-q.yt})`;
}
