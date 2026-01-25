
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, onSnapshot, query, orderBy, limit, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Telegram Setup
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { id: "dev_123", username: "Local_Tester", first_name: "Tester" };
const userId = String(user.id);
const tgName = user.username || user.first_name;

let userBalance = 0;
let cdActive = false;

// 1. Sync Profile and Balance
const userRef = doc(db, "users", userId);
onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
        const data = snap.data();
        userBalance = data.balance;
        document.getElementById('balance').innerText = userBalance.toFixed(4);
        document.getElementById('uName').innerText = `@${data.username}`;
        document.getElementById('uAvatar').innerText = data.username.charAt(0).toUpperCase();
    } else {
        setDoc(userRef, {
            username: tgName,
            balance: 0,
            todayEarned: 0,
            lastAd: 0,
            lastReset: new Date().toLocaleDateString()
        });
    }
    document.getElementById('loader').style.display = 'none';
});

// 2. Monetag Ads Logic (15s Cooldown | ₱0.0102)
window.triggerAd = async (type) => {
    if (cdActive) return;
    
    const snap = await getDoc(userRef);
    const now = Date.now();
    if (now - (snap.data().lastAd || 0) < 15000) {
        alert("Cooldown active! Please wait.");
        return;
    }

    const adTask = (type === 'pop') ? show_10276123('pop') : show_10276123();

    adTask.then(async () => {
        cdActive = true;
        startCooldown();
        
        const today = new Date().toLocaleDateString();
        const needsReset = snap.data().lastReset !== today;

        await updateDoc(userRef, {
            balance: increment(0.0102),
            todayEarned: needsReset ? 0.0102 : increment(0.0102),
            lastAd: Date.now(),
            lastReset: today
        });
    }).catch(() => alert("Ad failed to load."));
};

function startCooldown() {
    let timeLeft = 15;
    const box = document.getElementById('cooldown');
    const sec = document.getElementById('cdSec');
    box.classList.remove('hidden');
    const timer = setInterval(() => {
        timeLeft--;
        sec.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            box.classList.add('hidden');
            cdActive = false;
        }
    }, 1000);
}

// 3. Global Chat
window.sendChat = async () => {
    const inp = document.getElementById('chatInp');
    if (!inp.value.trim()) return;
    await addDoc(collection(db, "globalChat"), {
        user: tgName,
        msg: inp.value,
        time: serverTimestamp()
    });
    inp.value = "";
};

onSnapshot(query(collection(db, "globalChat"), orderBy("time", "desc"), limit(20)), (snap) => {
    const box = document.getElementById('chatBox');
    box.innerHTML = snap.docs.map(d => `
        <div class="p-2 glass rounded-lg border-l-2 border-yellow-600 self-start max-w-[80%]">
            <p class="text-[9px] gold-text font-black">@${d.data().user}</p>
            <p class="text-xs text-gray-200">${d.data().msg}</p>
        </div>
    `).reverse().join('');
    box.scrollTop = box.scrollHeight;
});

// 4. Leaderboard (Today's Top)
onSnapshot(query(collection(db, "users"), orderBy("todayEarned", "desc"), limit(10)), (snap) => {
    document.getElementById('leadList').innerHTML = snap.docs.map((d, i) => `
        <div class="glass flex justify-between p-4 rounded-xl border-l-2 ${i < 3 ? 'border-yellow-500' : 'border-gray-800'}">
            <span class="text-sm font-bold">#${i+1} @${d.data().username}</span>
            <span class="gold-text font-black tracking-widest">₱${d.data().todayEarned.toFixed(4)}</span>
        </div>
    `).join('');
});

// 5. Withdrawal and History
window.submitWithdraw = async () => {
    const num = document.getElementById('gcNum').value;
    const amt = parseFloat(document.getElementById('gcAmt').value);

    if (amt < 1) return alert("Min withdrawal ₱1.00");
    if (userBalance < amt) return alert("Insufficient balance");
    if (num.length < 10) return alert("Enter valid GCash number");

    await updateDoc(userRef, { balance: increment(-amt) });
    await addDoc(collection(db, "payouts"), {
        uid: userId,
        user: tgName,
        gcash: num,
        amount: amt,
        status: "PENDING",
        time: serverTimestamp()
    });
    alert("Withdrawal submitted!");
};

onSnapshot(query(collection(db, "payouts"), where("uid", "==", userId), orderBy("time", "desc")), (snap) => {
    document.getElementById('withdrawHistory').innerHTML = snap.docs.map(d => `
        <div class="glass p-3 rounded-lg flex justify-between items-center text-[10px]">
            <span>₱${d.data().amount.toFixed(2)} → ${d.data().gcash}</span>
            <span class="font-black ${d.data().status === 'PAID' ? 'text-green-500' : 'text-yellow-600'} italic">● ${d.data().status}</span>
        </div>
    `).join('');
});

// 6. Admin Panel (Password: Propetas12)
window.authAdmin = () => {
    const p = prompt("Enter Master Password:");
    if (p === "Propetas12") {
        showView('admin');
        initAdmin();
    } else alert("Denied");
};

function initAdmin() {
    onSnapshot(query(collection(db, "payouts"), where("status", "==", "PENDING")), (snap) => {
        document.getElementById('adminList').innerHTML = snap.docs.map(d => `
            <div class="glass p-4 rounded-xl border-2 border-yellow-600/30">
                <div class="flex justify-between mb-2">
                    <span class="text-xs gold-text font-black">@${d.data().user}</span>
                    <span class="text-lg font-black italic">₱${d.data().amount.toFixed(2)}</span>
                </div>
                <p class="text-sm mb-4">Account: ${d.data().gcash}</p>
                <button onclick="approvePayout('${d.id}')" class="w-full gold-bg py-2 rounded-lg text-xs">APPROVE & SYNC PAID</button>
            </div>
        `).join('');
    });
}

window.approvePayout = async (id) => {
    if (confirm("Confirm as Paid?")) {
        await updateDoc(doc(db, "payouts", id), { status: "PAID" });
        alert("Synced!");
    }
};

window.showView = (id) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};
