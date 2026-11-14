  (() => {
    'use strict';
    const canvas=document.querySelector('#scene');
    const intro=document.querySelector('#intro'), ending=document.querySelector('#ending');
    const chapter=document.querySelector('#chapter'), timer=document.querySelector('#timer');
    const hint=document.querySelector('#hint'), pips=[...document.querySelectorAll('.pip')];
    const keys=new Set(), solids=[], guests=[], lights=[], beams=[], strobePanels=[];
    window.clubAudioFrame=window.clubAudioFrame||null;
    const player={x:0,z:-2.5,angle:0,pitch:0,radius:.29};
    const signals=[{x:-5,z:-8,got:false},{x:3,z:-15,got:false},{x:-5,z:-28,got:false}];
    const colors=[0xffbc52,0xdf8644,0x7199ee,0xe5d6ac,0x9cafa3];
    let playing=false, elapsed=0, pulse=0, softMode=true, dancing=false, drinks=0, jumpTime=-1, seatedAtBar=false, tipsiness=0, sipsLeft=6;
    let last=0, scene, camera, renderer, floor, messageUntil=0, moving=false;
    let clockTime=0, crouch=0, beatCount=0, rhythmEnergy=0, rhythmCombo=0, lastRhythmBeat=-Infinity, lastRhythmTime=-Infinity;
    const score=createScore({player,signals,isPlaying:()=>playing});
    const materialCache=new Map();
    const unitBox=new THREE.BoxGeometry(1,1,1);
    const limbShape=new THREE.CylinderGeometry(.065,.085,1,4,1);
    const headShape=new THREE.CylinderGeometry(.10,.13,.57,4,1);
    const torsoShape=new THREE.CylinderGeometry(.26,.145,.72,4,1);
    const hipShape=new THREE.BoxGeometry(.32,.19,.23);
    const jointShape=new THREE.IcosahedronGeometry(.09,0);
    const lampMaterial=new THREE.MeshBasicMaterial({color:0xcaff82});
    const ghostMaterials=[0x00ffe8,0xff21d4].map(color=>new THREE.MeshBasicMaterial({
      color,wireframe:true,transparent:true,opacity:.2,depthWrite:false
    }));
    function getMaterial(color,emission=0){
      const key=`${color}/${emission}`;
      if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({
        color,roughness:.91,metalness:.08,flatShading:true,emissive:color,emissiveIntensity:emission
      }));
      return materialCache.get(key);
    }
    function addBox(x,y,z,width,height,depth,color,emission=0,parent=scene){
      const mesh=new THREE.Mesh(unitBox,getMaterial(color,emission));
      mesh.position.set(x,y,z);mesh.scale.set(width,height,depth);parent.add(mesh);
      return mesh;
    }
    function addSolid(x,z,width,depth,height,color,y=height/2){
      const mesh=addBox(x,y,z,width,height,depth,color);
      solids.push({minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2});
      return mesh;
    }
    function addStrip(x,y,z,width,depth,color){
      const mesh=new THREE.Mesh(unitBox,new THREE.MeshBasicMaterial({color}));
      mesh.position.set(x,y,z);mesh.scale.set(width,.035,depth);scene.add(mesh);return mesh;
    }
    function makeTiles(base,accent){
      const tile=document.createElement('canvas');tile.width=tile.height=128;
      const brush=tile.getContext('2d');brush.fillStyle=base;brush.fillRect(0,0,128,128);
      brush.fillStyle=accent;brush.fillRect(0,0,64,64);brush.fillRect(64,64,64,64);
      brush.strokeStyle='#43504b';brush.lineWidth=1;
      for(const edge of [0,64,128]){brush.beginPath();brush.moveTo(edge,0);brush.lineTo(edge,128);brush.stroke();brush.beginPath();brush.moveTo(0,edge);brush.lineTo(128,edge);brush.stroke();}
      const texture=new THREE.CanvasTexture(tile);texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(10,16);
      texture.magFilter=THREE.NearestFilter;return texture;
    }
    function addSign(text,x,y,z,color=0xffbc52,width=2.6,angle=0){
      const surface=document.createElement('canvas');surface.width=768;surface.height=192;
      const brush=surface.getContext('2d');brush.fillStyle='#080b0a';brush.fillRect(0,0,768,192);
      brush.strokeStyle=`#${color.toString(16).padStart(6,'0')}`;brush.lineWidth=6;brush.strokeRect(8,8,752,176);
      brush.fillStyle=brush.strokeStyle;brush.font='bold 76px monospace';brush.textAlign='center';brush.textBaseline='middle';brush.fillText(text,384,100);
      const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:texture}));
      sign.position.set(x,y,z);sign.rotation.y=angle;scene.add(sign);return sign;
    }
    function buildRoom(){
      floor=new THREE.Mesh(new THREE.PlaneGeometry(20,32),new THREE.MeshStandardMaterial({
        map:makeTiles('#1a1c22','#565550'),roughness:.9,metalness:.1
      }));
      floor.rotation.x=-Math.PI/2;floor.position.set(0,0,-16);scene.add(floor);
      addBox(0,4.62,-16,20,.18,32,0x131118);
      // Wall meshes and collision bounds are created by the same operation.
      addSolid(-10.15,-16,.3,32.6,4.7,0x2b2334);
      addSolid(10.15,-16,.3,32.6,4.7,0x262a2a);
      addSolid(0,.15,20,.3,4.7,0x24202b);
      addSolid(0,-32.15,20,.3,4.7,0x273033);
      addSolid(-8.4,-24,3.2,.25,4.7,0x33313f);
      addSolid(3.4,-24,13.2,.25,4.7,0x33313f);
      addBox(-5,3.65,-24,3.6,2.1,.25,0x33313f);
      // The bathroom doorway is a genuine 3.6 m gap, with an overhead lintel.
      for(const x of [-6.8,-3.2])addStrip(x,2.6,-23.82,.055,.12,0x6dffe3);
      addSign('RESTROOM',-5,3,-23.82,0x7199ee,2.3);
      addSign('DANCE FLOOR',4.2,3.5,-23.8,0xff70df,3.2);
      addSign('EXIT',0,2.7,-.02,0xffbc52,2.1,Math.PI);
      for(const x of [-9.9,9.9]){
        addStrip(x,.08,-12,.035,24,0x3d9b8e);
        addStrip(x,3.7,-12,.06,24,0xf861e4);
      }
      for(const [x,z] of [[-3,-10],[6,-10],[-3,-18],[6,-18]]){
        addSolid(x,z,.55,.55,4.6,0x282331);
        addStrip(x,1.2,z,.58,.58,0x7199ee);addStrip(x,3.4,z,.58,.58,0xdf8644);
      }
      for(let depth=4;depth<24;depth+=4){
        addBox(0,4.3,-depth,20,.1,.12,0x55505d);
        addStrip(-1,4.21,-depth,2.2,.08,depth%8?0xdf8644:0x7199ee);
      }
      buildBar();buildBathroom();buildBooth();buildLights();
    }
    function buildBar(){
      addSolid(-8.05,-8,1.25,8,1.08,0x392742);
      addBox(-8.05,1.12,-8,1.46,.12,8.2,0x989888);
      addStrip(-7.39,.87,-8,.04,8,0xdf8644);
      addSign('BAR',-8.5,3.05,-12.4,0xdf8644,2.2);
      addBox(-9.83,1.65,-8,.2,.1,7.5,0x554354);
      for(let index=0;index<16;index++){
        const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.28+(index%3)*.08,5),getMaterial(colors[index%5],.35));
        bottle.position.set(-9.55,1.87,-4.7-index*.44);scene.add(bottle);
      }
      for(const z of [-5,-8,-11]){
        addSolid(-6.7,z,.5,.5,.63,0x535045);
        addBox(-6.7,.67,z,.65,.1,.65,0xd7cbb5);
      }
      for(const z of [-7.7,-8.3]){
        const glass=new THREE.Mesh(new THREE.CylinderGeometry(.075,.05,.22,8,1,true),new THREE.MeshStandardMaterial({color:0xb9ffe9,transparent:true,opacity:.55,side:THREE.DoubleSide,roughness:.15}));
        glass.position.set(-7.65,1.29,z);scene.add(glass);
        const liquid=new THREE.Mesh(new THREE.CylinderGeometry(.065,.045,.12,8),getMaterial(0xffb539,.3));liquid.position.set(-7.65,1.25,z);scene.add(liquid);
      }
      addGuest(-8.85,-9.8,14,true);
    }
    function buildBathroom(){
      const bathFloor=new THREE.Mesh(new THREE.PlaneGeometry(20,7.9),new THREE.MeshStandardMaterial({color:0xabb6ad,roughness:.8}));
      bathFloor.rotation.x=-Math.PI/2;bathFloor.position.set(0,.006,-28.05);scene.add(bathFloor);
      addStrip(0,4.3,-28,12,.13,0xb4ffe9);
      addSign('BREATHE',-5,2.7,-31.97,0x8cffe1,3);
      // Open stalls, shallow sinks and a metal mirror leave a continuous aisle.
      for(const x of [-1,2,5])addSolid(x,-30.1,.12,3.8,2.2,0x63746d);
      for(const x of [.5,3.5]){
        addSolid(x,-31,.62,.82,.5,0xdee8d8);
        addBox(x,.78,-31.65,.65,.9,.25,0xdde4d6);
      }
      addSolid(8.8,-28,1.35,4.9,.85,0x93b3a4);
      for(const z of [-26.5,-28,-29.5]){
        addBox(8.7,.9,z,1.16,.15,.9,0xd3eee1);
        addBox(9.1,1.1,z,.08,.27,.08,0x89bcb1);
      }
      addBox(9.97,2,-28,.035,1.6,4.8,0x668b91,.18);
      addSign('WATER',9.94,3,-28,0xb5ffed,2.1,-Math.PI/2);
      const light=new THREE.PointLight(0x9effd9,30,13,2);light.position.set(-3,3.6,-28);scene.add(light);
    }
    function buildBooth(){
      addSolid(3,-22,5,1.5,1.1,0x2a2338);
      addBox(3,1.15,-22,5.1,.1,1.6,0x63516d);
      addStrip(3,.8,-21.23,4.8,.04,0xffbc52);
      for(const x of [-.4,6.4]){
        addSolid(x,-22.5,1,1,2.6,0x191a23);
        for(const y of [.55,1.45,2.15]){
          const speaker=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.035,12),getMaterial(0x4b4855));
          speaker.rotation.x=Math.PI/2;speaker.position.set(x,y,-21.98);scene.add(speaker);
        }
      }
      const dj=addGuest(3,-23.05,8,true);
      dj.role='dj';dj.root.rotation.y=0;dj.root.scale.set(1.04,1.12,.95);
      dj.body.rotation.x=.16;dj.head.rotation.set(.25,-.12,0);
      dj.leftArm.pivot.rotation.set(-1.25,-.3,-.16);
      dj.rightArm.pivot.rotation.set(-1.08,.25,.2);
      dj.leftArm.elbow.rotation.x=-.7;dj.rightArm.elbow.rotation.x=-.95;
      // Faceted hands rest over the mixer; the figure remains fixed behind the decks.
      for(const arm of [dj.leftArm,dj.rightArm])addPart(new THREE.BoxGeometry(.11,.065,.18),getMaterial(0x7199ee,.3),0,-.32,.04,arm.elbow);
      const band=new THREE.Mesh(new THREE.TorusGeometry(.16,.025,4,8,Math.PI),getMaterial(0x242030,.1));
      band.position.y=.1;dj.head.add(band);
      for(const x of [-.15,.15])addPart(new THREE.BoxGeometry(.055,.13,.12),getMaterial(0xdf8644,.35),x,.04,0,dj.head);
      for(const x of [1.7,3,4.3])addBox(x,1.23,-21.8,.7,.06,.5,0x11151b,.12);
    }
    function buildLights(){
      scene.add(new THREE.HemisphereLight(0xdec9ff,0x283a37,1.25));
      for(const [x,z,color] of [[-5,-7,0xffa62e],[6,-13,0x537bea],[-4,-21,0xffe5ae]]){
        const light=new THREE.PointLight(color,55,15,2);light.position.set(x,3.7,z);scene.add(light);lights.push(light);
        addStrip(x,4.15,z,1.2,.12,color);
        const beam=new THREE.Mesh(new THREE.ConeGeometry(1.7,4.1,4,1,true),new THREE.MeshBasicMaterial({
          color,transparent:true,opacity:.045,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending
        }));
        beam.position.set(x,2.08,z);scene.add(beam);beams.push(beam);
      }
      const fill=new THREE.DirectionalLight(0xd4e8ff,1.2);fill.position.set(0,4,4);scene.add(fill);
    }
    function addPart(shape,material,x,y,z,parent,outlined=false){
      const mesh=new THREE.Mesh(shape,material);mesh.position.set(x,y,z);parent.add(mesh);
      if(outlined){
        const lines=new THREE.LineSegments(new THREE.EdgesGeometry(shape,25),new THREE.LineBasicMaterial({color:0xb8ffe1,transparent:true,opacity:.55}));
        mesh.add(lines);
      }
      return mesh;
    }
    function addLimb(parent,x,y,z,upperLength,lowerLength,material){
      const pivot=new THREE.Group();pivot.position.set(x,y,z);parent.add(pivot);
      const upper=addPart(limbShape,material,0,-upperLength/2,0,pivot);upper.scale.y=upperLength;
      const elbow=new THREE.Group();elbow.position.y=-upperLength;pivot.add(elbow);
      addPart(jointShape,material,0,0,0,elbow);
      const lower=addPart(limbShape,material,0,-lowerLength/2,0,elbow);lower.scale.set(.83,lowerLength,.83);
      return {pivot,elbow};
    }
    function addGuest(x,z,index,stationary=false){
      const root=new THREE.Group();root.position.set(x,0,z);scene.add(root);
      const body=new THREE.Group();body.position.y=1.05;root.add(body);
      const coat=getMaterial(colors[index%colors.length],.24);
      const skin=coat;
      const trousers=coat;
      const torso=addPart(torsoShape,coat,0,.31,0,body);torso.rotation.y=Math.PI/4;
      addPart(hipShape,trousers,0,-.09,0,body);
      const head=addPart(headShape,skin,0,.97,0,body);head.scale.set(1,1,1);head.rotation.x=-.12;
      const leftArm=addLimb(body,-.23,.58,0,.35,.32,coat);
      const rightArm=addLimb(body,.23,.58,0,.35,.32,coat);
      const leftLeg=addLimb(body,-.12,-.15,0,.42,.4,trousers);
      const rightLeg=addLimb(body,.12,-.15,0,.42,.4,trousers);
      const ghosts=ghostMaterials.map((material,offset)=>{
        const echo=new THREE.Group();echo.position.x=(offset?1:-1)*.065;body.add(echo);
        const chest=addPart(torsoShape,material,0,.25,0,echo);chest.rotation.y=Math.PI/4;
        addPart(headShape,material,0,.7,0,echo);return echo;
      });
      const guest={x,z,index,root,body,head,leftArm,rightArm,leftLeg,rightLeg,ghosts,stationary,shared:false,radius:.27};
      // Back-facing shells provide a luminous silhouette while preserving solid facets.
      const surfaces=[];body.traverse(object=>{if(object.isMesh&&!ghosts.some(e=>e===object.parent))surfaces.push(object);});
      const haloMaterial=new THREE.MeshBasicMaterial({color:colors[(index+2)%colors.length],side:THREE.BackSide,transparent:true,opacity:.38,depthWrite:false});
      surfaces.forEach(part=>{const halo=new THREE.Mesh(part.geometry,haloMaterial);halo.scale.setScalar(1.12);part.add(halo);});
      if(stationary){root.rotation.y=Math.PI/2;leftArm.pivot.rotation.x=-.45;rightArm.pivot.rotation.x=-.45;leftArm.elbow.rotation.x=-1.1;rightArm.elbow.rotation.x=-1.1;}
      root.rotation.y=stationary?Math.PI/2:index*2.37;root.scale.setScalar(.91+(index%4)*.045);guests.push(guest);return guest;
    }
    function buildGuests(){
      const places=[[-4,-7],[-1,-6],[2,-7],[5,-6.5],[7.8,-8],[-4.8,-12],[-1,-11],[1.7,-10],[4,-11.7],[7.8,-12.7],[-5.2,-16],[-.7,-15],[1.6,-16.7],[4.5,-15.2],[8,-17],[-1.2,-19],[1,-19.8],[4,-19.4],[-6,-19.8],[-.3,-8.2],[3.6,-8.7],[7.5,-20]];
      places.forEach(([x,z],index)=>addGuest(x,z,index));
      for(const [index,z] of [-5,-11].entries()){
        const guest=addGuest(-6.7,z,30+index,true);guest.seated=true;guest.radius=.34;
        guest.root.rotation.y=-Math.PI/2;guest.body.position.y=.86;
        for(const leg of [guest.leftLeg,guest.rightLeg]){leg.pivot.rotation.x=-Math.PI/2;leg.elbow.rotation.x=Math.PI/2;}
        for(const arm of [guest.leftArm,guest.rightArm]){arm.pivot.rotation.x=-.5;arm.elbow.rotation.x=-.8;}
        guest.head.rotation.x=.12;
      }
    }
    function rhythmMultiplier(combo){return Math.min(4,1+Math.floor(Math.max(0,combo)/10));}
    function animateGuest(guest,time){
      if(guest.stationary)return;
      const external=window.clubAudioFrame;
      const multiplier=rhythmMultiplier(rhythmCombo);
      const expression=softMode?1:1+(multiplier-1)*.16;
      const cadence=softMode?2:[2,2,3,4][multiplier-1];
      const step=(playing?beatCount:time*132/60)*cadence+guest.index%4;
      const frame=Math.floor(step), transition=Math.min(1,(step-frame)/(softMode?.45:[.32,.22,.12,.06][multiplier-1]));
      const blend=transition*transition*(3-2*transition);
      const phase=(frame-1+blend)*Math.PI/2;
      const poses=[-1,.3,1,-.45,-.8,.65,.15,1];
      const pose=offset=>{const shift=Math.round(offset/(Math.PI/2)), current=((frame+shift)%8+8)%8,previous=(current+7)%8;return poses[previous]*(1-blend)+poses[current]*blend;};
      const strength=expression;
      const distance=Math.hypot(player.x-guest.x,player.z-guest.z);
      const presence=Math.max(0,1-distance/7)*.3;
      const facing=Math.atan2(player.x-guest.x,player.z-guest.z);
      guest.root.rotation.y+=Math.atan2(Math.sin(facing-guest.root.rotation.y),Math.cos(facing-guest.root.rotation.y))*Math.min(1,presence*.16);
      guest.body.position.y=1.05+pose(Math.PI/2)*.12*strength;
      guest.body.rotation.z=pose(0)*(.28+.15*presence)*strength;
      guest.body.rotation.y=pose(Math.PI/2)*(.5+.35*presence)*strength;
      guest.head.rotation.z=pose(.5)*.13*expression;guest.head.rotation.y=pose(Math.PI)*.24*expression;
      guest.leftArm.pivot.rotation.set(pose(0)*(.85+.3*presence)*expression,0,-.3-pose(Math.PI/2)*(.85+.3*presence)*expression);
      guest.rightArm.pivot.rotation.set(-pose(Math.PI/2)*(.85+.3*presence)*expression,0,.3+pose(0)*(.85+.3*presence)*expression);
      guest.leftArm.elbow.rotation.x=-.9-pose(Math.PI/2)*.65;
      guest.rightArm.elbow.rotation.x=-.9-pose(Math.PI)*.65;
      guest.leftLeg.pivot.rotation.x=pose(0)*.5*strength;
      guest.rightLeg.pivot.rotation.x=-pose(0)*.5*strength;
      guest.leftLeg.elbow.rotation.x=Math.max(0,-pose(0))*.65*strength;
      guest.rightLeg.elbow.rotation.x=Math.max(0,pose(0))*.65*strength;
      guest.ghosts.forEach((echo,index)=>{echo.visible=false;echo.position.x=(index?1:-1)*(.06+Math.abs(pose(0))*.09);});
      if(guest.shared)guest.body.rotation.y+=Math.sin(phase*1.5)*.18;
    }
    function findContact(point,box,radius){
      const nearX=Math.max(box.minX,Math.min(box.maxX,point.x));
      const nearZ=Math.max(box.minZ,Math.min(box.maxZ,point.z));
      const dx=point.x-nearX,dz=point.z-nearZ,distance=Math.hypot(dx,dz);
      if(distance>=radius)return null;
      if(distance>1e-9)return {x:dx/distance*(radius-distance),z:dz/distance*(radius-distance)};
      const faces=[{depth:point.x-box.minX,x:-1,z:0},{depth:box.maxX-point.x,x:1,z:0},
        {depth:point.z-box.minZ,x:0,z:-1},{depth:box.maxZ-point.z,x:0,z:1}];
      faces.sort((a,b)=>a.depth-b.depth);
      return {x:faces[0].x*(faces[0].depth+radius),z:faces[0].z*(faces[0].depth+radius)};
    }
    function resolvePosition(point,obstacles=solids,people=guests){
      // Iterating contacts resolves two faces at a corner without changing wall bounds.
      for(let pass=0;pass<6;pass++){
        let corrected=false;
        for(const box of obstacles){
          const contact=findContact(point,box,player.radius);
          if(contact){point.x+=contact.x;point.z+=contact.z;corrected=true;}
        }
        for(const guest of people){
          const dx=point.x-guest.x,dz=point.z-guest.z,distance=Math.hypot(dx,dz),separation=player.radius+guest.radius;
          if(distance>=separation)continue;
          point.x+=(distance>1e-9?dx/distance:1)*(separation-distance);
          point.z+=(distance>1e-9?dz/distance:0)*(separation-distance);corrected=true;
        }
        if(!corrected)break;
      }
      return point;
    }
    function movePlayer(dx,dz,obstacles=solids,people=guests){
      // Substeps are smaller than both the player radius and the thinnest wall.
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));
      for(let step=0;step<steps;step++){
        player.x+=dx/steps;player.z+=dz/steps;resolvePosition(player,obstacles,people);
      }
    }
    function readMovement(forward,side,angle){
      const length=Math.hypot(forward,side)||1;
      return {x:(forward*Math.sin(angle)+side*Math.cos(angle))/length,
        z:(-forward*Math.cos(angle)+side*Math.sin(angle))/length};
    }
    let beatGuide;
    function updateBeatGuide(){
      if(!beatGuide){beatGuide=document.createElement('div');beatGuide.id='beat-guide';beatGuide.innerHTML='<i></i><span>SPACE</span>';document.querySelector('main').append(beatGuide);}
      beatGuide.style.display=playing?'flex':'none';
      const ext=window.clubAudioFrame,phase=ext?.active?ext.phase/(Math.PI*2):beatCount;
      const bpm=ext?.active?(ext.bpm||120):132;
      const ready=!ext?.active||ext.ready;
      const distance=Math.abs(phase-Math.round(phase));
      const hitWindow=distance*60/bpm<=.15;
      beatGuide.classList.toggle('on-beat',ready&&hitWindow);
      beatGuide.querySelector('i').style.transform=`scale(${.6+(1-distance*2)*.4})`;
      beatGuide.querySelector('span').textContent=ready?`SPACE · ×${rhythmMultiplier(rhythmCombo)}`:'SYNC…';
    }
    function rhythmHit(phase,bpm,lastBeat){
      const beat=Math.round(phase),error=Math.abs(phase-beat)*60/bpm;
      return {beat,hit:error<=.15&&beat!==lastBeat,duplicate:beat===lastBeat};
    }
    function tapRhythm(){
      dancing=true;
      const external=window.clubAudioFrame;
      const bpm=external?.active?(external.bpm||120):132;
      const phase=external?.active?external.phase/(Math.PI*2):beatCount;
      if(external?.active&&!external.ready){showMessage('Listening for the beat…');return;}
      const result=rhythmHit(phase,bpm,lastRhythmBeat);
      if(result.duplicate)return;
      if(result.beat-lastRhythmBeat>1)rhythmCombo=0;
      if(result.hit){
        lastRhythmBeat=result.beat;
        rhythmCombo++;rhythmEnergy=Math.min(1,rhythmEnergy+.13);lastRhythmTime=elapsed;
        showMessage(`×${rhythmMultiplier(rhythmCombo)} · ${rhythmCombo} consecutive beats · Space: keep the rhythm · B: stop`,1.4);
      }else{rhythmCombo=0;rhythmEnergy=Math.max(0,rhythmEnergy-.18);showMessage(phase<result.beat?'Early · wait for the ring':'Late · try the next ring',1);}
    }
    function showMessage(message,duration=5){hint.textContent=message;messageUntil=elapsed+duration;}
    function nearestGuest(){
      return guests.filter(guest=>!guest.stationary).reduce((near,guest)=>{
        const distance=Math.hypot(player.x-guest.x,player.z-guest.z);
        return distance<1.9&&(!near||distance<near.distance)?{guest,distance}:near;
      },null);
    }
    function drinkCup(){
      if(!drinks){showMessage('Your glass is empty. E at the bar to order.');return;}
      if(elapsed<sipUntil)return;
      sipUntil=elapsed+.85;sipsLeft--;tipsiness=Math.min(1,tipsiness+.22);
      if(sipsLeft===0){drinks--;sipsLeft=6;}
      showMessage(drinks?`A sip. ${sipsLeft} sips left · Q: drink`:'Glass empty. E or click at the bar for another.');
    }
    function leaveSeat(){seatedAtBar=false;player.x=-5.75;player.z=-8;}
    function interact(){
      if(seatedAtBar){drinks=Math.min(3,drinks+1);showMessage('A fresh glass. Q: sip · X: stand up');return;}
      if(player.x<-5.5&&player.x>-7.35&&player.z<-3.5&&player.z>-12.5){
        drinks=2;sipsLeft=6;showMessage('Two drinks. Approach someone and press E to share.');score.resonate();return;
      }
      if(player.z<-24.5){showMessage('Breathe. Cold water, still light. The dance floor continues outside.');pulse=.25;return;}
      const near=nearestGuest();
      if(near){
        near.guest.shared=true;dancing=true;score.resonate();
        if(drinks>0){drinks--;sipsLeft=6;showMessage(`You share a drink and dance together. Remaining: ${drinks}.`);}
        else showMessage('They follow your rhythm. Space to dance · walk to stop.');
      }else showMessage('BAR on the left · RESTROOM at the back · E near someone to say hello.');
    }
    function updateHints(){
      if(elapsed<messageUntil)return;
      if(seatedAtBar){hint.textContent='E: order a glass · Q: sip · X: stand up';return;}
      if(Math.hypot(player.x+6.7,player.z+8)<1.65){hint.textContent='Empty stool · X: sit · E / click: get drinks';return;}
      if(dancing){hint.textContent='Dancing · B to stop · Space on the beat · WASD to walk';return;}
      if(player.z<-24.5){hint.textContent='RESTROOM · E: breathe · return through the lit doorway';return;}
      if(player.x<-5.5&&player.z<-3.5&&player.z>-12.5){hint.textContent='BAR · E: get drinks · Q: sip';return;}
      if(nearestGuest()){hint.textContent=drinks?'E: share a drink · Space: dance / tap beat':'E: say hello · Space: dance / tap beat';return;}
      hint.textContent='C: crouch · Space: dance / tap beat · WASD: walk · Shift: run · M: music source · Q: drink · mouse / drag: look · J/R: turn · E / click: interact · Space: dance / tap beat · L: lights';
    }
    function updatePlayer(dt){
      const forward=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
      const side=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      player.angle+=(Number(keys.has('r'))-Number(keys.has('j')))*dt*1.6;
      const movement=readMovement(forward,side,player.angle);moving=Boolean(forward||side);
      const crouching=keys.has('c');
      crouch+=((crouching?1:0)-crouch)*(1-Math.exp(-dt*14));
      const speed=crouching?1.35:keys.has('shift')?5.6:3.1;
      if(moving&&seatedAtBar)leaveSeat();
      if(moving){movePlayer(movement.x*dt*speed,movement.z*dt*speed);dancing=false;}
      const dancePhase=window.clubAudioFrame?.active?window.clubAudioFrame.phase:elapsed*13.82;
      const jump=jumpTime<0?0:Math.sin(Math.min(1,jumpTime/.72)*Math.PI)*.72;
      if(jumpTime>=0){jumpTime+=dt;if(jumpTime>=.72)jumpTime=-1;}
      const bob=moving?Math.abs(Math.sin(elapsed*13))*.075:dancing?Math.sin(dancePhase)*.08:0;
      const sway=moving?Math.sin(elapsed*6.5)*.035:dancing?Math.sin(dancePhase*.5)*.06:0;
      tipsiness=Math.max(0,tipsiness-dt*.012);
      const dizzy=softMode?0:tipsiness;
      camera.position.set(player.x,(seatedAtBar?1.45:1.64)-crouch*.7+jump+bob,player.z);
      canvas.style.filter=tipsiness>0.01?`blur(${(tipsiness*(softMode?.65:4.2)).toFixed(2)}px)`:'';
      camera.rotation.set(player.pitch+Math.sin(elapsed*.85)*dizzy*.065,-player.angle+Math.sin(elapsed*.6)*dizzy*.055,sway+Math.sin(elapsed*1.2)*dizzy*.105,'YXZ');
    }
    function updateWorld(dt){
      if(!playing)return;
      if(window.clubAudioFrame?.active)beatCount=window.clubAudioFrame.phase/(Math.PI*2);else beatCount+=dt*132/60;
      if(elapsed-lastRhythmTime>1.2){rhythmEnergy=Math.max(0,rhythmEnergy-dt*.18);rhythmCombo=0;}
      elapsed+=dt;pulse=Math.max(0,pulse-dt*1.4);updatePlayer(dt);
      for(const [index,signal] of signals.entries()){
        if(!signal.got&&Math.hypot(signal.x-player.x,signal.z-player.z)<1.65){
          signal.got=true;pips[index].classList.add('on');pulse=.7;score.resonate();
        }
      }
      chapter.textContent=`${player.z<-24.1?'restroom':player.x<-5.5&&player.z>-13?'bar':'dance floor'} · ${softMode?'gentle lights':'strobe'} · ×${rhythmMultiplier(rhythmCombo)}${drinks?' · '+drinks+' glasses · '+sipsLeft+'/6 sips':''}`;
      timer.textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;
      updateHints();
    }
    let heldDrink;
    let sipUntil=0;
    function updateHeldDrink(){
      if(!heldDrink){
        heldDrink=new THREE.Group();camera.add(heldDrink);scene.add(camera);
        const skin=new THREE.MeshStandardMaterial({color:0x89e6d1,roughness:.7});
        const forearm=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,.36,5),skin);
        forearm.position.set(.04,-.16,.08);forearm.rotation.x=-.55;heldDrink.add(forearm);
        const palm=new THREE.Mesh(new THREE.BoxGeometry(.13,.12,.10),skin);palm.position.set(.025,-.03,.04);heldDrink.add(palm);
        const glass=new THREE.Mesh(new THREE.CylinderGeometry(.075,.055,.23,10,1,true),new THREE.MeshStandardMaterial({color:0xcaffed,transparent:true,opacity:.45,side:THREE.DoubleSide,roughness:.1,depthWrite:false}));
        glass.position.y=.05;heldDrink.add(glass);
        const liquid=new THREE.Mesh(new THREE.CylinderGeometry(.065,.05,.14,10),new THREE.MeshStandardMaterial({color:0xffb52a,emissive:0x9b4200,emissiveIntensity:.25}));
        liquid.position.y=.02;heldDrink.add(liquid);
      }
      const sipping=elapsed<sipUntil;
      heldDrink.visible=playing&&(drinks>0||sipping);
      heldDrink.position.set(sipping?.06:.28,sipping?-.12:-.32,sipping?-.26:-.48);
      heldDrink.rotation.set(sipping?.65:0,0,Math.sin(elapsed*3)*.025);
    }
    function updateLights(){
      const phase=beatCount%2;
      const flash=playing&&!softMode&&phase<.18?1:0;
      lights.forEach(light=>{light.intensity=softMode?45:28+flash*(65+rhythmEnergy*90);});
      beams.forEach(beam=>{beam.material.opacity=softMode?.025:.025+rhythmEnergy*.085;});
      renderer.toneMappingExposure=softMode?1.12:1.12+rhythmEnergy*.25;
    }
    let bathroomScreen,clubScreen,screenSurface,screenBrush,screenTexture,videoTexture,screenVideo;
    function updateScreen(){
      if(!clubScreen){
        screenSurface=document.createElement('canvas');screenSurface.width=768;screenSurface.height=432;
        screenBrush=screenSurface.getContext('2d');screenTexture=new THREE.CanvasTexture(screenSurface);screenTexture.colorSpace=THREE.SRGBColorSpace;
        clubScreen=new THREE.Mesh(new THREE.PlaneGeometry(8,4.5),new THREE.MeshBasicMaterial({map:screenTexture,toneMapped:false}));
        clubScreen.scale.setScalar(.7);clubScreen.position.set(3.8,2.7,-23.77);scene.add(clubScreen);
        bathroomScreen=new THREE.Mesh(new THREE.PlaneGeometry(8,4.5),clubScreen.material);
        bathroomScreen.position.set(-5,2.7,-31.9);bathroomScreen.scale.setScalar(.42);scene.add(bathroomScreen);
      }
      const video=window.clubProjectionCanvas;
      const external=window.clubAudioFrame?.active&&video&&window.clubAudioFrame.ready;
      if(external){
        if(screenVideo!==video||!videoTexture){videoTexture?.dispose();screenVideo=video;videoTexture=new THREE.CanvasTexture(video);videoTexture.colorSpace=THREE.SRGBColorSpace;}
        if(clubScreen.material.map!==videoTexture){clubScreen.material.map=videoTexture;clubScreen.material.needsUpdate=true;}
        videoTexture.needsUpdate=true;const aspect=video.width/Math.max(1,video.height);clubScreen.scale.set(.7,.7*(16/9)/aspect,1);bathroomScreen.scale.set(.42,.42*(16/9)/aspect,1);
        return;
      }
      if(videoTexture){videoTexture.dispose();videoTexture=null;screenVideo=null;}
      if(clubScreen.material.map!==screenTexture){clubScreen.material.map=screenTexture;clubScreen.material.needsUpdate=true;}
      clubScreen.scale.setScalar(.7);bathroomScreen.scale.setScalar(.42);
      const c=screenBrush,t=softMode?0:clockTime*.15;c.fillStyle='#090516';c.fillRect(0,0,768,432);c.save();c.translate(384,216);
      for(let ring=5;ring>0;ring--)for(let part=0;part<12;part++){
        c.save();c.rotate(part*Math.PI/6+t*(ring%2?1:-1));c.fillStyle=['#dbaf65','#4969b0','#e2d9b6','#8e6242'][ring%4];
        c.beginPath();c.moveTo(ring*31,0);c.lineTo(ring*47,38+Math.sin(t)*12);c.lineTo(ring*55,0);c.lineTo(ring*47,-38-Math.sin(t)*12);c.closePath();c.fill();c.restore();
      }
      c.restore();screenTexture.needsUpdate=true;
    }
    let floorGlow;
    function updateFloorEffects(){
      if(!floorGlow){
        const material=new THREE.ShaderMaterial({
          transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
          uniforms:{phase:{value:0},energy:{value:0},gentle:{value:1}},
          vertexShader:`varying vec2 floorUv;void main(){floorUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader:`
            varying vec2 floorUv;uniform float phase;uniform float energy;uniform float gentle;
            void main(){
              vec2 p=(floorUv-.5)*vec2(20.,24.);
              vec2 grid=abs(fract(p*.5)-.5);
              float seams=1.-smoothstep(.012,.04,min(grid.x,grid.y));
              float distanceFromBooth=length(p-vec2(2.,8.));
              float ringPhase=fract(distanceFromBooth*.18-phase*.16);
              float rings=(1.-smoothstep(.035,.11,abs(ringPhase-.5)))*(1.-gentle);
              float diagonal=pow(.5+.5*sin(p.x*.9+p.y*.7-phase*.7),12.)*(1.-gentle);
              vec3 cyan=vec3(.95,.61,.16),pink=vec3(.19,.32,.72);
              vec3 color=mix(cyan,pink,.5+.5*sin(distanceFromBooth*.5-phase*.2));
              float edge=smoothstep(0.,.04,floorUv.x)*smoothstep(0.,.04,1.-floorUv.x)*smoothstep(0.,.04,floorUv.y)*smoothstep(0.,.04,1.-floorUv.y);
              float strength=seams*.18+rings*(.18+energy*.35)+diagonal*.12;
              gl_FragColor=vec4(color,edge*strength*mix(1.,.28,gentle));
            }`,
        });
        floorGlow=new THREE.Mesh(new THREE.PlaneGeometry(19.9,23.8),material);
        floorGlow.rotation.x=-Math.PI/2;floorGlow.position.set(0,.014,-12);scene.add(floorGlow);
      }
      floorGlow.material.uniforms.phase.value=softMode?0:beatCount;
      floorGlow.material.uniforms.energy.value=rhythmEnergy;
      floorGlow.material.uniforms.gentle.value=softMode?1:0;
    }
    let wallTexture,wallBrush,wallTick=-1;
    function updateWallEffects(){
      if(!wallTexture){
        const surface=document.createElement('canvas');surface.width=512;surface.height=256;
        wallBrush=surface.getContext('2d');wallTexture=new THREE.CanvasTexture(surface);wallTexture.colorSpace=THREE.SRGBColorSpace;
        const material=new THREE.MeshBasicMaterial({map:wallTexture,transparent:true,opacity:.68,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
        for(const x of [-9.96,9.96])for(const z of [-16]){
          const panel=new THREE.Mesh(new THREE.PlaneGeometry(31.9,4.45),material);
          panel.position.set(x,2.3,z);panel.rotation.y=x<0?Math.PI/2:-Math.PI/2;scene.add(panel);
        }
        const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(16,20),material);ceiling.rotation.x=Math.PI/2;ceiling.position.set(0,4.49,-12);scene.add(ceiling);
      }
      const frame=Math.floor(clockTime*20);if(frame===wallTick)return;wallTick=frame;
      const c=wallBrush,t=softMode?0:clockTime*(.45+rhythmEnergy*.7);c.fillStyle='#090b1d';c.fillRect(0,0,512,256);
      const palette=['#e7ba65','#6289db','#f0e4c4'];
      for(let echo=2;echo>=0;echo--){
        c.strokeStyle=palette[echo];c.lineWidth=softMode?1:2+rhythmEnergy*3;c.globalAlpha=softMode?.2:.7;
        for(let ring=0;ring<14;ring++){
          const radius=12+ring*25+(t*18)%25;c.beginPath();
          for(let corner=0;corner<=4;corner++){const angle=corner*Math.PI/2+Math.sin(t*.4)*.3;const x=256+Math.cos(angle)*radius+echo*5,y=128+Math.sin(angle)*radius*.65+Math.sin(t+ring*.3)*12;corner?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
        }
      }
      c.globalAlpha=1;wallTexture.needsUpdate=true;
    }
    function resizeScene(){
      const bounds=canvas.getBoundingClientRect();
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(bounds.width,bounds.height,false);
      camera.aspect=bounds.width/Math.max(1,bounds.height);camera.updateProjectionMatrix();
    }
    function drawFrame(time){
      const dt=Math.min(.08,Math.max(0,(time-last)/1000||0));last=time;
      if(!document.hidden){
        clockTime+=dt;updateWorld(dt);
        guests.forEach(guest=>animateGuest(guest,clockTime));updateLights();updateScreen();updateWallEffects();updateFloorEffects();updateHeldDrink();updateBeatGuide();
        renderer.render(scene,camera);
      }
      requestAnimationFrame(drawFrame);
    }
    function requestLook(){
      canvas.focus();
      if(!canvas.requestPointerLock)return;
      try{
        const request=canvas.requestPointerLock();
        if(request&&request.catch)request.catch(()=>showMessage('Drag over the club to look · J/R also turn.'));
      }catch(error){showMessage('Drag over the club to look · J/R also turn.');}
    }
    function start(soft=true){
      softMode=soft||matchMedia('(prefers-reduced-motion: reduce)').matches;
      playing=true;rhythmEnergy=0;rhythmCombo=0;lastRhythmBeat=-Infinity;lastRhythmTime=-Infinity;seatedAtBar=false;tipsiness=0;elapsed=0;beatCount=0;pulse=0;dancing=false;drinks=0;sipsLeft=6;sipUntil=0;jumpTime=-1;crouch=0;keys.clear();
      Object.assign(player,{x:0,z:-2.5,angle:0,pitch:0});
      signals.forEach(signal=>signal.got=false);pips.forEach(pip=>pip.classList.remove('on'));
      intro.classList.add('hidden');ending.classList.add('hidden');document.querySelector('main').classList.add('active');
      showMessage('WASD: walk · click: capture mouse · Esc: release · BAR on the left',6);
      if(!window.clubAudioFrame?.active)score.start();
      requestLook();
    }
    function readKey(event){return event.code.startsWith('Key')?event.code.slice(3).toLowerCase():event.key.toLowerCase();}
    function handleKey(event){
      if(event.target.matches('input,button,textarea,select')||!playing)return;
      const key=readKey(event);
      if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))event.preventDefault();
      if(!event.repeat){
        if(key==='l'){softMode=!softMode;showMessage(softMode?'Gentle mode · flashes off':'Strobes active · L to disable');}
        if(key==='m'){keys.clear();window.openClubMusicSource?.();return;}
        if(key==='e')interact();
        if(key==='q')drinkCup();
        if(key==='x'){if(seatedAtBar)leaveSeat();else if(Math.hypot(player.x+6.7,player.z+8)<1.65){seatedAtBar=true;dancing=false;player.x=-6.7;player.z=-8;player.angle=-Math.PI/2;showMessage('E: order · Q: sip · X: stand up');}}
        if(key===' ')tapRhythm();
        if(key==='b'){dancing=!dancing;score.resonate();showMessage(dancing?'Dancing · walk to stop':'Walking again.');}
      }
      keys.add(key);
    }
    function bindControls(){
      window.addEventListener('club-audio-source',event=>{
        if(event.detail?.external)score.stop(false);
        else if(playing)score.start();
      });
      document.querySelector('#begin').addEventListener('click',()=>start(false));
      document.querySelector('#begin-soft').addEventListener('click',()=>start(true));
      document.querySelector('#again').addEventListener('click',()=>start(softMode));
      addEventListener('keydown',handleKey);
      addEventListener('keyup',event=>keys.delete(readKey(event)));
      let dragging=false,lastX=0,lastY=0,clickX=0,clickY=0;
      canvas.addEventListener('click',event=>{if(playing&&event.button===0&&Math.hypot(event.clientX-clickX,event.clientY-clickY)<6)interact();});
      canvas.addEventListener('pointerdown',event=>{
        if(!playing)return;clickX=event.clientX;clickY=event.clientY;dragging=true;lastX=event.clientX;lastY=event.clientY;
        canvas.setPointerCapture(event.pointerId);requestLook();
      });
      canvas.addEventListener('pointermove',event=>{
        if(!playing||document.pointerLockElement===canvas||!dragging)return;
        player.angle+=(event.clientX-lastX)*.003;
        player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-(event.clientY-lastY)*.003));
        lastX=event.clientX;lastY=event.clientY;
      });
      for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>dragging=false);
      document.addEventListener('mousemove',event=>{
        if(!playing||document.pointerLockElement!==canvas)return;
        player.angle+=event.movementX*.0024;
        player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-event.movementY*.0024));
      });
      document.addEventListener('pointerlockchange',()=>{keys.clear();dragging=false;});
      for(const [id,key] of [['move-forward','w'],['move-back','s'],['move-left','a'],['move-right','d']]){
        const button=document.getElementById(id);
        button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);keys.add(key);});
        for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(key));
      }
      for(const event of ['blur','pagehide'])addEventListener(event,()=>{keys.clear();dragging=false;});
      document.addEventListener('visibilitychange',()=>{keys.clear();last=performance.now();});
      addEventListener('resize',resizeScene);
    }
    function bootScene(){
      try{
        renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
        renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
        scene=new THREE.Scene();scene.background=new THREE.Color(0x08080e);scene.fog=new THREE.FogExp2(0x11101b,.026);
        camera=new THREE.PerspectiveCamera(72,1,.045,65);camera.position.set(0,1.64,-2.5);
        buildRoom();buildGuests();bindControls();resizeScene();requestAnimationFrame(drawFrame);
      }catch(error){
        console.error(error);chapter.textContent='WebGL unavailable';
        document.querySelector('.lede').textContent='Could not start the 3D scene. Open in a browser with WebGL and hardware acceleration enabled.';
        document.querySelectorAll('.start').forEach(button=>button.disabled=true);
      }
    }
    bootScene();
  })();
