import { initializeApp } from "https://www.gstatic.com/firebasejs/10.2.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, addDoc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.2.0/firebase-firestore.js";

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
  return !t || Date.now() - parseInt(t) > ms;
}
function setClaim(key) {
  localStorage.setItem(key, Date.now());
}
async function rewardUser(amount = 0.02) {
  const ref = doc(db, "users", USERNAME);
  const snap = await getDoc(ref);
  await updateDoc(ref, { balance: snap.data().balance + amount });
  alert(`🎉 You earned ₱${amount.toFixed(2)} pesos`);
}

/* ---------- AUTO LOGIN ---------- */
if (USERNAME) {
  showBank();
  listenUser();
  listenUserWithdrawals();
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
    createdAt: new Date()
  });

  USERNAME = username;
  localStorage.setItem("miniBankUsername", username);
  showBank();
  listenUser();
  listenUserWithdrawals();
};

function showBank() {
  usernameCard.classList.add("hidden");
  bankCard.classList.remove("hidden");
  usernameDisplay.innerText = `👤 ${USERNAME}`;
}

/* ---------- BALANCE REALTIME ---------- */
function listenUser() {
  onSnapshot(doc(db, "users", USERNAME), snap => {
    const bal = snap.data().balance;
    balance.innerText = `Balance: ₱${bal.toFixed(2)}`;
    balance.dataset.old = bal;
  });
}

/* ---------- ADS REWARDS ---------- */
signinAdsBtn.onclick = () => {
  if (!canClaim("signinAds", 12 * 60 * 60 * 1000))
    return alert("Available every 12 hours");
  show_10276123().then(async () => {
    setClaim("signinAds");
    await rewardUser(0.02);
  });
};

giftAdsBtn.onclick = () => {
  if (!canClaim("giftAds", 3 * 60 * 60 * 1000))
    return alert("Available every 3 hours");
  show_10276123().then(async () => {
    setClaim("giftAds");
    await rewardUser(0.02);
  });
};

viewAdsBtn.onclick = () => {
  if (!canClaim("viewAds", 5 * 60 * 1000))
    return alert("Available every 5 minutes");
  show_10276123().then(async () => {
    setClaim("viewAds");
    await rewardUser(0.02);
  });
};

viewAds2Btn.onclick = () => {
  if (!canClaim("viewAds2", 5 * 60 * 1000))
    return alert("Available every 5 minutes");
  show_10276123("pop").then(async () => {
    setClaim("viewAds2");
    await rewardUser(0.02);
  });
};

/* ---------- AUTO IN-APP ADS ---------- */
show_10276123({
  type: 'inApp',
  inAppSettings: {
    frequency: 2,
    capping: 0.1,
    interval: 30,
    timeout: 5,
    everyPage: false
  }
});

/* ---------- WITHDRAW ---------- */
withdrawBtn.onclick = async () => {
  const amount = parseFloat(withdrawAmount.value);
  const gcash = gcashNumber.value.trim();
  if (!amount || amount <= 0 || !gcash) return alert("Invalid input");

  const userRef = doc(db, "users", USERNAME);
  const snap = await getDoc(userRef);
  if (amount > snap.data().balance) return alert("Insufficient balance");

  const receiptId = `RCPT-${Date.now()}-${Math.floor(Math.random()*9999)}`;

  await addDoc(collection(db, "withdrawals"), {
    username: USERNAME,
    amount,
    gcashNumber: gcash,
    receiptId,
    status: "pending",
    createdAt: new Date()
  });

  await updateDoc(userRef, {
    balance: snap.data().balance - amount
  });

  withdrawAmount.value = "";
  gcashNumber.value = "";
  alert("Withdrawal pending");
};

/* ---------- USER WITHDRAW TABLE ---------- */
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

/* ---------- OWNER ---------- */
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
