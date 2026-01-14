import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  addDoc, collection, onSnapshot,
  serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let username = localStorage.getItem("activeUser");
let userRef = null;

/* ===============================
   INIT APP
================================ */
if (!username) {
  showLogin();
} else {
  startApp(username);
}

/* ===============================
   LOGIN
================================ */
window.login = async () => {
  const input = loginUsername.value.trim().toLowerCase();
  if (!input) return alert("Enter a username");

  localStorage.setItem("activeUser", input);
  startApp(input);
};

function showLogin() {
  loginCard.classList.remove("hidden");
  appCard.classList.add("hidden");
}

async function startApp(name) {
  username = name;
  userRef = doc(db, "users", username);

  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  document.getElementById("username").innerText = username;

  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      username,
      balance: 0,
      createdAt: serverTimestamp()
    });
  }

  listenBalance();
  listenWithdrawals();
}

/* ===============================
   REAL-TIME BALANCE
================================ */
function listenBalance() {
  onSnapshot(userRef, snap => {
    if (snap.exists()) {
      balance.innerText = snap.data().balance.toFixed(2);
    }
  });
}

/* ===============================
   WITHDRAWALS
================================ */
function listenWithdrawals() {
  onSnapshot(collection(db,"withdrawals"), snap => {
    withdrawTable.innerHTML = "";
    ownerTable.innerHTML = "";
    let total = 0;

    snap.forEach(d => {
      const w = d.data();

      if (w.username === username) {
        withdrawTable.innerHTML +=
          `<tr><td>₱${w.amount}</td><td>${w.status}</td></tr>`;
      }

      if (w.status === "PAID") total += w.amount;

      if (w.status === "PENDING") {
        ownerTable.innerHTML += `
        <tr>
          <td>${w.username}</td>
          <td>₱${w.amount}</td>
          <td><button onclick="approve('${d.id}')">Approve</button></td>
        </tr>`;
      }
    });

    totalPaid.innerText = total.toFixed(2);
  });
}

/* ===============================
   🔥 SAFE AD REWARD
================================ */
async function reward(amount) {
  await runTransaction(db, async tx => {
    const snap = await tx.get(userRef);
    const bal = snap.exists() ? snap.data().balance : 0;
    tx.update(userRef, { balance: bal + amount });
  });
}

window.dailySignin = () => {
  show_10276123().then(async () => {
    await reward(0.02);
    alert("Congratulations 🎉 0.02 peso earned");
  });
};

window.showAds = () => {
  show_10276123("pop").then(async () => {
    await reward(0.04);
    alert("Congratulations 🎉 0.04 peso earned");
  });
};

/* ===============================
   WITHDRAW
================================ */
window.withdraw = async () => {
  const snap = await getDoc(userRef);
  const bal = snap.data().balance;

  await addDoc(collection(db,"withdrawals"), {
    username,
    amount: bal,
    status: "PENDING",
    time: serverTimestamp()
  });

  await updateDoc(userRef,{ balance: 0 });
};

/* ===============================
   LOGOUT (SWITCH ACCOUNT)
================================ */
window.logout = () => {
  if (!confirm("Switch account?")) return;
  localStorage.removeItem("activeUser");
  location.reload();
};

/* ===============================
   OWNER
================================ */
window.ownerLogin = () => {
  if (prompt("Owner password") === "Propetas6") {
    owner.classList.remove("hidden");
  }
};

window.approve = async id => {
  await updateDoc(doc(db,"withdrawals",id),{ status:"PAID" });
};
