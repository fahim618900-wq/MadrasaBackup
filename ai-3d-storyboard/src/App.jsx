import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  Bot, Play, Pause, Plus, Trash2, Sparkles, Volume2, Download, RotateCcw,
  Film, ChevronDown, Settings2, CircleStop, Camera, Mic2
} from "lucide-react";

const CHARACTERS = {
  Robot:{ body:"#7380ff", accent:"#d9deff", head:"#9aa4bd" },
  Boy:{ body:"#4aa3ff", accent:"#f4c6a3", head:"#f4c6a3" },
  Girl:{ body:"#e77dff", accent:"#ffd0e4", head:"#ffd0e4" },
  Alien:{ body:"#66d98b", accent:"#b7f5c9", head:"#86e9a3" }
};
const ACTIONS=["idle","walk","talk","wave","jump","point"];
const CAMERAS=["wide","close","pan-left","pan-right","over-shoulder"];
const initialClips=[
  {id:"a",name:"Scene 1",duration:4,character:"Robot",action:"talk",dialogue:"Hello! Welcome to our story.",camera:"wide"},
  {id:"b",name:"Scene 2",duration:3.5,character:"Boy",action:"wave",dialogue:"Hi, Robot!",camera:"close"}
];

function Character({type, action, active, x}) {
  const group=useRef();
  const t=useRef(0);
  const colors=CHARACTERS[type];
  useFrame((_,delta)=>{
    t.current+=delta;
    if(!group.current)return;
    const s=Math.sin(t.current*4);
    group.current.position.x=x;
    group.current.position.y=action==="jump"?Math.max(0,s)*.35:0;
    group.current.rotation.y=action==="walk"?Math.sin(t.current*3)*.12:0;
  });
  return <group ref={group} position={[x,0,0]}>
    <mesh position={[0,1.15,0]} castShadow><capsuleGeometry args={[.38,.7,8,16]}/><meshStandardMaterial color={colors.body}/></mesh>
    <mesh position={[0,1.95,0]} castShadow><sphereGeometry args={[.43,20,14]}/><meshStandardMaterial color={colors.head}/></mesh>
    <mesh position={[0,1.98,.39]}><sphereGeometry args={[.07,12,8]}/><meshStandardMaterial color="#111827"/></mesh>
    <mesh position={[.18,1.98,.36]}><sphereGeometry args={[.07,12,8]}/><meshStandardMaterial color="#111827"/></mesh>
    <mesh position={[0,.57,0]}><boxGeometry args={[.18,.5,.2]}/><meshStandardMaterial color={colors.accent}/></mesh>
    <mesh position={[-.24,1.1,0]} rotation={[0,0, action==="wave"?-.8:0]}><capsuleGeometry args={[.09,.5,6,10]}/><meshStandardMaterial color={colors.body}/></mesh>
    <mesh position={[.24,1.1,0]} rotation={[0,0, action==="wave"?.8:0]}><capsuleGeometry args={[.09,.5,6,10]}/><meshStandardMaterial color={colors.body}/></mesh>
    {active && <pointLight position={[0,2.5,.8]} intensity={1.2} distance={3} color={colors.body}/>}
  </group>;
}

function CameraDirector({cameraType, playing}) {
  const {camera}=useThree();
  useEffect(()=>{
    const targets={wide:[0,2.4,7],close:[0,2.0,4.1],"pan-left":[-3,2.6,6],"pan-right":[3,2.6,6],"over-shoulder":[2,2.3,4.8]};
    const p=targets[cameraType]||targets.wide;
    camera.position.set(...p);
    camera.lookAt(0,1.25,0);
  },[camera,cameraType]);
  useFrame((_,d)=>{
    if(playing && (cameraType==="pan-left"||cameraType==="pan-right")){
      camera.position.x += (cameraType==="pan-left"?-1:1)*d*.35;
      camera.lookAt(0,1.2,0);
    }
  });
  return null;
}

function Stage({clip,playing,environment}) {
  const bg=environment==="Room" ? "#202636" : environment==="Park" ? "#173326" : "#10152c";
  const positions={Robot:-1.7,Boy:0,Girl:1.7,Alien:0};
  const active=clip?.character||"Robot";
  return <div className="absolute inset-0">
    <Canvas shadows camera={{position:[0,2.4,7],fov:45}} gl={{preserveDrawingBuffer:true,antialias:true}}>
      <color attach="background" args={[bg]}/>
      <ambientLight intensity={.7}/>
      <directionalLight position={[4,7,5]} intensity={2} castShadow shadow-mapSize={[2048,2048]}/>
      <CameraDirector cameraType={clip?.camera||"wide"} playing={playing}/>
      <Suspense fallback={null}>
        <Environment preset={environment==="Park"?"forest":environment==="Sci-Fi Stage"?"city":"apartment"}/>
      </Suspense>
      {Object.keys(CHARACTERS).map((name,i)=><Character key={name} type={name} action={name===active?(clip?.action||"idle"):"idle"} active={name===active} x={positions[name]}/>)}
      <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[30,30]}/><meshStandardMaterial color={environment==="Park"?"#24452f":"#171b28"}/></mesh>
      <ContactShadows position={[0,.01,0]} opacity={.45} scale={10} blur={2}/>
      {clip?.dialogue && playing && <Text position={[0,3.15,0]} fontSize={.22} maxWidth={5} textAlign="center" color="white" anchorX="center" anchorY="middle">{clip.dialogue}</Text>}
      <OrbitControls enablePan={false} minDistance={3.2} maxDistance={10}/>
    </Canvas>
  </div>;
}

function App(){
  const [clips,setClips]=useState(initialClips);
  const [selected,setSelected]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [prompt,setPrompt]=useState("");
  const [environment,setEnvironment]=useState("Sci-Fi Stage");
  const [status,setStatus]=useState("Ready");
  const [elapsed,setElapsed]=useState(0);
  const [recording,setRecording]=useState(false);
  const canvasWrap=useRef(null);
  const recorder=useRef(null);
  const chunks=useRef([]);
  const clip=clips[selected]||clips[0];

  const total=useMemo(()=>clips.reduce((s,c)=>s+Number(c.duration||0),0),[clips]);
  const timeBefore=useMemo(()=>clips.slice(0,selected).reduce((s,c)=>s+Number(c.duration||0),0),[clips,selected]);

  useEffect(()=>{
    if(!playing)return;
    const id=setInterval(()=>{
      setElapsed(e=>{
        const n=e+.05;
        if(n>=total){ setPlaying(false); return total; }
        return n;
      });
    },50);
    return()=>clearInterval(id);
  },[playing,total]);

  useEffect(()=>{
    if(!playing)return;
    const local=elapsed-timeBefore;
    if(local<0 || local>Number(clip?.duration||0)){
      let acc=0;
      const idx=clips.findIndex(c=>{const end=acc+Number(c.duration); const ok=elapsed>=acc&&elapsed<end; acc=end; return ok;});
      if(idx>=0)setSelected(idx);
    }
  },[elapsed,playing,timeBefore,clip,clips]);

  useEffect(()=>{
    if(!playing || !clip?.dialogue) return;
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(clip.dialogue);
    u.rate=1; u.pitch=1;
    window.speechSynthesis.speak(u);
    return()=>window.speechSynthesis.cancel();
  },[selected,playing,clip?.dialogue]);

  function update(field,value){
    setClips(cs=>cs.map((c,i)=>i===selected?{...c,[field]:value}:c));
  }
  function addClip(){
    const id=crypto.randomUUID();
    setClips(cs=>[...cs,{id,name:`Scene ${cs.length+1}`,duration:4,character:"Robot",action:"idle",dialogue:"",camera:"wide"}]);
    setSelected(clips.length);
  }
  function deleteClip(){
    if(clips.length===1)return;
    setClips(cs=>cs.filter((_,i)=>i!==selected));
    setSelected(Math.max(0,selected-1));
  }
  async function autoDirector(){
    if(!prompt.trim())return;
    setStatus("AI director parsing...");
    try{
      const res=await fetch("/api/parse-script",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
      if(!res.ok)throw new Error("API unavailable");
      const data=await res.json();
      if(data.clips?.length){setClips(data.clips);setSelected(0);setElapsed(0);setStatus(`${data.clips.length} scenes generated`);}
    }catch{
      setStatus("Parser API unavailable — using local parser");
      const words=prompt.split(/(?:,| then | and then )/i).map(s=>s.trim()).filter(Boolean);
      const fallback=words.map((s,i)=>({id:crypto.randomUUID(),name:`Scene ${i+1}`,duration:3.5,character:/boy/i.test(s)?"Boy":/girl/i.test(s)?"Girl":/alien/i.test(s)?"Alien":"Robot",action:/wave/i.test(s)?"wave":/walk/i.test(s)?"walk":/jump/i.test(s)?"jump":/say|hello|talk/i.test(s)?"talk":"idle",dialogue:/say|hello|talk/i.test(s)?s:"",camera:i%2?"close":"wide"}));
      setClips(fallback.length?fallback:initialClips);setSelected(0);setElapsed(0);
    }
  }
  function speak(){
    if(!clip?.dialogue)return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(clip.dialogue));
  }
  function reset(){setPlaying(false);setElapsed(0);setSelected(0);setStatus("Reset");}
  function startRecording(){
    const canvas=canvasWrap.current?.querySelector("canvas");
    if(!canvas?.captureStream){setStatus("Canvas capture is not supported in this browser");return;}
    const stream=canvas.captureStream(30);
    const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm";
    recorder.current=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:7000000});
    chunks.current=[];
    recorder.current.ondataavailable=e=>e.data.size&&chunks.current.push(e.data);
    recorder.current.onstop=()=>{
      const blob=new Blob(chunks.current,{type:"video/webm"});
      const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="storyboard-video.webm";a.click();
      setStatus("Video exported");
    };
    recorder.current.start();
    setRecording(true);setElapsed(0);setSelected(0);setPlaying(true);setStatus("Recording preview...");
  }
  useEffect(()=>{
    if(recording && !playing && recorder.current?.state==="recording"){recorder.current.stop();setRecording(false);}
  },[playing,recording]);

  const progress=total?elapsed/total:0;
  return <div className="h-full w-full bg-[#070a10] text-slate-100 flex flex-col overflow-hidden">
    <header className="h-14 shrink-0 glass flex items-center px-4 gap-3 z-20">
      <div className="flex items-center gap-2 font-semibold"><div className="h-8 w-8 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center"><Bot size={18}/></div>AI 3D Storyboard</div>
      <div className="text-xs text-slate-500">Director Studio</div>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={reset} className="glass-soft px-3 py-1.5 rounded-lg text-xs flex items-center gap-2"><RotateCcw size={14}/>Reset</button>
        <button onClick={startRecording} disabled={recording} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2"><Download size={14}/>Export WebM</button>
      </div>
    </header>

    <div className="flex-1 min-h-0 flex">
      <aside className="w-72 shrink-0 glass border-y-0 border-l-0 p-3 overflow-y-auto scrollbar">
        <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">AI Auto-Director</div>
        <div className="glass-soft rounded-xl p-2">
          <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Robot says Hello to Boy, then Boy waves back..." className="w-full h-24 bg-transparent outline-none resize-none text-sm placeholder:text-slate-600"/>
          <button onClick={autoDirector} className="w-full mt-2 rounded-lg bg-white/10 hover:bg-white/15 py-2 text-xs flex items-center justify-center gap-2"><Sparkles size={14}/>Build Storyboard</button>
        </div>

        <div className="mt-5 text-[11px] uppercase tracking-widest text-slate-500 mb-2">Scene</div>
        <div className="space-y-2">
          <label className="text-xs text-slate-400">Character</label>
          <select value={clip?.character} onChange={e=>update("character",e.target.value)} className="w-full bg-[#111622] rounded-lg px-3 py-2 text-sm outline-none">{Object.keys(CHARACTERS).map(x=><option key={x}>{x}</option>)}</select>
          <label className="text-xs text-slate-400 block mt-2">Action</label>
          <select value={clip?.action} onChange={e=>update("action",e.target.value)} className="w-full bg-[#111622] rounded-lg px-3 py-2 text-sm outline-none">{ACTIONS.map(x=><option key={x}>{x}</option>)}</select>
          <label className="text-xs text-slate-400 block mt-2">Camera</label>
          <select value={clip?.camera} onChange={e=>update("camera",e.target.value)} className="w-full bg-[#111622] rounded-lg px-3 py-2 text-sm outline-none">{CAMERAS.map(x=><option key={x}>{x}</option>)}</select>
          <label className="text-xs text-slate-400 block mt-2">Duration: {Number(clip?.duration||0).toFixed(1)}s</label>
          <input className="w-full range" type="range" min="1" max="12" step=".1" value={clip?.duration||4} onChange={e=>update("duration",e.target.value)}/>
        </div>

        <div className="mt-5 text-[11px] uppercase tracking-widest text-slate-500 mb-2">Dialogue / TTS</div>
        <textarea value={clip?.dialogue||""} onChange={e=>update("dialogue",e.target.value)} placeholder="Character dialogue..." className="w-full h-28 glass-soft rounded-xl p-3 text-sm outline-none resize-none"/>
        <button onClick={speak} className="w-full mt-2 glass-soft rounded-lg py-2 text-xs flex items-center justify-center gap-2"><Volume2 size={14}/>Preview Voice</button>

        <div className="mt-5 text-[11px] uppercase tracking-widest text-slate-500 mb-2">Environment</div>
        <select value={environment} onChange={e=>setEnvironment(e.target.value)} className="w-full bg-[#111622] rounded-lg px-3 py-2 text-sm outline-none"><option>Room</option><option>Park</option><option>Sci-Fi Stage</option></select>
        <div className="mt-4 text-[11px] text-slate-500 flex gap-2 items-start"><Mic2 size={13} className="mt-0.5"/>SpeechSynthesis is used for browser preview. Captured WebM contains the WebGL video; production audio muxing can be added with a server TTS provider.</div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <section ref={canvasWrap} className="relative flex-1 min-h-0 grid-bg overflow-hidden">
          <Stage clip={clip} playing={playing} environment={environment}/>
          <div className="absolute top-3 left-3 glass rounded-xl px-3 py-2 text-xs flex items-center gap-2"><Camera size={14}/>{clip?.camera}</div>
          <div className="absolute top-3 right-3 glass rounded-xl px-3 py-2 text-xs">{status}</div>
          {clip?.dialogue && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-2xl px-5 py-3 max-w-xl text-sm text-center">{clip.dialogue}</div>}
        </section>

        <section className="h-52 shrink-0 glass border-x-0 border-b-0 flex flex-col">
          <div className="h-12 flex items-center px-3 gap-2 border-b border-white/5">
            <button onClick={()=>{if(!playing&&elapsed>=total){setElapsed(0);setSelected(0)} setPlaying(p=>!p)}} className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center">{playing?<Pause size={15}/>:<Play size={15} fill="currentColor"/>}</button>
            <span className="text-xs tabular-nums text-slate-300">{elapsed.toFixed(1)}s / {total.toFixed(1)}s</span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-indigo-400" style={{width:`${progress*100}%`}}/></div>
            <button onClick={addClip} className="glass-soft px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"><Plus size={14}/>Scene</button>
            <button onClick={deleteClip} className="glass-soft px-3 py-1.5 rounded-lg text-xs text-rose-300 flex items-center gap-1"><Trash2 size={14}/>Delete</button>
          </div>
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 scrollbar">
            <div className="flex gap-2 min-w-max h-full">
              {clips.map((c,i)=><button key={c.id} onClick={()=>{setSelected(i);setElapsed(clips.slice(0,i).reduce((s,x)=>s+Number(x.duration),0))}} className={`w-48 h-full rounded-xl p-3 text-left border transition ${i===selected?"bg-indigo-500/15 border-indigo-400/50":"glass-soft border-white/5"}`}>
                <div className="flex items-center justify-between"><span className="text-xs font-medium">{c.name}</span><span className="text-[10px] text-slate-500">{Number(c.duration).toFixed(1)}s</span></div>
                <div className="mt-3 h-2 rounded bg-white/5 overflow-hidden"><div className="h-full bg-indigo-400/70" style={{width:`${Math.min(100,Number(c.duration)/12*100)}%`}}/></div>
                <div className="mt-3 text-[11px] text-slate-400">{c.character} · {c.action}</div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">{c.dialogue||"No dialogue"}</div>
              </button>)}
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>;
}
