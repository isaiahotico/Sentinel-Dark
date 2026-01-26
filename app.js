
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update, increment, query, orderByChild, limitToLast, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const tg = window.Telegram.WebApp;
tg.expand();

const uid = tg.initDataUnsafe?.user?.id || "dev_" + Math.floor(Math.random() * 999);
const username = tg.initDataUnsafe?.user?.username || "Guest_" + uid;
const startParam = tg.initDataUnsafe?.start_param;

let currentBal = 0;
let currentPts = 0;

// Init User & Referral System
onValue(ref(db, 'users/' + uid), (snap) => {
    const data = snap.val();
    if (!data) {
        set(ref(db, 'users/' + uid), {
            username: username,
            balance: 0,
            chatPoints: 0,
            refBy: (startParam && startParam !== username) ? startParam : null
        });
        set(ref(db, 'usernames/' + username), uid);
    } else {
        currentBal = data.balance || 0;
        currentPts = data.chatPoints || 0;
        document.getElementById('bal').innerText = currentBal.toFixed(4);
        document.getElementById('pts').innerText = currentPts;
    }
});
document.getElementById('my-username').innerText = username;

// Ad Reward + 8% Referral Logic
async function giveReward(amt) {
    await update(ref(db, 'users/' + uid), { balance: increment(amt) });
    const userSnap = await get(ref(db, 'users/' + uid));
    const referrer = userSnap.val()?.refBy;
    if (referrer) {
        const refUidSnap = await get(ref(db, 'usernames/' + referrer));
        const refUid = refUidSnap.val();
        if (refUid) {
            update(ref(db, 'users/' + refUid), { balance: increment(amt * 0.08) });
        }
    }
}

// Combined Ads Handlers
window.runAd = async (type) => {
    const btn = document.getElementById('btn-' + type);
    btn.disabled = true;

    try {
        if (type === 'normal') {
            await show_10276123('pop');
            await giveReward(0.0102);
            startTimer('normal', 180);
        } else if (type === 'turbo') {
            await show_10276123('pop');
            await show_10276123('pop'); // Combined Ad 2
            await giveReward(0.0120);
            startTimer('turbo', 45);
        } else if (type === 'pts') {
            await show_10276123('pop');
            await show_10276123('pop');
            await show_10276123('pop'); // Combined Ad 3
            update(ref(db, 'users/' + uid), { chatPoints: increment(1) });
            startTimer('pts', 300);
        }
        tg.showAlert("Reward Successful!");
    } catch (e) {
        btn.disabled = false;
        tg.showAlert("Ad error or cancelled.");
    }
};

function startTimer(type, sec) {
    const btn = document.getElementById('btn-' + type);
    const div = document.getElementById('timer-' + type);
    const end = Date.now() + sec * 1000;
    const itv = setInterval(() => {
        const remaining = Math.ceil((end - Date.now()) / 1000);
        div.innerText = `Wait: ${remaining}s`;
        if (remaining <= 0) {
            clearInterval(itv);
            btn.disabled = false;
            div.innerText = "Ready!";
        }
    }, 1000);
}

// Chat System
window.sendChat = async () => {
    const inp = document.getElementById('chat-input');
    if (!inp.value.trim() || currentPts < 1) return tg.showAlert("Need 1 Chat Point!");
    
    await update(ref(db, 'users/' + uid), { 
        chatPoints: increment(-1), 
        balance: increment(0.02) 
    });
    push(ref(db, 'chat'), { u: username, m: inp.value, t: Date.now() });
    inp.value = "";
};

// Tabs & Loaders
window.tab = (id) => {
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('n-' + id).classList.add('active');
    if (id === 'chat') loadChat();
    if (id === 'leaderboard') loadLeaderboard();
    if (id === 'wallet') loadHistory();
};

function loadChat() {
    onValue(query(ref(db, 'chat'), limitToLast(20)), (snap) => {
        const box = document.getElementById('chat-list');
        box.innerHTML = "";
        snap.forEach(c => {
            const d = c.val();
            box.innerHTML += `<div class="bg-white/5 p-2 rounded-lg"><b>${d.u}:</b> ${d.m}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// Wallet & Admin
window.submitWithdraw = () => {
    const num = document.getElementById('gcash-num').value;
    if (num.length < 10 || currentBal < 0.02) return tg.showAlert("Error: Check balance or number");
    const amt = currentBal;
    update(ref(db, 'users/' + uid), { balance: 0 });
    const payload = { uid, username, gcash: num, amount: amt, status: 'pending', date: new Date().toLocaleString() };
    push(ref(db, 'withdrawals'), payload);
    push(ref(db, `history/${uid}`), payload);
    tg.showAlert("Withdrawal Requested!");
};

function loadHistory() {
    onValue(ref(db, `history/${uid}`), (snap) => {
        const box = document.getElementById('history-list');
        box.innerHTML = "<h4 class='text-[10px] text-yellow-500 font-bold'>MY HISTORY</h4>";
        snap.forEach(c => {
            const h = c.val();
            box.innerHTML += `<div class="glass p-2 text-[10px] flex justify-between"><span>${h.date}</span><span class="${h.status === 'pending'?'text-orange-400':'text-green-400'}">${h.status.toUpperCase()} (₱${h.amount.toFixed(2)})</span></div>`;
        });
    });
}

window.doAdminLogin = () => {
    if (document.getElementById('admin-pw').value === "Propetas12") {
        document.getElementById('admin-gate').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const box = document.getElementById('adm-requests');
        box.innerHTML = "";
        snap.forEach(c => {
            const r = c.val();
            if (r.status === 'pending') {
                const d = document.createElement('div');
                d.className = "glass p-3 text-xs flex justify-between items-center";
                d.innerHTML = `<span>${r.username} (${r.gcash})<br>₱${r.amount.toFixed(2)}</span>
                               <button onclick="approveW('${c.key}', ${r.amount})" class="bg-green-600 px-3 py-1 rounded">PAY</button>`;
                box.appendChild(d);
            }
        });
    });
    onValue(ref(db, 'admin/total'), s => document.getElementById('adm-total').innerText = (s.val() || 0).toFixed(2));
}

window.approveW = async (key, amt) => {
    await update(ref(db, `withdrawals/${key}`), { status: 'paid' });
    await update(ref(db, 'admin/total'), increment(amt));
};

function loadLeaderboard() {
    onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), (snap) => {
        const box = document.getElementById('leader-list');
        box.innerHTML = "<h3 class='text-yellow-500 font-bold text-center'>🏅 TOP 10 EARNERS</h3>";
        let arr = [];
        snap.forEach(c => arr.push(c.val()));
        arr.reverse().forEach((u, i) => {
            box.innerHTML += `<div class="glass p-3 flex justify-between text-sm"><span>${i+1}. ${u.username}</span><span class="text-green-400">₱${u.balance.toFixed(2)}</span></div>`;
        });
    });
}

// Background Diamonds
const wrap = document.getElementById('diamond-wrap');
for (let i = 0; i < 12; i++) {
    const d = document.createElement('div');
    d.className = 'diamond';
    d.style.left = Math.random() * 100 + '%';
    d.style.animationDelay = Math.random() * 10 + 's';
    wrap.appendChild(d);
}

// In-App Ad Logic
window.onload = () => {
    const last = localStorage.getItem('lastInApp') || 0;
    if (Date.now() - last > 120000) {
        show_10276123({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
        localStorage.setItem('lastInApp', Date.now());
    }
};
