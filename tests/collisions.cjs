'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const THREE=require('../vendor/three.min.js');
const controls=new Map();
function control(selector){
  if(!controls.has(selector))controls.set(selector,{textContent:'',value:'.55',classList:{add(){},remove(){}},addEventListener(){},setAttribute(){}});
  return controls.get(selector);
}
const document={querySelector:control,querySelectorAll:()=>[control('pip1'),control('pip2'),control('pip3')],addEventListener(){},
  createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){}})})};
const sandbox={THREE,document,console,window:{},performance:{now:()=>0},setTimeout,clearTimeout,setInterval,clearInterval};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/audio.js'),'utf8'),sandbox);
const source=fs.readFileSync(path.join(__dirname,'../src/engine.js'),'utf8');
const instrumented=source.replace('    bootScene();',`    globalThis.game={player,solids,guests,movePlayer,readMovement,resolvePosition,findContact,
      createWorld(){scene=new THREE.Scene();camera=new THREE.PerspectiveCamera();buildRoom();buildGuests();return scene;},
      animate(time){guests.forEach(guest=>animateGuest(guest,time));},animateGuest,updateVisualMusic,
      updateHearts,get danceHearts(){return danceHearts;},get danceGuest(){return danceGuest;},setDancing(value){dancing=value;},activateControl,interact,drinkCup,updateBathroom,updateCigarette,readRoomDistance,get cigarette(){return cigarette;},get smoker(){return smoker;}, get tipsiness(){return tipsiness;},get bathroomAction(){return bathroomAction;}, get drinks(){return drinks;},get dancing(){return dancing;},
      advance(seconds){elapsed+=seconds;return elapsed;},
      stick,gyro,stickPush,readGyro,turnView,setPlaying(value){playing=value;}};`);
vm.runInContext(instrumented,sandbox);
const game=sandbox.game;
const scene=game.createWorld();
function position(x,z){game.player.x=x;game.player.z=z;}
function near(value,expected,tolerance=1e-6){assert.ok(Math.abs(value-expected)<tolerance,`${value} should equal ${expected}`);}
function clearOfWalls(){
  for(const box of game.solids){
    const x=Math.max(box.minX,Math.min(box.maxX,game.player.x));
    const z=Math.max(box.minZ,Math.min(box.maxZ,game.player.z));
    assert.ok(Math.hypot(game.player.x-x,game.player.z-z)>=.29-1e-7,'player intersects solid');
  }
}
let passed=0;
function check(name,run){run();passed++;console.log('PASS '+name);}
check('the entrance leads from the vestibule through the passage onto the floor',()=>{
  assert.ok(game.player.z>5);
  game.movePlayer(-game.player.x,0);game.movePlayer(0,-9);
  assert.ok(game.player.z<0);clearOfWalls();
  game.movePlayer(0,15);near(game.player.z,8.11);clearOfWalls();
});
check('the joystick ignores its dead zone and scales its push',()=>{
  Object.assign(game.stick,{x:.1,y:0});near(game.stickPush(),0);
  Object.assign(game.stick,{x:.575,y:0});near(game.stickPush(),.5);
  Object.assign(game.stick,{x:0,y:-1});near(game.stickPush(),1);
  Object.assign(game.stick,{x:0,y:0});
});
check('the gyroscope turns and tilts the view from where it was switched on',()=>{
  game.setPlaying(true);Object.assign(game.player,{angle:1,pitch:0});
  Object.assign(game.gyro,{on:true,calibrate:true,yawOffset:0,pitchOffset:0});
  game.readGyro({alpha:40,beta:90,gamma:0});near(game.player.angle,1,1e-6);near(game.player.pitch,0,1e-6);
  game.readGyro({alpha:130,beta:90,gamma:0});near(game.player.angle,1-Math.PI/2,1e-6);
  game.readGyro({alpha:40,beta:120,gamma:0});near(game.player.pitch,Math.PI/6,1e-6);
  game.turnView(.25,0);game.readGyro({alpha:40,beta:120,gamma:0});near(game.player.angle,1.25,1e-6);
  game.gyro.on=false;game.setPlaying(false);
});
check('walking diagonally slides along the exterior wall',()=>{
  position(9,-3);game.movePlayer(4,-4);near(game.player.x,9.71);near(game.player.z,-7);clearOfWalls();
});
check('a 200-metre displacement cannot tunnel through a wall',()=>{
  position(0,-2);game.movePlayer(200,0);near(game.player.x,9.71);near(game.player.z,-2);clearOfWalls();
});
check('moving into an outside corner stays in the room',()=>{
  position(9,-1);game.movePlayer(20,20);near(game.player.x,9.71);near(game.player.z,-.29);clearOfWalls();
});
check('bathroom doorway is traversable in both directions',()=>{
  position(-5,-22);game.movePlayer(0,-7);near(game.player.z,-29);clearOfWalls();
  game.movePlayer(0,7);near(game.player.z,-22);clearOfWalls();
});
check('bathroom divider blocks movement away from the doorway',()=>{
  position(-8,-22);game.movePlayer(0,-5);near(game.player.z,-23.585);clearOfWalls();
});
check('the bar approach remains accessible and offers drinks',()=>{
  position(-5.5,-3);game.movePlayer(0,-3);near(game.player.z,-6);
  game.movePlayer(-1.3,0);near(game.player.x,-6.8);game.interact();assert.equal(game.drinks,1);game.interact();assert.equal(game.drinks,1);clearOfWalls();
});
check('bar counter stops the player at the actual counter face',()=>{
  position(-6.8,-6);game.movePlayer(-3,0);near(game.player.x,-7.135);clearOfWalls();
});
check('diagonal collision with an obstacle slides around its corner',()=>{
  const box={minX:0,maxX:1,minZ:0,maxZ:1};
  position(-.8,-1);game.movePlayer(3,1.6,[box],[]);
  assert.ok(game.player.x>1.29,'player should slide beyond the corner');
  const closestX=Math.max(0,Math.min(1,game.player.x)),closestZ=Math.max(0,Math.min(1,game.player.z));
  assert.ok(Math.hypot(game.player.x-closestX,game.player.z-closestZ)>=.29-1e-7);
});
check('movement follows camera orientation and diagonal speed is normalized',()=>{
  let vector=game.readMovement(1,0,0);near(vector.x,0);near(vector.z,-1);
  vector=game.readMovement(0,1,Math.PI/2);near(vector.x,0);near(vector.z,1);
  vector=game.readMovement(1,0,Math.PI/2);near(vector.x,1);near(vector.z,0);
  vector=game.readMovement(1,1,0);near(Math.hypot(vector.x,vector.z),1);
});
check('guests have solid personal space and articulated bodies',()=>{
  const guest=game.guests.filter(guest=>!guest.stationary&&!guest.smoker).sort((a,b)=>b.z-a.z)[0];
  position(guest.x,guest.z+.65);
  game.movePlayer(0,-.65);near(Math.hypot(game.player.x-guest.x,game.player.z-guest.z),.56);
  assert.ok(guest.leftArm.elbow.children.length>0);assert.ok(guest.leftLeg.elbow.children.length>0);
  const before=guest.leftArm.elbow.rotation.x;game.animate(1.27);assert.notEqual(guest.leftArm.elbow.rotation.x,before);
});
check('sharing a drink triggers a dance without a countdown ending',()=>{
  game.interact();assert.equal(game.drinks,0);assert.equal(game.dancing,true);
  const recipient=game.guests.find(guest=>guest.cup?.visible);
  assert.ok(recipient,'recipient visibly holds the glass');
  assert.equal(recipient.cup.parent,recipient.rightArm.elbow);
  const drinkUntil=recipient.drinkUntil;
  game.interact();assert.equal(game.drinks,0,'one glass allows only one gift');
  assert.equal(recipient.drinkUntil,drinkUntil,'empty hands cannot start another drink');
  game.animate(1);assert.equal(recipient.rightArm.pivot.rotation.x,-2.3);
  game.advance(4);game.animate(4);assert.equal(recipient.cup.visible,false);
  game.setDancing(false);game.activateControl('e');assert.equal(game.drinks,0);
  assert.equal(game.dancing,false,'interacting empty-handed does not start a dance');
  assert.equal(recipient.cup.visible,false,'no second glass appears after the first is finished');
  assert.equal(game.advance(36000),36004);
  assert.ok(!source.includes('function finish('));
});
check('world builds true meshes with finite geometry bounds',()=>{
  let count=0;scene.traverse(node=>{if(node.isMesh){count++;assert.ok(node.geometry?.isBufferGeometry);node.geometry.computeBoundingSphere();assert.ok(Number.isFinite(node.geometry.boundingSphere.radius));}});
  assert.ok(count>300);assert.ok(game.guests.length>=21&&game.guests.length<=37);
  console.log(`  ${count} meshes, ${game.solids.length} colliders, ${game.guests.length} articulated figures`);
});
console.log(`${passed} checks passed`);

check("seated guests and other staff retain fixed poses across beats",()=>{const fixed=game.guests.filter(g=>g.stationary&&g.role!=='dj');assert.equal(fixed.filter(g=>g.seated).length,2);const snapshot=()=>JSON.stringify(fixed.map(g=>[g.root.rotation.toArray(),g.body.position.toArray(),g.leftArm.pivot.rotation.toArray(),g.leftLeg.pivot.rotation.toArray()]));const before=snapshot();game.animate(20);game.animate(44);assert.equal(snapshot(),before);});

check('seated guests and staff never display wireframe echoes',()=>{
  const fixed=game.guests.filter(guest=>guest.stationary);
  assert.ok(fixed.length>0);
  for(const guest of fixed){
    for(const echo of guest.ghosts)assert.equal(echo.visible,false);
  }
  game.animate(60);
  for(const guest of fixed){
    for(const echo of guest.ghosts)assert.equal(echo.visible,false);
  }
});

check('water and toilets reduce drunkenness only after a completed nearby action',()=>{
  position(-6,-8);game.interact();game.drinkCup();
  near(game.tipsiness,.22);
  position(0,-26);game.interact();assert.equal(game.bathroomAction,null);
  position(7.7,-28);game.interact();
  assert.equal(game.bathroomAction.spot.kind,'water');
  game.interact();game.advance(1);game.updateBathroom();near(game.tipsiness,.22);
  position(5,-27);game.updateBathroom();assert.equal(game.bathroomAction,null);near(game.tipsiness,.22);
  position(7.7,-28);game.interact();game.advance(2);game.updateBathroom();near(game.tipsiness,0);
  game.drinkCup();game.advance(1);game.drinkCup();near(game.tipsiness,.44);
  position(.5,-30.05);game.interact();assert.equal(game.bathroomAction.spot.kind,'toilet');
  game.advance(3.5);game.updateBathroom();near(game.tipsiness,0);
  assert.equal(game.bathroomAction,null);
});

check('toilet water receives a gradual stream independent of the camera',()=>{
  position(.5,-30.05);game.player.angle=0;game.player.pitch=0;game.interact();
  const spot=game.bathroomAction.spot,water=spot.water;
  near(water.position.x,.5);near(water.position.y,.43);near(water.position.z,-30.9);
  game.advance(.1);game.updateBathroom();
  const drops=spot.particles.children,drop=drops[0];
  const initial=drops.filter(p=>p.visible).length;
  assert.ok(initial>0&&initial<6);
  const before=drop.position.clone();
  game.player.angle=Math.PI/2;game.player.pitch=.8;game.updateBathroom();
  assert.ok(drop.position.distanceTo(before)<1e-9,'looking around must not redirect flow');
  game.advance(.5);game.updateBathroom();
  assert.ok(drops.filter(p=>p.visible).length>initial,'flow fills in gradually');
  game.advance(.049);game.updateBathroom();
  assert.ok(drop.visible);
  assert.ok(Math.hypot(drop.position.x-water.position.x,drop.position.z-water.position.z)<.04);
  assert.ok(Math.abs(drop.position.y-water.position.y)<.01,'drop lands on the water');
  game.advance(3);game.updateBathroom();assert.equal(spot.particles.visible,false);
});

check('smoking room doorway is traversable and its outer walls contain the player',()=>{
  position(8.8,-8.5);game.movePlayer(5,0);near(game.player.x,13.8);clearOfWalls();
  assert.equal(game.readRoomDistance(),1);
  game.movePlayer(20,0);near(game.player.x,17.86);clearOfWalls();
  game.movePlayer(-9,0);assert.ok(game.player.x<10);clearOfWalls();
  position(9,-6);game.movePlayer(4,0);near(game.player.x,9.71);
});
check('music distance fades in both quiet rooms and clears on the dance floor',()=>{
  position(0,-10);near(game.readRoomDistance(),0);
  position(11,-8.5);near(game.readRoomDistance(),.5);
  position(14,-8.5);near(game.readRoomDistance(),1);
  position(-5,-25);near(game.readRoomDistance(),.5);
  position(-5,-28);near(game.readRoomDistance(),1);
  position(0,-10);near(game.readRoomDistance(),0);
});
check('guests vary in silhouette and all end in hands and feet',()=>{
  const dancers=game.guests.filter(guest=>!guest.stationary&&!guest.smoker);
  const outline=guest=>{let meshes=0;guest.body.traverse(node=>{if(node.isMesh)meshes++;});
    return [meshes,guest.root.scale.x.toFixed(2),guest.leftArm.pivot.position.x.toFixed(3),JSON.stringify(guest.style)].join('/');};
  assert.ok(new Set(dancers.map(outline)).size>=15,'most dancers are told apart by build and dance style');
  for(const guest of game.guests)for(const limb of [guest.leftArm,guest.rightArm,guest.leftLeg,guest.rightLeg])
    assert.ok(limb.elbow.children.length>=3,'joint, lower limb and hand or foot');
});
check('beat and melody drive different dancers independently',()=>{
  const dancers=game.guests.filter(guest=>!guest.stationary&&!guest.smoker);
  const beatGuest=dancers.find(guest=>guest.danceMusic==='beat');
  const melodyGuest=dancers.find(guest=>guest.danceMusic==='melody');
  const pose=guest=>guest.leftArm.pivot.rotation.x;
  const sample=()=>{
    game.updateVisualMusic(1);
    game.animateGuest(beatGuest,1);game.animateGuest(melodyGuest,1);
  };
  const audio=sandbox.window.clubAudioFrame={active:true,phase:2*Math.PI,melody:.2};
  game.setPlaying(true);
  sample();
  const beatPose=pose(beatGuest),melodyPose=pose(melodyGuest);
  audio.melody=.8;sample();
  assert.equal(pose(beatGuest),beatPose);
  const newMelodyPose=pose(melodyGuest);
  assert.notEqual(newMelodyPose,melodyPose);
  audio.phase=3*Math.PI;sample();
  assert.notEqual(pose(beatGuest),beatPose);
  near(pose(melodyGuest),newMelodyPose,1e-6);
  const melodyPoses=[0,.225,.45,.675,.9].map(melody=>{
    audio.melody=melody;sample();
    return [melodyGuest.body.rotation.z,melodyGuest.body.position.y,melodyGuest.head.rotation.y];
  });
  assert.equal(new Set(melodyPoses.map(pose=>pose.map(value=>value.toFixed(2)).join(','))).size,5);
  assert.ok(melodyPoses[1][1]<melodyPoses[0][1]&&melodyPoses[2][1]>melodyPoses[0][1],
    'melodic poses move both down and up as the contour rises');
  sandbox.window.clubAudioFrame=null;game.setPlaying(false);
});
check('the smoker shares a cigarette that lasts six drags and is stubbed out at the door',()=>{
  const smoker=game.smoker;assert.ok(smoker.smoker&&!smoker.stationary);
  position(11,-8.5);game.interact();assert.equal(game.cigarette,0,'too far away to be offered one');
  const glasses=game.drinks;
  position(smoker.x,smoker.z+1.2);game.interact();assert.equal(game.cigarette,6);assert.equal(smoker.shared,true);
  game.interact();assert.equal(game.cigarette,5);
  game.interact();assert.equal(game.cigarette,5,'a drag takes time');
  game.advance(2);game.updateCigarette();game.interact();assert.equal(game.cigarette,4);
  assert.equal(game.drinks,glasses,'smoking never touches the glass');
  const resting=smoker.rightArm.pivot.rotation.x;game.animate(6);game.animate(7);
  assert.ok(smoker.rightArm.pivot.rotation.x<resting-1,'the smoker lifts the cigarette');
  position(9,-8.5);game.updateCigarette();assert.equal(game.cigarette,0);
});

check('DJ mixes with moving hands while staying behind the booth',()=>{
  const dj=game.guests.find(g=>g.role==='dj');
  const position=dj.root.position.toArray();
  game.animate(0);
  const left=dj.leftArm.elbow.rotation.toArray(),right=dj.rightArm.elbow.rotation.toArray();
  game.animate(2);
  assert.notDeepEqual(dj.leftArm.elbow.rotation.toArray(),left);
  assert.notDeepEqual(dj.rightArm.elbow.rotation.toArray(),right);
  assert.deepEqual(dj.root.position.toArray(),position);
});

check('random guests have room to dance without overlapping furniture',()=>{
 const dancers=game.guests.filter(g=>!g.stationary&&!g.smoker);
 assert.ok(dancers.length>=16&&dancers.length<=32);
 for(const [index,g] of dancers.entries()){
  for(const other of dancers.slice(index+1))assert.ok(Math.hypot(g.x-other.x,g.z-other.z)>=1.65);
  for(const box of game.solids)assert.ok(Math.hypot(g.x-Math.max(box.minX,Math.min(box.maxX,g.x)),g.z-Math.max(box.minZ,Math.min(box.maxZ,g.z)))>=.8);
 }
});
check('waiting at a toilet starts automatically and does not repeat until leaving',()=>{
 position(0,-26);game.updateBathroom();
 position(.5,-30.05);game.updateBathroom();assert.equal(game.bathroomAction,null);
 game.advance(1.3);game.updateBathroom();assert.equal(game.bathroomAction.spot.kind,'toilet');
 game.advance(3.6);game.updateBathroom();assert.equal(game.bathroomAction,null);
 game.advance(5);game.updateBathroom();assert.equal(game.bathroomAction,null);
 position(0,-26);game.updateBathroom();position(.5,-30.05);game.updateBathroom();
 game.advance(1.3);game.updateBathroom();assert.equal(game.bathroomAction.spot.kind,'toilet');
 position(0,-26);game.updateBathroom();assert.equal(game.bathroomAction,null);
});
check('dancing near a guest automatically starts a shared dance and hearts fade after leaving',()=>{
 const guest=game.guests.find(g=>!g.stationary&&!g.smoker);
 position(guest.x,guest.z);game.setDancing(false);game.updateHearts();
 assert.equal(game.dancing,false);
 assert.equal(game.danceGuest,null);
 assert.equal(game.danceHearts.length,0);
 game.activateControl('b');game.updateHearts();game.advance(.2);game.updateHearts();
 assert.equal(game.danceGuest,guest);
 assert.ok(game.danceHearts.some(h=>h.mesh.visible&&h.mesh.material.opacity>0));
 position(0,2.5);game.advance(3);game.updateHearts();
 assert.equal(game.danceGuest,null);
 assert.ok(game.danceHearts.every(h=>!h.mesh.visible));
});
