import { initializeApp } from "https://www.gstatic.com/firebasejs/10.2.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, addDoc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.2.0/firebase-firestore.js";

// Firebase
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

// ---------- AUTO LOGIN ----------
if (USERNAME) {
  showBank();
  listenUser();
} else {
  document.getElementById("usernameCard").classList.remove("hidden");
}

// ---------- CREATE ACCOUNT ----------
document.getElementById("createUsernameBtn").onclick = async () => {
  const username = inputUsername.value.trim();
  if (!username) return alert("Enter username");

  const btn = createUsernameBtn;
  btn.disabled = true;
  btn.innerText = "Creating...";

  try {
    const ref = doc(db, "users", username);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      btn.disabled = false;
      btn.innerText = "Create Account";
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

  } catch (e) {
    alert("Error creating account");
    console.error(e);
  }

  btn.disabled = false;
  btn.innerText = "Create Account";
};

// ---------- SHOW BANK ----------
function showBank() {
  usernameCard.classList.add("hidden");
  bankCard.classList.remove("hidden");
  usernameDisplay.innerText = `👤 ${USERNAME}`;
}

// ---------- LISTEN USER ----------
function listenUser() {
  const ref = doc(db, "users", USERNAME);
  onSnapshot(ref, snap => {
    if (!snap.exists()) return;
    const data = snap.data();

    const balEl = balance;
    const old = parseInt(balEl.dataset.old);
    if (old !== data.balance) {
      animateBalance(old, data.balance);
      balEl.dataset.old = data.balance;
    }
  });
}

// ---------- ANIMATE ----------
function animateBalance(start, end) {
  const el = balance;
  let startTime = null;

  function step(t) {
    if (!startTime) startTime = t;
    const p = Math.min((t - startTime) / 500, 1);
    el.innerText = `Balance: ₱${Math.floor(start + (end - start) * p)}`;
    if (p < 1) requestAnimationFrame(step);
    else el.innerText = `Balance: ₱${end}`;
  }
  requestAnimationFrame(step);
}

// ---------- WITHDRAW ----------
withdrawBtn.onclick = async () => {
  const amount = parseInt(withdrawAmount.value);
  const gcash = gcashNumber.value.trim();
  if (!amount || amount <= 0 || !gcash) return alert("Invalid input");

  try {
    const userRef = doc(db, "users", USERNAME);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const bal = snap.data().balance;
    if (amount > bal) return alert("Insufficient balance");

    await addDoc(collection(db, "withdrawals"), {
      username: USERNAME,
      userId: USERNAME,
      amount,
      gcashNumber: gcash,
      status: "pending",
      createdAt: new Date()
    });

    await updateDoc(userRef, {
      balance: bal - amount
    });

    alert("Withdrawal pending");
    withdrawAmount.value = "";
    gcashNumber.value = "";

  } catch (e) {
    alert("Error processing withdrawals");
    console.error(e);
  }
};

// ---------- OWNER ----------
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
