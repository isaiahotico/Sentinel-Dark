
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

const uid = tg.initDataUnsafe?.user?.id || "temp_" + Math.floor(Math.random()*1000);
const username = tg.initDataUnsafe?.user?.username || "NoUser_" + uid;
const refCode = tg.initDataUnsafe?.start_param; // Automatically get ref username from link

let balance = 0;
let points = 0;

// Initialize User
const userRef = ref(db, 'users/' + uid);
onValue(userRef, (snap) => {
    const data = snap.val();
    if (!data) {
        set(userRef, {
            username: username,
            balance: 0,
            chatPoints: 0,
            referredBy: (refCode && refCode !== username) ? refCode : null
        });
        set(ref(db, 'usernames/' + username), uid);
    } else {
        balance = data.balance || 0;
        points = data.chatPoints || 0;
        document.getElementById('u-bal').innerText = balance.toFixed(4);
        document.getElementById('u-pts').innerText = points;
    }
});

document.getElementById('my-username').innerText = username;

// Ads Logic
async function giveReward(amount) {
    await update(userRef, { balance: increment(amount) });
    
    // Referral Reward (8%)
    const snap = await get(userRef);
    const referrer = snap.val()?.referredBy;
    if (referrer) {
        const refUidSnap = await get(ref(db, 'usernames/' + referrer));
        const refUid = refUidSnap.val();
        if (refUid) {
            update(ref(db, 'users/' + refUid), { balance: increment(amount * 0.08) });
        }
    }
}

window.playAd = (type) => {
    const btn = document.getElementById('btn-' + type);
    btn.disabled = true;

    show_10276123('pop').then(async () => {
        if (type === 'normal') {
            await giveReward(0.0102);
            setTimeout(() => btn.disabled = false, 180000);
        } else if (type === 'turbo') {
            await show_10276123('pop'); // 2nd ad immediately
            await giveReward(0.0120);
            setTimeout(() => btn.disabled = false, 45000);
        } else if (type === 'points') {
            await show_10276123('pop'); 
            await show_10276123('pop'); // 3 combined
            update(userRef, { chatPoints: increment(1) });
            setTimeout(() => btn.disabled = false, 300000);
        }
        tg.showAlert("Reward Added!");
    }).catch(() => {
        btn.disabled = false;
        tg.showAlert("Ad failed. Try again.");
    });
};

// Tabs
window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('active');
    if(id === 'chat') loadChat();
    if(id === 'leaderboard') loadLeader();
    if(id === 'wallet') loadHistory();
};

// Chat
window.sendMsg = async () => {
    const input = document.getElementById('chat-in');
    if (!input.value.trim() || points < 1) return tg.showAlert("Need 1 Point!");
    
    await update(userRef, { chatPoints: increment(-1), balance: increment(0.02) });
    push(ref(db, 'chat'), {
        user: username,
        text: input.value,
        timestamp: Date.now()
    });
    input.value = "";
};

function loadChat() {
    onValue(query(ref(db, 'chat'), limitToLast(15)), (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(c => {
            const m = c.val();
            box.innerHTML += `<div class="bg-gray-800 p-2 rounded"><b>${m.user}:</b> ${m.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// Wallet
window.withdraw = () => {
    const g = document.getElementById('gcash-num').value;
    if (g.length < 10 || balance < 0.02) return tg.showAlert("Check GCash or Balance");
    const amt = balance;
    update(userRef, { balance: 0 });
    const req = { uid, username, gcash: g, amount: amt, status: 'pending', time: new Date().toLocaleString() };
    push(ref(db, 'withdrawals'), req);
    push(ref(db, `history/${uid}`), req);
    tg.showAlert("Request Submitted!");
};

function loadHistory() {
    onValue(ref(db, `history/${uid}`), (snap) => {
        const box = document.getElementById('history-box');
        box.innerHTML = "";
        snap.forEach(c => {
            const h = c.val();
            box.innerHTML += `<div class="glass p-2 text-[10px] flex justify-between"><span>${h.time}</span><span>₱${h.amount.toFixed(2)} - ${h.status}</span></div>`;
        });
    });
}

// Admin
window.adminLogin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-gate').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const box = document.getElementById('adm-reqs');
        box.innerHTML = "";
        snap.forEach(c => {
            const r = c.val();
            if (r.status === 'pending') {
                const div = document.createElement('div');
                div.className = "glass p-2 text-xs flex justify-between items-center";
                div.innerHTML = `<span>${r.username} (${r.gcash})<br>₱${r.amount.toFixed(2)}</span>
                                 <button onclick="approve('${c.key}', ${r.amount})" class="bg-green-600 px-2 py-1 rounded">Pay</button>`;
                box.appendChild(div);
            }
        });
    });
    onValue(ref(db, 'admin/total'), s => document.getElementById('adm-total').innerText = (s.val() || 0).toFixed(2));
}

window.approve = async (key, amt) => {
    await update(ref(db, `withdrawals/${key}`), { status: 'paid' });
    await update(ref(db, 'admin/total'), increment(amt));
};

function loadLeader() {
    onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), (snap) => {
        const box = document.getElementById('lead-box');
        box.innerHTML = "<h3 class='text-yellow-500 font-bold'>TOP 10 EARNERS</h3>";
        let list = [];
        snap.forEach(c => list.push(c.val()));
        list.reverse().forEach((u, i) => {
            box.innerHTML += `<div class="glass p-2 flex justify-between text-sm"><span>${i+1}. ${u.username}</span><span class="text-green-400">₱${u.balance.toFixed(2)}</span></div>`;
        });
    });
}

// Diamonds
const container = document.getElementById('diamonds');
for (let i = 0; i < 12; i++) {
    const d = document.createElement('div');
    d.className = 'diamond';
    d.style.left = Math.random() * 100 + '%';
    d.style.animationDelay = Math.random() * 8 + 's';
    container.appendChild(d);
}

// In-App Ad on Startup
window.onload = () => {
    const last = localStorage.getItem('lastInApp') || 0;
    if (Date.now() - last > 120000) {
        show_10276123({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
        localStorage.setItem('lastInApp', Date.now());
    }
};
