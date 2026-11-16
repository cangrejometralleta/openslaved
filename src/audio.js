// One acoustic path for synthesized music and shared-tab playback.
function createRoomSound(context,destination){
  const filter=context.createBiquadFilter(),level=context.createGain();
  filter.type='lowpass';filter.Q.value=.7;filter.frequency.value=20000;
  filter.connect(level);level.connect(destination);
  let previous=-1;
  function update(){
    const distance=window.clubRoomDistance||0;
    if(Math.abs(distance-previous)<.01)return;
    previous=distance;
    filter.frequency.setTargetAtTime(20000*Math.pow(700/20000,distance),context.currentTime,.25);
    level.gain.setTargetAtTime(1-distance*.76,context.currentTime,.25);
  }
  update();
  return {input:filter,update,dispose(){filter.disconnect();level.disconnect();}};
}
    // Original synthesis: no recordings or external audio assets.
    function createScore({player,signals,isPlaying}){
      const tempo=132, beat=60/tempo, stepLength=beat/4, silence=.0001;
      const patterns=[
        [0,0,12,null,0,7,0,10,0,null,12,7,3,0,10,7],
        [0,null,0,7,12,0,10,0,3,3,null,7,0,12,10,0],
        [0,12,0,3,null,7,10,7,0,0,15,null,12,10,7,3]
      ];
      const toggle=document.querySelector('#sound-toggle');
      const volume=document.querySelector('#sound-volume');
      const status=document.querySelector('#sound-status');
      let context, output, mix, acid, filter, envelope, duck, echo, noise, roomSound;
      let running=false, enabled=true, nextTime=0, step=0, seenSignals=0;
      let previousPitch=55, previousSlide=false, resonance=0, scheduler, fadeTimer;

      function setLevel(){
        toggle.textContent=enabled?'Sound: on':'Sound: off';
        toggle.setAttribute('aria-pressed',String(enabled));
        if(output)output.gain.setTargetAtTime(enabled?Number(volume.value)*.6:0,context.currentTime,.035);
      }
      function makeNoise(){
        const buffer=context.createBuffer(1,context.sampleRate,context.sampleRate);
        const data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        return buffer;
      }
      function makeDrive(){
        const shaper=context.createWaveShaper(), curve=new Float32Array(2048);
        for(let i=0;i<curve.length;i++)curve[i]=Math.tanh((i*2/(curve.length-1)-1)*9)/2.6;
        shaper.curve=curve;shaper.oversample='2x';
        return shaper;
      }
      function buildScore(){
        const Audio=contextConstructor();
        context=new Audio();
        output=context.createGain();mix=context.createGain();
        const limiter=context.createDynamicsCompressor();
        limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=8;
        limiter.attack.value=.003;limiter.release.value=.15;
        mix.connect(limiter);limiter.connect(output);
        roomSound=createRoomSound(context,context.destination);output.connect(roomSound.input);
        mix.gain.value=0;noise=makeNoise();buildAcid();setLevel();
      }
      function contextConstructor(){
        const Audio=window.AudioContext||window.webkitAudioContext;
        if(!Audio)throw new Error('Audio no disponible');
        return Audio;
      }
      function buildAcid(){
        acid=context.createOscillator();acid.type='sawtooth';acid.frequency.value=55;
        filter=context.createBiquadFilter();filter.type='lowpass';filter.Q.value=23;
        envelope=context.createGain();envelope.gain.value=silence;
        duck=context.createGain();const drive=makeDrive();
        acid.connect(filter);filter.connect(drive);drive.connect(envelope);
        envelope.connect(duck);duck.connect(mix);
        echo=context.createDelay(1);echo.delayTime.value=beat*.75;
        const feedback=context.createGain(), tone=context.createBiquadFilter(), wet=context.createGain();
        feedback.gain.value=.28;tone.type='lowpass';tone.frequency.value=2400;wet.gain.value=.22;
        envelope.connect(echo);echo.connect(tone);tone.connect(feedback);feedback.connect(echo);
        tone.connect(wet);wet.connect(duck);acid.start();
      }
      function playKick(time){
        const oscillator=context.createOscillator(), gain=context.createGain();
        oscillator.frequency.setValueAtTime(145,time);
        oscillator.frequency.exponentialRampToValueAtTime(47,time+.09);
        oscillator.frequency.exponentialRampToValueAtTime(38,time+.28);
        gain.gain.setValueAtTime(silence,time);gain.gain.linearRampToValueAtTime(.9,time+.003);
        gain.gain.exponentialRampToValueAtTime(silence,time+.34);
        oscillator.connect(gain);gain.connect(mix);oscillator.start(time);oscillator.stop(time+.36);
        oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
        duck.gain.setValueAtTime(.28,time);duck.gain.exponentialRampToValueAtTime(1,time+beat*.8);
      }
      function playNoise(time,duration,level,frequency,pan=0,clap=false){
        const source=context.createBufferSource(), band=context.createBiquadFilter();
        const gain=context.createGain(), stereo=context.createStereoPanner();
        source.buffer=noise;band.type=clap?'bandpass':'highpass';band.frequency.value=frequency;
        band.Q.value=clap?.65:.5;stereo.pan.value=pan;
        gain.gain.setValueAtTime(silence,time);gain.gain.linearRampToValueAtTime(level,time+.002);
        if(clap){
          for(let i=1;i<=3;i++){
            gain.gain.exponentialRampToValueAtTime(level*.13,time+i*.012-.003);
            gain.gain.linearRampToValueAtTime(level,time+i*.012);
          }
        }
        gain.gain.exponentialRampToValueAtTime(silence,time+duration);
        source.connect(band);band.connect(gain);gain.connect(stereo);stereo.connect(mix);
        source.start(time,Math.random()*.5);source.stop(time+duration+.01);
        source.onended=()=>{source.disconnect();band.disconnect();gain.disconnect();stereo.disconnect();};
      }
      function playAcid(time,note,accent,slide,energy){
        if(note===null){envelope.gain.setTargetAtTime(silence,time,.018);previousSlide=false;return;}
        const pitch=55*Math.pow(2,note/12), duration=slide?stepLength*.96:stepLength*.79;
        const sweep=.5+.5*Math.sin(step*Math.PI/128);
        const cutoff=420+sweep*2600+energy*2600+(accent?3200:0);
        acid.frequency.setValueAtTime(previousSlide?previousPitch:pitch,time);
        acid.frequency.exponentialRampToValueAtTime(pitch,time+(previousSlide?.065:.004));
        filter.frequency.setValueAtTime(Math.min(5200,cutoff),time);
        filter.frequency.exponentialRampToValueAtTime(150+energy*180,time+duration);
        if(!previousSlide)envelope.gain.setValueAtTime(silence,time);
        envelope.gain.linearRampToValueAtTime(accent?.58:.38,time+.004);
        envelope.gain.exponentialRampToValueAtTime(slide?.13:silence,time+duration);
        previousPitch=pitch;previousSlide=slide;
      }
      function playChime(time,note,pan=0){
        const oscillator=context.createOscillator(), gain=context.createGain();
        const stereo=context.createStereoPanner();stereo.pan.value=pan;
        oscillator.type='triangle';oscillator.frequency.value=220*Math.pow(2,note/12);
        gain.gain.setValueAtTime(silence,time);gain.gain.linearRampToValueAtTime(.1,time+.008);
        gain.gain.exponentialRampToValueAtTime(silence,time+.7);
        oscillator.connect(gain);gain.connect(stereo);stereo.connect(mix);gain.connect(echo);
        oscillator.start(time);oscillator.stop(time+.75);
        oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();stereo.disconnect();};
      }
      function playLead(time,index,bar){
        const phrases=[[12,15,19,22,19,15,10,7],[12,19,24,22,19,15,14,10],[12,15,22,24,27,22,19,15],[19,15,12,10,7,10,14,15]];
        const note=phrases[Math.floor(bar/2)%4][index];
        const osc=context.createOscillator(), tone=context.createBiquadFilter(), gain=context.createGain(), pan=context.createStereoPanner();
        osc.type='sawtooth';const hz=110*Math.pow(2,note/12);
        osc.frequency.setValueAtTime(hz*(index%3===0?.89:1),time);osc.frequency.exponentialRampToValueAtTime(hz,time+.045);
        tone.type='lowpass';tone.Q.value=10;tone.frequency.setValueAtTime(3000+(index%3)*700,time);tone.frequency.exponentialRampToValueAtTime(580,time+stepLength*1.7);
        gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.065,time+.008);gain.gain.exponentialRampToValueAtTime(.0001,time+stepLength*2.7);
        pan.pan.value=Math.sin(index*.8)*.3;osc.connect(tone);tone.connect(gain);gain.connect(pan);pan.connect(mix);gain.connect(echo);
        osc.start(time);osc.stop(time+stepLength*3);osc.onended=()=>{osc.disconnect();tone.disconnect();gain.disconnect();pan.disconnect();};
      }
      function readEnergy(){
        const collected=signals.filter(signal=>signal.got).length;
        const proximity=Math.max(0,1-Math.min(...signals.filter(signal=>!signal.got)
          .map(signal=>Math.hypot(signal.x-player.x,signal.z-player.z)))/10);
        return {collected,level:Math.min(1,.13+collected*.18+proximity*.25+resonance*.4)};
      }
      function arrangeStep(time){
        const position=step%16, bar=Math.floor(step/16), state=readEnergy();
        const breakdown=bar%8===7&&position<8;
        const pattern=patterns[(Math.floor(bar/4)+state.collected)%patterns.length];
        if(state.collected>seenSignals){
          [0,7,12].forEach((note,index)=>playChime(time+index*stepLength,note+state.collected*3,index*.5-.5));
          seenSignals=state.collected;resonance=1;
        }
        if(!breakdown&&position%4===0)playKick(time);
        if(position===4||position===12)playNoise(time,.16,.28,1400,0,true);
        if(position%4===2)playNoise(time,.18,.11,6200,.28);
        if(position%2===0||state.collected>1)
          playNoise(time,.035,position%2?.035:.07,7800,-.3);
        if(bar%4===3&&position>12)playNoise(time,.055,.08,2100,-.1,true);
        playAcid(time,pattern[position],position%3===0,[3,6,11,14].includes(position),state.level);
        if(state.collected>0&&position%8===6)
          playChime(time,[0,7,10,15][bar%4],Math.sin(bar)*.65);
        if(bar%8>=6&&position%4===2)playLead(time,position/2,bar);
        resonance*=.91;
      }
      function scheduleScore(){
        if(!running||context.state!=='running')return;
        roomSound.update();
        if(nextTime<context.currentTime-.1)nextTime=context.currentTime+.03;
        while(nextTime<context.currentTime+.12){arrangeStep(nextTime);nextTime+=stepLength;step++;}
      }
      async function startScore(){
        try{
          if(!context)buildScore();
          clearTimeout(fadeTimer);await context.resume();
          if(!isPlaying())return;
          step=0;previousSlide=false;seenSignals=0;resonance=0;running=true;nextTime=context.currentTime+.045;
          mix.gain.cancelScheduledValues(context.currentTime);
          mix.gain.setTargetAtTime(1,context.currentTime,.08);
          clearInterval(scheduler);scheduler=setInterval(scheduleScore,25);scheduleScore();
          status.textContent='acid / 132 bpm';
        }catch(error){status.textContent='audio unavailable';}
      }
      function stopScore(win){
        if(!context)return;
        running=false;clearInterval(scheduler);
        const now=context.currentTime;
        if(win)[0,7,12,19].forEach((note,index)=>playChime(now+index*.1,note));
        mix.gain.cancelScheduledValues(now);mix.gain.setTargetAtTime(0,now+.25,.35);
        fadeTimer=setTimeout(()=>{if(!running)context.suspend().catch(()=>{});},1800);
        status.textContent='the room resonates';
      }
      function resonateScore(){
        if(!running||context.state!=='running')return;
        resonance=1;
        playChime(Math.max(context.currentTime+.015,nextTime),7,Math.max(-1,Math.min(1,player.x/3.25)));
      }
      toggle.addEventListener('click',()=>{enabled=!enabled;setLevel();});
      volume.addEventListener('input',setLevel);
      for(const control of [toggle,volume]){
        control.addEventListener('keydown',event=>event.stopPropagation());
        control.addEventListener('keyup',event=>event.stopPropagation());
      }
      document.addEventListener('visibilitychange',()=>{
        if(!context)return;
        if(document.hidden)context.suspend().catch(()=>{});
        else if(running)context.resume().catch(()=>{status.textContent='click sound to resume';});
      });
      toggle.addEventListener('click',()=>{
        if(running&&context.state!=='running')context.resume().catch(()=>{});
      });
      return {start:startScore,stop:stopScore,resonate:resonateScore};
    }


