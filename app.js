
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

/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.floor(Math.random()*1000);
const userId = tgUser ? tgUser.id : "guest_" + Date.now();

document.getElementById("userBar").innerText = "👤 " + username;

/* ================= STATE MANAGEMENT ================= */
let adsWatched = 0;
let lastPostTime = 0;
let userTheme = { bg: '#1a1a1a', text: '#ffffff' };

// Load User Progress
db.ref('users/' + userId).on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        adsWatched = data.adsWatched || 0;
        lastPostTime = data.lastPostTime || 0;
        document.getElementById('adCountDisplay').innerText = adsWatched;
        updateCooldownDisplay();
    } else {
        db.ref('users/' + userId).set({ username: username, adsWatched: 0, lastPostTime: 0 });
    }
});

/* ================= THEME COLOR PICKER ================= */
const colorPicker = document.getElementById('colorPicker');
colorPicker.addEventListener('input', (e) => {
    document.documentElement.style.setProperty('--main-bg', e.target.value);
    // Simple logic: if bg is light, make text black
    const hex = e.target.value.replace('#', '');
    const r = parseInt(hex.substr(0,2),16);
    const g = parseInt(hex.substr(2,2),16);
    const b = parseInt(hex.substr(4,2),16);
    const brightness = ((r*299)+(g*587)+(b*114))/1000;
    const textColor = brightness > 125 ? '#000000' : '#ffffff';
    document.documentElement.style.setProperty('--main-color', textColor);
});

/* ================= UI NAVIGATION ================= */
function showSection(id) {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(id + '-section').classList.remove('hidden-section');
    toggleMenu();
}

const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const closeBtn = document.getElementById('closeBtn');

function toggleMenu() { sidebar.classList.toggle('active'); }
menuBtn.onclick = toggleMenu;
closeBtn.onclick = toggleMenu;

/* ================= ADS LOGIC ================= */
function watchMandatoryAd() {
    // Requirements: Show the specific link AND a random Monetag ad
    const monetagZones = ['show_10555663', 'show_10830602', 'show_10555746'];
    const randomZone = monetagZones[Math.floor(Math.random() * monetagZones.length)];

    // Open the profitable link
    window.open("https://www.profitablecpmratenetwork.com/i2rx8svvds?key=ec449a85ea63cb0b7adf4cd90009cbca", "_blank");

    // Trigger Monetag
    if (typeof window[randomZone] === 'function') {
        window[randomZone]().then(() => {
            db.ref('users/' + userId + '/adsWatched').set(adsWatched + 1);
            alert("Ad Completed! Progress saved.");
        }).catch(() => {
            // Fallback if ad fails or blocked
            db.ref('users/' + userId + '/adsWatched').set(adsWatched + 1);
        });
    } else {
        // Fallback for script issues
        db.ref('users/' + userId + '/adsWatched').set(adsWatched + 1);
    }
}

/* ================= TASKS SYSTEM ================= */
function updateCooldownDisplay() {
    const now = Date.now();
    const wait = 4 * 60 * 60 * 1000; // 4 Hours
    const remaining = (lastPostTime + wait) - now;
    const msgEl = document.getElementById('cooldownMsg');
    
    if (remaining > 0) {
        const mins = Math.ceil(remaining / (1000 * 60));
        msgEl.innerText = `Cooldown: ${mins} mins left`;
    } else {
        msgEl.innerText = "";
    }
}

async function handlePostLink() {
    const link = document.getElementById('tgLinkInput').value;
    const now = Date.now();
    const fourHours = 4 * 60 * 60 * 1000;

    if (adsWatched < 27) return alert("You need 27 ads. You have " + adsWatched);
    if (now - lastPostTime < fourHours) return alert("Cooldown active!");
    if (!link.includes("t.me")) return alert("Valid Telegram link required!");

    const taskId = db.ref('tasks').push().key;
    await db.ref('tasks/' + taskId).set({
        owner: userId,
        username: username,
        link: link,
        timestamp: now
    });

    await db.ref('users/' + userId + '/lastPostTime').set(now);
    document.getElementById('tgLinkInput').value = "";
    alert("Link Posted!");
}

// Fetch Tasks and hide if clicked
db.ref('tasks').limitToLast(20).on('value', (snapshot) => {
    const list = document.getElementById('taskList');
    list.innerHTML = "";
    const hiddenTasks = JSON.parse(localStorage.getItem('hidden_tasks') || "[]");

    snapshot.forEach(child => {
        const task = child.val();
        if (hiddenTasks.includes(child.key)) return;

        const div = document.createElement('div');
        div.className = "bg-gray-800 p-4 rounded flex justify-between items-center border-l-4 border-blue-500";
        div.innerHTML = `
            <div>
                <p class="font-bold">${task.username}</p>
                <p class="text-xs opacity-60">Posted link...</p>
            </div>
            <button onclick="performTask('${child.key}', '${task.link}')" class="bg-blue-600 px-4 py-1 rounded text-sm">Join</button>
        `;
        list.prepend(div);
    });
});

function performTask(id, link) {
    window.open(link, "_blank");
    let hiddenTasks = JSON.parse(localStorage.getItem('hidden_tasks') || "[]");
    hiddenTasks.push(id);
    localStorage.setItem('hidden_tasks', JSON.stringify(hiddenTasks));
    // Trigger the ad logic when clicking a task too (as it's an ads app)
    watchMandatoryAd(); 
    showSection('tasks'); // Refresh view
}

/* ================= CHAT SYSTEM ================= */
function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input.value.trim()) return;
    db.ref('chat').push({
        username: username,
        text: input.value,
        time: Date.now()
    });
    input.value = "";
}

db.ref('chat').limitToLast(30).on('value', (snapshot) => {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = "";
    snapshot.forEach(child => {
        const msg = child.val();
        const div = document.createElement('div');
        div.className = "mb-2 text-sm";
        div.innerHTML = `<span class="text-blue-400 font-bold">${msg.username}:</span> ${msg.text}`;
        chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
});

/* ================= TOPICS SYSTEM ================= */
function openTopicModal() { document.getElementById('topicModal').classList.remove('hidden'); }
function closeTopicModal() { document.getElementById('topicModal').classList.add('hidden'); }

async function submitTopic() {
    const title = document.getElementById('topicTitle').value;
    const desc = document.getElementById('topicDesc').value;
    const fileInput = document.getElementById('topicImg');
    let imgData = "";

    if (!title || !desc) return alert("Fill all fields");

    if (fileInput.files[0]) {
        const reader = new FileReader();
        reader.readAsDataURL(fileInput.files[0]);
        reader.onload = () => {
            imgData = reader.result;
            saveTopic(title, desc, imgData);
        };
    } else {
        saveTopic(title, desc, "");
    }
}

function saveTopic(title, desc, img) {
    db.ref('topics').push({
        owner: username,
        title,
        desc,
        img,
        timestamp: Date.now()
    });
    closeTopicModal();
}

db.ref('topics').on('value', (snapshot) => {
    const container = document.getElementById('topicList');
    container.innerHTML = "";
    snapshot.forEach(child => {
        const t = child.val();
        const div = document.createElement('div');
        div.className = "bg-gray-800 rounded-lg overflow-hidden border border-white/5";
        div.innerHTML = `
            ${t.img ? `<img src="${t.img}" class="w-full h-40 object-cover">` : ''}
            <div class="p-3">
                <h3 class="font-bold text-blue-400">${t.title}</h3>
                <p class="text-sm opacity-80">${t.desc}</p>
                <div class="mt-2 text-[10px] opacity-40">By ${t.owner}</div>
                <div class="mt-2 pt-2 border-t border-white/5">
                   <input type="text" placeholder="Reply..." onkeydown="if(event.key==='Enter') replyTopic('${child.key}', this.value)" class="w-full bg-black/20 p-1 rounded text-xs">
                   <div id="replies-${child.key}" class="mt-2 space-y-1"></div>
                </div>
            </div>
        `;
        container.prepend(div);
        
        // Load replies
        db.ref('replies/' + child.key).on('value', (repSnap) => {
            const repDiv = document.getElementById(`replies-${child.key}`);
            repDiv.innerHTML = "";
            repSnap.forEach(r => {
                const rd = document.createElement('div');
                rd.className = "text-[11px] bg-white/5 p-1 rounded";
                rd.innerHTML = `<b>${r.val().user}:</b> ${r.val().text}`;
                repDiv.appendChild(rd);
            });
        });
    });
});

function replyTopic(topicId, text) {
    if (!text) return;
    db.ref('replies/' + topicId).push({ user: username, text: text });
}

/* ================= ONLINE USERS ================= */
const userStatusRef = db.ref('status/' + userId);
userStatusRef.set({ username: username, online: true });
userStatusRef.onDisconnect().remove();

db.ref('status').on('value', (snapshot) => {
    const list = document.getElementById('onlineList');
    list.innerHTML = "";
    snapshot.forEach(child => {
        const li = document.createElement('li');
        li.className = "py-2 flex items-center gap-2 text-sm";
        li.innerHTML = `<span class="w-2 h-2 bg-green-500 rounded-full"></span> ${child.val().username}`;
        list.appendChild(li);
    });
});

/* ================= FOOTER TIME ================= */
setInterval(() => {
    const now = new Date();
    document.getElementById('footerDateTime').innerText = now.toLocaleString();
}, 1000);
