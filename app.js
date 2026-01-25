
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, onSnapshot, query, orderBy, limit, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Telegram Auth Integration
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { id: "dev_user", first_name: "Developer", username: "dev_pro" };
const userId = String(user.id);
const userName = user.username || user.first_name;

// Global State
let userBalance = 0;
const REWARD_AMT = 0.01;
const COOLDOWN_TIME = 60000; // 1 minute

// Elements
document.getElementById('tgUsername').innerText = `@${userName}`;
document.getElementById('userInitial').innerText = userName.charAt(0).toUpperCase();

// 1. Sync User Data & Real-time Balance
const userRef = doc(db, "users", userId);
onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
        userBalance = snap.data().balance;
        document.getElementById('balance').innerText = userBalance.toFixed(2);
    } else {
        setDoc(userRef, { 
            username: userName, 
            balance: 0, 
            lastAd: 0,
            totalWithdrawn: 0 
        });
    }
    document.getElementById('loading').style.display = 'none';
});

// 2. Navigation
window.switchTab = (id) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

// 3. Ad Logic with 1-Min Cooldown
window.handleAd = async (type) => {
    const snap = await getDoc(userRef);
    const lastAd = snap.data().lastAd || 0;
    const now = Date.now();

    if (now - lastAd < COOLDOWN_TIME) {
        const remaining = Math.ceil((COOLDOWN_TIME - (now - lastAd)) / 1000);
        alert(`Please wait ${remaining}s before next ad.`);
        return;
    }

    const adPromise = (type === 'pop') ? show_10276123('pop') : show_10276123();

    adPromise.then(async () => {
        await updateDoc(userRef, {
            balance: increment(REWARD_AMT),
            lastAd: Date.now()
        });
        alert(`Success! ₱${REWARD_AMT} added.`);
    }).catch(e => alert("Ad failed to load. Try again later."));
};

// 4. Global Chat (Live)
window.sendChat = async () => {
    const text = document.getElementById('chatInput').value;
    if (!text) return;
    await addDoc(collection(db, "chat"), {
        uid: userId,
        name: userName,
        msg: text,
        time: serverTimestamp()
    });
    document.getElementById('chatInput').value = "";
};

onSnapshot(query(collection(db, "chat"), orderBy("time", "desc"), limit(20)), (snap) => {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = snap.docs.map(d => `
        <div class="bg-white/5 p-2 rounded border-l-2 border-yellow-600">
            <span class="gold-text text-[10px] font-bold">@${d.data().name}</span>
            <p class="text-white text-xs">${d.data().msg}</p>
        </div>
    `).reverse().join('');
    chatBox.scrollTop = chatBox.scrollHeight;
});

// 5. Leaderboard (Updates every second via Firestore Snapshot)
onSnapshot(query(collection(db, "users"), orderBy("balance", "desc"), limit(10)), (snap) => {
    document.getElementById('leaderboardList').innerHTML = snap.docs.map((d, i) => `
        <div class="glass flex justify-between p-4 rounded-xl border-l-4 ${i < 3 ? 'border-yellow-500' : 'border-gray-700'}">
            <div class="flex items-center gap-3">
                <span class="font-black text-xl italic">${i + 1}</span>
                <span class="text-sm font-bold">@${d.data().username}</span>
            </div>
            <span class="gold-text font-black text-lg">₱${d.data().balance.toFixed(2)}</span>
        </div>
    `).join('');
});

// 6. Withdrawal System
window.requestWithdraw = async () => {
    const num = document.getElementById('gcashNum').value;
    const amt = parseFloat(document.getElementById('withAmount').value);

    if (amt < 1) return alert("Minimum withdrawal is ₱1");
    if (userBalance < amt) return alert("Insufficient Balance");
    if (num.length < 10) return alert("Invalid GCash Number");

    await updateDoc(userRef, { balance: increment(-amt) });
    await addDoc(collection(db, "withdrawals"), {
        uid: userId,
        username: userName,
        number: num,
        amount: amt,
        status: "pending",
        time: serverTimestamp()
    });
    alert("Withdrawal Requested! Pending approval.");
};

// My History
onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", userId), orderBy("time", "desc")), (snap) => {
    document.getElementById('myHistory').innerHTML = snap.docs.map(d => `
        <div class="glass p-3 rounded-lg flex justify-between items-center text-xs">
            <span>₱${d.data().amount} → ${d.data().number}</span>
            <span class="${d.data().status === 'approved' ? 'text-green-500' : 'text-yellow-500'} font-bold uppercase">${d.data().status}</span>
        </div>
    `).join('');
});

// 7. Admin Dashboard (Propetas12)
window.promptAdmin = () => {
    const pass = prompt("Enter Admin Password:");
    if (pass === "Propetas12") {
        switchTab('admin');
        loadAdminPanel();
    } else {
        alert("Unauthorized");
    }
};

function loadAdminPanel() {
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (snap) => {
        document.getElementById('adminList').innerHTML = snap.docs.map(d => `
            <div class="glass p-4 rounded-xl">
                <p class="text-xs text-yellow-500 font-bold">@${d.data().username}</p>
                <p class="text-xl font-black italic">₱${d.data().amount}</p>
                <p class="text-gray-400 text-sm mb-4">Number: ${d.data().number}</p>
                <button onclick="approvePayout('${d.id}')" class="bg-green-600 text-white px-6 py-2 rounded-full font-bold text-xs">APPROVE & PAYOUT</button>
            </div>
        `).join('');
    });
}

window.approvePayout = async (id) => {
    if (confirm("Mark as Paid?")) {
        await updateDoc(doc(db, "withdrawals", id), { status: "approved" });
        alert("Marked as Approved!");
    }
};
