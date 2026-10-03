(() => {
'use strict';
const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id), TAU=Math.PI*2;
const reefImage=new Image(); reefImage.src='reef-environment.jpg';
const robotImage=new Image(); robotImage.src='crab-robot.webp';
const robotSide=new Image(); robotSide.src='crab-side.webp';
const robotRear=new Image(); robotRear.src='crab-rear.webp';
const W=1280,H=720, rand=(a,b)=>a+Math.random()*(b-a), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const state={phase:'start',level:0,time:0,health:100,score:0,target:0,now:0,mouse:{x:640,y:360},net:[],debris:[],fish:[],bubbles:[],corals:[],pieces:[],ground:[],yaw:0,depth:0,sonar:0,sonarCooldown:0,charge:1,casts:0,saved:0,wrong:0,drag:false,dragX:0,keys:{},toastUntil:0,sound:false,audio:null,finishReason:'',cam:{x:0,z:0},grip:null,particles:[],current:0,motion:{forward:0,strafe:0,turn:0,drag:0,walk:0}};
let last=performance.now();
const palette=['#ffb22f','#ef6944','#9a6fc3','#3ccfc2','#f1ce75','#e87e8d'];
function wrap(a){return Math.atan2(Math.sin(a),Math.cos(a))}
function showToast(message,color='#bcffe1'){let t=$('toast');t.textContent=message;t.style.color=color;t.classList.remove('hidden');state.toastUntil=state.now+2.2}
function beep(freq=450,duration=.08,type='sine',volume=.045){if(!state.sound)return;try{let a=state.audio||(state.audio=new (window.AudioContext||window.webkitAudioContext)()),o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,a.currentTime);g.gain.setValueAtTime(volume,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+duration);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+duration)}catch(e){}}
function ui(){let running=state.phase==='play';$('hud').classList.toggle('hidden',!running);$('bottomHud').classList.toggle('hidden',!running);$('overlay').classList.toggle('hidden',running);$('gameFrame').classList.toggle('level-two',running&&state.level===2);$('missionLabel').textContent=`MISSION 0${state.level} / 02`;$('levelTitle').textContent=state.level===1?'The drifting tide':'The hidden reef';$('objective').textContent=state.level===1?'Cast a selective net · Rescue wildlife · Keep the reef healthy':'Rotate 360° · Scan coral · Collect plastic with the gripper';$('collected').textContent=`${state.score} / ${state.target}`;$('health').textContent=`${Math.ceil(state.health)}%`;$('health').style.color=state.health<40?'#ff847a':'#d8fff2';let sec=Math.max(0,Math.ceil(state.time));$('timer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;$('hint').innerHTML=state.level===1?'Aim ahead of drifting waste · <kbd>CLICK</kbd> cast · Net travels before opening · Avoid wildlife':'<kbd>A D</kbd> rotate · <kbd>W S</kbd> swim · <kbd>Q E</kbd> sidestep · <kbd>SPACE</kbd> sonar · <kbd>CLICK</kbd> grip';$('meterName').textContent=state.level===1?'NET CHARGE':'SONAR CHARGE';$('meterFill').style.width=`${Math.round((state.level===1?state.charge:1-state.sonarCooldown/7)*100)}%`;$('footerStatus').textContent=running?(state.level===1?'CURRENT MONITOR ACTIVE':'PANORAMIC SCAN ACTIVE'):'SYSTEM READY'}
function panel(name){for(let id of ['startPanel','briefPanel','resultPanel'])$(id).classList.toggle('hidden',id!==name)}
function briefing(level){state.level=level;state.phase='brief';panel('briefPanel');$('overlay').classList.remove('hidden');$('briefKicker').textContent=`MISSION BRIEFING 0${level} / 02`;$('briefNumber').textContent=`0${level}`;if(level===1){$('briefTitle').textContent='The drifting tide';$('briefText').textContent='Floating waste is carried toward the reef. Aim the crab’s biodegradable retrieval net at plastic, but give living animals a clear passage.';$('briefInstructions').innerHTML='<div><strong>01 · AIM</strong>Move the mouse over drifting plastic</div><div><strong>02 · CAST</strong>Click to throw a circular net</div><div><strong>03 · PROTECT</strong>Avoid fish and turtles inside the net</div>';$('briefScience').innerHTML='<strong>SCIENCE IN ACTION</strong> · Ocean currents carry litter. A selective net removes larger waste while reducing accidental capture of marine life.'}else{$('briefTitle').textContent='The hidden reef';$('briefText').textContent='A 360° coral habitat is full of fragile living structures. Rotate the camera, use sonar to reveal concealed litter, approach each target and collect it with the gripper.';$('briefInstructions').innerHTML='<div><strong>A / D or DRAG</strong>Rotate 360°; Q/E sidestep</div><div><strong>W / S</strong>Move carefully around coral</div><div><strong>SPACE + CLICK</strong>Scan; grip waste within reach</div>';$('briefScience').innerHTML='<strong>SCIENCE IN ACTION</strong> · Coral is a living animal. Slow, precise removal helps protect its polyps and the shelter they provide for reef species.'}$('playBtn').textContent=level===1?'LAUNCH LEVEL 01 ↗':'DIVE INTO LEVEL 02 ↗';ui()}
function initLevel(level){state.phase='play';state.level=level;state.health=level===1?100:Math.max(45,state.health);state.score=0;state.target=level===1?12:10;state.time=level===1?105:245;state.charge=1;state.casts=0;state.saved=0;state.wrong=0;state.sonar=0;state.sonarCooldown=0;state.net=[];state.yaw=0;state.depth=0;state.cam={x:0,z:0};state.grip=null;state.particles=[];state.ground=[];state.motion={forward:0,strafe:0,turn:0,drag:0,walk:0};state.lastCollision=-99;state.debris=[];state.fish=[];state.pieces=[];state.corals=[];state.bubbles=Array.from({length:68},()=>({x:rand(0,W),y:rand(0,H),r:rand(1,4),speed:rand(15,45)}));if(level===1){for(let i=0;i<15;i++)spawnDebris(rand(170,1430));for(let i=0;i<8;i++)spawnFish(rand(50,1300));}else{for(let i=0;i<72;i++){let a=i*TAU/72+rand(-.11,.11),d=rand(3.2,10.4);state.corals.push({x:Math.sin(a)*d,z:Math.cos(a)*d,type:i%4,color:palette[i%palette.length],size:rand(.75,1.45),seed:rand(0,10)})}for(let i=0;i<14;i++){let a=(i+.3)*TAU/14+rand(-.08,.08),d=rand(3.3,9.2);state.pieces.push({x:Math.sin(a)*d,z:Math.cos(a)*d,type:i%4,taken:false,seed:rand(0,10)})}for(let i=0;i<135;i++){let a=rand(0,TAU),d=rand(2.1,11.5);state.ground.push({x:Math.sin(a)*d,z:Math.cos(a)*d,size:rand(1,4),seed:rand(0,7)})}}ui()}
function spawnDebris(x=W+rand(20,260)){state.debris.push({x,y:rand(195,570),vx:rand(-65,-33),vy:rand(-9,9),r:rand(14,21),type:Math.floor(rand(0,4)),spin:rand(-1,1),phase:rand(0,7),caught:false})}
function spawnFish(x=W+rand(20,200)){state.fish.push({x,y:rand(180,560),vx:rand(-70,-37),r:rand(15,25),type:Math.random()<.17?'turtle':'fish',color:palette[Math.floor(rand(0,4))],phase:rand(0,8)})}
function finish(win){state.phase='result';state.finishReason=win?'complete':'retry';panel('resultPanel');$('overlay').classList.remove('hidden');$('resultKicker').textContent=win?'MISSION COMPLETE':'MISSION INTERRUPTED';$('resultIcon').textContent=win?'✦':'↻';$('resultTitle').textContent=win?(state.level===1?'Wildlife corridor secured':'Reef restored!'):(state.health<=0?'Reef health depleted':'The tide is turning');$('resultText').textContent=win?(state.level===1?'Your selective casts intercepted the waste while the reef remained safe. Now it is time to search beneath the coral canopy.':'You surveyed the full reef, spotted concealed litter and retrieved it with care. The ocean is safer because you acted precisely.'):(state.level===1?'Try smaller, well-timed casts and keep marine animals outside the net.':'Rotate slowly, use sonar and approach plastic before using the gripper. Avoid touching live coral.');$('resultStats').innerHTML=`<div><small>PLASTIC COLLECTED</small>${state.score} / ${state.target}</div><div><small>REEF HEALTH</small>${Math.ceil(state.health)}%</div><div><small>${state.level===1?'SAFE CASTS':'TIME REMAINING'}</small>${state.level===1?Math.max(0,state.casts-state.wrong):Math.ceil(state.time)+'s'}</div>`;$('resultScience').innerHTML=state.level===1?'<strong>FIELD NOTE</strong> · Currents move plastic through habitats. Targeting waste while keeping wildlife clear is safer than indiscriminate collection.':'<strong>FIELD NOTE</strong> · Coral reefs support biodiversity. Plastic can snag and shade coral, so careful removal matters.';$('nextBtn').textContent=win?(state.level===1?'CONTINUE TO LEVEL 02 ↗':'PLAY AGAIN ↻'):'RETRY LEVEL ↻';beep(win?660:180,.3);ui()}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill()}
function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function roundRect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function background(t,deep=false){
  if(reefImage.complete&&reefImage.naturalWidth){
    if(deep)ctx.drawImage(reefImage,-28+Math.sin(state.yaw)*22,0,W+56,H);
    else ctx.drawImage(reefImage,0,0,W,H);
  }else{let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#075671');g.addColorStop(1,'#052d43');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
  let haze=ctx.createLinearGradient(0,0,0,H);haze.addColorStop(0,deep?'#063c6570':'#05577935');haze.addColorStop(.65,deep?'#00495d32':'#04767b20');haze.addColorStop(1,'#042b3890');ctx.fillStyle=haze;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<8;i++){
    let x=i*235-165+Math.sin(t*.15+i)*22,g=ctx.createLinearGradient(x,0,x+270,H);
    g.addColorStop(0,'#a9edff30');g.addColorStop(1,'#8cf8dd00');ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+52,0);ctx.lineTo(x+300,H);ctx.lineTo(x+88,H);ctx.fill()
  }ctx.restore();
  ctx.globalAlpha=deep?.12:.17;for(let j=0;j<15;j++){
    let x=(j*117+Math.sin(j*37)*33)%W,y=H-38-j%5*25;
    ctx.strokeStyle='#d7fff1';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y,35+j%4*11,5+j%3*2,Math.sin(t*.4+j)*.15,0,Math.PI);ctx.stroke()
  }ctx.globalAlpha=1;
}
function randSeed(i){return (Math.sin(i*45.332)*31234.234)%1+1}
function bubbles(dt){for(let b of state.bubbles){b.y-=b.speed*dt;b.x+=Math.sin(state.now+b.y*.04)*.13;if(b.y<0){b.y=H+5;b.x=rand(0,W)}}ctx.strokeStyle='#c5f9f066';ctx.lineWidth=1.4;for(let b of state.bubbles){ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.stroke()}}
function coral(x,y,s,col,type=0,alpha=1){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=alpha;ctx.lineCap='round';
  const shade='#123e49',light='#ffe2ae';
  if(type===3){let g=ctx.createLinearGradient(-36,-50,42,5);g.addColorStop(0,'#a17a8d');g.addColorStop(.6,col);g.addColorStop(1,shade);
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-30,0);ctx.bezierCurveTo(-52,-24,-28,-55,-11,-43);ctx.bezierCurveTo(-4,-34,8,-45,18,-51);ctx.bezierCurveTo(45,-47,52,-22,30,0);ctx.closePath();ctx.fill();
    for(let i=0;i<55;i++){let xx=Math.sin(i*84)*32,yy=-Math.abs(Math.cos(i*33)*41);circle(xx,yy,1.1,'#ffe6cb85')}
  }else if(type===2){for(let i=0;i<7;i++){let a=i*TAU/7;line(0,-4,Math.cos(a)*27,Math.sin(a)*17-24,shade,14);line(0,-4,Math.cos(a)*27,Math.sin(a)*17-24,col,10);circle(Math.cos(a)*29,Math.sin(a)*17-25,8,col);circle(Math.cos(a)*28-2,Math.sin(a)*17-28,2,light)}circle(0,-17,12,col)
  }else if(type===1){for(let i=-2;i<=2;i++){let xx=i*17,h=28-Math.abs(i)*3;ctx.fillStyle=shade;ctx.beginPath();ctx.ellipse(xx+3,-h,12,h+8,i*.16,0,TAU);ctx.fill();ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(xx,-h,10,h+8,i*.16,0,TAU);ctx.fill();line(xx-3,-h-19,xx+3,-h+10,'#ffffff3b',2);for(let j=0;j<9;j++)circle(xx+Math.sin(j*7)*6,-h-22+j*5,.8,light)}}
  else{for(let i=-3;i<=3;i++){let ex=i*14,ey=-31-Math.abs(i%3)*11;line(0,0,ex,ey,shade,13);line(-2,-3,ex-2,ey-2,col,9);line(ex*.65,ey*.65,ex+12,ey-17,shade,9);line(ex*.65,ey*.65,ex+12,ey-17,col,6);circle(ex+12,ey-18,4,light);for(let j=0;j<5;j++)circle(ex*.3+j*ex*.12-2,ey*.3+j*ey*.12,1,'#ffe7c59e')}}
  ctx.restore()
}
function crab(x,y,s=1,small=false){
  if(robotImage.complete&&robotImage.naturalWidth){ctx.save();ctx.fillStyle='#011b2855';ctx.beginPath();ctx.ellipse(x,y+46*s,112*s,15*s,0,0,TAU);ctx.fill();ctx.drawImage(robotImage,x-142*s,y-112*s+Math.sin(state.now*3)*2,284*s,190*s);ctx.restore();return}
  ctx.save();ctx.translate(x,y+Math.sin(state.now*3)*2);ctx.scale(s,s);
  ctx.fillStyle='#001f2b79';ctx.beginPath();ctx.ellipse(0,49,100,16,0,0,TAU);ctx.fill();
  for(let side of [-1,1])for(let i=0;i<3;i++){
    let x0=side*(48+i*3),y0=-10+i*13,x1=side*(79+i*8),y1=5+i*10,x2=side*(87+i*10),y2=31+i*6;
    line(x0,y0,x1,y1,'#092d40',13);line(x0,y0,x1,y1,'#ec9522',8);circle(x1,y1,8,'#e2d0a8');circle(x1,y1,3,'#2b4250');line(x1,y1,x2,y2,'#0c3448',9);line(x1,y1,x2,y2,'#efac3d',5);circle(x2,y2,5,'#142e36')
  }
  let body=ctx.createLinearGradient(-50,-37,44,43);body.addColorStop(0,'#ffffff');body.addColorStop(.44,'#d9e8e6');body.addColorStop(1,'#7b9ca4');
  roundRect(-65,-38,130,78,19,'#133648');roundRect(-61,-35,122,70,17,body);
  line(-48,-28,48,-28,'#ffffffb0',2);roundRect(-48,-18,96,34,9,'#0a293d');
  for(let side of [-1,1]){let lens=ctx.createRadialGradient(side*24-4,-8,1,side*24,-3,16);lens.addColorStop(0,'#e6ffff');lens.addColorStop(.25,'#5ee5eb');lens.addColorStop(.75,'#116684');lens.addColorStop(1,'#041b32');circle(side*24,-3,13,lens);circle(side*24-5,-8,3,'#ffffff');roundRect(side*40-6,19,13,7,2,'#f29e28')}
  roundRect(-38,-55,76,20,5,'#d88216');roundRect(-34,-58,68,18,5,'#ffbd42');roundRect(-25,-62,50,8,2,'#224458');
  line(-14,-61,-14,-74,'#c1d7cd',3);circle(-14,-76,4,'#5af5d7');
  for(let side of [-1,1]){line(side*56,-17,side*88,-38,'#12384b',9);circle(side*91,-40,11,'#c8d9cd');line(side*92,-40,side*112,-53,'#ed921b',11);line(side*105,-49,side*117,-59,'#1e4052',6);line(side*105,-44,side*118,-39,'#1e4052',6)}
  if(!small){roundRect(-25,30,50,18,5,'#0b3448');for(let i=-2;i<=2;i++)line(i*8,34,i*8,45,'#44d7df',2)}ctx.restore()
}
function drawPlastic(x,y,s,type=0,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);ctx.shadowColor='#031a2899';ctx.shadowBlur=12;ctx.shadowOffsetY=4;if(type===0){ctx.fillStyle='#ddd8b8';ctx.strokeStyle='#79c1c4';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-15,-17);ctx.lineTo(13,-18);ctx.lineTo(18,13);ctx.quadraticCurveTo(0,23,-18,12);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#e9efca';ctx.lineWidth=4;ctx.strokeRect(-8,-23,15,9)}else if(type===1){ctx.strokeStyle='#f2ebe2';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,2,16,Math.PI*.17,Math.PI*1.78);ctx.stroke();ctx.fillStyle='#f1a54e';ctx.fillRect(-13,-5,25,9)}else if(type===2){ctx.fillStyle='#c0e8ee';ctx.beginPath();ctx.moveTo(-18,-14);ctx.lineTo(15,-12);ctx.lineTo(21,14);ctx.lineTo(-21,13);ctx.closePath();ctx.fill();line(-15,-6,17,-5,'#75aab5',2);line(-10,6,17,8,'#75aab5',2)}else{ctx.strokeStyle='#eaf0d8';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-18,-11);ctx.quadraticCurveTo(-2,-28,16,-13);ctx.lineTo(11,16);ctx.stroke();ctx.beginPath();ctx.arc(1,12,10,0,TAU);ctx.stroke()}ctx.restore()}
function fish(f){
  ctx.save();ctx.translate(f.x,f.y+Math.sin(state.now*2+f.phase)*7);
  if(f.type==='turtle'){
    let g=ctx.createRadialGradient(-5,-9,2,4,1,32);g.addColorStop(0,'#a4d6a4');g.addColorStop(.65,'#4c947c');g.addColorStop(1,'#17566a');
    for(let sign of [-1,1]){ctx.fillStyle='#478e80';ctx.beginPath();ctx.ellipse(sign*23,sign*17,18,7,sign*.52,0,TAU);ctx.fill()}
    circle(-34,0,12,'#85c5a0');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,30,21,0,0,TAU);ctx.fill();
    ctx.strokeStyle='#d3b9908a';ctx.lineWidth=1.6;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.ellipse(i*8,0,12,17,0,0,TAU);ctx.stroke()}
    circle(-38,-4,2,'#143a39');
  }else{
    let g=ctx.createLinearGradient(0,-f.r,0,f.r);g.addColorStop(0,'#ecf4d5');g.addColorStop(.35,f.color);g.addColorStop(1,'#174d66');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,f.r*1.23,f.r*.62,0,0,TAU);ctx.fill();
    ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(f.r,0);ctx.lineTo(f.r+19,-14+Math.sin(state.now*8+f.phase)*4);ctx.lineTo(f.r+19,14-Math.sin(state.now*8+f.phase)*4);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(-5,-f.r*.4);ctx.lineTo(5,-f.r);ctx.lineTo(12,-f.r*.42);ctx.fill();
    for(let i=-1;i<=1;i++)line(i*9-1,-f.r*.45,i*9+4,f.r*.46,'#ffffff55',2);
    circle(-f.r*.55,-3,2.6,'#0b3042');circle(-f.r*.55-1,-4,1,'#fff')
  }ctx.restore()
}

function levelOne(dt){
  background(state.now);
  for(let i=0;i<12;i++){let x=i*112+Math.sin(i*3)*25;coral(x,688,.48+(i%4)*.14,palette[(i+2)%6],i%4,.72)}
  ctx.globalAlpha=.22;for(let i=0;i<8;i++){let y=178+i*57;line(0,y+Math.sin(state.now+i)*3,W,y-16,'#a8f0de',1)}ctx.globalAlpha=1;
  for(let d of state.debris){d.x+=d.vx*dt;d.y+=Math.sin(state.now*1.5+d.phase)*dt*8;d.spin+=dt*.5;if(d.x<15){d.x=W+rand(35,250);d.y=rand(195,540)}drawPlastic(d.x,d.y,d.r/20,d.type,Math.sin(d.spin)*.22)}
  for(let f of state.fish){f.x+=f.vx*dt;f.y+=Math.sin(state.now*2+f.phase)*dt*6;if(f.x<-70){f.x=W+rand(50,240);f.y=rand(180,555)}fish(f)}
  crab(126,564,.76);
  for(let n of [...state.net]){
    n.t+=dt;let travel=clamp(n.t/n.flight,0,1),opening=clamp((n.t-n.flight)/.23,0,1);
    let nx=126+(n.x-126)*travel-17*Math.max(0,n.t-n.flight),ny=542+(n.y-542)*travel-94*Math.sin(travel*Math.PI);
    ctx.setLineDash([6,6]);ctx.strokeStyle='#b8f5e4b0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(145,533);ctx.quadraticCurveTo((nx+126)/2,ny-85,nx,ny);ctx.stroke();ctx.setLineDash([]);
    if(n.t<n.flight){circle(nx,ny,12,'#e5f9dfbd');circle(nx,ny,5,'#ffb64a')}
    else{let radius=n.r*opening,yy=ny;
      ctx.fillStyle='rgba(226,255,234,.14)';ctx.beginPath();ctx.ellipse(nx,yy,radius,radius*.82,0,0,TAU);ctx.fill();ctx.strokeStyle='#dcfce8';ctx.lineWidth=3;ctx.stroke();
      ctx.save();ctx.beginPath();ctx.ellipse(nx,yy,radius,radius*.82,0,0,TAU);ctx.clip();for(let j=-70;j<80;j+=13){line(nx+j,yy-65,nx+j+45,yy+65,'#daf8e9a5',1);line(nx+j,yy+65,nx+j+45,yy-65,'#daf8e9a5',1)}ctx.restore();
      if(opening>.85&&n.t<n.flight+.85){let caught=0,hit=0;
        for(let d of state.debris)if(Math.hypot(d.x-nx,d.y-yy)<radius-d.r*.25){d.x=W+rand(40,340);d.y=rand(195,540);caught++;state.score++}
        for(let f of state.fish)if(Math.hypot(f.x-nx,f.y-yy)<radius+f.r*.25){f.x=W+rand(80,330);f.y=rand(195,540);hit++}
        if(caught){n.hits+=caught;showToast(`+${caught} plastic recovered`);beep(650,.08)}
        if(hit){state.health-=hit*15;state.wrong++;showToast(`Wildlife entangled! Reef health −${hit*15}`,'#ff9a86');beep(180,.22,'sawtooth')}
        if(caught||hit){ui();if(state.score>=state.target)finish(true);else if(state.health<=0)finish(false)}
      }
    }
    if(n.t>n.flight+.85)state.net.splice(state.net.indexOf(n),1)
  }
  ctx.setLineDash([5,5]);ctx.strokeStyle=state.charge>=1?'#c1ffe5':'#b4d9cc88';ctx.lineWidth=2;ctx.beginPath();ctx.arc(state.mouse.x,state.mouse.y,64,0,TAU);ctx.stroke();ctx.setLineDash([]);
  let lead=state.mouse.x-36;line(state.mouse.x,state.mouse.y,lead,state.mouse.y,'#fff2c899',2);circle(lead,state.mouse.y,3,'#ffba48');
  ctx.fillStyle='#dbfff2';ctx.font='700 10px Outfit';ctx.fillText('CURRENT ←  LEAD YOUR CAST',state.mouse.x+72,state.mouse.y+5)
}
function groundShadow(x,y,rx,ry,strength=.35){
  ctx.save();ctx.fillStyle=`rgba(3,28,34,${strength})`;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();ctx.restore()
}
function drawSeabed(){
  // The curved horizon and sand ridges share the projection used by reef objects.
  const horizon=326;
  let sand=ctx.createLinearGradient(0,horizon,0,H);
  sand.addColorStop(0,'rgba(157,207,183,.12)');
  sand.addColorStop(.16,'rgba(159,199,172,.58)');
  sand.addColorStop(.58,'rgba(167,168,132,.73)');
  sand.addColorStop(1,'rgba(97,113,96,.9)');
  ctx.fillStyle=sand;
  ctx.beginPath();ctx.moveTo(0,horizon+14);
  ctx.bezierCurveTo(270,horizon-7,475,horizon+12,640,horizon+2);
  ctx.bezierCurveTo(910,horizon-9,1060,horizon+15,W,horizon+5);
  ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();
  let light=ctx.createRadialGradient(630,465,30,630,620,710);
  light.addColorStop(0,'rgba(224,234,188,.25)');
  light.addColorStop(1,'rgba(27,69,73,.36)');
  ctx.fillStyle=light;ctx.fillRect(0,horizon,W,H-horizon);
  for(let d=11;d>=2.4;d-=1.05){
    let y=280+760/(d+.7),amplitude=clamp(45/d,4,18);
    ctx.beginPath();
    for(let x=0;x<=W;x+=16){
      let yy=y+Math.sin(x*.015+state.cam.x*.45+d*1.7)*amplitude*.4
        +Math.sin(x*.037+state.cam.z*.32+d)*amplitude*.16;
      if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy)
    }
    ctx.strokeStyle=`rgba(51,91,87,${clamp(.12+8/d*.055,.14,.31)})`;
    ctx.lineWidth=clamp(16/d,1,5);ctx.stroke();
    ctx.beginPath();
    for(let x=0;x<=W;x+=16){
      let yy=y+Math.sin(x*.015+state.cam.x*.45+d*1.7)*amplitude*.4
        +Math.sin(x*.037+state.cam.z*.32+d)*amplitude*.16-3*clamp(6/d,.4,2);
      if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy)
    }
    ctx.strokeStyle=`rgba(239,255,216,${clamp(.1+8/d*.045,.1,.25)})`;
    ctx.lineWidth=clamp(9/d,1,3);ctx.stroke()
  }
  for(let stone of state.ground){
    let p=project(stone);if(!p||p.y>H+30||p.y<horizon)continue;
    let size=stone.size*p.scale*.72;
    groundShadow(p.x,p.y+size*.3,size*1.8,size*.6,.26);
    ctx.fillStyle=stone.seed<2?'#e4d2a2b8':stone.seed<4?'#829988aa':'#3b696aaa';
    ctx.beginPath();ctx.ellipse(p.x,p.y-size*.42,size,size*.62,stone.seed,0,TAU);ctx.fill();
    circle(p.x-size*.3,p.y-size*.8,Math.max(.7,size*.18),'#fff4ce7a')
  }
}

function project(obj){
  let dx=obj.x-state.cam.x,dz=obj.z-state.cam.z,d=Math.hypot(dx,dz),delta=wrap(Math.atan2(dx,dz)-state.yaw);
  if(Math.abs(delta)>1.23||d<.32)return null;
  const scale=clamp(3.7/d,.25,2.2),x=W/2+Math.tan(delta)*505;
  return{x,y:280+760/(d+.7)+Math.sin(obj.seed||0)*1.5,scale,d,delta}
}
function levelTwo(dt){
  let turn=Number(!!(state.keys.d||state.keys.arrowright))-Number(!!(state.keys.a||state.keys.arrowleft));
  state.yaw=wrap(state.yaw+turn*dt*1.12);
  let forward=Number(!!(state.keys.w||state.keys.arrowup))-Number(!!(state.keys.s||state.keys.arrowdown));
  let strafe=Number(!!state.keys.e)-Number(!!state.keys.q);
  let motion=state.motion,k=Math.min(1,dt*8);motion.forward+=(forward-motion.forward)*k;motion.strafe+=(strafe-motion.strafe)*k;motion.turn+=(clamp(turn+strafe*.45+motion.drag,-1,1)-motion.turn)*k;motion.drag*=Math.max(0,1-dt*4);if(forward||strafe||turn)motion.walk+=dt*(8+Math.abs(forward)*2);
  if(forward||strafe){let speed=1.85*dt,dx=(Math.sin(state.yaw)*forward+Math.cos(state.yaw)*strafe)*speed,dz=(Math.cos(state.yaw)*forward-Math.sin(state.yaw)*strafe)*speed;
    let nx=state.cam.x+dx,nz=state.cam.z+dz,near=state.corals.some(c=>Math.hypot(c.x-nx,c.z-nz)<.68*c.size);
    if(Math.hypot(nx,nz)<11.2&&!near){state.cam.x=nx;state.cam.z=nz}else if(near&&state.now-(state.lastCollision||0)>1.3){state.health=Math.max(0,state.health-3);state.lastCollision=state.now;showToast('Coral contact · move around the colony  −3','#ffab92');beep(160,.12);if(state.health<=0)finish(false)}
  }
  background(state.now,true);drawSeabed();
  let visible=[];
  for(let c of state.corals){let p=project(c);if(p)visible.push({kind:'coral',item:c,p})}
  for(let q of state.pieces){if(q.taken)continue;let p=project(q);if(p)visible.push({kind:'plastic',item:q,p})}
  visible.sort((a,b)=>b.p.d-a.p.d);
  for(let e of visible){let {p,item}=e;if(e.kind==='coral'){
      let sc=p.scale*item.size;groundShadow(p.x,p.y,37*sc,8*sc,.38);ctx.globalAlpha=clamp(1-p.d/21,.4,1);coral(p.x,p.y,sc,item.color,item.type,.96);ctx.globalAlpha=1;
    }else{let x=p.x+Math.sin(item.seed)*6*p.scale,y=p.y-12*p.scale;groundShadow(p.x,p.y+5*p.scale,19*p.scale,5*p.scale,.48);
      drawPlastic(x,y,p.scale*1.25,item.type,Math.sin(state.now*.7+item.seed)*.12);
      
    }}
  let haze=ctx.createRadialGradient(640,430,140,640,430,690);haze.addColorStop(0,'#00182700');haze.addColorStop(1,'#00172689');ctx.fillStyle=haze;ctx.fillRect(0,0,W,H);
  if(state.sonar>0)for(let q of state.pieces){if(q.taken)continue;let p=project(q);if(!p)continue;let sx=p.x+Math.sin(q.seed)*6*p.scale,sy=p.y-12*p.scale;ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle='#a1ffe1';ctx.lineWidth=2;ctx.shadowColor='#4bfbc4';ctx.shadowBlur=13;ctx.beginPath();ctx.arc(sx,sy,24+p.scale*12,0,TAU);ctx.stroke();ctx.restore()}
  drawCompass();drawReticle();drawCrabDashboard();drawRadar();
  if(state.grip){state.grip.t+=dt;let f=clamp(state.grip.t/.45,0,1);let x=640+(state.grip.x-640)*f,y=685+(state.grip.y-685)*f;
    line(586,680,x-7,y,'#254456',12);line(586,680,x-7,y,'#eca633',6);circle(x,y,10,'#e9f4da');line(x,y,x-13,y-10,'#ef9c26',5);line(x,y,x+12,y-9,'#ef9c26',5);
    if(state.grip.t>.8)state.grip=null
  }
  if(state.sonar>0){let r=(1-state.sonar/3.4)*750;ctx.strokeStyle=`rgba(129,255,220,${state.sonar/3.4*.6})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(640,435,r,0,TAU);ctx.stroke()}
}
function drawCompass(){let x=420,y=104,w=440;roundRect(x,y,w,41,8,'#05283dbb');ctx.strokeStyle='#8ee5dc77';ctx.lineWidth=1;ctx.strokeRect(x,y,w,41);for(let i=-6;i<=6;i++){let a=state.yaw+i*.25,px=W/2+i*32;line(px,115,px,i%2?122:129,'#a6eee2',1);if(i%2===0){let d=(a*180/Math.PI+360)%360;ctx.fillStyle='#b7e4e0';ctx.font='700 9px Outfit';ctx.textAlign='center';ctx.fillText(`${Math.round(d)}°`,px,139)}}ctx.fillStyle='#ffc252';ctx.beginPath();ctx.moveTo(640,105);ctx.lineTo(634,96);ctx.lineTo(646,96);ctx.fill();ctx.textAlign='left';ctx.font='800 11px Outfit';ctx.fillStyle='#bcffe3';ctx.fillText('360° PANORAMA',x+11,y-9)}
function drawRadar(){
  let x=1167,y=588,r=53;ctx.fillStyle='#062b3edb';ctx.beginPath();ctx.arc(x,y,r+8,0,TAU);ctx.fill();ctx.strokeStyle='#78d8d298';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(x,y,r*.5,0,TAU);ctx.stroke();line(x-r,y,x+r,y,'#8ad3cd44',1);line(x,y-r,x,y+r,'#8ad3cd44',1);
  for(let c of state.corals){let dx=c.x-state.cam.x,dz=c.z-state.cam.z;if(Math.hypot(dx,dz)>9)continue;circle(x+dx*4,y-dz*4,1.5,'#dcab77aa')}
  if(state.sonar>0)for(let q of state.pieces){if(q.taken)continue;circle(x+(q.x-state.cam.x)*4,y-(q.z-state.cam.z)*4,3,'#a4ffdb')}
  ctx.save();ctx.translate(x,y);ctx.rotate(state.yaw);ctx.fillStyle='#ffbb4e';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(-5,6);ctx.lineTo(5,6);ctx.fill();ctx.restore();ctx.fillStyle='#d3f9e7';ctx.textAlign='center';ctx.font='800 9px Outfit';ctx.fillText('SEAFLOOR MAP',x,y-r-14);ctx.textAlign='left'
}
function drawReticle(){let x=state.mouse.x,y=state.mouse.y;ctx.strokeStyle='#d4fff2c5';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,18,.2,2.8);ctx.arc(x,y,18,3.4,6);ctx.stroke();circle(x,y,2,'#fff');let target=nearestPiece(x,y,34);
  if(target){$('aimCaption').classList.remove('hidden');$('aimCaption').style.left=(x/W*100)+'%';$('aimCaption').style.top=(y/H*100)+'%';$('aimCaption').textContent=occluded(target)?'OBSCURED · CIRCLE AROUND CORAL':target.p.d<=3.2?'PLASTIC · CLICK TO GRIP':'PLASTIC · MOVE CLOSER';
    ctx.strokeStyle=occluded(target)?'#ffae72':'#aaffdc';ctx.lineWidth=1;ctx.beginPath();ctx.arc(target.x,target.y,25+target.p.scale*14,0,TAU);ctx.stroke()
  }else $('aimCaption').classList.add('hidden')
}
function drawCrabDashboard(){
  const m=state.motion;
  let moving=Math.max(Math.abs(m.forward),Math.abs(m.strafe),Math.abs(m.turn));
  let retreat=m.forward<-.3,turning=Math.abs(m.turn)>.28||Math.abs(m.strafe)>.4;
  let sprite=retreat?robotImage:turning?robotSide:robotRear;
  if(!(sprite.complete&&sprite.naturalWidth))sprite=robotImage;
  let width=312*(1-.07*m.forward),height=width*(sprite.naturalHeight||566)/(sprite.naturalWidth||850);
  let x=640+m.strafe*20+m.turn*15;
  let foot=698-14*Math.max(0,m.forward)+11*Math.max(0,-m.forward);
  let bob=Math.sin(m.walk)*3.5*moving;
  groundShadow(x,foot+4,139*(1-.08*m.forward),15,.52);
  if(moving>.15){
    for(let i=0;i<7;i++){let phase=(state.now*2.6+i*.13)%1;
      let dx=(i-3)*25+Math.sin(i*9.3)*9,dy=foot-4+phase*28;
      circle(x+dx,dy,Math.max(.5,2.5-phase*2),`rgba(196,225,195,${(1-phase)*moving*.34})`)
    }
  }
  ctx.save();ctx.translate(x,foot+bob);ctx.rotate(m.turn*.045);
  if(turning&&!retreat&&m.turn<0)ctx.scale(-1,1);
  if(sprite.complete&&sprite.naturalWidth)ctx.drawImage(sprite,-width/2,-height,width,height);
  else{ctx.scale(1.2,1.2);crab(0,-60,.75,true)}
  ctx.restore();
  ctx.fillStyle='#d6fff1';ctx.textAlign='center';ctx.font='800 10px Outfit';
  let action=retreat?'REVERSING':turning?'TURNING':m.forward>.3?'MOVING FORWARD':'HOLDING POSITION';
  ctx.fillText(`${action}  ·  GRIPPER RANGE 3m`,640,166);ctx.textAlign='left'
}

function nearestPiece(x,y,r){
  let best=null,dist=r;
  for(let q of state.pieces){if(q.taken)continue;let p=project(q);if(!p)continue;
    let px=p.x+Math.sin(q.seed)*6*p.scale,py=p.y-12*p.scale,d=Math.hypot(px-x,py-y);
    if(d<dist+18*p.scale){dist=d;best={item:q,p,x:px,y:py}}
  }return best
}
function occluded(target){
  return state.corals.some(c=>{let p=project(c);return p&&p.d<target.p.d-.4&&Math.hypot(p.x-target.x,p.y-29*p.scale-target.y)<30*p.scale*c.size})
}
function clickAt(x,y){
  if(state.phase!=='play')return;
  if(state.level===1){if(state.charge<.99){showToast('Net recharging…','#fbd78d');beep(230,.06);return}
    state.charge=0;state.casts++;state.net.push({x:clamp(x,100,1190),y:clamp(y,165,580),r:64,t:0,flight:.5+Math.abs(x-130)/2200,done:false,hits:0});beep(490,.12);ui();return}
  let found=nearestPiece(x,y,34);
  if(found){if(occluded(found)){showToast('Coral blocks the gripper · sidestep with Q / E','#fbd78d');beep(260,.08);return}
    if(found.p.d>3.2){showToast('Out of reach · swim closer with W','#fbd78d');beep(260,.08);return}
    if(state.grip)return;
    state.grip={x:found.x,y:found.y,t:0};found.item.takstartBtnen=true;state.score++;beep(590,.08);setTimeout(()=>beep(880,.1),75);showToast(`Plastic retrieved! ${state.target-state.score} remaining`);ui();if(state.score>=state.target)finish(true)
  }else{let hitCoral=state.corals.some(c=>{let p=project(c);return p&&p.d<=3.4&&Math.hypot(p.x-x,p.y-28*p.scale-y)<32*p.scale*c.size});
    if(hitCoral){state.health-=6;state.wrong++;showToast('Careful! Live coral is fragile · −6 health','#ff9b87');beep(170,.14,'triangle');if(state.health<=0)finish(false)}else{showToast('No plastic in the gripper · rotate and scan','#b9ebe5');beep(280,.05)}ui()}
}
function update(dt){state.now+=dt;if(state.toastUntil<state.now)$('toast').classList.add('hidden');if(state.phase!=='play')return;state.time-=dt;if(state.level===1)state.charge=clamp(state.charge+dt/1.55,0,1);else{state.sonar=Math.max(0,state.sonar-dt);state.sonarCooldown=Math.max(0,state.sonarCooldown-dt)}if(state.time<=0){state.time=0;finish(false)}ui()}
function render(dt){if(state.phase==='play'){if(state.level===1)levelOne(dt);else levelTwo(dt)}else{background(state.now,state.level===2);for(let i=0;i<26;i++)coral(i*58+Math.sin(i)*22,665,(i%4+3)*.18,palette[i%palette.length],i%3,.82);for(let i=0;i<8;i++){let x=(i*183+state.now*9)%1370-30,y=240+i*39;fish({x,y,r:15,type:i===4?'turtle':'fish',color:palette[i%6],phase:i})}crab(1000,518,1.1)}bubbles(dt)}
function loop(now){let dt=Math.min(.05,(now-last)/1000);last=now;update(dt);render(dt);requestAnimationFrame(loop)}
function pointer(e){let r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
canvas.addEventListener('pointermove',e=>{let p=pointer(e);state.mouse=p;if(state.drag&&state.level===2&&state.phase==='play'){let delta=e.clientX-state.dragX;state.yaw=wrap(state.yaw-delta*.006);state.motion.drag=clamp(-delta*.035,-1,1);state.dragX=e.clientX}});
canvas.addEventListener('pointerdown',e=>{if(state.phase!=='play')return;let p=pointer(e);state.mouse=p;state.drag=state.level===2;state.dragX=e.clientX;state.dragStartX=e.clientX;state.dragStartY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointerup',e=>{if(state.phase!=='play')return;let p=pointer(e);state.drag=false;if(Math.hypot(e.clientX-state.dragStartX,e.clientY-state.dragStartY)<8)clickAt(p.x,p.y)});
window.addEventListener('keydown',e=>{let k=e.key.toLowerCase();if([' ','arrowleft','arrowright','arrowup','arrowdown'].includes(k))e.preventDefault();state.keys[k]=true;if(k===' '&&state.phase==='play'&&state.level===2&&!e.repeat){if(state.sonarCooldown<=0){state.sonar=3.4;state.sonarCooldown=7;showToast('SONAR PULSE · concealed plastic highlighted');beep(360,.35,'sine');ui()}else showToast('Sonar charging…','#fbd78d')}if(k==='f'&&state.level===2&&state.phase==='play')clickAt(640,360)});
window.addEventListener('keyup',e=>state.keys[e.key.toLowerCase()]=false);
$('startBtn').onclick=()=>{beep(520,.08);briefing(1)};
$('playBtn').onclick=()=>{initLevel(state.level);beep(650,.12)};
$('nextBtn').onclick=()=>{if(state.finishReason==='complete')state.level===1?briefing(2):briefing(1);else briefing(state.level)};
$('soundBtn').onclick=()=>{state.sound=!state.sound;$('soundBtn').textContent=state.sound?'♫':'♪';$('soundBtn').style.color=state.sound?'#ffbf54':'#9de5de';beep(570,.08)};
ui();requestAnimationFrame(loop);
})();


