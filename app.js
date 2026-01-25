
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- Telegram User ---
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { id: "GUEST_" + Math.floor(Math.random() * 1000), username: "Guest_User" };
const userId = user.id.toString();
const myUsername = user.username || userId;

document.getElementById('user-display').innerText = `@${myUsername}`;

let userData = {};

// --- Realtime Data Sync ---
db.collection("users").doc(userId).onSnapshot((doc) => {
    if (doc.exists) {
        userData = doc.data();
        document.getElementById('user-balance').innerText = `₱ ${(userData.balance || 0).toFixed(4)}`;
        document.getElementById('ref-count').innerText = userData.refCount || 0;
        document.getElementById('ref-bonus').innerText = `₱ ${(userData.pendingRefBonus || 0).toFixed(4)}`;
        updateCooldowns();
    } else {
        db.collection("users").doc(userId).set({
            balance: 0,
            username: myUsername,
            refCount: 0,
            pendingRefBonus: 0,
            referredBy: null,
            lastVip: 0,
            lastPremium: 0
        });
    }
});

// History Sync
db.collection("withdrawals").where("userId", "==", userId).orderBy("timestamp", "desc").onSnapshot(snap => {
    let html = "";
    snap.forEach(doc => {
        const d = doc.data();
        const color = d.status === "Approved" ? "text-green-500" : "text-yellow-500";
        html += `
            <div class="bg-zinc-900 p-3 rounded-lg border-l-4 border-yellow-600 flex justify-between items-center text-xs">
                <div>
                    <p class="font-bold text-white">₱${d.amount} GCash</p>
                    <p class="text-[9px] text-gray-500">${new Date(d.timestamp).toLocaleString()}</p>
                </div>
                <span class="${color} font-black uppercase text-[10px]">${d.status}</span>
            </div>`;
    });
    document.getElementById('history-list').innerHTML = html;
});

// --- Referral Logic ---
async function submitReferral() {
    const refCode = document.getElementById('ref-input').value.trim().replace('@', '');
    if (!refCode || refCode === myUsername) return alert("Invalid code.");
    if (userData.referredBy) return alert("You are already referred.");

    const q = await db.collection("users").where("username", "==", refCode).get();
    if (q.empty) return alert("User not found.");

    const uplineId = q.docs[0].id;
    await db.collection("users").doc(userId).update({ referredBy: uplineId });
    await db.collection("users").doc(uplineId).update({
        refCount: firebase.firestore.FieldValue.increment(1)
    });
    alert("Referral Applied! Your inviter will earn 8% commission.");
}

async function claimRefBonus() {
    if (userData.pendingRefBonus <= 0) return alert("Nothing to claim.");
    const amount = userData.pendingRefBonus;
    await db.collection("users").doc(userId).update({
        balance: firebase.firestore.FieldValue.increment(amount),
        pendingRefBonus: 0
    });
    alert(`Claimed ₱${amount.toFixed(4)} to your balance!`);
}

// --- Monetag Ad Reward Logic ---
async function rewardUser(baseAmount, type) {
    // Update self balance
    await db.collection("users").doc(userId).update({
        balance: firebase.firestore.FieldValue.increment(baseAmount),
        [type]: Date.now()
    });

    // 8% Commission to inviter
    if (userData.referredBy) {
        const commission = baseAmount * 0.08;
        await db.collection("users").doc(userData.referredBy).update({
            pendingRefBonus: firebase.firestore.FieldValue.increment(commission)
        });
    }
}

// --- Ads Functions ---
function updateCooldowns() {
    const now = Date.now();
    const vipBtn = document.getElementById('vip-btn');
    const premBtn = document.getElementById('premium-btn');

    const vDiff = 60000 - (now - (userData.lastVip || 0));
    const pDiff = 120000 - (now - (userData.lastPremium || 0));

    if (vDiff > 0) {
        vipBtn.disabled = true;
        vipBtn.innerHTML = `Wait ${Math.ceil(vDiff/1000)}s`;
        vipBtn.classList.add('opacity-50');
    } else {
        vipBtn.disabled = false;
        vipBtn.innerHTML = `<span>🎖🎉VIP ADS🎉🎖</span><span class="text-[10px] bg-black/20 px-2 py-1 rounded">₱0.0102</span>`;
        vipBtn.classList.remove('opacity-50');
    }

    if (pDiff > 0) {
        premBtn.disabled = true;
        premBtn.innerHTML = `Wait ${Math.ceil(pDiff/1000)}s`;
        premBtn.classList.add('opacity-50');
    } else {
        premBtn.disabled = false;
        premBtn.innerHTML = `<span>🎖PREMIUM🎉ADS🎖</span><span class="text-[10px] bg-yellow-600/20 px-2 py-1 rounded text-yellow-500">₱0.0185</span>`;
        premBtn.classList.remove('opacity-50');
    }
}

function showVipAd() {
    const ads = ['10276123', '10337795', '10337853'];
    const pick = ads[Math.floor(Math.random() * ads.length)];
    window[`show_${pick}`]('pop').then(() => {
        rewardUser(0.0102, 'lastVip');
    }).catch(() => alert("Ad error"));
}

async function showPremiumAd() {
    try {
        // High CPM: Sequence of 3 Interstitials
        await show_10276123();
        await show_10337795();
        await show_10337853();
        rewardUser(0.0185, 'lastPremium');
    } catch (e) {
        alert("Ad failed to finish.");
    }
}

// --- Withdrawal ---
function requestWithdrawal() {
    const num = document.getElementById('gcash-num').value;
    const amt = parseFloat(document.getElementById('wd-amount').value);

    if (amt < 1) return alert("Minimum withdrawal is ₱1");
    if (amt > userData.balance) return alert("Insufficient balance");
    if (num.length < 10) return alert("Invalid GCash number");

    db.collection("withdrawals").add({
        userId, username: myUsername, gcashNumber: num, amount: amt, status: "Pending", timestamp: Date.now()
    }).then(() => {
        db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(-amt) });
        alert("Withdrawal Requested!");
    });
}

// --- Admin Logic ---
function openAdminPrompt() {
    if (prompt("Enter Owner Password") === "Propetas12") {
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdmin();
    }
}

function closeAdmin() { document.getElementById('admin-panel').classList.add('hidden'); }

function loadAdmin() {
    db.collection("withdrawals").where("status", "==", "Pending").onSnapshot(snap => {
        let html = "";
        snap.forEach(doc => {
            const d = doc.data();
            html += `
                <div class="bg-zinc-900 border border-yellow-600/50 p-4 rounded-xl space-y-2">
                    <p class="text-xs text-yellow-500 font-bold uppercase">User: @${d.username}</p>
                    <p class="text-xl font-black">₱${d.amount}</p>
                    <p class="text-sm bg-black p-2 rounded text-blue-400">GCash: ${d.gcashNumber}</p>
                    <button onclick="approveWithdrawal('${doc.id}')" class="w-full gold-gradient py-2 rounded text-black font-bold">APPROVE & SEND</button>
                </div>`;
        });
        document.getElementById('pending-withdrawals').innerHTML = html || "<p class='text-gray-500 text-center'>No pending requests</p>";
    });
}

function approveWithdrawal(id) {
    db.collection("withdrawals").doc(id).update({ status: "Approved" }).then(() => alert("Approved!"));
}

setInterval(updateCooldowns, 1000);
