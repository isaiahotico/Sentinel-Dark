import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  addDoc, collection, onSnapshot,
  serverTimestamp, runTransaction, arrayUnion, getDocs
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

if (!username) showLogin();
else startApp(username);

/* =============================== LOGIN / REGISTER ============================== */
window.login = async () => {
  const input = loginUsername.value.trim().toLowerCase();
  if (!input) return alert("Enter username");

  const referralCode = prompt("Referral code (optional)").trim().toLowerCase();
  if (referralCode && referralCode === input) return alert("Cannot refer yourself");

  userRef = doc(db,"users",input);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef,{
      username: input,
      balance: 0,
      referralBonus:0,
      referrer: referralCode || null,
      createdAt: serverTimestamp()
    });
  }

  localStorage.setItem("activeUser", input);
  startApp(input);
};

/* =============================== START APP ============================== */
async function startApp(name){
  username=name;
  userRef = doc(db,"users",username);
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  document.getElementById("username").innerText=username;
  document.getElementById("refCode").innerText=username;

  listenBalance();
  listenWithdrawals();
  listenReferrals();
  updateLeaderboard();
}

/* =============================== BALANCE ============================== */
function listenBalance(){
  onSnapshot(userRef,snap=>{
    if(snap.exists()) balance.innerText=snap.data().balance.toFixed(2);
  });
}

/* =============================== WITHDRAWALS ============================== */
function listenWithdrawals(){
  onSnapshot(collection(db,"withdrawals"),snap=>{
    withdrawTable.innerHTML="";
    ownerTable.innerHTML="";
    snap.forEach(d=>{
      const w=d.data();
      const date=w.time?.toDate().toLocaleString()||"-";
      const badge=w.status==="PAID"?`<span class="badge paid">PAID</span>`:`<span class="badge pending">PENDING</span>`;
      if(w.username===username)
        withdrawTable.innerHTML+=`<tr><td>${date}</td><td>${w.username}</td><td>₱${w.amount}</td><td>${badge}</td></tr>`;
      const actionButtons=w.status==="PENDING"?`<button onclick="approve('${d.id}')">Approve</button><button onclick="deny('${d.id}')">Deny</button>`:"";
      ownerTable.innerHTML+=`<tr><td>${date}</td><td>${w.username}</td><td>₱${w.amount}</td><td>${badge}</td><td>${actionButtons}</td></tr>`;
    });
  });
}

/* =============================== REFERRALS ============================== */
function listenReferrals(){
  onSnapshot(collection(db,"referrals"),snap=>{
    refTable.innerHTML="";
    let total=0;
    snap.forEach(d=>{
      const r=d.data();
      if(r.referrer===username){
        total++;
        const status=r.claimed?`<span class="badge paid">CLAIMED</span>`:`<span class="badge pending">UNCLAIMED</span>`;
        refTable.innerHTML+=`<tr><td>${r.invitee}</td><td>₱${r.withdrawAmount}</td><td>₱${r.bonus}</td><td>${status}</td></tr>`;
      }
    });
    refCount.innerText=total;
  });
}
window.toggleReferral=()=>referralBox.classList.toggle("hidden");

/* =============================== CLAIM REFERRAL ============================== */
window.claimReferral=async()=>{
  const snap=await getDocs(collection(db,"referrals"));
  let totalBonus=0;
  const docs=[];
  snap.forEach(d=>{
    const r=d.data();
    if(r.referrer===username && !r.claimed){
      totalBonus+=r.bonus;
      docs.push(d.ref);
    }
  });
  if(totalBonus<=0)return alert("No bonus to claim");
  await runTransaction(db,async tx=>{
    const userSnap=await tx.get(userRef);
    tx.update(userRef,{balance:userSnap.data().balance+totalBonus});
    docs.forEach(ref=>tx.update(ref,{claimed:true}));
  });
  alert(`🎉 Referral bonus ₱${totalBonus} claimed`);
  updateLeaderboard();
};

/* =============================== LEADERBOARD ============================== */
async function updateLeaderboard(){
  const refSnap=await getDocs(collection(db,"referrals"));
  const leaderboard={};
  refSnap.forEach(d=>{
    const r=d.data();
    if(!r.claimed)return;
    leaderboard[r.referrer]=(leaderboard[r.referrer]||0)+r.bonus;
  });
  const sorted=Object.entries(leaderboard).sort((a,b)=>b[1]-a[1]);
  leaderboardTable.innerHTML="";
  sorted.forEach(([user,bonus])=>{
    leaderboardTable.innerHTML+=`<tr><td>${user}</td><td>₱${bonus.toFixed(2)}</td></tr>`;
  });
}

/* =============================== AD REWARD ============================== */
async function reward(amount){await runTransaction(db,async tx=>{const snap=await tx.get(userRef);tx.update(userRef,{balance:snap.data().balance+amount});});}
window.dailySignin=()=>show_10276123().then(()=>reward(0.02).then(()=>alert("🎉 0.02 earned")));
window.showAds=()=>show_10276123("pop").then(()=>reward(0.04).then(()=>alert("🎉 0.04 earned")));

/* =============================== WITHDRAW ============================== */
window.withdraw=async()=>{
  const snap=await getDoc(userRef);
  const amount=snap.data().balance;
  if(amount<=0)return alert("No balance");
  const referrer=snap.data().referrer;
  await addDoc(collection(db,"withdrawals"),{username,amount,status:"PENDING",time:serverTimestamp()});
  await updateDoc(userRef,{balance:0});
  if(referrer){
    const bonus=+(amount*0.10).toFixed(2);
    await addDoc(collection(db,"referrals"),{referrer,invitee:username,withdrawAmount:amount,bonus,claimed:false,time:serverTimestamp()});
  }
  updateLeaderboard();
};

/* =============================== LOGOUT ============================== */
window.logout=()=>{localStorage.removeItem("activeUser");location.reload();};

/* =============================== OWNER DASHBOARD ============================== */
window.ownerLogin=()=>{if(prompt("Owner password")==="Propetas6")owner.classList.remove("hidden");};
window.approve=async(id)=>{const wRef=doc(db,"withdrawals",id);const wSnap=await getDoc(wRef);if(!wSnap.exists())return;await updateDoc(wRef,{status:"PAID"});};
window.deny=async(id)=>{const wRef=doc(db,"withdrawals",id);const wSnap=await getDoc(wRef);if(!wSnap.exists())return;await updateDoc(wRef,{status:"DENIED"});};
