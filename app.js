import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  addDoc, collection, onSnapshot, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Telegram user
const tg = window.Telegram?.WebApp;
const user = tg?.initDataUnsafe?.user;
const uid = user?.id?.toString() || "guest";
const uname = user?.username || "Guest";

username.textContent = uname;
const userRef = doc(db,"users",uid);

// Init user
const init = async()=>{
  const snap = await getDoc(userRef);
  if(!snap.exists()){
    await setDoc(userRef,{balance:0,username:uname});
  }
};
init();

// Balance sync
onSnapshot(userRef,s=>{
  balance.textContent = (s.data()?.balance || 0).toFixed(2);
});

// Withdrawals sync
onSnapshot(collection(db,"withdrawals"),snap=>{
  withdrawTable.innerHTML="";
  ownerTable.innerHTML="";
  let total=0;

  snap.forEach(d=>{
    const w=d.data();

    if(w.uid===uid){
      withdrawTable.innerHTML+=`<tr><td>₱${w.amount}</td><td>${w.status}</td></tr>`;
    }

    if(w.status==="PAID") total+=w.amount;

    if(w.status==="PENDING"){
      ownerTable.innerHTML+=`
      <tr>
        <td>${w.username}</td>
        <td>₱${w.amount}</td>
        <td><button onclick="approve('${d.id}')">Approve</button></td>
      </tr>`;
    }
  });

  totalPaid.textContent=total.toFixed(2);
});

// Ads
window.dailySignin=()=>{
  show_10276123().then(async()=>{
    await updateDoc(userRef,{balance:increment(0.02)});
    alert("Congratulations 🎉 0.02 peso earned");
  });
};

window.showAds=()=>{
  show_10276123('pop').then(async()=>{
    await updateDoc(userRef,{balance:increment(0.04)});
    alert("Congratulations 🎉 0.04 peso earned");
  });
};

// Withdraw
window.withdraw=async()=>{
  const snap=await getDoc(userRef);
  const bal=snap.data().balance;
  if(bal<1) return alert("Minimum ₱1");

  await addDoc(collection(db,"withdrawals"),{
    uid,
    username:uname,
    amount:bal,
    status:"PENDING",
    time:serverTimestamp()
  });

  await updateDoc(userRef,{balance:0});
};

// Owner
window.ownerLogin=()=>{
  const p=prompt("Owner password");
  if(p==="Propetas6") owner.classList.remove("hidden");
};

window.approve=async(id)=>{
  await updateDoc(doc(db,"withdrawals",id),{status:"PAID"});
};
