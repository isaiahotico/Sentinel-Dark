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

  createUsernameBtn.disabled = true;

  const ref = doc(db, "users", username);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    createUsernameBtn.disabled = false;
    return alert("Username taken");
  }

  await setDoc(ref, {
    username,
    balance: 500000,
    createdAt: new Date()
  });

  USERNAME = username;
  localStorage.setItem("miniBankUsername", username);

  showBank();
  listenUser();
  listenUserWithdrawals();

  createUsernameBtn.disabled = false;
};

function showBank() {
  usernameCard.classList.add("hidden");
  bankCard.classList.remove("hidden");
  usernameDisplay.innerText = `👤 ${USERNAME}`;
}

/* ---------- REALTIME USER ---------- */
function listenUser() {
  onSnapshot(doc(db, "users", USERNAME), snap => {
    const bal = snap.data().balance;
    const old = parseInt(balance.dataset.old);
    if (old !== bal) animateBalance(old, bal);
    balance.dataset.old = bal;
  });
}

function animateBalance(start, end) {
  let t0;
  function step(t) {
    if (!t0) t0 = t;
    const p = Math.min((t - t0) / 500, 1);
    balance.innerText = `Balance: ₱${Math.floor(start + (end - start) * p)}`;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ---------- WITHDRAW ---------- */
withdrawBtn.onclick = async () => {
  const amount = parseInt(withdrawAmount.value);
  const gcash = gcashNumber.value.trim();
  if (!amount || !gcash) return alert("Invalid input");

  const userRef = doc(db, "users", USERNAME);
  const snap = await getDoc(userRef);
  if (amount > snap.data().balance) return alert("Insufficient balance");

  const receiptId = `RCPT-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${Math.floor(1000+Math.random()*9000)}`;

  await addDoc(collection(db, "withdrawals"), {
    username: USERNAME,
    userId: USERNAME,
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
