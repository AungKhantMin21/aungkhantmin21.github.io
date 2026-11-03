/* Engine sound synthesizer. Shared by the AudioWorklet and the ScriptProcessor fallback.
   Model: crank angle advances with rpm; each cylinder fires at its crank angle and injects a
   pressure pulse into an exhaust pipe (comb resonator), then muffler/body resonances (band-pass
   formants), soft saturation, intake noise, turbo whistle, road + wind + tyre noise.
   EV: motor/inverter whine orders + gear whine instead of combustion. */
class Biquad{
  constructor(){this.b0=1;this.b1=0;this.b2=0;this.a1=0;this.a2=0;this.z1=0;this.z2=0;}
  set(type,f,Q,sr,gainDb){
    const w=2*Math.PI*Math.min(f,sr*0.45)/sr,c=Math.cos(w),s=Math.sin(w),al=s/(2*Q);let b0,b1,b2,a0,a1,a2;
    if(type==='bp'){b0=al;b1=0;b2=-al;a0=1+al;a1=-2*c;a2=1-al;}
    else if(type==='lp'){b0=(1-c)/2;b1=1-c;b2=(1-c)/2;a0=1+al;a1=-2*c;a2=1-al;}
    else if(type==='hp'){b0=(1+c)/2;b1=-(1+c);b2=(1+c)/2;a0=1+al;a1=-2*c;a2=1-al;}
    else { // peaking
      const A=Math.pow(10,(gainDb||0)/40);b0=1+al*A;b1=-2*c;b2=1-al*A;a0=1+al/A;a1=-2*c;a2=1-al/A;}
    this.b0=b0/a0;this.b1=b1/a0;this.b2=b2/a0;this.a1=a1/a0;this.a2=a2/a0;return this;
  }
  run(x){const y=this.b0*x+this.z1;this.z1=this.b1*x-this.a1*y+this.z2;this.z2=this.b2*x-this.a2*y;return y;}
}
class EngineDSP{
  constructor(sr){
    this.sr=sr;this.theta=0;this.rpm=800;this.load=0;this.boost=0;
    this.t={rpm:800,load:0,boost:0,speed:0,slip:0,on:0,brake:0};
    this.buf=new Float32Array(16384);this.w=0;this.loopLp=0;this.PK=new Int32Array(64);this.PN=new Int32Array(64);this.PA=new Float32Array(64);this.np=0;
    this.prof=null;this.brown=0;this.env=0;this.blow=0;this.pop=0;this.phase=[0,0,0,0,0,0];this.vol=0;
    this.road=new Biquad().set('lp',380,0.7,sr);this.wind=new Biquad().set('bp',520,0.6,sr);
    this.tyre=new Biquad().set('bp',2100,7,sr);this.tyre2=new Biquad().set('bp',1650,9,sr);
    this.intake=new Biquad().set('bp',700,1.2,sr);this.blowF=new Biquad().set('bp',2600,1.5,sr);
    this.dc=0;this.seed=12345;
  }
  rnd(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296;}
  setProfile(p){
    this.prof=p;const sr=this.sr;
    this.hp=new Biquad().set('hp',28,0.7,sr);
    if(p.ev)return;
    this.dcb=new Biquad().set('hp',38,0.7,sr);
    this.form=p.formants.map(([f,Q,g])=>({bq:new Biquad().set('bp',f,Q,sr),g}));
    this.body=new Biquad().set('lp',p.lp,0.75,sr);this.body2=new Biquad().set('lp',p.lp*1.4,0.7,sr);
    this.sub=new Biquad().set('lp',p.sub||160,0.9,sr);
    this.D=Math.round(p.pipeMs/1000*sr);
    // per-cylinder variation: makes the half/1st-order "lope" that gives an engine its character
    this.cv=p.angles.map((_,i)=>1+(p.cylVar||0.1)*Math.sin(i*2.3+0.7));
  }
  process(out,n){
    const p=this.prof,sr=this.sr,T=this.t;
    for(let i=0;i<n;i++){
      // parameter smoothing
      this.rpm+=(T.rpm-this.rpm)*0.0016;this.load+=(T.load-this.load)*0.0025;this.boost+=(T.boost-this.boost)*0.0008;
      this.vol+=((T.on?1:0)-this.vol)*0.0004;
      const spd=T.speed;let s=0;
      if(!p){out[i]=0;continue;}
      if(p.ev){
        // motor whine: electrical orders of motor speed + reduction gear mesh + inverter hiss
        const f=Math.max(0,this.rpm)/60;const ld=this.load;
        const orders=[[p.poles,0.05+0.11*ld],[p.poles*2,0.025+0.05*ld],[p.poles*3.5,0.012*ld],[p.gearTeeth,0.02+0.03*ld]];
        for(let k=0;k<orders.length;k++){this.phase[k]+=2*Math.PI*f*orders[k][0]/sr;if(this.phase[k]>6.2832)this.phase[k]-=6.2832;
          s+=Math.sin(this.phase[k])*orders[k][1]*Math.min(1,f/8);}
        s*=0.9;
      }else{
        const degPerSample=this.rpm/60*360/sr;const prev=this.theta;this.theta+=degPerSample;
        const wrap=this.theta>=720;if(wrap)this.theta-=720;
        const ang=p.angles,interval=720/ang.length/(this.rpm/60*360);
        for(let c=0;c<ang.length;c++){
          const a=ang[c];const crossed=wrap?(a>=prev||a<this.theta):(a>=prev&&a<this.theta);
          if(crossed){
            const idleLope=this.rpm<1100?0.35:0.12;
            let amp=(0.28+0.72*(this.load*0.6+this.load*this.load*0.4))*this.cv[c]*(1+idleLope*(this.rnd()-0.5));
            amp*=1+this.boost*0.45;
            // off-throttle at high rpm: weak, ragged pulses + occasional exhaust pop
            if(this.load<0.05&&this.rpm>2500){amp*=0.35;if(p.pops&&this.rnd()<0.012*p.pops)this.pop=1;}
            const Tp=Math.min(p.pulseMs/1000,interval*0.42);
            if(this.np<64){const j=this.np++;this.PK[j]=0;this.PN[j]=Math.max(8,Tp*sr|0);this.PA[j]=amp;}
          }
        }
        let x=0;
        for(let k=this.np-1;k>=0;k--){const n=this.PN[k],a=this.PA[k];const ph=this.PK[k]/n;
          if(ph<1){const sn=Math.sin(Math.PI*ph);x+=a*sn*sn;}
          x+=a*0.32*(this.rnd()*2-1)*Math.exp(-ph*1.6);
          if(++this.PK[k]>n*3){const l=--this.np;this.PK[k]=this.PK[l];this.PN[k]=this.PN[l];this.PA[k]=this.PA[l];}}
        x=this.dcb.run(x);
        if(this.pop>0){x+=this.pop*(this.rnd()*2-1)*1.6;this.pop*=0.992;if(this.pop<0.01)this.pop=0;}
        // exhaust pipe: delay line with damped feedback (quarter-wave resonances)
        const mask=16383;const d=this.buf[(this.w-this.D)&mask];
        this.loopLp+=(d-this.loopLp)*p.pipeDamp;
        const y=x+p.pipeFb*this.loopLp;this.buf[this.w&mask]=y;this.w++;
        let e=this.body.run(this.body2.run(y))*p.bodyG;
        for(const f of this.form)e+=f.bq.run(y)*f.g;
        e+=this.sub.run(y)*(p.subG||0.6);
        // drive harder under load for a thicker, heavier tone
        const drive=1.2+this.load*2.2+this.boost;e=Math.tanh(e*drive*p.gain)/Math.tanh(drive*0.9);
        // intake roar under load
        this.env+=(Math.abs(x)-this.env)*0.02;
        e+=this.intake.run(this.rnd()*2-1)*this.env*this.load*p.intakeG;
        // turbo: spool whistle + blow-off on lift
        if(p.turbo){this.phase[0]+=2*Math.PI*(2600+this.boost*6200+this.rpm*0.35)/sr;if(this.phase[0]>6.2832)this.phase[0]-=6.2832;
          e+=Math.sin(this.phase[0])*this.boost*this.boost*0.05;
          if(this.blow>0){e+=this.blowF.run(this.rnd()*2-1)*this.blow*0.9;this.blow*=0.99985;if(this.blow<0.01)this.blow=0;}}
        s=e*p.master;
      }
      s*=this.vol;
      // road rumble (brown noise) + wind + tyre squeal, for every car
      this.brown=(this.brown+0.02*(this.rnd()*2-1))*0.995;
      s+=this.road.run(this.brown)*Math.min(1,spd/30)*0.9;
      s+=this.wind.run(this.rnd()*2-1)*Math.min(0.12,spd*spd*0.00009);
      const sl=Math.max(0,T.slip-0.08);
      if(sl>0){const nz=this.rnd()*2-1;s+=(this.tyre.run(nz)+this.tyre2.run(nz)*0.7)*Math.min(0.55,sl*2.2);}
      s=this.hp.run(s);
      out[i]=s>1?1:s<-1?-1:s;
    }
  }
}
