
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
const user = tg.initDataUnsafe?.user || { id: "DEV_MODE", username: "Dev" };
const username = user.username || `User_${user.id}`;
const uid = user.id.toString();

document.getElementById('my-username').innerText = username;
document.getElementById('ref-code').innerText = username;

const uRef = ref(db, 'users/' + uid);

// --- State Engine ---
onValue(uRef, snap => {
    const d = snap.val();
    if (!d) {
        set(uRef, { username, balance: 0, totalAds: 0, refCount: 0, refBonus: 0, lastVip: 0, lastPrem: 0, lastChat: 0 });
        return;
    }
    document.getElementById('bal').innerText = d.balance.toFixed(4);
    document.getElementById('ref-count').innerText = d.refCount || 0;
    document.getElementById('ref-bonus').innerText = (d.refBonus || 0).toFixed(4);
    
    const now = Date.now();
    const updateTimer = (btn, span, last, min) => {
        const diff = Math.max(0, Math.ceil((min * 60 * 1000 - (now - (last || 0))) / 1000));
        document.getElementById(btn).disabled = diff > 0;
        document.getElementById(span).innerText = diff > 0 ? `(${Math.floor(diff/60)}m ${diff%60}s)` : "";
    };
    updateTimer('vip-btn', 'vip-timer', d.lastVip, 10);
    updateTimer('prem-btn', 'prem-timer', d.lastPrem, 5);
});

// Online List
const pRef = ref(db, 'presence/' + uid);
onValue(ref(db, '.info/connected'), s => { if(s.val()) { onDisconnect(pRef).remove(); set(pRef, { username }); } });
onValue(ref(db, 'presence'), s => {
    const box = document.getElementById('online-list'); box.innerHTML = "";
    s.forEach(c => box.innerHTML += `<div class="tag">@${c.val().username}</div>`);
});

// --- Ad Combo Engine ---
window.handleAd = async (type) => {
    if (type === 'prem') { await show_10337795(); await show_10337795(); }
    show_10337795('pop').then(() => grant(type === 'vip' ? 0.0112 : 0.0162, type === 'vip' ? 'lastVip' : 'lastPrem'));
};

function grant(amt, field) {
    get(uRef).then(s => {
        const d = s.val();
        const upd = { balance: d.balance + amt, totalAds: (d.totalAds || 0) + 1 };
        upd[field] = Date.now();
        update(uRef, upd);
        if (d.referredBy) {
            get(ref(db, 'users')).then(all => all.forEach(u => {
                if(u.val().username === d.referredBy) update(ref(db, 'users/'+u.key), { refBonus: (u.val().refBonus || 0) + (amt * 0.08) });
            }));
        }
    });
}

// --- Chat ---
window.handleChat = () => {
    const msg = document.getElementById('chat-input').value;
    if(!msg) return;
    get(uRef).then(async s => {
        const d = s.val();
        if(Date.now() - (d.lastChat || 0) > 300000) {
            await show_10337795(); await show_10337795();
            show_10337795('pop').then(() => {
                grant(0.0162, 'lastChat');
                push(ref(db, 'chat'), { uid, username, msg, timestamp: serverTimestamp() });
            });
        } else {
            push(ref(db, 'chat'), { uid, username, msg, timestamp: serverTimestamp() });
        }
        document.getElementById('chat-input').value = "";
    });
};

onValue(query(ref(db, 'chat'), limitToLast(15)), s => {
    const render = document.getElementById('chat-render'); render.innerHTML = "";
    s.forEach(c => {
        const m = c.val();
        render.innerHTML += `<div class="msg ${m.uid === uid ? 'msg-self' : 'msg-other'}"><b>@${m.username}</b><br>${m.msg}</div>`;
    });
    render.scrollTop = render.scrollHeight;
});

// --- Leaderboard ---
onValue(query(ref(db, 'users'), orderByChild('totalAds'), limitToLast(10)), s => {
    const list = document.getElementById('leader-list'); list.innerHTML = "";
    let items = []; s.forEach(c => items.push(c.val()));
    items.reverse().forEach((u, i) => {
        list.innerHTML += `<div class="list-item"><span>#${i+1} @${u.username}</span><b>${u.totalAds} Ads</b></div>`;
    });
});

// --- Withdrawal ---
window.submitPayout = () => {
    const name = document.getElementById('gc-name').value;
    const gcash = document.getElementById('gc-num').value;
    get(uRef).then(s => {
        if(s.val().balance < 0.02) return alert("Min 0.02");
        push(ref(db, 'withdrawals'), { uid, username, name, gcash, amount: s.val().balance, status: 'pending', timestamp: serverTimestamp() });
        update(uRef, { balance: 0 });
    });
};

onValue(ref(db, 'withdrawals'), s => {
    const list = document.getElementById('payout-history'); list.innerHTML = "";
    s.forEach(c => {
        const w = c.val();
        if(w.uid === uid) {
            list.innerHTML += `<div class="list-item"><div>₱${w.amount.toFixed(4)}<br><small>${new Date(w.timestamp).toLocaleString()}</small></div><span class="badge badge-${w.status}">${w.status}</span></div>`;
        }
    });
});

// --- Admin Dashboard ---
window.authAdmin = () => {
    if(document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'withdrawals'), s => {
        const pend = document.getElementById('adm-pending');
        const hist = document.getElementById('adm-history');
        const total = document.getElementById('adm-total');
        pend.innerHTML = ""; hist.innerHTML = ""; let sum = 0;
        s.forEach(c => {
            const w = c.val();
            const details = `<div class="list-item"><div>@${w.username} - ₱${w.amount.toFixed(2)}<br><small>${w.gcash} (${w.name}) - ${new Date(w.timestamp).toLocaleString()}</small></div>`;
            if(w.status === 'pending') {
                pend.innerHTML += details + `<div><button onclick="admSet('${c.key}','approve')">✔</button><button onclick="admSet('${c.key}','denied')">✖</button></div></div>`;
            } else {
                if(w.status === 'approve') sum += w.amount;
                hist.innerHTML += details + `<span class="badge badge-${w.status}">${w.status}</span></div>`;
            }
        });
        total.innerText = sum.toFixed(2);
    });
}
window.admSet = (k, s) => update(ref(db, `withdrawals/${k}`), { status: s });

// --- Background Engine ---
const bgs = ["#0a0a0a", "pink", "green", "blue", "red", "violet", "yellow", "yellowgreen", "orange", "white", "cyan", "brown", "bricks"];
let bgIdx = 0;
window.cycleBackground = (e) => {
    if(['BUTTON', 'INPUT', 'I'].includes(e.target.tagName)) return;
    document.body.className = ""; document.body.style.backgroundColor = "";
    const current = bgs[bgIdx];
    if(current === 'bricks') document.body.classList.add('brick-bg');
    else document.body.style.backgroundColor = current;
    bgIdx = (bgIdx + 1) % bgs.length;
};

// --- Helpers ---
window.tab = (id, el) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav i').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active'); el.classList.add('active');
};
window.applyReferrer = () => {
    const refU = document.getElementById('refer-apply').value.trim();
    if(refU === username) return;
    get(uRef).then(s => {
        if(!s.val().referredBy) {
            update(uRef, { referredBy: refU });
            get(ref(db, 'users')).then(all => all.forEach(u => {
                if(u.val().username === refU) update(ref(db, 'users/'+u.key), { refCount: (u.val().refCount || 0) + 1 });
            }));
        }
    });
};
window.claimBonus = () => {
    get(uRef).then(s => {
        const b = s.val().refBonus || 0;
        if(b > 0) update(uRef, { balance: s.val().balance + b, refBonus: 0 });
    });
};
setInterval(() => document.getElementById('clock').innerText = new Date().toLocaleString(), 1000);
