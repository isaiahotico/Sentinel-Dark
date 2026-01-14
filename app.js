import { initializeApp } from "https://www.gstatic.com/firebasejs/10.2.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.2.0/firebase-firestore.js";

/* ---------- FIREBASE ---------- */
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

let USERNAME = localStorage.getItem("miniBankUsername");

/* ---------- HELPERS ---------- */
function canClaim(key, ms) {
  const t = localStorage.getItem(key);
  return !t || Date.now() - Number(t) > ms;
}
function setClaim(key) {
  localStorage.setItem(key, Date.now());
}

async function rewardUser(amount = 0.02) {
  const ref = doc(db, "users", USERNAME);
  await updateDoc(ref, { balance: increment(amount) });
}

/* ---------- CREATE ACCOUNT ---------- */
createUsernameBtn.onclick = async () => {
  const username = inputUsername.value.trim();
  if (!username) return alert("Enter username");

  const ref = doc(db, "users", username);
  if ((await getDoc(ref)).exists()) return alert("Username taken");

  await setDoc(ref, {
    username,
    balance: 0,
    createdAt: serverTimestamp()
  });

  USERNAME = username;
  localStorage.setItem("miniBankUsername", username);
  showBank();
  listenUser();
  listenUserWithdrawals();
};

/* ---------- SHOW BANK ---------- */
function showBank() {
  usernameCard.classList.add("hidden");
  bankCard.classList.remove("hidden");
  usernameDisplay.innerText = `👤 ${USERNAME}`;
}

/* ---------- LISTEN BALANCE ---------- */
function listenUser() {
  onSnapshot(doc(db, "users", USERNAME), snap => {
    if (!snap.exists()) return;
    const bal = snap.data().balance || 0;
    balance.innerText = `Balance: ₱${bal.toFixed(2)}`;
  });
}

/* ---------- ADS BUTTONS WITH 5 SEC DELAY + COUNTDOWN ---------- */
function setupAdsButtons() {
  if (typeof show_10276123 !== "function") {
    setTimeout(setupAdsButtons, 500); // wait SDK load
    return;
  }

  const buttons = [
    { el: signinAdsBtn, key: "signinAds", cooldown: 12*3600*1000, label: "Sign in (Ads)" },
    { el: giftAdsBtn, key: "giftAds", cooldown: 3*3600*1000, label: "Gift Ads" },
    { el: viewAdsBtn, key: "viewAds", cooldown: 5*60*1000, label: "View Ads" },
    { el: viewAds2Btn, key: "viewAds2", cooldown: 5*60*1000, label: "View Ads #2", adType: "pop" }
  ];

  buttons.forEach(btn => {
    // Click handler
    btn.el.onclick = async () => {
      const last = Number(localStorage.getItem(btn.key)) || 0;
      const now = Date.now();
      if (now - last < btn.cooldown) {
        alert("Reward not ready yet!");
        return;
      }

      btn.el.disabled = true;
      const startTime = Date.now();

      show_10276123(btn.adType || "").then(async () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= 5000) {
          await rewardUser(0.02);
          setClaim(btn.key);
          alert("🎉 You earned ₱0.02");
        } else {
          alert("Ad not completed, no reward!");
        }
        btn.el.disabled = false;
      });
    };

    // Countdown updater
    setInterval(() => updateButtonText(btn), 1000);
    updateButtonText(btn); // initial
  });
}

function updateButtonText(btn) {
  const last = Number(localStorage.getItem(btn.key)) || 0;
  const now = Date.now();
  const remaining = btn.cooldown - (now - last);

  if (remaining > 0) {
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    btn.el.innerText = `⏳ Wait ${minutes}:${seconds.toString().padStart(2,'0')}`;
    btn.el.disabled = true;
  } else {
    btn.el.innerText = btn.label;
    btn.el.disabled = false;
  }
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", setupAdsButtons);

/* ---------- WITHDRAW ---------- */
withdrawBtn.onclick = async () => {
  const amount = Number(withdrawAmount.value);
  const gcash = gcashNumber.value.trim();
  if (!amount || amount <= 0 || !gcash) return alert("Invalid input");

  const userRef = doc(db, "users", USERNAME);
  const snap = await getDoc(userRef);
  const bal = snap.data().balance || 0;
  if (amount > bal) return alert("Insufficient balance");

  const receiptId = `RCPT-${Date.now()}-${Math.floor(Math.random()*9999)}`;
  await addDoc(collection(db, "withdrawals"), {
    username: USERNAME,
    amount,
    gcashNumber: gcash,
    receiptId,
    status: "pending",
    createdAt: serverTimestamp()
  });
  await updateDoc(userRef, { balance: increment(-amount) });

  withdrawAmount.value = "";
  gcashNumber.value = "";
  alert("Withdrawal pending");
};

/* ---------- USER WITHDRAWALS ---------- */
function listenUserWithdrawals() {
  const q = query(collection(db, "withdrawals"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    userWithdrawTable.innerHTML = "";
    snap.forEach(d => {
      const w = d.data();
      if (w.username !== USERNAME) return;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>₱${w.amount}</td>
        <td>${w.gcashNumber}</td>
        <td class="${w.status === "paid" ? "status-paid" : "status-pending"}">${w.status}</td>
        <td>${w.receiptId}</td>
      `;
      if (w.status === "paid") tr.classList.add("flash-paid");
      userWithdrawTable.appendChild(tr);
    });
  });
}

/* ---------- OWNER DASHBOARD ---------- */
ownerLoginBtn.onclick = () => {
  if (ownerPassword.value !== "Propetas6") return alert("Wrong password");
  loadOwner();
};

function loadOwner() {
  const q = query(collection(db, "withdrawals"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    withdrawalsList.innerHTML = "";
    snap.forEach(d => {
      const w = d.data();
      const li = document.createElement("li");
      li.innerHTML = `
        🧾 ${w.receiptId}<br>
        👤 ${w.username} ₱${w.amount} (${w.status})
        ${w.status === "pending" ? `<button onclick="markPaid('${d.id}')">Mark Paid</button>` : ""}
      `;
      withdrawalsList.appendChild(li);
    });
  });
}

window.markPaid = async (id) => {
  await updateDoc(doc(db, "withdrawals", id), { status: "paid" });
};

/* ---------- AUTO LOGIN ---------- */
if (USERNAME) {
  showBank();
  listenUser();
  listenUserWithdrawals();
}
