  (() => {
    'use strict';
    const canvas=document.querySelector('#scene');
    const intro=document.querySelector('#intro'), ending=document.querySelector('#ending');
    const chapter=document.querySelector('#chapter'), timer=document.querySelector('#timer');
    const hint=document.querySelector('#hint'), pips=[...document.querySelectorAll('.pip')];
    const keys=new Set(), solids=[], guests=[], lights=[], beams=[], strobePanels=[];
    window.clubAudioFrame=window.clubAudioFrame||null;
    const entranceSpawn={x:3.8,z:7.4,angle:0,pitch:0};
    const player={...entranceSpawn,radius:.29};
    const signals=[{x:-5,z:-8,got:false},{x:3,z:-15,got:false},{x:-5,z:-28,got:false}];
    const colors=[0xffbc52,0xdf8644,0x7199ee,0xe5d6ac,0x9cafa3];
    let playing=false, elapsed=0, pulse=0, softMode=true, dancing=false, drinks=0, jumpTime=-1, seatedAtBar=false, tipsiness=0, sipsLeft=6;
    let last=0, scene, camera, renderer, floor, messageUntil=0, moving=false;
    let clockTime=0, beatCount=0, rhythmEnergy=0, rhythmCombo=0, lastRhythmBeat=-Infinity, lastRhythmTime=-Infinity;
    const score=createScore({player,signals,isPlaying:()=>playing});
    const materialCache=new Map();
    const unitBox=new THREE.BoxGeometry(1,1,1);
    const limbShape=new THREE.CylinderGeometry(.075,.085,1,12,1);
    const headShape=new THREE.SphereGeometry(1,20,16).scale(.14,.38,.16);
    const torsoShape=new THREE.CylinderGeometry(.24,.145,.72,16,1).scale(1,1,.85);
    const hipShape=new THREE.SphereGeometry(1,16,10).scale(.18,.17,.15);
    const jointShape=new THREE.SphereGeometry(.085,12,8);
    const guestColors=[0xef20df,0xcdff24,0x29f5cb,0xf3eada,0xf44069];
    const guestMaterials=guestColors.map(color=>new THREE.MeshBasicMaterial({color}));
    const shadeMaterials=guestColors.map(color=>new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(.42)}));
    const handShape=new THREE.SphereGeometry(1,10,8).scale(.07,.09,.05);
    const footShape=new THREE.BoxGeometry(.13,.08,.27);
    const straightTorso=new THREE.CylinderGeometry(.2,.185,.72,12,1).scale(1,1,.8);
    const skirtShape=new THREE.CylinderGeometry(.15,.3,.5,14,1).scale(1,1,.85);
    // Headwear is positioned in head space: none, bun, crest, brim, bob.
    const hairShapes=[null,
      new THREE.SphereGeometry(.1,10,8).translate(0,.37,-.07),
      new THREE.ConeGeometry(.1,.3,5).translate(0,.47,0),
      new THREE.CylinderGeometry(.21,.21,.035,14).translate(0,.2,.05),
      new THREE.SphereGeometry(1,12,10).scale(.19,.25,.17).translate(0,.1,-.07)];
    const puffShape=new THREE.IcosahedronGeometry(1,1);
    const smokePuffs=[];
    let smoker=null, cigarette=0, dragUntil=0, exhaled=true;
    const headMaterial=new THREE.MeshStandardMaterial({
      color:0x202a24,roughness:.95,metalness:0,flatShading:false,
      emissive:0x202a24,emissiveIntensity:.18
    });
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
    function buildEntrance(){
      // The front wall opens into a narrow passage and a wider vestibule.
      for(const x of [-5.7,5.7])addSolid(x,.15,8.6,.3,4.7,0x24202b);
      addBox(0,3.65,.15,2.8,2.1,.3,0x22212b);
      addBox(0,-.08,2.5,2.8,.16,5,0x272437);
      addBox(0,2.7,2.5,2.8,.2,5,0x161520);
      for(const x of [-1.5,1.5])addSolid(x,2.5,.2,5,2.8,0x272635);
      addBox(2,-.08,6.7,6.8,.16,3.4,0x262631);
      addBox(2,2.7,6.7,6.8,.2,3.4,0x181822);
      addSolid(3.5,5.1,3.8,.2,2.8,0x292532);
      addSolid(2,8.5,7.2,.2,2.8,0x232330);
      for(const x of [-1.5,5.5])addSolid(x,6.7,.2,3.4,2.8,0x292633);
      const palette=[0xff48ce,0x71f6df,0xf4efbf];
      for(let arch=0;arch<5;arch++){
        const z=.4+arch*1.08,color=palette[arch%palette.length];
        for(const x of [-1.37,1.37])addBox(x,1.32,z,.045,2.55,.055,color,.65);
        addStrip(0,2.58,z,2.76,.08,color);
      }
      addStrip(1.8,.025,6.3,3.7,.07,0xf4efbf);
      addStrip(0,.025,3.15,.07,6.3,0xf4efbf);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.42,.035,8,48),
        new THREE.MeshBasicMaterial({color:0xffdb3f}));
      ring.position.set(3.8,1.65,5.22);scene.add(ring);
      addSign('← CLUB',2.3,1.65,5.22,0x71f6df,1.15);
    }
    function buildRoom(){
      floor=new THREE.Mesh(new THREE.PlaneGeometry(20,32),new THREE.MeshStandardMaterial({
        map:makeTiles('#1a1c22','#565550'),roughness:.9,metalness:.1
      }));
      floor.rotation.x=-Math.PI/2;floor.position.set(0,0,-16);scene.add(floor);
      addBox(0,4.62,-16,20,.18,32,0x131118);
      // Wall meshes and collision bounds are created by the same operation.
      addSolid(-10.15,-16,.3,32.6,4.7,0x2b2334);
      addSolid(10.15,-3.425,.3,7.15,4.7,0x262a2a);
      addSolid(10.15,-21.15,.3,22.3,4.7,0x262a2a);
      addBox(10.15,3.85,-8.5,.3,1.7,3,0x262a2a);
      buildEntrance();
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
      buildBar();buildBathroom();buildSmokingRoom();buildBooth();buildLights();
    }
    function readRoomDistance(){
      const bathroom=Math.max(0,Math.min(1,(-player.z-23.5)/3));
      const smoking=Math.max(0,Math.min(1,(player.x-9.5)/3));
      return Math.max(bathroom,smoking,THREE.MathUtils.clamp(player.z/7,0,1));
    }
    function buildSmokingRoom(){
      addBox(14.2,-.08,-9,8,.16,8,0x171b22);
      addBox(14.2,4.62,-9,8,.18,8,0x11131a);
      addSolid(18.3,-9,.3,8.3,4.7,0x171a21);
      addSolid(14.25,-4.85,8.4,.3,4.7,0x1c2027);
      addSolid(14.25,-13.15,8.4,.3,4.7,0x1c2027);
      for(const z of [-6,-12]){
        addSolid(15.2,z,4,.7,.5,0x292a30);
        addBox(15.2,.9,z+(z===-6?.3:-.3),4,.12,.9,0x282d34);
      }
      addSolid(16,-9,.9,.9,.7,0x343943);
      const ashtray=new THREE.Mesh(new THREE.CylinderGeometry(.15,.12,.045,12),getMaterial(0x5d6570));
      ashtray.position.set(16,.74,-9);scene.add(ashtray);
      addSign('SMOKING ROOM',9.96,3.3,-8.5,0x82958e,2.8,-Math.PI/2);
      addSign('DANCE FLOOR',10.34,3.3,-8.5,0x82958e,2.8,Math.PI/2);
      const lamp=new THREE.PointLight(0xa3bda9,3,7,2);
      lamp.position.set(15,2.8,-9);scene.add(lamp);
      addBox(15,2.9,-9,.3,.08,.3,0x718378,.2);
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
    const bathroomSpots=[];
    const recoveryAmount={water:.3,toilet:.55};
    const recoveryDuration={water:2,toilet:3.5};
    let bathroomAction=null, bathroomWait=null, bathroomDone=null;
    const bathroomDelay=1.2;
    function addBathroomSpot(kind,x,z){
      const particles=new THREE.Group();
      const shape=kind==='water'?new THREE.SphereGeometry(.035,6,4):new THREE.BoxGeometry(.042,.042,.042);
      const material=new THREE.MeshBasicMaterial({
        color:kind==='water'?0x80edff:0xe9ff44,toneMapped:false
      });
      const glow=new THREE.MeshBasicMaterial({
        color:0x3127cc,side:THREE.BackSide,toneMapped:false
      });
      for(let index=0;index<(kind==='water'?14:24);index++){
        const drop=new THREE.Mesh(shape,material);
        if(kind==='toilet'){
          const halo=new THREE.Mesh(new THREE.IcosahedronGeometry(.062,1),glow);drop.add(halo);
        }
        particles.add(drop);
      }
      particles.visible=false;scene.add(particles);
      const spot={kind,x,z,particles};bathroomSpots.push(spot);return spot;
    }
    function buildBathroom(){
      const bathFloor=new THREE.Mesh(new THREE.PlaneGeometry(20,7.9),new THREE.MeshStandardMaterial({color:0x334333,roughness:.8}));
      bathFloor.rotation.x=-Math.PI/2;bathFloor.position.set(0,.006,-28.05);scene.add(bathFloor);
      addStrip(0,4.3,-28,12,.13,0xb4ffe9);
      addSign('BREATHE',-5,2.7,-31.97,0x8cffe1,3);
      // Open stalls, shallow sinks and a metal mirror leave a continuous aisle.
      for(const x of [-1,2,5]){
        addSolid(x,-30.1,.12,3.8,2.2,0x323b32);
        addStrip(x,2.21,-30.1,.15,3.8,0xa1ffbb);
        addBox(x,1.1,-28.18,.14,2.2,.04,0xe449ab,.35);
      }
      for(const x of [.5,3.5]){
        // A dark recessed trough with a broad, luminous rectangular lip.
        const width=1.72, depth=.66, centerZ=-30.9;
        addSolid(x,centerZ,width,depth,.36,0x24283a);
        addBox(x,.69,-31.21,width,.66,.09,0x30352d);
        addBox(x,1.02,-31.21,width,.045,.10,0xa9ffe1,.7);
        addBox(x,.49,-30.59,width,.20,.08,0x32343b);
        addBox(x,.60,-30.59,width,.035,.085,0xf2f2ba,.65);
        for(const side of [-1,1]){
          const edge=x+side*(width-.08)/2;
          addBox(edge,.49,centerZ,.08,.22,depth,0x353c38);
          addBox(edge,.61,centerZ,.08,.035,depth,0xd148ab,.65);
        }
        const water=new THREE.Mesh(new THREE.PlaneGeometry(width-.17,depth-.14),
          new THREE.MeshStandardMaterial({color:0x3f8290,roughness:.2,metalness:.22,
            emissive:0x18303a,side:THREE.DoubleSide}));
        water.rotation.x=-Math.PI/2;water.position.set(x,.43,centerZ);scene.add(water);
        const spot=addBathroomSpot('toilet',x,-30.05);spot.water=water;
        const ripple=new THREE.Mesh(new THREE.RingGeometry(.8,1,20),
          new THREE.MeshBasicMaterial({color:0xbaff9e,transparent:true,depthWrite:false}));
        ripple.rotation.x=-Math.PI/2;ripple.position.copy(water.position);ripple.position.y+=.003;
        ripple.visible=false;scene.add(ripple);spot.ripple=ripple;
      }
      addSolid(8.8,-28,1.35,4.9,.85,0x93b3a4);
      for(const z of [-26.5,-28,-29.5]){
        addBox(8.7,.9,z,1.16,.15,.9,0xd3eee1);
        addBox(9.1,1.1,z,.08,.27,.08,0x89bcb1);
        addBox(8.35,1.06,z,.3,.08,.08,0x89bcb1);
        addBathroomSpot('water',7.7,z);
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
      animateDj(dj,0);
      const band=new THREE.Mesh(new THREE.TorusGeometry(.16,.025,4,8,Math.PI),getMaterial(0x242030,.1));
      band.position.y=.1;dj.head.add(band);
      for(const x of [-.15,.15])addPart(new THREE.BoxGeometry(.055,.13,.12),getMaterial(0xdf8644,.35),x,.04,0,dj.head);
      for(const x of [2.45,3,3.55])addBox(x,1.23,-22.5,.48,.06,.5,0x11151b,.12);
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
    function addLimb(parent,x,y,z,upperLength,lowerLength,material,thick=1,endShape=null,endMaterial=material){
      const pivot=new THREE.Group();pivot.position.set(x,y,z);parent.add(pivot);
      addPart(jointShape,material,0,0,0,pivot);
      const upper=addPart(limbShape,material,0,-upperLength/2,0,pivot);upper.scale.set(thick,upperLength,thick);
      const elbow=new THREE.Group();elbow.position.y=-upperLength;pivot.add(elbow);
      addPart(jointShape,material,0,0,0,elbow);
      const lower=addPart(limbShape,material,0,-lowerLength/2,0,elbow);lower.scale.set(.83*thick,lowerLength,.83*thick);
      if(endShape)addPart(endShape,endMaterial,0,-lowerLength-(endShape===footShape?0:.03),endShape===footShape?.07:0,elbow);
      return {pivot,elbow};
    }
    function readLook(index){
      // A deterministic hash gives every guest a stable silhouette, outfit and way of dancing.
      const pick=(salt,count)=>Math.abs(Math.floor(Math.sin(index*12.9898+salt*78.233)*43758.5453))%count;
      const tone=index%guestColors.length, outfit=pick(1,4);
      return {
        top:outfit===2?shadeMaterials[tone]:guestMaterials[tone],
        bottom:outfit===1?shadeMaterials[tone]:guestMaterials[tone],
        accent:outfit===2?guestMaterials[tone]:shadeMaterials[tone],
        torso:pick(2,3), hair:pick(3,hairShapes.length),
        width:[.9,1,1.13][pick(4,3)], limb:[.82,1,1.18][pick(5,3)], height:.9+pick(6,5)*.04,
        style:{lift:[0,0,.55,1.1][pick(7,4)],bounce:[.7,1,1.35][pick(8,3)],twist:[.6,1,1.3][pick(9,3)],stride:[.6,1,1.25][pick(10,3)]}
      };
    }
    function addGuest(x,z,index,stationary=false,standing=true){
      const root=new THREE.Group();root.position.set(x,0,z);scene.add(root);
      const body=new THREE.Group();body.position.y=1.05;root.add(body);
      const look=readLook(index), skin=headMaterial;
      const torso=addPart(look.torso===1?straightTorso:torsoShape,look.top,0,.31,0,body);torso.scale.x=look.width;
      addPart(hipShape,look.bottom,0,-.055,0,body);
      if(look.torso===2&&standing)addPart(skirtShape,look.top,0,-.16,0,body);
      const head=addPart(headShape,skin,0,1.04,0,body);head.rotation.x=-.12;
      if(hairShapes[look.hair])addPart(hairShapes[look.hair],look.accent,0,0,0,head);
      const shoulder=.23*look.width;
      const leftArm=addLimb(body,-shoulder,.58,0,.35,.32,look.top,look.limb,handShape,skin);
      const rightArm=addLimb(body,shoulder,.58,0,.35,.32,look.top,look.limb,handShape,skin);
      const leftLeg=addLimb(body,-.12,-.15,0,.42,.4,look.bottom,look.limb,footShape,skin);
      const rightLeg=addLimb(body,.12,-.15,0,.42,.4,look.bottom,look.limb,footShape,skin);
      const ghosts=ghostMaterials.map((material,offset)=>{
        const echo=new THREE.Group();echo.visible=false;echo.position.x=(offset?1:-1)*.065;body.add(echo);
        addPart(torsoShape,material,0,.31,0,echo);
        addPart(headShape,material,0,1.04,0,echo);return echo;
      });
      const guest={x,z,index,root,body,head,leftArm,rightArm,leftLeg,rightLeg,ghosts,stationary,style:look.style,shared:false,radius:.27};
      // Back-facing shells provide a luminous silhouette while preserving the continuous body contour.
      const surfaces=[];body.traverse(object=>{if(object.isMesh&&!ghosts.some(e=>e===object.parent))surfaces.push(object);});
      const haloMaterial=new THREE.MeshBasicMaterial({color:0xf1ffe8,side:THREE.BackSide,transparent:true,opacity:.38,depthWrite:false});
      surfaces.forEach(part=>{const halo=new THREE.Mesh(part.geometry,haloMaterial);halo.scale.setScalar(1.12);part.add(halo);});
      if(stationary){root.rotation.y=Math.PI/2;leftArm.pivot.rotation.x=-.45;rightArm.pivot.rotation.x=-.45;leftArm.elbow.rotation.x=-1.1;rightArm.elbow.rotation.x=-1.1;}
      root.rotation.y=stationary?Math.PI/2:index*2.37;root.scale.setScalar(look.height);guests.push(guest);return guest;
    }
    function buildGuests(){
      const count=16+Math.floor(Math.random()*17);
      let added=0;
      for(let attempt=0;added<count&&attempt<1000;attempt++){
        const x=-5+Math.random()*13,z=-5-Math.random()*15;
        const blocked=solids.some(box=>Math.hypot(x-Math.max(box.minX,Math.min(box.maxX,x)),
          z-Math.max(box.minZ,Math.min(box.maxZ,z)))<.8);
        if(blocked||guests.some(guest=>Math.hypot(x-guest.x,z-guest.z)<1.65))continue;
        addGuest(x,z,added++);
      }
      for(const [index,z] of [-5,-11].entries()){
        const guest=addGuest(-6.7,z,30+index,true,false);guest.seated=true;guest.radius=.34;
        guest.root.rotation.y=-Math.PI/2;guest.body.position.y=.86;
        for(const leg of [guest.leftLeg,guest.rightLeg]){leg.pivot.rotation.x=-Math.PI/2;leg.elbow.rotation.x=Math.PI/2;}
        for(const arm of [guest.leftArm,guest.rightArm]){arm.pivot.rotation.x=-.5;arm.elbow.rotation.x=-.8;}
        guest.head.rotation.x=.12;
      }
      buildSmoker();
    }
    function buildSmoker(){
      // The smoker sits on the far bench, facing the room, and keeps a slow cycle of drags.
      smoker=addGuest(14.4,-11.8,41,false,false);smoker.smoker=true;smoker.radius=.3;
      smoker.root.rotation.y=0;smoker.body.position.y=.67;
      for(const leg of [smoker.leftLeg,smoker.rightLeg]){leg.pivot.rotation.x=-Math.PI/2;leg.elbow.rotation.x=Math.PI/2;}
      smoker.leftArm.pivot.rotation.x=-.5;smoker.leftArm.elbow.rotation.x=-.8;
      smoker.cigarette=new THREE.Group();smoker.cigarette.position.set(0,-.4,.03);smoker.rightArm.elbow.add(smoker.cigarette);
      const paper=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,.12,6),new THREE.MeshBasicMaterial({color:0xf4f1e6}));
      paper.rotation.x=Math.PI/2;paper.position.z=.06;smoker.cigarette.add(paper);
      smoker.ember=new THREE.Mesh(new THREE.SphereGeometry(.016,8,6),new THREE.MeshBasicMaterial({color:0xff6a1f}));
      smoker.ember.position.z=.125;smoker.cigarette.add(smoker.ember);
      for(let index=0;index<20;index++){
        const mesh=new THREE.Mesh(puffShape,new THREE.MeshBasicMaterial({color:0xcfdcd5,transparent:true,opacity:0,depthWrite:false}));
        mesh.visible=false;scene.add(mesh);smokePuffs.push({mesh,age:1,life:1,size:.05,vx:0,vy:0,vz:0});
      }
    }
    function emitSmoke(x,y,z,dx,dz,count=4,size=.06){
      for(let made=0;made<count;made++){
        const puff=smokePuffs.find(puff=>puff.age>=puff.life)||smokePuffs[0];
        const drift=made*1.7+x*3.1;
        Object.assign(puff,{age:0,life:2.2+made*.35,size:size*(1+made*.18),
          vx:dx*(.5-made*.07)+Math.sin(drift)*.05,vy:.16+made*.03,vz:dz*(.5-made*.07)+Math.cos(drift)*.05});
        puff.mesh.position.set(x,y,z);puff.mesh.rotation.set(drift,drift*.7,0);
      }
    }
    function updateSmoke(dt){
      for(const puff of smokePuffs){
        if(puff.age>=puff.life){puff.mesh.visible=false;continue;}
        puff.age+=dt;const progress=Math.min(1,puff.age/puff.life),slow=Math.exp(-puff.age*1.3);
        puff.mesh.visible=true;
        puff.mesh.position.x+=puff.vx*slow*dt;puff.mesh.position.y+=puff.vy*dt;puff.mesh.position.z+=puff.vz*slow*dt;
        puff.mesh.rotation.y+=dt*.5;puff.mesh.scale.setScalar(puff.size*(1+progress*2.6));
        puff.mesh.material.opacity=.17*Math.sin(Math.min(1,progress*5)*Math.PI/2)*(1-progress);
      }
    }
    const smokePoint=new THREE.Vector3();
    function animateSmoker(guest,time){
      const cycle=(time+1.5)%7,round=Math.floor((time+1.5)/7);
      const ease=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
      const drag=ease(cycle/.9)*(1-ease((cycle-2.1)/.9));
      guest.rightArm.pivot.rotation.set(-.5-drag*1.8,0,-.08-drag*.17);
      guest.rightArm.elbow.rotation.x=-.8-drag*.4;
      guest.ember.scale.setScalar(1+drag*1.4+Math.sin(time*9)*.12);
      const dx=player.x-guest.x,dz=player.z-guest.z;
      const attention=guest.shared?1:Math.max(0,1-Math.hypot(dx,dz)/4.5);
      const turn=Math.max(-1,Math.min(1,Math.atan2(dx,dz)));
      guest.head.rotation.y+=(turn*attention-guest.head.rotation.y)*.08;
      guest.head.rotation.x=-.05-ease((cycle-2.9)/.5)*(1-ease((cycle-4.2)/.8))*.3;
      guest.body.rotation.x=Math.sin(time*.7)*.025;
      if(cycle>3.1&&guest.puffed!==round){
        guest.puffed=round;guest.head.getWorldPosition(smokePoint);
        const aim=guest.root.rotation.y+guest.head.rotation.y;
        emitSmoke(smokePoint.x+Math.sin(aim)*.2,smokePoint.y-.05,smokePoint.z+Math.cos(aim)*.2,Math.sin(aim),Math.cos(aim),5);
      }
      const wisp=Math.floor(time/1.3);
      if(guest.wisp!==wisp){guest.wisp=wisp;guest.ember.getWorldPosition(smokePoint);emitSmoke(smokePoint.x,smokePoint.y,smokePoint.z,0,0,1,.022);}
    }
    function shareSmoke(){
      if(!cigarette){
        if(Math.hypot(player.x-smoker.x,player.z-smoker.z)>2.4){showMessage('Someone is smoking on the far bench. Walk over · E to join them.');return;}
        cigarette=6;smoker.shared=true;dancing=false;score.resonate();
        showMessage('They tap one out of the pack and light it for you. E / click: take a drag.');return;
      }
      if(elapsed<dragUntil)return;
      dragUntil=elapsed+1.7;exhaled=false;cigarette--;
      showMessage(cigarette?`${cigarette} drags left · E / click: take a drag`:'Last drag. You stub it out in the ashtray · E near them for another.',4);
    }
    function updateCigarette(){
      if(!exhaled&&elapsed>dragUntil-.6){
        exhaled=true;const x=Math.sin(player.angle),z=-Math.cos(player.angle);
        emitSmoke(player.x+x*.4,1.5,player.z+z*.4,x*1.6,z*1.6,5,.05);
      }
      if(cigarette&&player.x<9.6){cigarette=0;showMessage('You stub it out at the door.',3);}
    }
    function rhythmMultiplier(combo){return Math.min(4,1+Math.floor(Math.max(0,combo)/10));}
    function animateDj(guest,time){
      const mix=Math.sin(time*.8),cue=Math.sin(time*1.3);
      guest.body.rotation.x=-.08;
      guest.head.rotation.set(.18+Math.sin(time*2.2)*.035,mix*.12,0);
      guest.leftArm.pivot.rotation.set(-.48,0,-.12+mix*.025);
      guest.leftArm.elbow.rotation.set(-.55, mix*.06,0);
      guest.rightArm.pivot.rotation.set(-.5+cue*.025,0,.12);
      guest.rightArm.elbow.rotation.set(-.52,0,cue*.045);
    }
    function animateGuest(guest,time){
      if(guest.role==='dj'){animateDj(guest,time);return;}
      if(guest.stationary)return;
      if(guest.smoker){animateSmoker(guest,time);return;}
      updateGuestDrink(guest);
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
      const strength=expression,{lift,bounce,twist,stride}=guest.style;
      const distance=Math.hypot(player.x-guest.x,player.z-guest.z);
      const presence=Math.max(0,1-distance/7)*.3;
      const facing=Math.atan2(player.x-guest.x,player.z-guest.z);
      guest.root.rotation.y+=Math.atan2(Math.sin(facing-guest.root.rotation.y),Math.cos(facing-guest.root.rotation.y))*Math.min(1,presence*.16);
      guest.body.position.y=1.05+pose(Math.PI/2)*.12*strength*bounce;
      guest.body.rotation.z=pose(0)*(.28+.15*presence)*strength;
      guest.body.rotation.y=pose(Math.PI/2)*(.5+.35*presence)*strength*twist;
      guest.head.rotation.z=pose(.5)*.13*expression;guest.head.rotation.y=pose(Math.PI)*.24*expression;
      guest.leftArm.pivot.rotation.set(pose(0)*(.85+.3*presence)*expression-lift*1.3,0,-.3-lift*.25-pose(Math.PI/2)*(.85+.3*presence)*expression);
      guest.rightArm.pivot.rotation.set(-pose(Math.PI/2)*(.85+.3*presence)*expression-lift*1.3,0,.3+lift*.25+pose(0)*(.85+.3*presence)*expression);
      guest.leftArm.elbow.rotation.x=-.9-pose(Math.PI/2)*.65;
      guest.rightArm.elbow.rotation.x=-.9-pose(Math.PI)*.65;
      guest.leftLeg.pivot.rotation.x=pose(0)*.5*strength*stride;
      guest.rightLeg.pivot.rotation.x=-pose(0)*.5*strength*stride;
      guest.leftLeg.elbow.rotation.x=Math.max(0,-pose(0))*.65*strength;
      guest.rightLeg.elbow.rotation.x=Math.max(0,pose(0))*.65*strength;
      guest.ghosts.forEach((echo,index)=>{echo.visible=false;echo.position.x=(index?1:-1)*(.06+Math.abs(pose(0))*.09);});
      if(guest.shared)guest.body.rotation.y+=Math.sin(phase*1.5)*.18;
      if(guest.drinkUntil>elapsed){
        guest.rightArm.pivot.rotation.set(-2.3,0,-.25);
        guest.rightArm.elbow.rotation.x=-1.2;
        guest.head.rotation.x=-.18;
      }else guest.head.rotation.x=-.12;
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
      return guests.filter(guest=>!guest.stationary&&!guest.smoker).reduce((near,guest)=>{
        const distance=Math.hypot(player.x-guest.x,player.z-guest.z);
        return distance<1.9&&(!near||distance<near.distance)?{guest,distance}:near;
      },null);
    }
    function drinkCup(){
      if(bathroomAction)return;
      if(!drinks){showMessage('Your glass is empty. E at the bar to order.');return;}
      if(elapsed<sipUntil)return;
      sipUntil=elapsed+.85;sipsLeft--;tipsiness=Math.min(1,tipsiness+.22);
      if(sipsLeft===0){drinks--;sipsLeft=6;}
      showMessage(drinks?`A sip. ${sipsLeft} sips left · Q: drink`:'Glass empty. E or click at the bar for another.');
    }
    const guestDrinkDuration=3;
    function updateGuestDrink(guest){
      if(guest.cup)guest.cup.visible=guest.drinkUntil>elapsed;
    }
    function giveGuestDrink(guest){
      if(guest.drinkUntil>elapsed){showMessage('They are still drinking. Give them a moment.');return;}
      if(!guest.cup){
        guest.cup=new THREE.Mesh(new THREE.CylinderGeometry(.075,.055,.2,8),
          new THREE.MeshBasicMaterial({color:0xffca55}));
        guest.cup.position.set(0,-.34,0);guest.rightArm.elbow.add(guest.cup);
      }
      drinks--;sipsLeft=6;guest.shared=true;guest.drinkUntil=elapsed+guestDrinkDuration;
      guest.cup.visible=true;dancing=true;score.resonate();
      showMessage(`They take your glass and drink. Remaining: ${drinks} · Space: dance together.`);
    }
    function nearestBathroom(){
      return bathroomSpots.find(spot=>Math.hypot(player.x-spot.x,player.z-spot.z)<.95);
    }
    function useBathroom(){
      if(bathroomAction)return;
      const spot=nearestBathroom();
      if(!spot){showMessage('Water fountains on the right · toilets in the rear stalls.');return;}
      const target=spot.water?.position;
      const direction=target?new THREE.Vector3(target.x-player.x,0,target.z-player.z).normalize():null;
      const origin=direction?new THREE.Vector3(player.x+direction.x*.18,.9,player.z+direction.z*.18):null;
      bathroomAction={spot,started:elapsed,origin};bathroomDone=null;dancing=false;
      showMessage(spot.kind==='water'?'Drinking water… stay by the fountain.':'Stay here to finish · look around freely.',
        recoveryDuration[spot.kind]);
    }
    function updateToiletDrop(drop,index,time){
      const flight=.65,spacing=.038,cycle=1.02;
      const offset=Math.floor(index/6)*.25+(index%6)*spacing;
      const born=Math.floor((time-offset)/cycle)*cycle+offset;
      const age=(time-born)/flight;
      drop.visible=born>=0&&born<=recoveryDuration.toilet-flight&&age>=0&&age<=1;
      if(!drop.visible)return;
      const {origin,spot}=bathroomAction,target=spot.water.position;
      const spread=.025;
      const arc=4*age*(1-age);
      const sweep=Math.sin(born*5.4)*.17;
      drop.position.set(
        THREE.MathUtils.lerp(origin.x,target.x+Math.sin(index*2.4)*spread,age)+arc*sweep,
        THREE.MathUtils.lerp(origin.y,target.y,age)+arc*(.17+.06*Math.cos(born*3)),
        THREE.MathUtils.lerp(origin.z,target.z+Math.cos(index*2.4)*spread,age)
      );
      const size=.55+.45*Math.min(1,born/.8);
      drop.scale.setScalar(size);
    }
    function updateBathroom(){
      const nearby=nearestBathroom();
      if(nearby!==bathroomDone)bathroomDone=null;
      if(!nearby||moving){bathroomWait=null;}
      else if(!bathroomAction&&nearby!==bathroomDone){
        if(bathroomWait?.spot!==nearby)bathroomWait={spot:nearby,started:elapsed};
        if(elapsed-bathroomWait.started>=bathroomDelay)useBathroom();
      }
      if(!bathroomAction)return;
      const {spot,started}=bathroomAction,progress=(elapsed-started)/recoveryDuration[spot.kind];
      if(Math.hypot(player.x-spot.x,player.z-spot.z)>=.95){
        if(spot.ripple)spot.ripple.visible=false;
        spot.particles.visible=false;bathroomAction=null;showMessage('Action cancelled.');return;
      }
      if(spot.ripple){
        const impactTime=elapsed-started-.65;
        const phase=(impactTime%.42)/.42;
        spot.ripple.visible=impactTime>=0&&progress<1;
        spot.ripple.scale.setScalar(.025+.15*Math.max(0,phase));
        spot.ripple.material.opacity=.65*(1-Math.max(0,phase));
      }
      spot.particles.visible=true;
      spot.particles.children.forEach((drop,index)=>{
        if(spot.kind==='water'){
          const t=(index/14+(elapsed-started)*.9)%1;
          drop.position.set(8.35-t*.5,1.1+Math.sin(t*Math.PI)*.25,spot.z);
        }else updateToiletDrop(drop,index,elapsed-started);
      });
      if(progress<1)return;
      tipsiness=Math.max(0,tipsiness-recoveryAmount[spot.kind]);
      spot.particles.visible=false;bathroomAction=null;bathroomDone=spot;bathroomWait=null;
      showMessage(spot.kind==='water'?'Water helps you steady yourself.':'You feel steadier. Back to the dance floor.');
    }
    function leaveSeat(){seatedAtBar=false;player.x=-5.75;player.z=-8;}
    function orderDrink(){
      if(drinks){showMessage('You already have a glass. Q: sip · E near someone: give it away.');return;}
      drinks=1;sipsLeft=6;
      showMessage('One glass. Q: sip · E near someone: give it away.');score.resonate();
    }
    function interact(){
      if(seatedAtBar){orderDrink();return;}
      if(player.x<-5.5&&player.x>-7.35&&player.z<-3.5&&player.z>-12.5){
        orderDrink();return;
      }
      if(player.z<-24.5){useBathroom();return;}
      if(player.x>10.3){shareSmoke();return;}
      const near=nearestGuest();
      if(near){
        if(drinks>0){giveGuestDrink(near.guest);return;}
        near.guest.shared=true;dancing=true;score.resonate();
        showMessage('They follow your rhythm. Space to dance · walk to stop.');
      }else showMessage('BAR on the left · RESTROOM at the back · E near someone to dance together.');
    }
    function updateHints(){
      if(elapsed<messageUntil)return;
      if(seatedAtBar){hint.textContent='E: order a glass · Q: sip · X: stand up';return;}
      if(Math.hypot(player.x+6.7,player.z+8)<1.65){hint.textContent='Empty stool · X: sit · E / click: get drinks';return;}
      if(player.x>10.3){
        hint.textContent=cigarette?`E / click: take a drag · ${cigarette} left · leave through the doorway to stub it out`:
          Math.hypot(player.x-smoker.x,player.z-smoker.z)<2.4?'E / click: share a smoke':'SMOKING ROOM · someone is on the far bench · return through the doorway';
        return;
      }
      if(player.z<-24.5){
        const spot=nearestBathroom();
        hint.textContent=spot?(spot.kind==='water'?'Stand here to drink water · reduces drunkenness':'Stand here to use toilet · reduces drunkenness'):'RESTROOM · water fountains right · toilets in rear stalls';
        return;
      }
      if(dancing){hint.textContent='Dancing · B to stop · Space on the beat · WASD to walk';return;}
      if(player.x<-5.5&&player.z<-3.5&&player.z>-12.5){hint.textContent='BAR · E: get drinks · Q: sip';return;}
      if(nearestGuest()){hint.textContent=drinks?'E: share a drink · Space: dance / tap beat':'E: dance together · Space: dance / tap beat';return;}
      hint.textContent='Space: dance / tap beat · WASD: walk · Shift: run · M: music source · Q: drink · mouse / drag: look · J/R: turn · E / click: interact · Space: dance / tap beat · L: lights';
    }
    function updatePlayer(dt){
      const forward=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
      const side=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      player.angle+=(Number(keys.has('r'))-Number(keys.has('j')))*dt*1.6;
      const movement=readMovement(forward,side,player.angle);moving=Boolean(forward||side);
      const speed=keys.has('shift')?5.6:3.1;
      if(moving&&seatedAtBar)leaveSeat();
      if(moving){movePlayer(movement.x*dt*speed,movement.z*dt*speed);dancing=false;}
      const dancePhase=window.clubAudioFrame?.active?window.clubAudioFrame.phase:elapsed*13.82;
      const jump=jumpTime<0?0:Math.sin(Math.min(1,jumpTime/.72)*Math.PI)*.72;
      if(jumpTime>=0){jumpTime+=dt;if(jumpTime>=.72)jumpTime=-1;}
      const bob=moving?Math.abs(Math.sin(elapsed*13))*.075:dancing?Math.sin(dancePhase)*.08:0;
      const sway=moving?Math.sin(elapsed*6.5)*.035:dancing?Math.sin(dancePhase*.5)*.06:0;
      tipsiness=Math.max(0,tipsiness-dt*.012);
      const dizzy=softMode?0:tipsiness;
      camera.position.set(player.x,(seatedAtBar?1.45:1.64)+jump+bob,player.z);
      canvas.style.filter=tipsiness>0.01?`blur(${(tipsiness*(softMode?.65:4.2)).toFixed(2)}px)`:'';
      camera.rotation.set(player.pitch+(bathroomAction?.spot.kind==='toilet'?-.25:0)+Math.sin(elapsed*.85)*dizzy*.065,-player.angle+Math.sin(elapsed*.6)*dizzy*.055,sway+Math.sin(elapsed*1.2)*dizzy*.105,'YXZ');
    }
    const danceHearts=[];
    const heartLifetime=2.2,heartInterval=.65;
    let heartNext=0;
    function buildHearts(){
      const shape=new THREE.Shape();shape.moveTo(0,-.5);
      shape.bezierCurveTo(-.95,.05,-.5,.85,0,.35);
      shape.bezierCurveTo(.5,.85,.95,.05,0,-.5);
      const geometry=new THREE.ShapeGeometry(shape);
      for(let index=0;index<6;index++){
        const material=new THREE.MeshBasicMaterial({color:0xff398a,transparent:true,
          opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
        const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;scene.add(mesh);
        danceHearts.push({mesh,born:-Infinity,x:0,z:0});
      }
    }
    function updateHearts(){
      const near=dancing?nearestGuest():null;
      if(near&&elapsed>=heartNext){
        if(!danceHearts.length)buildHearts();
        const heart=danceHearts.find(heart=>elapsed-heart.born>=heartLifetime);
        if(heart){heart.born=elapsed;heart.x=near.guest.x;heart.z=near.guest.z;}
        heartNext=elapsed+heartInterval;
      }
      for(const heart of danceHearts){
        const age=(elapsed-heart.born)/heartLifetime;
        heart.mesh.visible=age>=0&&age<1;
        if(!heart.mesh.visible)continue;
        heart.mesh.position.set(heart.x+Math.sin(age*4)*.15,2.35+age*.9,heart.z);
        heart.mesh.quaternion.copy(camera.quaternion);
        heart.mesh.scale.setScalar(.3+Math.sin(age*Math.PI)*.16);
        heart.mesh.material.opacity=Math.sin(age*Math.PI)*.85;
      }
    }
    function updateWorld(dt){
      if(!playing)return;
      if(window.clubAudioFrame?.active)beatCount=window.clubAudioFrame.phase/(Math.PI*2);else beatCount+=dt*132/60;
      if(elapsed-lastRhythmTime>1.2){rhythmEnergy=Math.max(0,rhythmEnergy-dt*.18);rhythmCombo=0;}
      elapsed+=dt;pulse=Math.max(0,pulse-dt*1.4);updatePlayer(dt);updateBathroom();updateHearts();updateCigarette();window.clubRoomDistance=readRoomDistance();
      for(const [index,signal] of signals.entries()){
        if(!signal.got&&Math.hypot(signal.x-player.x,signal.z-player.z)<1.65){
          signal.got=true;pips[index].classList.add('on');pulse=.7;score.resonate();
        }
      }
      chapter.textContent=`${player.z>0?'entrance':player.x>10.3?'smoking room':player.z<-24.1?'restroom':player.x<-5.5&&player.z>-13?'bar':'dance floor'} · ${softMode?'gentle lights':'strobe'} · ×${rhythmMultiplier(rhythmCombo)}${drinks?' · '+drinks+' glasses · '+sipsLeft+'/6 sips':''}`;
      timer.textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;
      updateHints();
    }
    let heldDrink, heldSmoke, heldEmber;
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
      if(!heldSmoke){
        heldSmoke=new THREE.Group();camera.add(heldSmoke);
        const skin=new THREE.MeshStandardMaterial({color:0x89e6d1,roughness:.7});
        const forearm=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,.36,5),skin);
        forearm.position.set(-.04,-.16,.08);forearm.rotation.x=-.55;heldSmoke.add(forearm);
        const palm=new THREE.Mesh(new THREE.BoxGeometry(.13,.12,.10),skin);palm.position.set(-.025,-.03,.04);heldSmoke.add(palm);
        const paper=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.13,6),new THREE.MeshBasicMaterial({color:0xf4f1e6}));
        paper.rotation.x=Math.PI/2;paper.position.set(.02,.04,-.06);heldSmoke.add(paper);
        heldEmber=new THREE.Mesh(new THREE.SphereGeometry(.013,8,6),new THREE.MeshBasicMaterial({color:0xff6a1f}));
        heldEmber.position.set(.02,.04,-.13);heldSmoke.add(heldEmber);
      }
      const dragging=elapsed<dragUntil-.6;
      heldSmoke.visible=playing&&(cigarette>0||elapsed<dragUntil);
      heldSmoke.position.set(dragging?-.07:-.3,dragging?-.13:-.32,dragging?-.24:-.5);
      heldSmoke.rotation.set(dragging?.5:0,dragging?-.3:0,-Math.sin(elapsed*2.6)*.025);
      heldEmber.scale.setScalar(dragging?2.2:1+Math.sin(elapsed*8)*.15);
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
              p.x+=sin(p.y*.55+phase*.18)*.65*(1.-gentle);
              vec2 grid=abs(fract(p*.48+vec2(0.,phase*.035))-.5);
              float seams=1.-smoothstep(.025,.065,min(grid.x,grid.y));
              float zigzag=abs(fract(p.x*.16+phase*.025)-.5)*4.;
              float bands=step(.56,fract(p.y*.23+zigzag-phase*.08));
              float hue=floor(p.y*.4+phase*.125);
              vec3 neon=.5+.5*cos(vec3(0.,2.094,4.188)+hue*1.7);
              neon=step(vec3(.35),neon);
              vec3 color=mix(neon,vec3(.92,1.,.73),bands*.85);
              float edge=smoothstep(0.,.04,floorUv.x)*smoothstep(0.,.04,1.-floorUv.x)*smoothstep(0.,.04,floorUv.y)*smoothstep(0.,.04,1.-floorUv.y);
              float strength=seams*(.65+energy*.2)+bands*.24*(1.-gentle);
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
        const material=new THREE.MeshBasicMaterial({map:wallTexture,transparent:true,opacity:.86,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
        for(const [x,z,width] of [[-9.96,-16,31.9],[9.96,-3.5,6.9],[9.96,-21,21.9]]){
          const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,4.45),material);
          panel.position.set(x,2.3,z);panel.rotation.y=x<0?Math.PI/2:-Math.PI/2;scene.add(panel);
        }
        const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(16,20),material);ceiling.rotation.x=Math.PI/2;ceiling.position.set(0,4.49,-12);scene.add(ceiling);
      }
      const frame=Math.floor(clockTime*20);if(frame===wallTick)return;wallTick=frame;
      const c=wallBrush,t=softMode?0:beatCount*.12;
      c.fillStyle='#080c12';c.fillRect(0,0,512,256);
      const palette=['#baff00','#00ffcc','#ff21d4','#f0ffd6'];
      c.globalAlpha=softMode?.18:.9;
      for(let ring=18;ring>=0;ring--){
        const radius=12+ring*22+(t*22)%22;
        const offset=Math.sin(t*.6)*42;
        c.strokeStyle=palette[(ring+Math.floor(t/4))%palette.length];
        c.lineWidth=softMode?2:8+rhythmEnergy*3;c.beginPath();
        for(let corner=0;corner<=4;corner++){
          const angle=corner*Math.PI/2+Math.PI/4;
          const x=256+Math.cos(angle)*radius*1.7+offset;
          const y=128+Math.sin(angle)*radius*.85;
          corner?c.lineTo(x,y):c.moveTo(x,y);
        }
        c.closePath();c.stroke();
      }
      c.globalAlpha=1;wallTexture.needsUpdate=true;
    }
    const projectionState={clubPhase:{value:0},clubStrength:{value:0}};
    let colorPass;
    function projectMaterial(material){
      if(material.transparent||(material.map&&material!==floor.material)||material.userData.clubProjection)return;
      material.userData.clubProjection=true;
      material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,projectionState);
        shader.vertexShader='varying vec3 clubPosition;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\nclubPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader='varying vec3 clubPosition;uniform float clubPhase;uniform float clubStrength;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`
          float clubBand=sin(clubPosition.x*2.8+clubPosition.y*4.2+clubPosition.z*1.6-clubPhase);
          vec3 clubInk=step(vec3(.0),sin(vec3(0.,2.094,4.188)+clubBand*2.4+clubPhase*.3));
          float clubMask=smoothstep(-.25,.25,clubBand);
          float clubRoom=smoothstep(-25.,-23.,clubPosition.z)*(1.-smoothstep(9.7,10.4,clubPosition.x));
          vec3 clubColor=mix(vec3(.008),mix(clubInk,vec3(1.,1.,.82),step(.88,clubBand)),clubMask);
          gl_FragColor.rgb=mix(gl_FragColor.rgb,clubColor,clubStrength*clubRoom);
          #include <tonemapping_fragment>
        `);
      };
      material.needsUpdate=true;
    }
    // Ink, midtone and paper sampled by eye from the club sequence.
    const strobePalettes=[
      [0x182017,0x627164,0xf2f4cc],
      [0x182643,0x2b22ad,0xf5ef52],
      [0x152b20,0xe52398,0x8dffb1],
      [0x301020,0xe14133,0x60fad9]
    ].map(row=>row.map(hex=>new THREE.Color(hex)));
    const strobePhrase=[0,0,1,0,2,0,3,1];
    function createColorPass(){
      const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});
      const uniforms={image:{value:target.texture},pixel:{value:new THREE.Vector2(1,1)},strength:{value:0}};
      for(const [index,name] of ['ink','midtone','paper'].entries())uniforms[name]={value:strobePalettes[0][index]};
      const material=new THREE.ShaderMaterial({
        uniforms,depthTest:false,depthWrite:false,toneMapped:false,
        vertexShader:'varying vec2 screenUv;void main(){screenUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:`
          varying vec2 screenUv;uniform sampler2D image;uniform vec3 ink,midtone,paper;uniform vec2 pixel;uniform float strength;
          void main(){
            vec2 offset=pixel*vec2(2.5,1.)*strength;
            vec3 color=vec3(texture2D(image,screenUv+offset).r,
              texture2D(image,screenUv).g,texture2D(image,screenUv-offset).b);
            vec2 ray=(screenUv-.5)*.012*strength;
            vec3 echo=texture2D(image,screenUv-ray).rgb;
            color=max(color,echo*.22*strength);
            float light=dot(color,vec3(.2126,.7152,.0722));
            vec3 printed=mix(ink,midtone,smoothstep(.065,.12,light));
            printed=mix(printed,paper,smoothstep(.30,.42,light));
            color=mix(color,printed,.83*strength);
            gl_FragColor=vec4(color,1.);
            #include <colorspace_fragment>
          }
        `
      });
      const view=new THREE.Scene();
      view.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
      return {target,uniforms,view,camera:new THREE.Camera()};
    }
    function renderClub(){
      const intense=playing&&!softMode&&readRoomDistance()<.7;
      projectionState.clubPhase.value=intense?beatCount*.65:0;
      projectionState.clubStrength.value=intense?.86:0;
      if(!intense){renderer.render(scene,camera);return;}
      const beat=Math.floor(Math.max(0,beatCount));
      const palette=strobePalettes[strobePhrase[beat%strobePhrase.length]];
      [colorPass.uniforms.ink.value,colorPass.uniforms.midtone.value,colorPass.uniforms.paper.value]=palette;
      colorPass.uniforms.strength.value=.65+Math.min(1,rhythmEnergy)*.35;
      renderer.setRenderTarget(colorPass.target);renderer.render(scene,camera);
      renderer.setRenderTarget(null);renderer.render(colorPass.view,colorPass.camera);
    }
    function resizeScene(){
      const bounds=canvas.getBoundingClientRect();
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(bounds.width,bounds.height,false);
      camera.aspect=bounds.width/Math.max(1,bounds.height);camera.updateProjectionMatrix();
      if(colorPass){
        const size=renderer.getDrawingBufferSize(new THREE.Vector2());
        colorPass.target.setSize(size.x,size.y);colorPass.uniforms.pixel.value.set(1/size.x,1/size.y);
      }
    }
    function drawFrame(time){
      const dt=Math.min(.08,Math.max(0,(time-last)/1000||0));last=time;
      if(!document.hidden){
        clockTime+=dt;updateWorld(dt);
        guests.forEach(guest=>animateGuest(guest,clockTime));updateSmoke(dt);updateLights();updateScreen();updateWallEffects();updateFloorEffects();updateHeldDrink();updateBeatGuide();
        renderClub();
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
      bathroomAction=null;bathroomWait=null;bathroomDone=null;bathroomSpots.forEach(spot=>{spot.particles.visible=false;if(spot.ripple)spot.ripple.visible=false;});
      playing=true;rhythmEnergy=0;rhythmCombo=0;lastRhythmBeat=-Infinity;lastRhythmTime=-Infinity;seatedAtBar=false;tipsiness=0;elapsed=0;beatCount=0;pulse=0;dancing=false;drinks=0;sipsLeft=6;sipUntil=0;cigarette=0;dragUntil=0;exhaled=true;jumpTime=-1;keys.clear();
      Object.assign(player,entranceSpawn);
      heartNext=0;danceHearts.forEach(heart=>{heart.born=-Infinity;heart.mesh.visible=false;});
      guests.forEach(guest=>{guest.shared=false;guest.drinkUntil=0;if(guest.cup)guest.cup.visible=false;});
      signals.forEach(signal=>signal.got=false);pips.forEach(pip=>pip.classList.remove('on'));
      intro.classList.add('hidden');ending.classList.add('hidden');document.querySelector('main').classList.add('active');
      showMessage('Follow the floor stripe left into the club · drag to look',6);
      if(!window.clubAudioFrame?.active)score.start();
      requestLook();
    }
    function readKey(event){return event.code.startsWith('Key')?event.code.slice(3).toLowerCase():event.key.toLowerCase();}
    function activateControl(key){
        if(key==='l'){softMode=!softMode;showMessage(softMode?'Gentle mode · flashes off':'Strobes active · L to disable');}
        if(key==='m'){keys.clear();window.openClubMusicSource?.();return;}
        if(key==='e')interact();
        if(key==='q')drinkCup();
        if(key==='x'){if(seatedAtBar)leaveSeat();else if(Math.hypot(player.x+6.7,player.z+8)<1.65){seatedAtBar=true;dancing=false;player.x=-6.7;player.z=-8;player.angle=-Math.PI/2;showMessage('E: order · Q: sip · X: stand up');}}
        if(key===' ')tapRhythm();
        if(key==='b'){dancing=!dancing;score.resonate();showMessage(dancing?'Dancing · walk to stop':'Walking again.');}
    }
    function handleKey(event){
      if(event.target.matches('input,button,textarea,select')||!playing)return;
      const key=readKey(event);
      if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))event.preventDefault();
      if(!event.repeat)activateControl(key);
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
        // Capture is refused while the pointer is locked; looking around still works without it.
        try{canvas.setPointerCapture(event.pointerId);}catch(error){}
        requestLook();
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
      for(const [id,key] of [['move-forward','w'],['move-back','s'],['move-left','a'],['move-right','d'],['move-run','shift']]){
        const button=document.getElementById(id);
        button.addEventListener('pointerdown',event=>{event.preventDefault();if(!playing)return;button.setPointerCapture(event.pointerId);keys.add(key);});
        for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(key));
      }
      for(const [id,key] of [['interact','e'],['drink','q'],['beat',' '],['dance','b'],['seat','x'],['lights','l']]){
        document.getElementById('action-'+id).addEventListener('click',()=>{if(playing)activateControl(key);});
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
        camera=new THREE.PerspectiveCamera(72,1,.045,65);camera.position.set(entranceSpawn.x,1.64,entranceSpawn.z);
        buildRoom();buildGuests();
        scene.traverse(object=>{if(object.isMesh)for(const material of [].concat(object.material))projectMaterial(material);});
        colorPass=createColorPass();
        bindControls();resizeScene();requestAnimationFrame(drawFrame);
      }catch(error){
        console.error(error);chapter.textContent='WebGL unavailable';
        document.querySelector('.lede').textContent='Could not start the 3D scene. Open in a browser with WebGL and hardware acceleration enabled.';
        document.querySelectorAll('.start').forEach(button=>button.disabled=true);
      }
    }
    bootScene();
  })();
