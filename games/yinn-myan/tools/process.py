import json,math,sys,collections
d=json.load(open(sys.argv[1]));R=json.load(open(sys.argv[2]));els=d['elements']
LAT0,LON0=16.8534,96.1407
KX=math.cos(math.radians(LAT0))*111320;KZ=110574
P=lambda la,lo:((lo-LON0)*KX,(LAT0-la)*KZ)
def resample(pts,step):
  out=[pts[0]];acc=0.0;i=1;a=pts[0]
  for b in pts[1:]:
    seg=math.dist(a,b)
    while acc+seg>=step:
      t=(step-acc)/seg;a=(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);out.append(a);seg=math.dist(a,b);acc=0
    acc+=seg;a=b
  if math.dist(out[-1],pts[-1])>0.5:out.append(tuple(pts[-1]))
  return out
# lanes per node-edge -> per-point
sb=[tuple(p) for p in R['sb']];nb=[tuple(p) for p in R['nb']]
def lanesPerDir(tag,twoWay=False):
  try:v=int(tag)
  except:return None
  return v
# cumulative along SB with lanes per edge
cum=[0]
for i in range(1,len(sb)):cum.append(cum[-1]+math.dist(sb[i-1],sb[i]))
edgeLanes=[]
for i,l in enumerate(R['sbLanes']):
  try:v=int(l)
  except:v=None
  edgeLanes.append(v)
S=resample(sb,1.0);N=len(S)
# lane count along S (by nearest edge)
def edgeAt(s):
  lo,hi=0,len(cum)-1
  while hi-lo>1:
    m=(lo+hi)//2
    if cum[m]<=s:lo=m
    else:hi=m
  return lo
NBr=resample(nb,1.0)
# grid index for NB
def grid(pts,c=20):
  g=collections.defaultdict(list)
  for i,p in enumerate(pts):g[(int(p[0]//c),int(p[1]//c))].append(i)
  return g
gNB=grid(NBr)
def nearestIn(pts,g,p,c=20,r=3):
  bi=-1;bd=1e18;cx,cz=int(p[0]//c),int(p[1]//c)
  for dx in range(-r,r+1):
    for dz in range(-r,r+1):
      for i in g.get((cx+dx,cz+dz),[]):
        dd=(pts[i][0]-p[0])**2+(pts[i][1]-p[1])**2
        if dd<bd:bd=dd;bi=i
  return bi,math.sqrt(bd) if bi>=0 else 1e9
sep=[];lanes=[]
for i,p in enumerate(S):
  j,dd=nearestIn(NBr,gNB,p)
  # tangent
  a=S[max(i-3,0)];b=S[min(i+3,N-1)];tx,tz=b[0]-a[0],b[1]-a[1];l=math.hypot(tx,tz) or 1;tx/=l;tz/=l
  nx,nz=-tz,tx  # right normal
  side=((NBr[j][0]-p[0])*nx+(NBr[j][1]-p[1])*nz) if j>=0 else 0
  sep.append(dd if (j>=0 and side<0 and dd<60) else 0.0)  # NB must be on the left
  e=edgeAt(i);v=edgeLanes[min(e,len(edgeLanes)-1)]
  lanes.append(v)
# two-way (sep~0) segments carry total lanes -> per direction
lp=[]
for i in range(N):
  v=lanes[i]
  if v is None:v=-1
  if sep[i]<2 and v>=4:v=v//2
  lp.append(v)
# fill unknown lanes with neighbours, clamp 2..4
known=[v for v in lp if v>0]
for i in range(N):
  if lp[i]<=0:
    k=1
    while True:
      if i-k>=0 and lp[i-k]>0:lp[i]=lp[i-k];break
      if i+k<N and lp[i+k]>0:lp[i]=lp[i+k];break
      k+=1
  lp[i]=max(2,min(4,lp[i]))
# smooth sep with a median filter then moving average (nearest-point jumps)
def movavg(a,w):
  out=[];acc=0;q=collections.deque()
  pre=[0]
  for v in a:pre.append(pre[-1]+v)
  for i in range(len(a)):
    lo=max(0,i-w);hi=min(len(a),i+w+1);out.append((pre[hi]-pre[lo])/(hi-lo))
  return out
sepM=[sorted(sep[max(0,i-15):i+16])[len(sep[max(0,i-15):i+16])//2] for i in range(N)]
sepS=movavg(sepM,25)
# lanes: mode filter over 60 m
lpS=[collections.Counter(lp[max(0,i-30):i+31]).most_common(1)[0][0] for i in range(N)]
# median half-width from carriageway separation, smoothed and taper-limited (1 m per 20 m)
medRaw=[(sepS[i]/2-lpS[i]*3.5/2) if sepS[i]>=2 else 0.3 for i in range(N)]
medRaw=[max(0.3,min(12,v)) for v in medRaw]
medS=movavg(medRaw,20)
for i in range(1,N):medS[i]=min(medS[i],medS[i-1]+0.05)
for i in range(N-2,-1,-1):medS[i]=min(medS[i],medS[i+1]+0.05)
offS=movavg([medS[i]+lpS[i]*3.5/2 for i in range(N)],25)
# the southbound carriageway (the one you drive) keeps its exact OSM shape; the road centre sits offS to its left
def lap(pts,it):
  X=[p[0] for p in pts];Z=[p[1] for p in pts];n=len(X)
  for _ in range(it):
    X=[X[0]]+[X[i]*0.5+(X[i-1]+X[i+1])*0.25 for i in range(1,n-1)]+[X[-1]]
    Z=[Z[0]]+[Z[i]*0.5+(Z[i-1]+Z[i+1])*0.25 for i in range(1,n-1)]+[Z[-1]]
  return list(zip(X,Z))
# OSM nodes make sharp corners; relax them into the smooth arcs the real kerbs follow
Ssm=lap(S,260)
C=[]
for i,p in enumerate(Ssm):
  a=Ssm[max(i-4,0)];b=Ssm[min(i+4,N-1)];tx,tz=b[0]-a[0],b[1]-a[1];l=math.hypot(tx,tz) or 1;tx/=l;tz/=l;nx,nz=-tz,tx
  C.append((p[0]-nx*offS[i],p[1]-nz*offS[i]))
Cs=lap(C,120)
cl=resample(Cs,5.0)
med=[];lan=[]
for k in range(len(cl)):
  i=min(N-1,k*5)
  med.append(round(medS[i],2));lan.append(lpS[i])
# ---- projection helper on centerline (1 m resample of cl) ----
CL=resample(cl,1.0);M=len(CL)
T=[];
for i in range(M):
  a=CL[max(i-2,0)];b=CL[min(i+2,M-1)];tx,tz=b[0]-a[0],b[1]-a[1];l=math.hypot(tx,tz) or 1;T.append((tx/l,tz/l))
gCL=grid(CL)
def proj(p):
  i,dd=nearestIn(CL,gCL,p,20,4)
  if i<0:return None
  tx,tz=T[i];dx,dz=p[0]-CL[i][0],p[1]-CL[i][1]
  return (i+dx*tx+dz*tz, dx*(-tz)+dz*tx, dd)
def medAt(s):return med[min(len(med)-1,max(0,int(s/5)))]
def lanAt(s):return lan[min(len(lan)-1,max(0,int(s/5)))]
def curbAt(s):return medAt(s)+lanAt(s)*3.5+0.5
nodes={e['id']:e for e in els if e['type']=='node'}
ways=[e for e in els if e['type']=='way']
pyIds=set(R['sbNodes'])|set(R['nbNodes'])
# ---- junctions ----
W={'primary':16,'secondary':13,'tertiary':11,'residential':8,'living_street':7,'unclassified':8}
J=[]
for w in ways:
  t=w.get('tags',{});h=t.get('highway')
  if h not in W:continue
  nm=t.get('name:en') or t.get('name') or ''
  if 'Pyay Road' in nm or 'ပြည်လမ်း' in nm:continue
  pts=[P(g['lat'],g['lon']) for g in w['geometry']]
  pr=[proj(p) for p in pts]
  pr=[q for q in pr if q and q[2]<200]
  if not pr:continue
  near=[q for q in pr if abs(q[1])<curbAt(q[0])+6]
  if not near:continue
  s0=sum(q[0] for q in near)/len(near)
  if s0<15 or s0>M-15:continue
  sides=set(1 if q[1]>0 else -1 for q in pr if abs(q[1])>curbAt(q[0])+8)
  side=0 if len(sides)==2 else (sides.pop() if sides else (1 if near[0][1]>0 else -1))
  J.append(dict(s=s0,side=side,w=W[h],name=nm,h=h))
J.sort(key=lambda j:j['s'])
merged=[]
for j in J:
  if merged and abs(j['s']-merged[-1]['s'])<14:
    m=merged[-1]
    if m['side']!=j['side']:m['side']=0
    m['w']=max(m['w'],j['w']);m['name']=m['name'] or j['name']
    if W.get(j['h'],0)>W.get(m['h'],0):m['name']=j['name'] or m['name'];m['h']=j['h']
  else:merged.append(dict(j))
# ---- point features ----
sig=[];cross=[];bus=[];trees=[]
for n in nodes.values():
  t=n.get('tags',{});q=proj(P(n['lat'],n['lon']))
  if not q or q[0]<5 or q[0]>M-5:continue
  s,dd,_=q;cb=curbAt(s)
  if t.get('highway')=='traffic_signals' and abs(dd)<cb+8:sig.append((s,dd,t.get('name','')))
  elif t.get('highway')=='crossing' and abs(dd)<cb+2:cross.append(s)
  elif t.get('highway')=='bus_stop' and abs(dd)<cb+25:bus.append(dict(s=round(s,1),side=1 if dd>0 else -1,name=t.get('name:en') or t.get('name') or ''))
  elif t.get('natural')=='tree' and cb+0.5<abs(dd)<cb+30:trees.append([round(s,1),round(dd,1)])
for w in ways:
  t=w.get('tags',{})
  if t.get('natural')=='tree_row':
    pts=resample([P(g['lat'],g['lon']) for g in w['geometry']],8)
    for p in pts:
      q=proj(p)
      if q and curbAt(q[0])+0.5<abs(q[1])<curbAt(q[0])+30:trees.append([round(q[0],1),round(q[1],1)])
# cluster signals into junction stop lines (southbound uses the first signal it meets)
sig.sort();SG=[]
for s,dd,nm in sig:
  if SG and s-SG[-1]['s1']<40:SG[-1]['s1']=s;SG[-1]['name']=SG[-1]['name'] or nm
  else:SG.append(dict(s0=s,s1=s,name=nm))
signals=[]
for g in SG:
  mid=(g['s0']+g['s1'])/2
  # attach to nearest junction
  jn=min(merged,key=lambda j:abs(j['s']-mid)) if merged else None
  if jn and abs(jn['s']-mid)<45:jn['signal']=True;stop=jn['s']-jn['w']/2-7;nm=g['name'] or jn['name']
  else:stop=g['s0']-3;nm=g['name']
  if signals and abs(signals[-1]['stop']-stop)<25:continue
  signals.append(dict(stop=round(stop,1),name=nm))
cross.sort();CR=[]
for s in cross:
  if not CR or s-CR[-1]>15:CR.append(round(s,1))
# ---- buildings ----
B=[]
for w in ways:
  t=w.get('tags',{})
  if 'building' not in t or 'geometry' not in w:continue
  pts=[P(g['lat'],g['lon']) for g in w['geometry']]
  if len(pts)<4:continue
  if math.dist(pts[0],pts[-1])<0.5:pts=pts[:-1]
  pr=[proj(p) for p in pts]
  if any(q is None for q in pr):continue
  mind=min(abs(q[1])-curbAt(q[0]) for q in pr)
  if mind<3.0 or mind>110:continue
  if min(q[0] for q in pr)<-5 or max(q[0] for q in pr)>M+5:continue
  try:lv=int(float(t.get('building:levels','0')))
  except:lv=0
  B.append(dict(p=[[round(x,1),round(z,1)] for x,z in pts],lv=lv,n=t.get('name:en') or t.get('name') or '',ty=t.get('building')))
# ---- flyovers (elevated Pyay Road bridges) ----
F=[]
for w in ways:
  t=w.get('tags',{})
  if t.get('bridge')=='yes' and t.get('highway') in('trunk','primary') and (t.get('layer') or '0')>='1':
    pts=[P(g['lat'],g['lon']) for g in w['geometry']]
    if math.dist(pts[0],pts[-1])<60:continue
    pr=[proj(p) for p in pts]
    if any(q is None or q[0]<0 or q[0]>M for q in pr):continue
    F.append(dict(p=[[round(x,1),round(z,1)] for x,z in pts],n=t.get('name:en') or t.get('name') or '',lanes=int(t.get('lanes') or 2)))
# ---- drivable decks: one-way elevated Pyay Road chains, as offsets from the main centerline ----
# A deck is described in main-road coordinates (s along the road, d lateral) every 5 m, so the game
# can reuse project()/frameAt() for it. Southbound chains (s increasing) are drivable; each one is
# paired with the northbound chain beside it (one shared structure, painted line between).
def chains():
  br=[w for w in ways if w.get('tags',{}).get('bridge')=='yes' and w['tags'].get('highway') in('trunk','primary')
      and (w['tags'].get('layer') or '0')>='1' and w['tags'].get('oneway')=='yes']
  start={w['nodes'][0]:w for w in br};ends={w['nodes'][-1] for w in br};out=[]
  for w in br:
    if w['nodes'][0] in ends:continue
    seq=[w]
    while seq[-1]['nodes'][-1] in start:seq.append(start[seq[-1]['nodes'][-1]])
    pts=[];[pts.extend([P(g['lat'],g['lon']) for g in x['geometry']][1 if pts else 0:]) for x in seq]
    lanes=[int(x['tags'].get('lanes') or 0) for x in seq]
    out.append(dict(ids=[x['id'] for x in seq],pts=pts,lanes=max(lanes) or 1))
  return out
def asOffsets(pts):
  q=[proj(p) for p in resample(pts,2.0)]
  if any(x is None for x in q):return None
  return [(x[0],x[1]) for x in q]
def sampleD(offs,s):
  best=None
  for (s0,d0),(s1,d1) in zip(offs,offs[1:]):
    lo,hi=min(s0,s1),max(s0,s1)
    if lo<=s<=hi and hi-lo>1e-6:best=d0+(d1-d0)*(s-s0)/(s1-s0);break
  return best
DK=[];ch=[c for c in chains()]
for c in ch:c['off']=asOffsets(c['pts'])
ch=[c for c in ch if c['off'] and math.dist(c['pts'][0],c['pts'][-1])>300]
for c in ch:
  o=c['off']
  if not(o[-1][0]>o[0][0] and sum(d for _,d in o)/len(o)>0):continue  # southbound, right of the centerline
  s0,s1=o[0][0],o[-1][0]
  nbs=[n for n in ch if n is not c and n['off'][0][0]>n['off'][-1][0] and min(n['off'][-1][0],n['off'][0][0])<s1 and max(n['off'][-1][0],n['off'][0][0])>s0]
  n0=nbs[0] if nbs else None
  dc=[];nc=[];s=s0
  while s<=s1+1e-6:
    dc.append(round(sampleD(o,s) if sampleD(o,s) is not None else dc[-1],2))
    v=sampleD(n0['off'],s) if n0 else None
    nc.append(round(v,2) if v is not None and dc[-1]-v<12 else None)
    s+=5
  nb=None
  if n0:
    no=n0['off'];ns0,ns1=no[-1][0],no[0][0];nd=[];s=ns0
    while s<=ns1+1e-6:nd.append(round(sampleD(no,s),2));s+=5
    nb=dict(s0=round(ns0,1),s1=round(ns1,1),dc=nd,lanes=n0['lanes'],osm=n0['ids'])
  # height profile: deck level H, ramp lengths along s. Placeholder values until measured from photos.
  DK.append(dict(name='Hledan flyover' if s0<3500 else 'flyover',s0=round(s0,1),s1=round(s1,1),dc=dc,nbc=nc,lanes=c['lanes'],
                 H=6.8,rampUp=170,rampDown=170,osm=c['ids'],nb=nb))
# ---- landmarks for the HUD ----
LM=[]
for j in merged:
  if j['h'] in('primary','secondary') and j['name']:LM.append(dict(s=round(j['s']),name=j['name']))
for b in bus:
  if b['side']==1 and b['name']:
    nm=b['name'].replace('Bus Stop','').replace('bus stop','').strip();LM.append(dict(s=round(b['s']),name=nm+' bus stop'))
LM.sort(key=lambda x:x['s'])
L2=[]
for x in LM:
  if any(y['name']==x['name'] and abs(y['s']-x['s'])<200 for y in L2):continue
  L2.append(x)
LM=L2
out=dict(cl=[[round(x,1),round(z,1)] for x,z in cl],med=med,lanes=lan,
  junctions=[dict(s=round(j['s'],1),side=j['side'],w=j['w'],name=j['name'],signal=bool(j.get('signal'))) for j in merged],
  signals=signals,crossings=CR,bus=bus,trees=trees,buildings=B,flyovers=F,decks=DK,landmarks=LM,len=M)
json.dump(out,open(sys.argv[3],'w'),ensure_ascii=False,separators=(',',':'))
print('centerline pts',len(cl),'length',M,'m');print('junctions',len(merged),collections.Counter(j['side'] for j in merged));print('signals',len(signals),[ (s['stop'],s['name']) for s in signals])
print('crossings',len(CR),'bus',len(bus),'trees',len(trees),'buildings',len(B),'named',[b['n'] for b in B if b['n']][:20]);print('flyovers',[(f['n'],len(f['p'])) for f in F])
print('median range',min(med),max(med),'lanes',collections.Counter(lan));print('landmarks',LM[:30])
import os;print('json KB',os.path.getsize(sys.argv[3])//1024)
def tight(pts):
  h=[math.atan2(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]) for i in range(len(pts)-1)]
  R=[5/abs((h[k+1]-h[k]+math.pi)%(2*math.pi)-math.pi+1e-9) for k in range(len(h)-1)]
  return [(k*5,round(R[k])) for k in range(len(R)) if R[k]<60]
print('SB raw tight',tight(resample(S,5.0))[:12]);print('SB smoothed tight',tight(resample(Ssm,5.0))[:12])
