(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const el = {
    text:$('sourceText'), key:$('key'), scale:$('scale'), tempo:$('tempo'), tempoValue:$('tempoValue'),
    melodyInstrument:$('melodyInstrument'), chordInstrument:$('chordInstrument'), eventStrip:$('eventStrip'),
    chordStrip:$('chordStrip'), stats:$('stats'), charCount:$('charCount'), keyBadge:$('keyBadge'),
    nowNote:$('nowNote'), nowChord:$('nowChord'), status:$('status'), play:$('playBtn'), stop:$('stopBtn'),
    midi:$('midiBtn'), wav:$('wavBtn')
  };
  const NOTE_NAMES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const SCALES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10]};
  const DURATIONS=[0.25,0.5,0.5,0.75,1,1,1.5,2];
  let audioCtx=null, liveNodes=[], timers=[];

  function hashChar(ch,index){let h=ch.codePointAt(0)>>>0;h=Math.imul(h^0x9e3779b9,2654435761);h^=Math.imul(index+1,2246822519);h^=h>>>13;return h>>>0;}
  function config(){return{tonic:Number(el.key.value),intervals:SCALES[el.scale.value]};}
  function noteName(midi){return NOTE_NAMES[midi%12]+(Math.floor(midi/12)-1);}

  function buildMelody(){
    const {tonic,intervals}=config(), out=[];
    Array.from(el.text.value).slice(0,500).forEach((ch,i)=>{
      const h=hashChar(ch,i), duration=DURATIONS[(h>>>5)%DURATIONS.length];
      if(/\s/u.test(ch)||h%31===0){out.push({rest:true,duration,label:'REST'});return;}
      const degree=h%7, octave=4+((h>>>9)%2), midi=Math.min(127,12*(octave+1)+tonic+intervals[degree]);
      out.push({rest:false,duration,midi,label:noteName(midi)});
    });
    return out;
  }

  function buildHarmony(totalBeats){
    const {tonic,intervals}=config(), chars=Array.from(el.text.value||'music'), bars=Math.max(1,Math.ceil(totalBeats/4)), out=[];
    for(let bar=0;bar<bars;bar++){
      const h=hashChar(chars[bar%chars.length],bar+77), degree=h%7;
      const scaleMidi=d=>36+tonic+intervals[d%7]+12*Math.floor(d/7);
      const notes=[scaleMidi(degree),scaleMidi(degree+2),scaleMidi(degree+4)];
      const a=notes[1]-notes[0], b=notes[2]-notes[1];
      const suffix=a===3&&b===4?'m':a===3&&b===3?'°':'';
      out.push({notes,label:NOTE_NAMES[(tonic+intervals[degree])%12]+suffix});
    }
    return out;
  }

  function composition(){const melody=buildMelody(),beats=melody.reduce((s,e)=>s+e.duration,0);return{melody,beats,harmony:buildHarmony(beats)};}

  function render(){
    const c=composition(), chars=Array.from(el.text.value).length;
    el.charCount.textContent=`${chars} character${chars===1?'':'s'}`;
    el.tempoValue.textContent=`${el.tempo.value} BPM`;
    el.keyBadge.textContent=`${NOTE_NAMES[Number(el.key.value)]} ${el.scale.value.toUpperCase()}`;
    el.stats.textContent=`${c.melody.length} melody events · ${c.beats.toFixed(2)} beats · ${c.harmony.length} chord bars`;
    el.eventStrip.innerHTML='';
    c.melody.slice(0,120).forEach(e=>{const n=document.createElement('span');n.className='event';n.textContent=e.label;el.eventStrip.appendChild(n);});
    el.chordStrip.innerHTML='';
    c.harmony.forEach((h,i)=>{const n=document.createElement('span');n.className='chord';n.textContent=`${i+1}. ${h.label}`;el.chordStrip.appendChild(n);});
    return c;
  }

  function frequency(midi){return 440*Math.pow(2,(midi-69)/12);}
  function stop(){liveNodes.forEach(n=>{try{n.stop();}catch{}});liveNodes=[];timers.forEach(clearTimeout);timers=[];el.nowNote.textContent='—';el.nowChord.textContent='—';el.status.textContent='Stopped.';}

  const PRESETS={
    piano:{waves:['triangle','sine'],gains:[0.12,0.035],attack:0.006,release:0.28,decay:true},
    pluck:{waves:['triangle','square'],gains:[0.11,0.018],attack:0.003,release:0.16,decay:true},
    bell:{waves:['sine','sine'],ratios:[1,2.01],gains:[0.11,0.04],attack:0.003,release:0.55,decay:true},
    organ:{waves:['sine','square'],gains:[0.085,0.02],attack:0.02,release:0.12,decay:false},
    lead:{waves:['sawtooth','square'],gains:[0.07,0.025],attack:0.015,release:0.12,decay:false},
    flute:{waves:['sine','triangle'],gains:[0.10,0.025],attack:0.06,release:0.18,decay:false},
    pad:{waves:['sine','triangle'],gains:[0.045,0.025],attack:0.25,release:0.55,decay:false},
    strings:{waves:['sawtooth','triangle'],gains:[0.025,0.03],attack:0.18,release:0.4,decay:false},
    soft:{waves:['sine','triangle'],gains:[0.04,0.02],attack:0.08,release:0.3,decay:false}
  };

  function synthVoice(midi,start,length,presetName,level=1){
    const p=PRESETS[presetName]||PRESETS.piano, base=frequency(midi);
    p.waves.forEach((wave,i)=>{
      const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
      osc.type=wave;osc.frequency.value=base*((p.ratios&&p.ratios[i])||1);
      const peak=(p.gains[i]||0.03)*level, a=Math.min(p.attack,length*0.25), release=Math.min(p.release,length*0.45);
      gain.gain.setValueAtTime(0.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),start+a);
      if(p.decay){gain.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak*0.35),Math.max(start+a+0.02,start+length-release));}
      else gain.gain.setValueAtTime(Math.max(0.0002,peak),Math.max(start+a,start+length-release));
      gain.gain.exponentialRampToValueAtTime(0.0001,start+length);
      osc.connect(gain).connect(audioCtx.destination);osc.start(start);osc.stop(start+length+0.03);liveNodes.push(osc);
    });
  }

  async function play(){
    stop();const c=render();if(!c.melody.length){el.status.textContent='Enter something first.';return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC){el.status.textContent='Web Audio is not supported by this browser.';return;}
    audioCtx=audioCtx||new AC();await audioCtx.resume();
    const beat=60/Number(el.tempo.value), start=audioCtx.currentTime+0.1;
    c.harmony.forEach((chord,i)=>{const t=start+i*4*beat,len=4*beat;chord.notes.forEach(m=>synthVoice(m,t,len,el.chordInstrument.value,0.8));timers.push(setTimeout(()=>el.nowChord.textContent=chord.label,i*4*beat*1000));});
    let pos=0;c.melody.forEach(e=>{const t=start+pos*beat,len=e.duration*beat;timers.push(setTimeout(()=>el.nowNote.textContent=e.label,pos*beat*1000));if(!e.rest)synthVoice(e.midi,t,len,el.melodyInstrument.value,1);pos+=e.duration;});
    timers.push(setTimeout(()=>{el.nowNote.textContent='—';el.nowChord.textContent='—';el.status.textContent='Finished.';},pos*beat*1000+200));el.status.textContent='Playing…';
  }

  function vlq(n){const a=[n&127];while((n>>=7))a.unshift((n&127)|128);return a;}
  function midiProgram(name){return({piano:0,pluck:24,bell:14,organ:16,lead:80,flute:73,pad:89,strings:48,soft:88})[name]??0;}
  function makeMidi(){
    const c=composition(),ppq=480,bpm=Number(el.tempo.value),events=[],us=Math.round(60000000/bpm);
    events.push({tick:0,ord:0,bytes:[255,81,3,(us>>16)&255,(us>>8)&255,us&255]});
    events.push({tick:0,ord:0,bytes:[192,midiProgram(el.melodyInstrument.value)]},{tick:0,ord:0,bytes:[193,midiProgram(el.chordInstrument.value)]});
    let pos=0;c.melody.forEach(e=>{const t=Math.round(pos*ppq),d=Math.max(1,Math.round(e.duration*ppq));if(!e.rest){events.push({tick:t,ord:2,bytes:[144,e.midi,100]},{tick:t+d,ord:1,bytes:[128,e.midi,0]});}pos+=e.duration;});
    c.harmony.forEach((h,i)=>{const t=i*4*ppq,end=t+4*ppq;h.notes.forEach(m=>events.push({tick:t,ord:2,bytes:[145,m,58]},{tick:end,ord:1,bytes:[129,m,0]}));});
    events.sort((a,b)=>a.tick-b.tick||a.ord-b.ord);let last=0,track=[];events.forEach(e=>{track.push(...vlq(e.tick-last),...e.bytes);last=e.tick;});track.push(0,255,47,0);
    const l=track.length,bytes=[77,84,104,100,0,0,0,6,0,0,0,1,ppq>>8,ppq&255,77,84,114,107,(l>>>24)&255,(l>>>16)&255,(l>>>8)&255,l&255,...track];return new Blob([new Uint8Array(bytes)],{type:'audio/midi'});
  }

  function renderOffline(){
    const c=composition(),sr=22050,beat=60/Number(el.tempo.value),totalBeats=Math.max(c.beats,c.harmony.length*4),total=Math.min(Math.ceil(totalBeats*beat*sr),sr*180),data=new Float32Array(total);
    function addTone(midi,startBeat,durBeat,amp){const start=Math.floor(startBeat*beat*sr),n=Math.min(Math.floor(durBeat*beat*sr),total-start),f=frequency(midi);for(let i=0;i<n;i++){const attack=Math.min(1,i/(sr*.012)),release=Math.min(1,(n-i)/(sr*.08)),env=attack*release;data[start+i]+=Math.sin(2*Math.PI*f*i/sr)*env*amp;}}
    let pos=0;c.melody.forEach(e=>{if(!e.rest)addTone(e.midi,pos,e.duration,.22);pos+=e.duration;});c.harmony.forEach((h,i)=>h.notes.forEach(m=>addTone(m,i*4,4,.035)));
    let peak=0;for(const x of data)peak=Math.max(peak,Math.abs(x));const norm=peak>0.95?0.95/peak:1;
    const b=new ArrayBuffer(44+data.length*2),v=new DataView(b),write=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};write(0,'RIFF');v.setUint32(4,36+data.length*2,true);write(8,'WAVE');write(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,data.length*2,true);for(let i=0;i<data.length;i++)v.setInt16(44+i*2,Math.max(-32768,Math.min(32767,data[i]*norm*32767)),true);return new Blob([b],{type:'audio/wav'});
  }

  function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  ['input','change'].forEach(evt=>el.text.addEventListener(evt,render));[el.key,el.scale].forEach(x=>x.addEventListener('change',render));el.tempo.addEventListener('input',render);el.play.addEventListener('click',play);el.stop.addEventListener('click',stop);el.midi.addEventListener('click',()=>{if(!buildMelody().length){el.status.textContent='Enter something first.';return;}download(makeMidi(),'sonotype-composition.mid');el.status.textContent='MIDI downloaded.';});el.wav.addEventListener('click',()=>{if(!buildMelody().length){el.status.textContent='Enter something first.';return;}el.status.textContent='Rendering WAV…';setTimeout(()=>{download(renderOffline(),'sonotype-composition.wav');el.status.textContent='WAV downloaded.';},20);});
  render();
})();
