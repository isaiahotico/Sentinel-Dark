
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- STATE MANAGEMENT ---
let username = localStorage.getItem('tg_username');
if (!username) {
    username = prompt("Enter your Telegram Username (e.g. @king_dev):");
    if(!username || !username.startsWith('@')) username = '@user' + Math.floor(Math.random()*1000);
    localStorage.setItem('tg_username', username);
}
document.getElementById('user-display').innerText = username;

let adsWatched = parseInt(localStorage.getItem('ads_count') || '0');
let lastPostTime = parseInt(localStorage.getItem('last_post_time') || '0');
const REQUIRED_ADS = 27;

// --- CORE FUNCTIONS ---

// Update UI
function updateUI() {
    document.getElementById('ad-count').innerText = `${adsWatched}/${REQUIRED_ADS}`;
    const status = document.getElementById('qualify-status');
    if (adsWatched >= REQUIRED_ADS) {
        status.innerText = "Qualified";
        status.className = "text-xs text-green-500 font-bold uppercase";
    }
}

// AD LOGIC
function watchAdsTogether() {
    // 1. Open Direct Link
    window.open("https://www.profitablecpmratenetwork.com/i2rx8svvds?key=ec449a85ea63cb0b7adf4cd90009cbca", "_blank");

    // 2. Random Interstitial
    const monetagScripts = ['show_10555663', 'show_10830602', 'show_10555746'];
    const randomScript = monetagScripts[Math.floor(Math.random() * monetagScripts.length)];
    
    if (typeof window[randomScript] === 'function') {
        window[randomScript]().then(() => {
            adsWatched++;
            localStorage.setItem('ads_count', adsWatched);
            updateUI();
            alert('Ad reward collected!');
        }).catch(e => {
            // Fallback if ad fails to load
            adsWatched++;
            localStorage.setItem('ads_count', adsWatched);
            updateUI();
        });
    }
}

// NAVIGATION
function toggleMenu() {
    const side = document.getElementById('sidebar');
    side.classList.toggle('-translate-x-full');
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId + '-section').classList.remove('hidden');
    toggleMenu();
}

// TASK LOGIC
function postLink() {
    const link = document.getElementById('tg-link').value;
    const now = Date.now();

    if (adsWatched < REQUIRED_ADS) return alert("Watch 27 ads first!");
    if (!link.includes("t.me/")) return alert("Enter a valid Telegram link!");
    
    // 4 Hour Cooldown
    if (now - lastPostTime < 4 * 60 * 60 * 1000) {
        return alert("Cooldown active! Wait 4 hours.");
    }

    const newPost = {
        username: username,
        link: link,
        timestamp: now,
        id: Math.random().toString(36).substr(2, 9)
    };

    db.ref('tasks').push(newPost);
    lastPostTime = now;
    localStorage.setItem('last_post_time', now);
    document.getElementById('tg-link').value = "";
    alert("Link Posted!");
}

// Handle Link Display and Hiding
db.ref('tasks').on('value', snapshot => {
    const container = document.getElementById('links-container');
    container.innerHTML = "";
    const hiddenLinks = JSON.parse(localStorage.getItem('hidden_links') || "[]");

    snapshot.forEach(child => {
        const data = child.val();
        if (hiddenLinks.includes(data.id)) return;

        const div = document.createElement('div');
        div.className = "bg-gray-800 p-4 rounded border-l-4 border-blue-500 flex justify-between items-center";
        div.innerHTML = `
            <div>
                <p class="text-sm font-bold">${data.username}</p>
                <p class="text-xs text-gray-400">Posted ${new Date(data.timestamp).toLocaleTimeString()}</p>
            </div>
            <button onclick="handleLinkClick('${data.id}', '${data.link}')" class="bg-blue-600 px-4 py-1 rounded text-sm">Join</button>
        `;
        container.prepend(div);
    });
});

function handleLinkClick(id, url) {
    const hiddenLinks = JSON.parse(localStorage.getItem('hidden_links') || "[]");
    hiddenLinks.push(id);
    localStorage.setItem('hidden_links', JSON.stringify(hiddenLinks));
    window.open(url, "_blank");
    location.reload(); // Refresh to hide the link
}

// CHAT LOGIC
function sendMessage() {
    const input = document.getElementById('chat-input');
    if (!input.value) return;
    db.ref('chat').push({
        user: username,
        text: input.value,
        time: Date.now()
    });
    input.value = "";
}

db.ref('chat').limitToLast(20).on('value', snapshot => {
    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML = "";
    snapshot.forEach(child => {
        const msg = child.val();
        const div = document.createElement('div');
        div.className = "p-2 bg-gray-700 rounded-lg max-w-[80%] " + (msg.user === username ? "ml-auto bg-blue-900" : "");
        div.innerHTML = `<p class="text-[10px] text-blue-300">${msg.user}</p><p class="text-sm">${msg.text}</p>`;
        chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
});

// ONLINE USERS
const userStatusRef = db.ref('/status/' + username.replace('@', ''));
db.ref('.info/connected').on('value', snap => {
    if (snap.val() === true) {
        userStatusRef.onDisconnect().remove();
        userStatusRef.set('online');
    }
});

db.ref('status').on('value', snapshot => {
    const list = document.getElementById('user-list');
    list.innerHTML = "";
    snapshot.forEach(child => {
        const li = document.createElement('li');
        li.className = "flex items-center gap-2 text-sm";
        li.innerHTML = `<span class="w-2 h-2 bg-green-500 rounded-full"></span> @${child.key}`;
        list.appendChild(li);
    });
});

// SETTINGS & COLORS
function updateColors() {
    const bg = document.getElementById('bg-picker').value;
    const accent = document.getElementById('accent-picker').value;
    document.body.style.setProperty('--main-bg', bg);
    document.body.style.background = bg;
    document.querySelectorAll('.bg-blue-600').forEach(el => el.style.backgroundColor = accent);
    localStorage.setItem('pref_bg', bg);
    localStorage.setItem('pref_accent', accent);
}

// FOOTER TIME
setInterval(() => {
    const now = new Date();
    document.getElementById('footer-time-date').innerText = now.toLocaleString();
}, 1000);

// INITIALIZE
window.onload = () => {
    updateUI();
    const savedBg = localStorage.getItem('pref_bg');
    const savedAccent = localStorage.getItem('pref_accent');
    if (savedBg) {
        document.getElementById('bg-picker').value = savedBg;
        updateColors();
    }
};
