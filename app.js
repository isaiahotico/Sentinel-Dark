
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

// User Context
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || { id: "GUEST", username: "anonymous" };
const username = user.username || `User_${user.id}`;
const uid = user.id.toString();

document.getElementById('tg-user').innerText = username;
document.getElementById('my-code').innerText = username;

const uRef = ref(db, 'users/' + uid);

// Init User
onValue(uRef, snap => {
    const d = snap.val();
    if (!d) {
        set(uRef, { username, balance: 0, totalAds: 0, referralCount: 0, claimableBonus: 0, referredBy: "", lastVip: 0, lastPrem: 0, lastChat: 0 });
        return;
    }
    document.getElementById('bal').innerText = d.balance.toFixed(4);
    document.getElementById('r-count').innerText = d.referralCount || 0;
    document.getElementById('r-bonus').innerText = (d.claimableBonus || 0).toFixed(4);
    
    // Cooldown logic
    updateCD('vip-btn', 'vip-wait', d.lastVip, 10);
    updateCD('prem-btn', 'prem-wait', d.lastPrem, 5);
});

function updateCD(bid, tid, last, mins) {
    const diff = Math.max(0, Math.ceil((mins * 60 * 1000 - (Date.now() - (last || 0))) / 1000));
    const btn = document.getElementById(bid);
    btn.disabled = diff > 0;
    document.getElementById(tid).innerText = diff > 0 ? `(${diff}s)` : "";
}

// Presence & Online List
const pRef = ref(db, 'presence/' + uid);
onValue(ref(db, '.info/connected'), (s) => {
    if (s.val()) { onDisconnect(pRef).remove(); set(pRef, { username, active: true }); }
});

onValue(ref(db, 'presence'), s => {
    const list = document.getElementById('on-list');
    const count = document.getElementById('on-count');
    list.innerHTML = ""; let i = 0;
    s.forEach(child => {
        i++;
        list.innerHTML += `<div class="user-chip"><div class="pulse-dot"></div>@${child.val().username}</div>`;
    });
    count.innerText = i;
});

// Ad Handlers
window.runAd = async function(type) {
    let reward = type === 'vip' ? 0.0112 : 0.0162;
    let field = type === 'vip' ? 'lastVip' : 'lastPrem';
    
    if (type === 'prem') { await show_10337795(); await show_10337795(); }
    
    show_10337795('pop').then(() => {
        addReward(reward, field);
    });
};

function addReward(amt, f) {
    get(uRef).then(s => {
        const d = s.val();
        const up = { balance: d.balance + amt, totalAds: (d.totalAds || 0) + 1 };
        up[f] = Date.now();
        update(uRef, up);
        if (d.referredBy) {
            get(ref(db, 'users')).then(all => {
                all.forEach(u => {
                    if (u.val().username === d.referredBy) {
                        update(ref(db, 'users/'+u.key), { claimableBonus: (u.val().claimableBonus||0) + (amt*0.08) });
                    }
                });
            });
        }
        showPop(amt);
    });
}

// Chat System
window.sendChatMsg = function() {
    const msg = document.getElementById('chat-in').value;
    if (!msg) return;

    get(uRef).then(async s => {
        const d = s.val();
        const now = Date.now();
        if (now - (d.lastChat || 0) > 300000) { // 5 min
            await show_10337795(); await show_10337795();
            show_10337795('pop').then(() => {
                addReward(0.0162, "lastChat");
                finishChat(msg);
            });
        } else {
            finishChat(msg);
        }
    });
};

function finishChat(txt) {
    push(ref(db, 'chat'), { uid, username, txt, timestamp: serverTimestamp() });
    document.getElementById('chat-in').value = "";
}

onValue(query(ref(db, 'chat'), limitToLast(20)), s => {
    const box = document.getElementById('chat-messages'); box.innerHTML = "";
    s.forEach(c => {
        const m = c.val();
        const side = m.uid === uid ? 'msg-self' : 'msg-other';
        box.innerHTML += `<div class="msg-bubble ${side}"><span class="msg-user">@${m.username}</span>${m.txt}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// Bg Cycle
const bgColors = ["#0b0b0b", "pink", "green", "blue", "red", "violet", "yellow", "yellowgreen", "orange", "white", "cyan", "brown", "bricks"];
let bgIdx = 0;
window.cycleBg = (e) => {
    if (['BUTTON', 'INPUT', 'I', 'A'].includes(e.target.tagName)) return;
    const body = document.body;
    body.className = ""; body.style.backgroundColor = "";
    const current = bgColors[bgIdx];
    if (current === 'bricks') body.classList.add('brick-bg');
    else body.style.backgroundColor = current;
    bgIdx = (bgIdx + 1) % bgColors.length;
};

// Admin & Withdrawal
window.requestPayout = () => {
    const n = document.getElementById('gc-name').value;
    const num = document.getElementById('gc-num').value;
    if (!n || !num) return alert("Missing info");
    get(uRef).then(s => {
        if (s.val().balance < 0.02) return alert("Min ₱0.02");
        push(ref(db, 'withdrawals'), { uid, username, name: n, gcash: num, amt: s.val().balance, status: 'pending', timestamp: serverTimestamp() });
        update(uRef, { balance: 0 });
        alert("Success!");
    });
};

onValue(ref(db, 'withdrawals'), s => {
    const hist = document.getElementById('pay-hist'); hist.innerHTML = "";
    s.forEach(c => {
        const w = c.val();
        if (w.uid === uid) {
            hist.innerHTML += `<div class="glass-card" style="font-size:11px;">₱${w.amt.toFixed(4)} | ${w.status.toUpperCase()} | ${new Date(w.timestamp).toLocaleDateString()}</div>`;
        }
    });
});

window.authAdmin = () => {
    if (document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('admin-auth').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'withdrawals'), s => {
        const reqs = document.getElementById('adm-reqs');
        const hist = document.getElementById('adm-hist');
        const totalDisp = document.getElementById('adm-total');
        reqs.innerHTML = ""; hist.innerHTML = ""; let sum = 0;
        s.forEach(c => {
            const w = c.val();
            if (w.status === 'pending') {
                reqs.innerHTML += `<div class="glass-card">@${w.username} - ₱${w.amt.toFixed(2)}<br>${w.gcash}<br>
                    <button onclick="admUpd('${c.key}','approve')">Approve</button> <button onclick="admUpd('${c.key}','denied')">Deny</button></div>`;
            } else if (w.status === 'approve') {
                sum += w.amt;
                hist.innerHTML += `<div style="font-size:10px;">${w.username} - ₱${w.amt} - ${w.gcash}</div>`;
            }
        });
        totalDisp.innerText = sum.toFixed(2);
    });
}
window.admUpd = (k, s) => update(ref(db, `withdrawals/${k}`), { status: s });

// Helpers
window.tab = (id, el) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-bar i').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active'); el.classList.add('active');
};

window.claimBonus = () => {
    get(uRef).then(s => {
        const b = s.val().claimableBonus || 0;
        if (b <= 0) return alert("Nothing to claim");
        update(uRef, { balance: s.val().balance + b, claimableBonus: 0 });
        showPop(b);
    });
};

function showPop(a) {
    const p = document.getElementById('reward-pop');
    document.getElementById('pop-amt').innerText = `+₱${a.toFixed(4)}`;
    p.classList.add('show');
    setTimeout(() => p.classList.remove('show'), 2000);
}

setInterval(() => { document.getElementById('footer-time').innerText = new Date().toLocaleString(); }, 1000);
