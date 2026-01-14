import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, addDoc,
  query, orderBy, limit, onSnapshot, serverTimestamp, doc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getDatabase, ref, push, set, onDisconnect, onValue
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

/* Firebase setup */
const firebaseConfig={
  apiKey:"AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain:"paper-house-inc.firebaseapp.com",
  projectId:"paper-house-inc",
  messagingSenderId:"658389836376",
  appId:"1:658389836376:web:2ab1e2743c593f4ca8e02d"
};
const app=initializeApp(firebaseConfig);
const db=getFirestore(app);
const rdb=getDatabase(app);

/* Username detection */
let username="Guest-"+Math.floor(Math.random()*9000+1000);
if(window.Telegram?.WebApp?.initDataUnsafe?.user?.username){
  username="@"+Telegram.WebApp.initDataUnsafe.user.username;
}

/* Online presence */
const myRef=push(ref(rdb,"presence"));
function heartbeat(){ set(myRef,{username,lastActive:Date.now()}); }
heartbeat();
setInterval(heartbeat,30000);
onDisconnect(myRef).remove();

/* Image compression */
function compressImage(file){
  return new Promise(res=>{
    const img=new Image();
    const reader=new FileReader();
    reader.onload=e=>{
      img.src=e.target.result;
      img.onload=()=>{
        const c=document.createElement("canvas");
        const max=1024;
        let w=img.width,h=img.height;
        if(w>h&&w>max){h*=max/w;w=max}
        else if(h>max){w*=max/h;h=max}
        c.width=w;c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        res(c.toDataURL("image/jpeg",0.6));
      };
    };
    reader.readAsDataURL(file);
  });
}
const toBase64=f=>new Promise(r=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(f); });

/* Rate limit */
let sentTimes=[];

/* Global balance */
let balance=0;
const balanceDisplay=document.getElementById("balanceDisplay");

/* Chat box */
const chatBox=document.getElementById("chat");
let autoScroll=true;

/* Detect user manual scroll */
chatBox.addEventListener('scroll',()=>{
  const scrollBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
  autoScroll = scrollBottom < 20; // If near bottom, keep auto scroll
});

/* Send button */
document.getElementById("send").onclick=async()=>{
  // Monetag rewarded interstitial
  try{
    await show_10276123();
    alert('You have seen an ad!');
    balance+=0.02;
    balanceDisplay.innerText=balance.toFixed(2);
  }catch(e){}

  // send chat
  const text=message.value.trim();
  const imgs=[...images.files].slice(0,5);
  const aud=audio.files[0];
  if(!text && imgs.length===0 && !aud) return;

  const now=Date.now();
  sentTimes=sentTimes.filter(t=>now-t<60000);
  if(sentTimes.length>=5){alert("Limit 5 msgs/min");return;}
  sentTimes.push(now);

  let img64=[], aud64=null;
  for(const f of imgs) img64.push(await compressImage(f));
  if(aud && aud.size<250000) aud64=await toBase64(aud);

  await addDoc(collection(db,"globalChat"),{user:username,text,images:img64,audio:aud64,time:serverTimestamp(),reactions:{}});
  
  message.value=""; images.value=""; audio.value="";
};

/* Chat display + reactions */
onSnapshot(query(collection(db,"globalChat"),orderBy("time"),limit(5000)),snap=>{
  chatBox.innerHTML="";
  snap.forEach(d=>{
    const m=d.data();
    const div=document.createElement("div");
    div.className="msg";
    let reactionsHTML="";
    for(const r of ["❤️","👍"]){
      reactionsHTML+=`<span style="cursor:pointer;margin-left:4px;" onclick="react('${d.id}','${r}')">${r} ${m.reactions?.[r]||0}</span>`;
    }
    div.innerHTML=`
      <div class="user">👤 ${m.user}</div>
      ${m.text?`<div>${m.text}</div>`:""}
      ${(m.images||[]).map(i=>`<img src="${i}">`).join("")}
      ${m.audio?`<audio controls src="${m.audio}"></audio>`:""}
      <div class="reactions">${reactionsHTML}</div>
    `;
    chatBox.appendChild(div);
  });
  if(autoScroll){
    chatBox.scrollTo({top:chatBox.scrollHeight,behavior:'smooth'});
  }
});

/* Reaction handler */
window.react=async(mid,emoji)=>{
  const msgRef=doc(db,"globalChat",mid);
  const snap=await getDoc(msgRef);
  let data=snap.data();
  if(!data.reactions) data.reactions={};
  data.reactions[emoji]=(data.reactions[emoji]||0)+1;
  await updateDoc(msgRef,{reactions:data.reactions});
};

/* Users list pagination */
let users=[],page=0,PER_PAGE=15;
const usersBox=document.getElementById("users");
onValue(ref(rdb,"presence"),snap=>{
  users=[];
  const now=Date.now();
  snap.forEach(c=>{
    const u=c.val();
    if(now-u.lastActive<=3600000) users.push(u);
  });
  renderUsers();
});
function renderUsers(){
  usersBox.innerHTML="";
  users.slice(page*PER_PAGE,(page+1)*PER_PAGE).forEach(u=>{
    const online=(Date.now()-u.lastActive<120000);
    usersBox.innerHTML+=`<div class="userItem"><span>${u.username}</span><span class="${online?"online":"active"}">${online?"Online":"Active"}</span></div>`;
  });
}
document.getElementById("next").onclick=()=>{if((page+1)*PER_PAGE<users.length){page++;renderUsers();}};
document.getElementById("prev").onclick=()=>{if(page>0){page--;renderUsers();}};

/* Withdrawals table (user only) */
const wtbody=document.getElementById("withdrawals");
onSnapshot(query(collection(db,"withdrawals"),orderBy("time")),snap=>{
  wtbody.innerHTML="";
  snap.forEach(d=>{
    const w=d.data();
    if(w.user===username){
      wtbody.innerHTML+=`<tr><td>${w.amount}</td><td>${w.status}</td></tr>`;
    }
  });
});

/* Request withdrawal */
document.getElementById("requestWithdraw").onclick=async()=>{
  const amount=balance;
  if(amount<=0){alert("No balance"); return;}
  await addDoc(collection(db,"withdrawals"),{user:username,amount,status:"Pending",time:serverTimestamp()});
  balance=0;
  balanceDisplay.innerText=balance.toFixed(2);
  alert("Withdrawal requested!");
};

/* Owner dashboard */
const ownerPanel=document.getElementById("ownerPanel");
document.getElementById("ownerLogin").onclick=()=>{
  const pass=document.getElementById("ownerPass").value;
  if(pass==="Propetas6"){
    document.getElementById("ownerContent").style.display="block";
    onSnapshot(query(collection(db,"withdrawals"),orderBy("time")),snap=>{
      const tbody=document.getElementById("ownerWithdrawals");
      tbody.innerHTML="";
      snap.forEach(d=>{
        const w=d.data();
        tbody.innerHTML+=`<tr>
          <td>${w.user}</td><td>${w.amount}</td><td>${w.status}</td>
          <td>
            <button onclick="approve('${d.id}')">Paid</button>
            <button onclick="deny('${d.id}')">Deny</button>
          </td>
        </tr>`;
      });
    });
  } else {alert("Wrong password");}
};
window.approve=async(id)=>{await updateDoc(doc(db,"withdrawals",id),{status:"Paid"});}
window.deny=async(id)=>{await updateDoc(doc(db,"withdrawals",id),{status:"Denied"});}
