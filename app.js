
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

// Telegram Integration
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { id: "Guest", username: "Guest_" + Math.floor(Math.random()*1000) };
const username = user.username || `User_${user.id}`;
const uid = user.id.toString();

document.getElementById('tg-username').innerText = "@" + username;
document.getElementById('my-code').innerText = username;

const userRef = ref(db, 'users/' + uid);

// 1. Initial Load & Presence
get(userRef).then(snap => {
    if (!snap.exists()) {
        set(userRef, { username, balance: 0, totalAds: 0, referralCount: 0, claimableBonus: 0, referredBy: "" });
    }
});

const presenceRef = ref(db, 'presence/' + uid);
onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() === true) {
        onDisconnect(presenceRef).remove();
        set(presenceRef, { username, lastActive: serverTimestamp() });
    }
});

// 2. Real-time Data Listeners
onValue(userRef, snap => {
    const data = snap.val();
    if (!data) return;
    document.getElementById('balance').innerText = data.balance.toFixed(2);
    document.getElementById('ref-count').innerText = data.referralCount || 0;
    document.getElementById('ref-bonus').innerText = (data.claimableBonus || 0).toFixed(4);
});

onValue(ref(db, 'presence'), snap => {
    const list = document.getElementById('online-list');
    const count = document.getElementById('online-count');
    list.innerHTML = "";
    let i = 0;
    snap.forEach(child => {
        i++;
        list.innerHTML += `<div class="list-item"><span>@${child.val().username}</span> <span style="color:#00ff00">● Online</span></div>`;
    });
    count.innerText = i;
});

// 3. Ad Logic & Referral Commission
window.watchAd = function() {
    show_10337795('pop').then(() => {
        get(userRef).then(snap => {
            const data = snap.val();
            const reward = 0.01;
            const commission = reward * 0.08;

            // Update User
            update(userRef, {
                balance: (data.balance || 0) + reward,
                totalAds: (data.totalAds || 0) + 1
            });

            // Update Referrer if exists
            if (data.referredBy) {
                const referrerRef = query(ref(db, 'users'), orderByChild('username'), limitToLast(1));
                // Note: Simplified lookup for demo. In production, store ReferrerUID.
                get(ref(db, 'users')).then(allUsers => {
                    allUsers.forEach(uSnap => {
                        if (uSnap.val().username === data.referredBy) {
                            const rRef = ref(db, 'users/' + uSnap.key);
                            update(rRef, { claimableBonus: (uSnap.val().claimableBonus || 0) + commission });
                        }
                    });
                });
            }
            alert("Reward added: ₱0.01");
        });
    });
};

// 4. Referral System Logic
window.applyReferral = function() {
    const code = document.getElementById('refer-input').value.trim();
    if (code === username) return alert("Cannot refer yourself!");
    
    get(userRef).then(snap => {
        if (snap.val().referredBy) return alert("Already referred!");
        
        get(ref(db, 'users')).then(allUsers => {
            let found = false;
            allUsers.forEach(uSnap => {
                if (uSnap.val().username === code) {
                    found = true;
                    update(userRef, { referredBy: code });
                    update(ref(db, 'users/' + uSnap.key), { referralCount: (uSnap.val().referralCount || 0) + 1 });
                    alert("Referrer applied!");
                }
            });
            if (!found) alert("Referrer not found!");
        });
    });
};

window.claimReferralBonus = function() {
    get(userRef).then(snap => {
        const bonus = snap.val().claimableBonus || 0;
        if (bonus <= 0) return alert("Nothing to claim!");
        update(userRef, {
            balance: snap.val().balance + bonus,
            claimableBonus: 0
        });
        alert(`Claimed ₱${bonus.toFixed(4)}`);
    });
};

// 5. Withdrawal Logic
window.submitWithdraw = function() {
    const name = document.getElementById('gcash-name').value;
    const num = document.getElementById('gcash-num').value;
    get(userRef).then(snap => {
        const bal = snap.val().balance;
        if (bal < 0.02) return alert("Min withdraw is 0.02");
        if (!name || !num) return alert("Fill all fields");

        const wRef = push(ref(db, 'withdrawals'));
        set(wRef, {
            uid, username, name, gcash: num, amount: bal,
            status: 'pending', timestamp: serverTimestamp()
        });
        update(userRef, { balance: 0 });
        alert("Withdrawal Pending!");
    });
};

onValue(ref(db, 'withdrawals'), snap => {
    const list = document.getElementById('history-list');
    list.innerHTML = "";
    snap.forEach(child => {
        const w = child.val();
        if (w.uid === uid) {
            const date = new Date(w.timestamp).toLocaleDateString();
            list.innerHTML += `<div class="card" style="font-size:12px;">
                ${date} - ₱${w.amount.toFixed(2)} - <span class="status-${w.status}">${w.status.toUpperCase()}</span><br>
                ${w.gcash} (${w.name})
            </div>`;
        }
    });
});

// 6. Admin Logic
window.loginAdmin = function() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-auth').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminRequests();
    } else { alert("Wrong password"); }
};

function loadAdminRequests() {
    onValue(ref(db, 'withdrawals'), snap => {
        const list = document.getElementById('admin-requests');
        list.innerHTML = "";
        snap.forEach(child => {
            const w = child.val();
            if (w.status === 'pending') {
                list.innerHTML += `<div class="card">
                    @${w.username} - ₱${w.amount.toFixed(2)}<br>
                    GCash: ${w.gcash} (${w.name})<br>
                    <button class="btn btn-sm" style="background:#00ff00" onclick="updateStatus('${child.key}', 'approve')">Approve</button>
                    <button class="btn btn-sm" style="background:#ff4444" onclick="updateStatus('${child.key}', 'denied')">Deny</button>
                </div>`;
            }
        });
    });
}

window.updateStatus = function(key, status) {
    update(ref(db, 'withdrawals/' + key), { status: status });
};

// 7. Navigation & Chat
window.showTab = function(id, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav i').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active');
};

window.sendChat = function() {
    const text = document.getElementById('chat-msg').value;
    if (!text) return;
    push(ref(db, 'chat'), { username, text, timestamp: serverTimestamp() });
    document.getElementById('chat-msg').value = "";
};

onValue(query(ref(db, 'chat'), limitToLast(15)), snap => {
    const box = document.getElementById('chat-messages');
    box.innerHTML = "";
    snap.forEach(child => {
        const c = child.val();
        box.innerHTML += `<div><b class="gold">@${c.username}:</b> ${c.text}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});
