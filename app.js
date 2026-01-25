
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

// Telegram Setup
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || { id: "GUEST", username: "Guest_" + Math.floor(Math.random()*1000) };
const username = user.username || `User_${user.id}`;
const uid = user.id.toString();

document.getElementById('tg-username').innerText = "@" + username;
document.getElementById('my-code').innerText = username;

const userRef = ref(db, 'users/' + uid);

// --- Initialization ---
get(userRef).then(snap => {
    if (!snap.exists()) {
        set(userRef, { 
            username, balance: 0, totalAds: 0, 
            referralCount: 0, claimableBonus: 0, referredBy: "",
            lastVip: 0, lastPremium: 0, lastChatAd: 0
        });
    }
});

// Presence System
const presenceRef = ref(db, 'presence/' + uid);
onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val()) {
        onDisconnect(presenceRef).remove();
        set(presenceRef, { username, lastActive: serverTimestamp() });
    }
});

// --- Core Logic ---

// Sync UI
onValue(userRef, snap => {
    const d = snap.val();
    if (!d) return;
    document.getElementById('balance').innerText = d.balance.toFixed(4);
    document.getElementById('ref-count').innerText = d.referralCount || 0;
    document.getElementById('ref-bonus').innerText = (d.claimableBonus || 0).toFixed(4);
    checkCooldowns(d);
});

function checkCooldowns(d) {
    const now = Date.now();
    const vipDiff = Math.max(0, Math.ceil((10 * 60 * 1000 - (now - (d.lastVip || 0))) / 1000));
    const premDiff = Math.max(0, Math.ceil((5 * 60 * 1000 - (now - (d.lastPremium || 0))) / 1000));
    
    document.getElementById('vip-btn').disabled = vipDiff > 0;
    document.getElementById('vip-timer').innerText = vipDiff > 0 ? `Wait ${vipDiff}s` : "READY";
    
    document.getElementById('premium-btn').disabled = premDiff > 0;
    document.getElementById('premium-timer').innerText = premDiff > 0 ? `Wait ${premDiff}s` : "READY";
}

// Ad Triggering
window.triggerAd = async function(type) {
    let adPromise;
    let reward = 0;
    let field = "";

    if (type === 'vip') {
        adPromise = show_10337795('pop');
        reward = 0.0112;
        field = "lastVip";
    } else if (type === 'premium') {
        // "3 combined random inline ads" - trigger the interstitial format 3 times
        await show_10337795();
        await show_10337795();
        adPromise = show_10337795();
        reward = 0.0162;
        field = "lastPremium";
    }

    adPromise.then(() => {
        applyReward(reward, field);
    }).catch(e => alert("Ad error or closed. Try again."));
};

function applyReward(amt, field) {
    get(userRef).then(snap => {
        const d = snap.val();
        const updates = {
            balance: d.balance + amt,
            totalAds: (d.totalAds || 0) + 1
        };
        updates[field] = Date.now();
        update(userRef, updates);
        
        // Referral Commission (8%)
        if (d.referredBy) {
            handleReferralCommission(d.referredBy, amt * 0.08);
        }
        
        showPopAnim(amt);
    });
}

function handleReferralCommission(refName, commission) {
    get(ref(db, 'users')).then(snap => {
        snap.forEach(child => {
            if (child.val().username === refName) {
                const rRef = ref(db, 'users/' + child.key);
                update(rRef, { claimableBonus: (child.val().claimableBonus || 0) + commission });
            }
        });
    });
}

// Referral Claiming
window.claimReferralBonus = function() {
    get(userRef).then(snap => {
        const d = snap.val();
        const bonus = d.claimableBonus || 0;
        if (bonus <= 0) return alert("No bonus to claim!");
        
        update(userRef, {
            balance: d.balance + bonus,
            claimableBonus: 0
        });
        showPopAnim(bonus, "Referral Bonus Claimed!");
    });
};

// Chat Logic with Ads
window.sendChatAd = function() {
    const msg = document.getElementById('chat-msg').value;
    if (!msg) return;

    get(userRef).then(snap => {
        const d = snap.val();
        const now = Date.now();
        const cooldown = (5 * 60 * 1000);

        if (now - (d.lastChatAd || 0) > cooldown) {
            // Trigger 3 inline ads before sending
            show_10337795().then(() => {
                applyReward(0.0152, "lastChatAd");
                finishChat(msg);
            });
        } else {
            finishChat(msg); // Send without reward if cooling down
        }
    });
};

function finishChat(msg) {
    push(ref(db, 'chat'), { username, text: msg, timestamp: serverTimestamp() });
    document.getElementById('chat-msg').value = "";
}

// UI Elements
function showPopAnim(amt, customMsg) {
    const pop = document.getElementById('reward-popup');
    document.getElementById('reward-msg').innerText = `+₱${amt.toFixed(4)}`;
    pop.classList.add('show');
    setTimeout(() => pop.classList.remove('show'), 2500);
}

window.changeBg = function() {
    const colors = ['#0f0f0f', '#1a0a2e', '#0a1a2e', '#0a2e1a', '#2e0a0a', '#1e1e1e', '#222'];
    document.body.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
};

// Helpers & Nav
window.showTab = function(id, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav i').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active');
};

// Footer Time
setInterval(() => {
    const now = new Date();
    document.getElementById('current-time').innerText = now.toLocaleString();
}, 1000);

// Admin & Withdrawal (Similar to previous logic)
window.submitWithdraw = function() {
    const name = document.getElementById('gcash-name').value;
    const num = document.getElementById('gcash-num').value;
    get(userRef).then(snap => {
        const bal = snap.val().balance;
        if (bal < 0.02) return alert("Min withdraw is 0.02");
        if (!name || !num) return alert("Fill all fields");

        push(ref(db, 'withdrawals'), {
            uid, username, name, gcash: num, amount: bal,
            status: 'pending', timestamp: serverTimestamp()
        });
        update(userRef, { balance: 0 });
        alert("Withdrawal Requested!");
    });
};

onValue(ref(db, 'presence'), snap => {
    const list = document.getElementById('online-list');
    const count = document.getElementById('online-count');
    list.innerHTML = "";
    let i = 0;
    snap.forEach(child => {
        i++;
        list.innerHTML += `<div><span class="online-dot"></span> @${child.val().username}</div>`;
    });
    count.innerText = i;
});

// Admin Control
window.loginAdmin = function() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        onValue(ref(db, 'withdrawals'), snap => {
            const list = document.getElementById('admin-requests');
            list.innerHTML = "";
            snap.forEach(child => {
                const w = child.val();
                if (w.status === 'pending') {
                    list.innerHTML += `<div class="card">
                        @${w.username} - ₱${w.amount.toFixed(2)} (${w.gcash})
                        <button onclick="updateStatus('${child.key}', 'approve')">Approve</button>
                        <button onclick="updateStatus('${child.key}', 'denied')">Deny</button>
                    </div>`;
                }
            });
        });
    }
};

window.updateStatus = (k, s) => update(ref(db, `withdrawals/${k}`), {status: s});

// Chat Sync
onValue(query(ref(db, 'chat'), limitToLast(15)), snap => {
    const box = document.getElementById('chat-messages');
    box.innerHTML = "";
    snap.forEach(child => {
        box.innerHTML += `<div><b class="gold">@${child.val().username}:</b> ${child.val().text}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});
