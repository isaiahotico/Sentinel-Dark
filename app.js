
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

// Telegram Web App
const tg = window.Telegram.WebApp;
const tgUser = tg.initDataUnsafe?.user || { id: "LocalDev", username: "Guest" };
const username = tgUser.username || `User_${tgUser.id}`;
const uid = tgUser.id.toString();

document.getElementById('u-name').innerText = username;
document.getElementById('u-code').innerText = username;

const userRef = ref(db, 'users/' + uid);
let userData = {};

// --- REAL-TIME DATA SYNC ---
onValue(userRef, snap => {
    userData = snap.val();
    if (!userData) {
        set(userRef, { username, balance: 0, refCount: 0, refBonus: 0, lastVip: 0, lastPrem: 0, lastChat: 0 });
        return;
    }
    document.getElementById('u-bal').innerText = userData.balance.toFixed(4);
    document.getElementById('u-ref-count').innerText = userData.refCount || 0;
    document.getElementById('u-ref-bonus').innerText = (userData.refBonus || 0).toFixed(4);
});

// Presence & Online List
const presenceRef = ref(db, 'presence/' + uid);
onValue(ref(db, '.info/connected'), s => { if(s.val()) { onDisconnect(presenceRef).remove(); set(presenceRef, { username }); } });
onValue(ref(db, 'presence'), s => {
    const list = document.getElementById('online-list'); list.innerHTML = "";
    s.forEach(c => list.innerHTML += `<div class="on-tag"><i class="fas fa-circle" style="font-size:7px"></i> @${c.val().username}</div>`);
});

// --- THE 1-SECOND SYNC TICKER ---
setInterval(() => {
    const now = Date.now();
    document.getElementById('live-time').innerText = new Date().toLocaleString();

    if (userData) {
        const check = (last, min, btn, txt) => {
            const diff = Math.max(0, Math.ceil((min * 60 * 1000 - (now - (last || 0))) / 1000));
            document.getElementById(btn).disabled = diff > 0;
            document.getElementById(txt).innerText = diff > 0 ? `(${Math.floor(diff/60)}m ${diff%60}s)` : "";
        };
        check(userData.lastVip, 10, 'vip-btn', 'vip-timer');
        check(userData.lastPrem, 5, 'prem-btn', 'prem-timer');
    }
}, 1000);

// --- ADS & REWARDS ---
window.runAd = async (type) => {
    if (type === 'prem') { await show_10337795(); await show_10337795(); }
    show_10337795('pop').then(() => grant(type));
};

function grant(type) {
    const reward = type === 'vip' ? 0.0112 : 0.0162;
    const field = type === 'vip' ? 'lastVip' : 'lastPrem';
    const upd = { balance: userData.balance + reward };
    upd[field] = Date.now();
    update(userRef, upd);
    if (userData.referredBy) {
        get(ref(db, 'users')).then(all => all.forEach(u => {
            if(u.val().username === userData.referredBy) update(ref(db, 'users/'+u.key), { refBonus: (u.val().refBonus || 0) + (reward * 0.08) });
        }));
    }
}

// --- CHAT ---
window.sendChat = () => {
    const msg = document.getElementById('chat-in').value;
    if (!msg) return;
    if (Date.now() - (userData.lastChat || 0) > 300000) {
        show_10337795('pop').then(() => {
            update(userRef, { balance: userData.balance + 0.0162, lastChat: Date.now() });
            push(ref(db, 'chat'), { uid, username, msg, timestamp: serverTimestamp() });
        });
    } else {
        push(ref(db, 'chat'), { uid, username, msg, timestamp: serverTimestamp() });
    }
    document.getElementById('chat-in').value = "";
};

onValue(query(ref(db, 'chat'), limitToLast(15)), s => {
    const box = document.getElementById('chat-content'); box.innerHTML = "";
    s.forEach(c => {
        const m = c.val();
        box.innerHTML += `<div class="msg ${m.uid === uid ? 'msg-self' : 'msg-other'}"><b>@${m.username}</b><br>${m.msg}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// --- LIVE LEADERBOARD (1-Second Sync via Firebase) ---
onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), s => {
    const box = document.getElementById('lb-content'); box.innerHTML = "";
    let items = []; s.forEach(c => items.push(c.val()));
    items.reverse().forEach((u, i) => {
        box.innerHTML += `<div class="lb-row"><div class="rank">#${i+1}</div><div style="flex:1">@${u.username}</div><b>₱${u.balance.toFixed(2)}</b></div>`;
    });
});

// --- WITHDRAWALS ---
window.requestPayout = () => {
    const n = document.getElementById('w-name').value;
    const num = document.getElementById('w-num').value;
    if (!n || !num) return alert("Fill all info");
    if (userData.balance < 0.02) return alert("Min 0.02");
    push(ref(db, 'withdrawals'), { uid, username, name: n, gcash: num, amount: userData.balance, status: 'pending', timestamp: serverTimestamp() });
    update(userRef, { balance: 0 });
};

onValue(ref(db, 'withdrawals'), s => {
    const box = document.getElementById('w-history'); box.innerHTML = "";
    s.forEach(c => {
        const w = c.val();
        if (w.uid === uid) {
            box.innerHTML += `<div class="hist-card">
                <b>₱${w.amount.toFixed(4)}</b> <span class="status s-${w.status}">${w.status}</span><br>
                ${w.name} | ${w.gcash}<br><small>${new Date(w.timestamp).toLocaleString()}</small>
            </div>`;
        }
    });
});

// --- ADMIN (FULL AUDIT) ---
window.authAdmin = () => {
    if (document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('adm-gate').style.display = "none";
        document.getElementById('adm-panel').style.display = "block";
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'withdrawals'), s => {
        const pBox = document.getElementById('adm-pending');
        const hBox = document.getElementById('adm-history');
        const tBox = document.getElementById('adm-total');
        pBox.innerHTML = ""; hBox.innerHTML = ""; let sum = 0;
        s.forEach(c => {
            const w = c.val();
            const row = `<div class="hist-card">
                <b>@${w.username} - ₱${w.amount.toFixed(2)}</b><br>
                ${w.gcash} (${w.name})<br><small>${new Date(w.timestamp).toLocaleString()}</small><br>`;
            if (w.status === 'pending') {
                pBox.innerHTML += row + `<button class="btn btn-gold" style="padding:5px; width:70px; display:inline-block;" onclick="admS('${c.key}','approve')">Approve</button>
                                         <button class="btn btn-blue" style="padding:5px; width:70px; display:inline-block;" onclick="admS('${c.key}','denied')">Deny</button></div>`;
            } else {
                if(w.status === 'approve') sum += w.amount;
                hBox.innerHTML += row + `<span class="status s-${w.status}">${w.status}</span></div>`;
            }
        });
        tBox.innerText = `₱${sum.toFixed(2)}`;
    });
}
window.admS = (k, s) => update(ref(db, `withdrawals/${k}`), { status: s });

// --- REFERRALS ---
window.setReferrer = () => {
    const refCode = document.getElementById('ref-apply').value.trim();
    if (!userData.referredBy && refCode !== username) {
        update(userRef, { referredBy: refCode });
        get(ref(db, 'users')).then(all => all.forEach(u => {
            if(u.val().username === refCode) update(ref(db, 'users/'+u.key), { refCount: (u.val().refCount || 0) + 1 });
        }));
    }
};

window.claimBonus = () => {
    if (userData.refBonus > 0) {
        update(userRef, { balance: userData.balance + userData.refBonus, refBonus: 0 });
    }
};

// --- NAVIGATION ---
window.tab = (id, el) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav i').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active'); el.classList.add('active');
};

const bgColors = ["#080808", "pink", "green", "blue", "red", "violet", "yellow", "yellowgreen", "orange", "white", "cyan", "brown", "bricks"];
let bI = 0;
window.cycleBg = (e) => {
    if (['BUTTON', 'INPUT', 'I'].includes(e.target.tagName)) return;
    document.body.className = ""; document.body.style.backgroundColor = "";
    const c = bgColors[bI];
    if (c === 'bricks') document.body.classList.add('brick-bg'); else document.body.style.backgroundColor = c;
    bI = (bI + 1) % bgColors.length;
};
