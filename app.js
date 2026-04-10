
// --- DATABASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "facebook-follow-to-follow.firebaseapp.com",
    databaseURL: "https://facebook-follow-to-follow-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facebook-follow-to-follow",
    storageBucket: "facebook-follow-to-follow.firebasestorage.app",
    messagingSenderId: "589427984313",
    appId: "1:589427984313:web:a17b8cc851efde6dd79868"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ================= TELEGRAM INTEGRATION ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.floor(1000 + Math.random() * 9000);
const userId = tgUser ? tgUser.id : "guest_" + username;

document.getElementById("userBar").innerText = "👤 " + username;

/* ================= STATE & DATA ================= */
let adsWatched = 0;
let lastPostTime = 0;
const PROFITABLE_URL = "https://www.profitablecpmratenetwork.com/i2rx8svvds?key=ec449a85ea63cb0b7adf4cd90009cbca";

// Sync user data from Firebase
db.ref('users/' + userId).on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        adsWatched = data.adsWatched || 0;
        lastPostTime = data.lastPostTime || 0;
        document.getElementById('adCountDisplay').innerText = adsWatched;
    } else {
        db.ref('users/' + userId).set({ username, adsWatched: 0, lastPostTime: 0 });
    }
});

/* ================= ADS LOGIC ================= */
function watchRandomAd() {
    // 1. Open the mandatory profitable link in new tab
    window.open(PROFITABLE_URL, "_blank");

    // 2. Randomly pick one of the three Monetag functions
    const monetagAds = [show_10555663, show_10830602, show_10555746];
    const randomIndex = Math.floor(Math.random() * monetagAds.length);
    const selectedAd = monetagAds[randomIndex];

    // 3. Execute the random ad
    if (typeof selectedAd === 'function') {
        selectedAd().then(() => {
            adsWatched++;
            db.ref('users/' + userId + '/adsWatched').set(adsWatched);
            alert("Ad Counted! You have " + adsWatched + "/27");
        }).catch(err => {
            console.error("Ad failed", err);
            // Fallback reward to ensure user doesn't get stuck if ad fails to load
            adsWatched++;
            db.ref('users/' + userId + '/adsWatched').set(adsWatched);
        });
    }
}

/* ================= TASK SYSTEM ================= */
function handlePostLink() {
    const linkInput = document.getElementById('tgLinkInput');
    const link = linkInput.value.trim();
    const now = Date.now();
    const fourHours = 4 * 60 * 60 * 1000;

    if (adsWatched < 27) {
        alert("Locked! You need to watch 27 ads first. You have: " + adsWatched);
        return;
    }

    if (now - lastPostTime < fourHours) {
        const remaining = Math.ceil((fourHours - (now - lastPostTime)) / 60000);
        alert(`Cooldown active. Wait ${remaining} more minutes.`);
        return;
    }

    if (!link.includes("t.me")) {
        alert("Please enter a valid Telegram link.");
        return;
    }

    const taskId = db.ref('tasks').push().key;
    db.ref('tasks/' + taskId).set({
        id: taskId,
        owner: userId,
        username: username,
        link: link,
        timestamp: now
    });

    db.ref('users/' + userId + '/lastPostTime').set(now);
    linkInput.value = "";
    alert("Link posted successfully!");
}

// Display tasks and auto-hide if already clicked
db.ref('tasks').limitToLast(50).on('value', (snapshot) => {
    const list = document.getElementById('taskList');
    list.innerHTML = "";
    const hiddenTasks = JSON.parse(localStorage.getItem('clicked_tasks') || "[]");

    snapshot.forEach(child => {
        const task = child.val();
        if (hiddenTasks.includes(task.id)) return; // Auto-hide logic

        const div = document.createElement('div');
        div.className = "task-card bg-white/5 p-5 rounded-2xl flex justify-between items-center border border-white/10";
        div.innerHTML = `
            <div>
                <p class="font-bold text-blue-400">${task.username}</p>
                <p class="text-xs opacity-50">Telegram Channel/Group</p>
            </div>
            <button onclick="clickTask('${task.id}', '${task.link}')" class="bg-white text-black px-6 py-2 rounded-xl font-bold text-sm">Open</button>
        `;
        list.prepend(div);
    });
});

function clickTask(id, link) {
    // Redirect to link
    window.open(link, "_blank");
    
    // Trigger ad logic automatically on click
    watchRandomAd();

    // Auto-hide for this user
    let hiddenTasks = JSON.parse(localStorage.getItem('clicked_tasks') || "[]");
    hiddenTasks.push(id);
    localStorage.setItem('clicked_tasks', JSON.stringify(hiddenTasks));
    
    showSection('tasks'); // Refresh view
}

/* ================= CHAT SYSTEM ================= */
function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input.value.trim()) return;

    db.ref('chat').push({
        username: username,
        text: input.value.trim(),
        timestamp: Date.now()
    });
    input.value = "";
}

db.ref('chat').limitToLast(40).on('value', (snapshot) => {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = "";
    snapshot.forEach(child => {
        const msg = child.val();
        const isMe = msg.username === username;
        const div = document.createElement('div');
        div.className = `max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? 'ml-auto bg-blue-600' : 'bg-white/10'}`;
        div.innerHTML = `<p class="text-[10px] font-bold opacity-50">${msg.username}</p><p>${msg.text}</p>`;
        chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
});

/* ================= ONLINE USERS & UI ================= */
// Online Status
const myStatusRef = db.ref('online_status/' + userId);
myStatusRef.set({ username, lastSeen: Date.now() });
myStatusRef.onDisconnect().remove();

db.ref('online_status').on('value', (snapshot) => {
    const container = document.getElementById('onlineList');
    container.innerHTML = "";
    snapshot.forEach(child => {
        const user = child.val();
        const div = document.createElement('div');
        div.className = "p-4 flex items-center gap-3";
        div.innerHTML = `<div class="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]"></div> <span>${user.username}</span>`;
        container.appendChild(div);
    });
});

// Sidebar & Sections
function showSection(id) {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(id + '-section').classList.remove('hidden-section');
    sidebar.classList.remove('active');
}

const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const closeBtn = document.getElementById('closeBtn');

menuBtn.onclick = () => sidebar.classList.add('active');
closeBtn.onclick = () => sidebar.classList.remove('active');

// Color Picker
document.getElementById('colorPicker').addEventListener('input', (e) => {
    document.documentElement.style.setProperty('--main-bg', e.target.value);
});

// Footer Clock
setInterval(() => {
    const now = new Date();
    document.getElementById('footerDateTime').innerText = now.toLocaleString();
    
    // Update Cooldown display in task section
    const fourHours = 4 * 60 * 60 * 1000;
    const diff = Date.now() - lastPostTime;
    if (diff < fourHours) {
        const timeLeft = fourHours - diff;
        const h = Math.floor(timeLeft / 3600000);
        const m = Math.floor((timeLeft % 3600000) / 60000);
        const s = Math.floor((timeLeft % 60000) / 1000);
        document.getElementById('cooldownTimer').innerText = `NEXT POST IN: ${h}h ${m}m ${s}s`;
    } else {
        document.getElementById('cooldownTimer').innerText = "POST READY";
    }
}, 1000);
