const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/engine.js'),'utf8');
const controls=new Map(),calls=[];
function element(id){if(!controls.has(id))controls.set(id,{events:{},addEventListener(event,handler){this.events[event]=handler;}});return controls.get(id);}
const sandbox={window:element('window'),document:{querySelector:element,getElementById:element,addEventListener(){}},canvas:element('canvas'),addEventListener(){},start:mode=>calls.push(mode),softMode:true,handleKey(){},resizeScene(){},keys:new Set()};
vm.runInNewContext(source.slice(source.indexOf('    function bindControls(){'),source.indexOf('    function bootScene(){'))+'\nbindControls();',sandbox);
for(const id of ['#begin','#begin-soft','#again']){assert.equal(typeof element(id).events.click,'function',id+' must handle real click');element(id).events.click();}
assert.deepEqual(calls,[false,true,true]);
for(const file of ['engine.js','audio.js','tab-audio.js'])assert.ok(!fs.readFileSync(require('node:path').join(__dirname,'../src',file),'utf8').includes("'clickk'"));
console.log('PASS entry buttons dispatch click and start the intended mode');
