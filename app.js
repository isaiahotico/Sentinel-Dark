
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
const user = tg.initDataUnsafe?.user || { id: "Local_User", username: "Guest" };
const username = user.username || `User_${user.id}`;
const uid = user.id.toString();

document.getElementById('tg-user').innerText = username;
document.getElementById('my-code').innerText = username;

const userRef = ref(db, 'users/' + uid);

// --- State Handlers ---
onValue(userRef, snap => {
    const d = snap.val();
    if (!d) {
        set(userRef, { username, balance: 0, referralCount: 0, claimableBonus: 0, lastVip: 0, lastPrem: 0, lastChat: 0 });
        return;
    }
    document.getElementById('balance').innerText = d.balance.toFixed(4);
    document.getElementById('ref-count').innerText = d.referralCount || 0;
    document.getElementById('ref-bonus').innerText = (d.claimableBonus || 0).toFixed(4);
    
    updateCooldowns(d);
});

function updateCooldowns(d) {
    const now = Date.now();
    const cd = (last, min, btn, txt) => {
        const remaining = Math.max(0, Math.ceil((min * 60 * 1000 - (now - (last || 0))) / 1000));
        document.getElementById(btn).disabled = remaining > 0;
        document.getElementById(txt).innerText = remaining > 0 ? `${Math.floor(remaining/60)}m ${remaining%60}s` : "";
    };
    cd(d.lastVip, 10, 'btn-vip', 'cd-vip');
    cd(d.lastPrem, 5, 'btn-prem', 'cd-prem');
}

// Presence
const presenceRef = ref(db, 'presence/' + uid);
onValue(ref(db, '.info/connected'), s => {
    if (s.val()) { onDisconnect(presenceRef).remove(); set(presenceRef, { username }); }
});
onValue(ref(db, 'presence'), s => {
    const list = document.getElementById('on-list');
    list.innerHTML = "";
    s.forEach(c => list.innerHTML += `<div class="u-dot">@${c.val().username}</div>`);
});

// --- Ad Actions ---
window.adAction = async (type) => {
    if (type === 'prem') { await show_10337795(); await show_10337795(); }
    show_10337795('pop').then(() => grant(type));
};

function grant(type) {
    const reward = type === 'vip' ? 0.0112 : 0.0162;
    const field = type === 'vip' ? 'lastVip' : 'lastPrem';
    get(userRef).then(s => {
        const d = s.val();
        const upd = { balance: d.balance + reward };
        upd[field] = Date.now();
        update(userRef, upd);
        if (d.referredBy) creditReferrer(d.referredBy, reward * 0.08);
    });
}

function creditReferrer(refName, amt) {
    get(ref(db, 'users')).then(all => {
        all.forEach(u => {
            if (u.val().username === refName) {
                update(ref(db, 'users/' + u.key), { claimableBonus: (u.val().claimableBonus || 0) + amt });
            }
        });
    });
}

// --- Chat ---
window.sendChat = async () => {
    const msg = document.getElementById('chat-in').value;
    if (!msg) return;
    get(userRef).then(async s => {
        const d = s.val();
        if (Date.now() - (d.lastChat || 0) > 300000) {
            await show_10337795(); await show_10337795();
            show_10337795('pop').then(() => {
                grant('chat'); // Rewarding same as premium
                update(userRef, { lastChat: Date.now() });
                push(ref(db, 'chat'), { uid, username, msg, timestamp: serverTimestamp() });
            });
        } else {
            push(ref(db, 'chat'), { uid, username, msg, timestamp: serverTimestamp() });
        }
        document.getElementById('chat-in').value = "";
    });
};

onValue(query(ref(db, 'chat'), limitToLast(15)), s => {
    const box = document.getElementById('chat-box'); box.innerHTML = "";
    s.forEach(c => {
        const m = c.val();
        box.innerHTML += `<div class="msg ${m.uid === uid ? 'msg-self' : 'msg-other'}"><b>@${m.username}</b><br>${m.msg}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// --- Background Cycle ---
const colors = ["pink", "green", "blue", "red", "violet", "yellow", "yellowgreen", "orange", "white", "cyan", "brown", "bricks"];
let cIdx = 0;
window.handleBgCycle = (e) => {
    if (['BUTTON', 'INPUT', 'I'].includes(e.target.tagName)) return;
    document.body.className = ""; document.body.style.backgroundColor = "";
    const c = colors[cIdx];
    if (c === 'bricks') document.body.classList.add('brick-bg');
    else document.body.style.backgroundColor = c;
    cIdx = (cIdx + 1) % colors.length;
};

// --- Withdraw ---
window.submitWithdraw = () => {
    const name = document.getElementById('w-name').value;
    const gcash = document.getElementById('w-num').value;
    get(userRef).then(s => {
        if (s.val().balance < 0.02) return alert("Min 0.02");
        push(ref(db, 'withdrawals'), {
            uid, username, name, gcash, amount: s.val().balance,
            status: 'pending', timestamp: serverTimestamp()
        });
        update(userRef, { balance: 0 });
    });
};

onValue(ref(db, 'withdrawals'), s => {
    const list = document.getElementById('w-history'); list.innerHTML = "";
    s.forEach(c => {
        const w = c.val();
        if (w.uid === uid) {
            list.innerHTML += `<div class="hist-item card">
                ${new Date(w.timestamp).toLocaleString()}<br>
                ₱${w.amount.toFixed(4)} | ${w.gcash}<br>
                <span class="status status-${w.status}">${w.status}</span>
            </div>`;
        }
    });
});

// --- Admin ---
window.loginAdmin = () => {
    if (document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('admin-auth').style.display = "none";
        document.getElementById('admin-panel').style.display = "block";
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
            const date = new Date(w.timestamp).toLocaleString();
            const h = `<div class="hist-item card">
                @${w.username} | ₱${w.amount.toFixed(2)} | ${w.gcash}<br>
                <small>${w.name} - ${date}</small><br>`;
            if (w.status === 'pending') {
                pend.innerHTML += h + `<button onclick="setStat('${c.key}','approve')">Approve</button>
                                       <button onclick="setStat('${c.key}','denied')">Deny</button></div>`;
            } else {
                if(w.status === 'approve') sum += w.amount;
                hist.innerHTML += h + `<span class="status status-${w.status}">${w.status}</span></div>`;
            }
        });
        total.innerText = sum.toFixed(2);
    });
}
window.setStat = (k, s) => update(ref(db, `withdrawals/${k}`), { status: s });

// --- Referrals ---
window.applyRef = () => {
    const code = document.getElementById('ref-code').value.trim();
    if (code === username) return;
    get(userRef).then(s => {
        if (!s.val().referredBy) {
            update(userRef, { referredBy: code });
            // Simplified referral count increment
            get(ref(db, 'users')).then(all => {
                all.forEach(u => { if(u.val().username === code) update(ref(db, 'users/' + u.key), { referralCount: (u.val().referralCount || 0) + 1 }); });
            });
        }
    });
};

window.claimBonus = () => {
    get(userRef).then(s => {
        const b = s.val().claimableBonus || 0;
        if (b > 0) update(userRef, { balance: s.val().balance + b, claimableBonus: 0 });
    });
};

// --- Utilities ---
window.showTab = (id, el) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav i').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active'); el.classList.add('active');
};
setInterval(() => document.getElementById('f-time').innerText = new Date().toLocaleString(), 1000);
