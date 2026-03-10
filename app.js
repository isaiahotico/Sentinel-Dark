
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push } 
    from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

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

// --- User Management ---
let username = localStorage.getItem('tg_username') || prompt("Enter Telegram Username (without @):") || "User_" + Math.floor(Math.random()*1000);
localStorage.setItem('tg_username', username);
document.getElementById('tg-username').innerText = username;

const userRef = ref(db, 'users/' + username);
let userData = { balance: 0, refCount: 0, linksCreated: 0, watched: {} };

// Initial Load / Realtime Sync
onValue(userRef, (snapshot) => {
    if (snapshot.exists()) {
        userData = snapshot.val();
        if (!userData.watched) userData.watched = {};
    } else {
        set(userRef, userData);
    }
    updateUI();
});

function updateUI() {
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('ref-count').innerText = userData.refCount || 0;
    document.getElementById('ref-link').innerText = `http://t.me/Sentinel_KRo_earning_bot?startapp=${username}`;
    document.getElementById('cost-info').innerText = (userData.linksCreated || 0) < 10 ? "Status: 5 Watch & 5 Sub Links FREE available" : "Status: Next link costs ₱1.00";
}

// --- Navigation ---
window.showSection = (name) => {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`${name}-section`).classList.remove('hidden-section');
};

// --- Tasks Logic ---
const linksRef = ref(db, 'links');
onValue(linksRef, (snapshot) => {
    const data = snapshot.val();
    const watchList = document.getElementById('watch-list');
    const subList = document.getElementById('sub-list');
    watchList.innerHTML = ''; subList.innerHTML = '';

    if (data) {
        Object.keys(data).forEach(key => {
            const link = data[key];
            // Don't show if user already did it or link expired
            if (userData.watched && userData.watched[key]) return;
            if (link.clicks >= link.maxClicks) return;

            const card = document.createElement('div');
            card.className = "bg-gray-800 border border-gray-700 p-4 rounded-lg flex justify-between items-center";
            card.innerHTML = `
                <div class="truncate mr-4">
                    <p class="text-xs text-gray-400">Task ID: ${key.substring(0,6)}</p>
                    <p class="text-sm font-semibold truncate">${link.url}</p>
                </div>
                <button onclick="startTask('${key}', '${link.type}', '${link.url}')" class="bg-blue-600 px-4 py-2 rounded font-bold text-sm">
                    ${link.type === 'watch' ? '₱0.01' : '₱0.03'}
                </button>
            `;

            if (link.type === 'watch') watchList.appendChild(card);
            else subList.appendChild(card);
        });
    }
});

window.startTask = (id, type, url) => {
    const overlay = document.getElementById('timer-overlay');
    const progress = document.getElementById('progress-bar');
    const secDisplay = document.getElementById('seconds');
    
    overlay.classList.remove('hidden');
    let timeLeft = 30;
    progress.style.width = '0%';

    const timer = setInterval(() => {
        timeLeft--;
        secDisplay.innerText = timeLeft;
        progress.style.width = `${((30 - timeLeft) / 30) * 100}%`;

        if (timeLeft <= 0) {
            clearInterval(timer);
            completeTask(id, type, url);
        }
    }, 1000);
};

async function completeTask(id, type, url) {
    const reward = type === 'watch' ? 0.01 : 0.03;
    
    // Update User Balance and History
    const newBalance = (userData.balance || 0) + reward;
    const updates = {};
    updates[`users/${username}/balance`] = newBalance;
    updates[`users/${username}/watched/${id}`] = true;
    
    // Update Link Click Count
    const linkSnap = await get(ref(db, `links/${id}`));
    if (linkSnap.exists()) {
        updates[`links/${id}/clicks`] = (linkSnap.val().clicks || 0) + 1;
    }

    await update(ref(db), updates);
    
    document.getElementById('timer-overlay').classList.add('hidden');
    alert(`Success! Reward ₱${reward} added.`);
    window.open(url, '_blank'); // Redirect to YouTube
}

// --- Submit New Link ---
window.submitLink = async () => {
    const urlInput = document.getElementById('link-input');
    const type = document.getElementById('link-type').value;
    const url = urlInput.value;

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        alert("Please enter a valid YouTube link");
        return;
    }

    const linksCreated = userData.linksCreated || 0;
    let maxClicks = 0;
    
    // Business Logic for Tiers
    if (type === 'watch') {
        maxClicks = linksCreated < 5 ? 100 : 120;
    } else {
        maxClicks = linksCreated < 10 ? 50 : 65; // (5 free watch + 5 free sub)
    }

    // Cost handling
    if (linksCreated >= 10) {
        if (userData.balance < 1) {
            alert("Insufficient balance! You need ₱1.00 for more links.");
            return;
        }
        await update(userRef, { balance: userData.balance - 1 });
    }

    const newLinkRef = push(ref(db, 'links'));
    await set(newLinkRef, {
        url: url,
        type: type,
        clicks: 0,
        maxClicks: maxClicks,
        creator: username
    });

    await update(userRef, { linksCreated: linksCreated + 1 });
    urlInput.value = '';
    alert("Link added to queue!");
};
