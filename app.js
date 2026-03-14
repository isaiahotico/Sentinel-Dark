
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
let username = "Guest_" + Math.floor(Math.random() * 8888);
if (tg?.initDataUnsafe?.user?.username) {
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
    updateUI();
});

function updateUI() {
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(3);
    document.getElementById('wallet-balance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('promo-quota').innerText = `FREE REMAINING: FB(${3-userData.counts.fb}) WEB(${3-userData.counts.web}) YT(${5-userData.counts.yt})`;
}

// --- Navigation ---
window.switchTab = (tab) => {
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden-section'));
    document.querySelectorAll('button[id$="-btn"]').forEach(b => b.classList.remove('tab-active', 'text-gray-100'));
    
    document.getElementById('section-' + tab).classList.remove('hidden-section');
    document.getElementById('tab-' + tab + '-btn').classList.add('tab-active');
};

window.checkAdmin = () => {
    const pw = prompt("Enter Admin Password:");
    if (pw === "Propetas12") switchTab('admin');
    else alert("Invalid Password");
};

// --- Task Engine Variables ---
let activeTimer;
let timeLeft = 0;
let currentTask = null;
let refreshes = 0;
let isTabFocused = true;

// Tab Monitoring (Auto-Pause)
document.addEventListener("visibilitychange", () => {
    isTabFocused = !document.hidden;
    const status = document.getElementById('social-status');
    if (status) {
        status.innerText = isTabFocused ? "TASK IN PROGRESS..." : "PAUSED - RETURN TO APP";
        status.classList.toggle('text-red-500', !isTabFocused);
    }
});

// --- Execution Logic ---
window.startTask = (id, type, url, reward, isAdmin) => {
    if (isAdmin && userData.history[id]) {
        if (Date.now() - userData.history[id] < 7200000) {
            return alert("Cooldown active! Return to this sponsored link in 2 hours.");
        }
    }

    currentTask = { id, type, url, reward, isAdmin };
    timeLeft = (type === 'yt_watch' || type === 'yt_sub') ? 30 : 15;

    if (type === 'web_visit' || isAdmin) {
        openWebCard(url);
    } else {
        openSocialOverlay(url);
    }
};

function openWebCard(url) {
    refreshes = 0;
    const modal = document.getElementById('web-modal');
    const frame = document.getElementById('web-frame');
    const blocker = document.getElementById('web-blocker');
    const countText = document.getElementById('refresh-count');
    const timerText = document.getElementById('web-timer');
    
    modal.classList.remove('hidden');
    frame.src = url;
    blocker.classList.remove('hidden');
    countText.innerText = "0";
    timerText.innerText = "15s";
}

window.handleInternalRefresh = () => {
    refreshes++;
    const frame = document.getElementById('web-frame');
    const blocker = document.getElementById('web-blocker');
    const countText = document.getElementById('refresh-count');
    const timerText = document.getElementById('web-timer');
    
    // Refresh the iframe
    frame.src = frame.src;
    countText.innerText = refreshes;

    if (refreshes >= 3) {
        blocker.classList.add('hidden');
        document.getElementById('refresh-btn').classList.add('hidden');
        
        activeTimer = setInterval(() => {
            timeLeft--;
            timerText.innerText = timeLeft + "s";
            if (timeLeft <= 0) {
                clearInterval(activeTimer);
                closeAndReward('web-modal');
            }
        }, 1000);
    }
};

function openSocialOverlay(url) {
    const overlay = document.getElementById('social-overlay');
    const display = document.getElementById('social-timer');
    overlay.classList.remove('hidden');
    window.open(url, '_blank');

    activeTimer = setInterval(() => {
        if (isTabFocused) {
            timeLeft--;
            display.innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(activeTimer);
                closeAndReward('social-overlay');
            }
        }
    }, 1000);
}

async function closeAndReward(modalId) {
    const { id, reward } = currentTask;
    document.getElementById(modalId).classList.add('hidden');
    document.getElementById('refresh-btn').classList.remove('hidden');
    
    const updates = {};
    updates[`users/${username}/balance`] = userData.balance + reward;
    updates[`users/${username}/history/${id}`] = Date.now();
    
    if (!currentTask.isAdmin) {
        const snap = await get(ref(db, `links/${id}`));
        if (snap.exists()) updates[`links/${id}/clicks`] = (snap.val().clicks || 0) + 1;
    }

    await update(ref(db), updates);
    alert(`₱${reward} credited to your balance!`);
    currentTask = null;
}

// --- Submit Promotion ---
window.handlePromotion = async () => {
    const type = document.getElementById('promo-type').value;
    const url = document.getElementById('promo-url').value;
    const def = document.getElementById('promo-def').value;

    if (!url || !def) return alert("Please fill all details");

    let isFree = false;
    let cost = 1.0;
    if (type === 'fb_follow' && userData.counts.fb < 3) isFree = true;
    if (type === 'web_visit' && userData.counts.web < 3) isFree = true;
    if (type.startsWith('yt') && userData.counts.yt < 5) isFree = true;

    if (!isFree && userData.balance < cost) return alert("Insufficient balance! (₱1.00 required)");

    const newLink = { 
        type, url, definition: def, clicks: 0, reward: 0.02, maxClicks: 100, 
        creator: username, createdAt: serverTimestamp() 
    };

    if (type === 'yt_watch') { newLink.reward = 0.01; newLink.maxClicks = isFree ? 100 : 120; }
    if (type === 'yt_sub') { newLink.reward = 0.03; newLink.maxClicks = isFree ? 50 : 65; }

    const key = push(ref(db, 'links')).key;
    const updates = {};
    updates[`links/${key}`] = newLink;
    if (!isFree) updates[`users/${username}/balance`] = userData.balance - cost;
    
    const countKey = type === 'fb_follow' ? 'fb' : type === 'web_visit' ? 'web' : 'yt';
    updates[`users/${username}/counts/${countKey}`] = userData.counts[countKey] + 1;

    await update(ref(db), updates);
    alert("Campaign Created!");
    switchTab('earn');
};

// --- Withdrawals ---
window.requestWithdrawal = async () => {
    const method = document.getElementById('wd-method').value;
    const account = document.getElementById('wd-account').value;
    const amount = parseFloat(document.getElementById('wd-amount').value);

    if (amount < 1 || amount > userData.balance) return alert("Minimum ₱1.00 or balance exceeded.");
    if (!account) return alert("Enter account details.");

    const wdKey = push(ref(db, 'withdrawals')).key;
    const updates = {};
    updates[`withdrawals/${wdKey}`] = { username, method, account, amount, status: 'pending', time: serverTimestamp() };
    updates[`users/${username}/balance`] = userData.balance - amount;

    await update(ref(db), updates);
    alert("Withdrawal request sent!");
};

// --- Admin Rendering ---
onValue(ref(db, 'withdrawals'), (snap) => {
    const list = document.getElementById('admin-wd-list');
    list.innerHTML = `<p class="text-[10px] text-gray-500 font-bold mb-2 uppercase">Pending Withdrawals</p>`;
    if (!snap.exists()) return;
    Object.keys(snap.val()).forEach(id => {
        const w = snap.val()[id];
        if (w.status !== 'pending') return;
        const div = document.createElement('div');
        div.className = "bg-black/50 p-3 rounded-xl flex justify-between items-center text-[10px]";
        div.innerHTML = `
            <span>@${w.username} • ₱${w.amount} (${w.method})</span>
            <div class="flex gap-2">
                <button onclick="approveWD('${id}', true)" class="text-green-500">✔ Approve</button>
                <button onclick="approveWD('${id}', false)" class="text-red-500">✖ Reject</button>
            </div>
        `;
        list.appendChild(div);
    });
});

window.approveWD = async (id, approve) => {
    if (!approve) {
        const wdSnap = await get(ref(db, `withdrawals/${id}`));
        const amount = wdSnap.val().amount;
        const u = wdSnap.val().username;
        const userSnap = await get(ref(db, `users/${u}`));
        await update(ref(db, `users/${u}`), { balance: userSnap.val().balance + amount });
    }
    await update(ref(db, `withdrawals/${id}`), { status: approve ? 'approved' : 'rejected' });
};

window.postAdminLink = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    if (!url || !def) return;
    const key = push(ref(db, 'links')).key;
    await set(ref(db, `links/${key}`), { 
        url, definition: def, isAdmin: true, reward: 0.021, clicks: 0, maxClicks: 100000, type: 'SPONSOR' 
    });
    alert("Sponsored link posted!");
};

// --- Earn Rendering ---
onValue(ref(db, 'links'), (snap) => {
    const adminCont = document.getElementById('admin-links-container');
    const userCont = document.getElementById('user-links-container');
    adminCont.innerHTML = ""; userCont.innerHTML = "";

    if (!snap.exists()) return;
    const data = snap.val();
    Object.keys(data).forEach(id => {
        const link = data[id];
        // Rules for Visibility
        if (!link.isAdmin && (link.clicks >= link.maxClicks || userData.history[id])) return;
        if (link.isAdmin && userData.history[id] && (Date.now() - userData.history[id] < 7200000)) return;

        const card = document.createElement('div');
        card.className = `p-4 rounded-2xl flex justify-between items-center ${link.isAdmin ? 'admin-glow' : 'bg-gray-800 border border-gray-700'}`;
        card.innerHTML = `
            <div class="flex-1 pr-3">
                <p class="text-[9px] uppercase font-bold text-blue-400">${link.isAdmin ? 'Sponsored' : link.type}</p>
                <p class="text-xs font-semibold leading-tight line-clamp-1">${link.definition}</p>
            </div>
            <button onclick="startTask('${id}', '${link.type}', '${link.url}', ${link.reward}, ${link.isAdmin || false})" class="bg-blue-600 px-4 py-2 rounded-lg font-black text-xs">
                ₱${link.reward}
            </button>
        `;
        if (link.isAdmin) adminCont.appendChild(card);
        else userCont.appendChild(card);
    });
});
