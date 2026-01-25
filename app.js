
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast, serverTimestamp, onDisconnect } 
from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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

// Telegram Context
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || { id: "DEV", username: "Dev_User" };
const username = user.username || `User_${user.id}`;
const uid = user.id.toString();

document.getElementById('tg-username').innerText = "@" + username;
document.getElementById('my-code').innerText = username;

const userRef = ref(db, 'users/' + uid);

// --- State Management ---
onValue(userRef, snap => {
    const d = snap.val();
    if (!d) {
        set(userRef, { username, balance: 0, totalAds: 0, referralCount: 0, claimableBonus: 0, referredBy: "", lastVip: 0, lastPremium: 0, lastChatAd: 0 });
        return;
    }
    document.getElementById('balance').innerText = d.balance.toFixed(4);
    document.getElementById('ref-count').innerText = d.referralCount || 0;
    document.getElementById('ref-bonus').innerText = (d.claimableBonus || 0).toFixed(4);
    
    // Timer Updates
    const now = Date.now();
    updateTimer('vip-btn', 'vip-timer', d.lastVip, 10);
    updateTimer('premium-btn', 'premium-timer', d.lastPremium, 5);
});

function updateTimer(btnId, timerId, lastTime, mins) {
    const diff = Math.max(0, Math.ceil((mins * 60 * 1000 - (Date.now() - (lastTime || 0))) / 1000));
    document.getElementById(btnId).disabled = diff > 0;
    document.getElementById(timerId).innerText = diff > 0 ? `(${diff}s)` : "READY";
}

// Presence
const presenceRef = ref(db, 'presence/' + uid);
onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val()) {
        onDisconnect(presenceRef).remove();
        set(presenceRef, { username, lastActive: serverTimestamp() });
    }
});

onValue(ref(db, 'presence'), snap => {
    const list = document.getElementById('online-list');
    const count = document.getElementById('online-count');
    list.innerHTML = ""; let i = 0;
    snap.forEach(c => { i++; list.innerHTML += ` @${c.val().username} | `; });
    count.innerText = i;
});

// --- Background Logic ---
const colors = ["pink", "green", "blue", "red", "violet", "yellow", "yellowgreen", "orange", "white", "cyan", "brown", "bricks"];
let colorIndex = 0;

window.handleGlobalClick = function(e) {
    // Prevent background change if clicking buttons/inputs
    if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'A' || e.target.tagName === 'I') return;
    
    const body = document.body;
    body.className = ""; // Reset
    const selected = colors[colorIndex];
    
    if(selected === 'bricks') {
        body.classList.add('brick-bg');
    } else {
        body.style.backgroundColor = selected;
    }
    
    colorIndex = (colorIndex + 1) % colors.length;
};

// --- Ads Logic ---
window.triggerAd = async function(type) {
    let reward = type === 'vip' ? 0.0112 : 0.0162;
    let field = type === 'vip' ? 'lastVip' : 'lastPremium';

    if(type === 'premium') {
        await show_10337795(); // 1
        await show_10337795(); // 2
    }
    
    show_10337795('pop').then(() => {
        processReward(reward, field);
    }).catch(() => alert("Ad error."));
};

function processReward(amt, field) {
    get(userRef).then(snap => {
        const d = snap.val();
        const upd = { balance: d.balance + amt, totalAds: (d.totalAds || 0) + 1 };
        upd[field] = Date.now();
        update(userRef, upd);
        
        if (d.referredBy) {
            get(ref(db, 'users')).then(all => {
                all.forEach(u => {
                    if(u.val().username === d.referredBy) {
                        update(ref(db, 'users/' + u.key), { claimableBonus: (u.val().claimableBonus || 0) + (amt * 0.08) });
                    }
                });
            });
        }
        showPop(amt);
    });
}

// --- Chat with High CPM Ads ---
window.sendChatAd = function() {
    const msg = document.getElementById('chat-msg').value;
    if(!msg) return;

    get(userRef).then(async snap => {
        const d = snap.val();
        const now = Date.now();
        if(now - (d.lastChatAd || 0) > (5 * 60 * 1000)) {
            // High CPM 3-Ad Combo
            await show_10337795();
            await show_10337795();
            show_10337795('pop').then(() => {
                processReward(0.0162, "lastChatAd");
                broadcastMsg(msg);
            });
        } else {
            broadcastMsg(msg);
        }
    });
};

function broadcastMsg(m) {
    push(ref(db, 'chat'), { username, text: m, timestamp: serverTimestamp() });
    document.getElementById('chat-msg').value = "";
}

onValue(query(ref(db, 'chat'), limitToLast(15)), snap => {
    const box = document.getElementById('chat-messages'); box.innerHTML = "";
    snap.forEach(c => { box.innerHTML += `<div><b class="gold">@${c.val().username}:</b> ${c.val().text}</div>`; });
    box.scrollTop = box.scrollHeight;
});

// --- Withdrawal & Referrals ---
window.applyReferral = function() {
    const code = document.getElementById('refer-input').value.trim();
    if(code === username) return alert("Self-referral disabled.");
    get(userRef).then(snap => {
        if(snap.val().referredBy) return alert("Referrer already set.");
        get(ref(db, 'users')).then(all => {
            all.forEach(u => {
                if(u.val().username === code) {
                    update(userRef, { referredBy: code });
                    update(ref(db, 'users/' + u.key), { referralCount: (u.val().referralCount || 0) + 1 });
                    alert("Referrer Linked!");
                }
            });
        });
    });
};

window.claimReferralBonus = function() {
    get(userRef).then(snap => {
        const b = snap.val().claimableBonus || 0;
        if(b <= 0) return alert("No bonus.");
        update(userRef, { balance: snap.val().balance + b, claimableBonus: 0 });
        showPop(b, "Bonus Credited!");
    });
};

window.submitWithdraw = function() {
    const n = document.getElementById('gcash-name').value;
    const g = document.getElementById('gcash-num').value;
    if(!n || !g) return alert("Fill all fields.");
    get(userRef).then(snap => {
        const b = snap.val().balance;
        if(b < 0.02) return alert("Min 0.02");
        push(ref(db, 'withdrawals'), { uid, username, name: n, gcash: g, amount: b, status: 'pending', timestamp: serverTimestamp() });
        update(userRef, { balance: 0 });
        alert("Success! Check History.");
    });
};

// History Listeners
onValue(ref(db, 'withdrawals'), snap => {
    const list = document.getElementById('history-list'); list.innerHTML = "";
    snap.forEach(c => {
        const w = c.val();
        if(w.uid === uid) {
            const date = new Date(w.timestamp).toLocaleString();
            list.innerHTML += `<div class="history-item">
                <div><b>₱${w.amount.toFixed(4)}</b><br>${date}</div>
                <div class="status-${w.status}">${w.status.toUpperCase()}</div>
            </div>`;
        }
    });
});

// --- Admin ---
window.loginAdmin = function() {
    if(document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'withdrawals'), snap => {
        const reqs = document.getElementById('admin-requests');
        const hist = document.getElementById('admin-history');
        const totalDisp = document.getElementById('admin-total-out');
        reqs.innerHTML = ""; hist.innerHTML = "";
        let totalSum = 0;

        snap.forEach(c => {
            const w = c.val();
            const date = new Date(w.timestamp).toLocaleString();
            if(w.status === 'pending') {
                reqs.innerHTML += `<div class="card" style="font-size:11px;">
                    ${w.username} | ₱${w.amount.toFixed(4)}<br>G: ${w.gcash} (${w.name})<br>
                    <button onclick="updateW('${c.key}','approve')" style="background:#00ff00; border:none; padding:5px; border-radius:5px;">Approve</button>
                    <button onclick="updateW('${c.key}','denied')" style="background:#ff0000; border:none; padding:5px; border-radius:5px; color:white;">Deny</button>
                </div>`;
            } else if(w.status === 'approve') {
                totalSum += w.amount;
                hist.innerHTML += `<div class="history-item">
                    <span>${w.username}<br>₱${w.amount.toFixed(2)}</span>
                    <span>${w.gcash}<br>${date}</span>
                </div>`;
            }
        });
        totalDisp.innerText = totalSum.toFixed(2);
    });
}
window.updateW = (k, s) => update(ref(db, `withdrawals/${k}`), {status: s});

// --- UI Helpers ---
function showPop(a, m) {
    const p = document.getElementById('reward-popup');
    document.getElementById('reward-msg').innerText = `+₱${a.toFixed(4)}`;
    if(m) document.getElementById('reward-sub').innerText = m;
    p.classList.add('show');
    setTimeout(() => p.classList.remove('show'), 2500);
}

window.showTab = (id, el) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav i').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active'); el.classList.add('active');
};

setInterval(() => { document.getElementById('current-time').innerText = new Date().toLocaleString(); }, 1000);
