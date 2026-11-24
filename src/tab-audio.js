/* PulseTracker and bassEnergy adapted from the local tab-hero/audio.js. */
(() => {
class PulseTracker {
  constructor() {
    this.reset();
  }
  reset() {
    this.minGap = .24;
    this.events = [];
    this.floor = .01;
    this.last = -10;
    this.bpm = null;
    this.onset = false;
    this.previous = 0;
    this.armed = true;
  }
  update(rms, t, threshold) {
    const gate = Math.max(threshold, this.floor * 1.5);
    // A sustained bass note must decay before it can trigger again.
    if (rms < gate * .75 || rms < this.previous * .7) this.armed = true;
    const onset = this.armed && rms > gate && rms > this.previous * 1.12 &&
      t - this.last > this.minGap;
    this.onset = onset;
    this.previous = rms;
    if (onset) this.armed = false;
    this.floor = this.floor * .92 + rms * .08;
    if (onset) {
      this.last = t;
      this.events.push(t);
      this.events = this.events.slice(-12);
    }
    this.events = this.events.filter((e) => t - e < 10);
    const intervals = this.events.slice(1).map((e, i) => e - this.events[i])
      .filter((i) => i >= .3 && i <= 1.5);
    this.bpm = null;
    if (intervals.length >= 4) {
      const sorted = [...intervals].sort((a, b) => a - b),
        median = sorted[Math.floor(sorted.length / 2)];
      const stable = intervals.filter((i) =>
        Math.abs(i - median) < median * .18
      );
      if (stable.length >= intervals.length * .7) {
        this.bpm = Math.round(
          60 / (stable.reduce((a, b) => a + b, 0) / stable.length),
        );
      }
    }
    return this.bpm;
  }
}

// FFT magnitudes are in dB. Only the bass band contributes to the pulse envelope.
function bandEnergy(spectrum, sampleRate, fftSize, low, high) {
  const first = Math.max(1, Math.ceil(low * fftSize / sampleRate));
  const last = Math.min(
    spectrum.length - 1,
    Math.floor(high * fftSize / sampleRate),
  );
  let power = 0;
  for (let i = first; i <= last; i++) power += 10 ** (spectrum[i] / 10);
  return Math.sqrt(power);
}

const bassEnergy = (spectrum, rate, size) =>
  bandEnergy(spectrum, rate, size, 35, 220);

function melodicContour(spectrum, sampleRate, fftSize) {
  const binWidth=sampleRate/fftSize;
  let peak=-Infinity, frequency=180;
  for(let bin=Math.ceil(180/binWidth);bin<spectrum.length&&bin*binWidth<=2200;bin++){
    if(spectrum[bin]<=peak)continue;
    peak=spectrum[bin];frequency=bin*binWidth;
  }
  const strength=Math.min(1,Math.max(0,(peak+75)/35));
  return strength*(.3+.7*Math.log(frequency/180)/Math.log(2200/180));
}

const host=document.createElement('div');
host.className='tab-audio-controls';
host.innerHTML='<button type="button">Music source · M</button> <span role="status">YouTube or Spotify · choose a tab and share its audio</span>';
Object.assign(host.style,{position:'fixed',top:'68px',right:'24px',zIndex:'8',maxWidth:'min(340px,85vw)',padding:'8px',background:'#111d',fontSize:'11px'});
document.body.append(host);
const button=host.querySelector('button'),status=host.querySelector('span');
Object.assign(button.style,{display:'block',width:'100%',padding:'12px 18px',marginBottom:'7px',background:'#b7ff36',color:'#101010',border:'1px solid #e1ffb5',fontWeight:'700',fontSize:'14px',cursor:'pointer'});
button.title='Press M while playing to select a music tab';
let stream,context,source,analyser,muted,spectrum,raf,token=0,last=0,delayNode;
const syncDelay=2,analysisQueue=[],videoQueue=[];
let lastVideo=0,livePhase=0,livePulse=0;
const delayedPicture=window.clubProjectionCanvas=document.createElement("canvas");delayedPicture.width=480;delayedPicture.height=270;const pictureBrush=delayedPicture.getContext("2d");
const tracker=new PulseTracker();
const projection=window.clubVideoElement=document.createElement('video');projection.muted=true;projection.playsInline=true;projection.autoplay=true;
const frame=window.clubAudioFrame={active:false,onset:false,bpm:null,energy:0,phase:0,pulse:0,melody:0};
let roomSound;
function release(notify=true){
  roomSound?.dispose();roomSound=null;
  token++;cancelAnimationFrame(raf);analysisQueue.length=0;videoQueue.length=0;livePhase=0;livePulse=0;delayNode?.disconnect();pictureBrush.clearRect(0,0,480,270);
  if(stream)stream.getTracks().forEach(track=>track.stop());
  stream=null;projection.pause();projection.srcObject=null;source?.disconnect();analyser?.disconnect();muted?.disconnect();
  context?.close().catch(()=>{});context=null;
  Object.assign(frame,{active:false,ready:false,onset:false,bpm:null,energy:0,phase:0,pulse:0,melody:0});tracker.reset();
  button.disabled=false;button.textContent='Music source · M';
  if(notify)window.dispatchEvent(new CustomEvent('club-audio-source',{detail:{external:false}}));
}
function sample(now){
  if(!frame.active)return;
  roomSound?.update();
  const t=context.currentTime,dt=Math.min(.1,Math.max(0,t-last));last=t;
  analyser.getFloatFrequencyData(spectrum);
  const bass=bassEnergy(spectrum,context.sampleRate,analyser.fftSize);
  const bpm=tracker.update(bass,t,.018),onset=tracker.onset;
  if(onset){livePulse=1;livePhase=Math.round(livePhase/(Math.PI*2))*Math.PI*2;}else livePulse*=Math.exp(-dt*12);
  livePhase+=dt*(bpm||120)/60*Math.PI*2;
  const melody=melodicContour(spectrum,context.sampleRate,analyser.fftSize);
  analysisQueue.push({time:t,bpm,onset,energy:Math.min(1,bass*4),pulse:livePulse,phase:livePhase,melody});
  const due=t-syncDelay-(context.outputLatency||context.baseLatency||0);
  frame.onset=false;
  while(analysisQueue.length&&analysisQueue[0].time<=due){const ready=analysisQueue.shift();Object.assign(frame,ready,{onset:frame.onset||ready.onset});}
  if(projection.readyState>=2&&t-lastVideo>=1/15){
    lastVideo=t;const shot=document.createElement('canvas');shot.width=480;shot.height=270;
    shot.getContext('2d').drawImage(projection,0,0,480,270);videoQueue.push({time:t,shot});
  }
  let shown;while(videoQueue.length&&videoQueue[0].time<=due)shown=videoQueue.shift();
  if(shown)pictureBrush.drawImage(shown.shot,0,0);
  while(videoQueue.length>40)videoQueue.shift();
  frame.ready=due>=0&&frame.time!==undefined;
  status.textContent=!frame.ready?'Synchronizing audio + video · 2 seconds':frame.bpm?`Tab connected · ${frame.bpm} BPM · 2s sync`:'Tab connected · following the bass · 2s sync';
  raf=requestAnimationFrame(sample);
}
async function capture(){
  if(frame.active){release();status.textContent='Internal music active';return;}
  if(!navigator.mediaDevices?.getDisplayMedia){status.textContent='Open in Chrome/Edge on localhost or HTTPS to share tab audio.';return;}
  const attempt=++token;button.disabled=true;status.textContent='Choose YouTube or Spotify and enable Share tab audio.';
  let incoming;
  try{
    incoming=await navigator.mediaDevices.getDisplayMedia({video:true,audio:{suppressLocalAudioPlayback:true,echoCancellation:false,noiseSuppression:false,autoGainControl:false},preferCurrentTab:false,selfBrowserSurface:'exclude',systemAudio:'exclude'});
    if(attempt!==token){incoming.getTracks().forEach(t=>t.stop());return;}
    if(!incoming.getAudioTracks().length)throw new Error('no-audio');
    stream=incoming;projection.srcObject=incoming;projection.play().catch(()=>{});context=new AudioContext();await context.resume();
    if(attempt!==token)return;
    source=context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.35;
    spectrum=new Float32Array(analyser.frequencyBinCount);
    // Analyze ahead; play audio and project frames with the same two-second delay.
    muted=context.createGain();muted.gain.value=0;
    source.connect(analyser);analyser.connect(muted);muted.connect(context.destination);
    delayNode=context.createDelay(2.5);delayNode.delayTime.value=syncDelay;source.connect(delayNode);roomSound=createRoomSound(context,context.destination);delayNode.connect(roomSound.input);
    stream.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(frame.active){release();status.textContent='Capture ended · internal music active';}}));
    frame.active=true;frame.ready=false;delete frame.time;last=context.currentTime;lastVideo=-1;
    button.disabled=false;button.textContent='Stop sharing';
    window.dispatchEvent(new CustomEvent('club-audio-source',{detail:{external:true}}));
    raf=requestAnimationFrame(sample);
  }catch(error){
    incoming?.getTracks().forEach(t=>t.stop());release(false);
    status.textContent=error.message==='no-audio'?'No audio received. Choose a tab and enable audio sharing.':error.name==='NotAllowedError'?'Capture cancelled. Try again.':'Capture failed. Choose a tab with shareable audio in Chrome/Edge.';
  }
}
function openMusicSource(){
  if(button.disabled)return;
  if(document.pointerLockElement)document.exitPointerLock();
  capture();
}
window.openClubMusicSource=openMusicSource;
button.addEventListener('click',openMusicSource);
window.addEventListener('pagehide',()=>release(false));
})();
