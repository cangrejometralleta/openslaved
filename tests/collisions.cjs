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
      createWorld(){scene=new THREE.Scene();buildRoom();buildGuests();return scene;},
      animate(time){guests.forEach(guest=>animateGuest(guest,time));},
      interact, get drinks(){return drinks;},get dancing(){return dancing;},
      advance(seconds){elapsed+=seconds;return elapsed;}};`);
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
  game.movePlayer(-1.3,0);near(game.player.x,-6.8);game.interact();assert.equal(game.drinks,2);clearOfWalls();
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
  const guest=game.guests.find(guest=>!guest.stationary);position(guest.x,guest.z+2);
  game.movePlayer(0,-2);near(Math.hypot(game.player.x-guest.x,game.player.z-guest.z),.56);
  assert.ok(guest.leftArm.elbow.children.length>0);assert.ok(guest.leftLeg.elbow.children.length>0);
  const before=guest.leftArm.elbow.rotation.x;game.animate(1.27);assert.notEqual(guest.leftArm.elbow.rotation.x,before);
});
check('sharing a drink triggers a dance without a countdown ending',()=>{
  game.interact();assert.equal(game.drinks,1);assert.equal(game.dancing,true);
  assert.equal(game.advance(36000),36000);
  assert.ok(!source.includes('function finish('));
});
check('world builds true meshes with finite geometry bounds',()=>{
  let count=0;scene.traverse(node=>{if(node.isMesh){count++;assert.ok(node.geometry?.isBufferGeometry);node.geometry.computeBoundingSphere();assert.ok(Number.isFinite(node.geometry.boundingSphere.radius));}});
  assert.ok(count>300);assert.equal(game.guests.length,26);
  console.log(`  ${count} meshes, ${game.solids.length} colliders, ${game.guests.length} articulated figures`);
});
console.log(`${passed} checks passed`);

check("seated guests and staff retain fixed poses across beats",()=>{const fixed=game.guests.filter(g=>g.stationary);assert.equal(fixed.filter(g=>g.seated).length,2);const snapshot=()=>JSON.stringify(fixed.map(g=>[g.root.rotation.toArray(),g.body.position.toArray(),g.leftArm.pivot.rotation.toArray(),g.leftLeg.pivot.rotation.toArray()]));const before=snapshot();game.animate(20);game.animate(44);assert.equal(snapshot(),before);});
