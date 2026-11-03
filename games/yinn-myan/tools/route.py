import json,math,sys,heapq
d=json.load(open(sys.argv[1]));els=d['elements']
LAT0,LON0=16.8534,96.1407
KX=math.cos(math.radians(LAT0))*111320;KZ=110574
P=lambda la,lo:((lo-LON0)*KX,(LAT0-la)*KZ)
ways=[e for e in els if e['type']=='way' and 'highway' in e.get('tags',{})]
def namedPyay(t):
  nm=t.get('name','')+'|'+t.get('name:en','')
  return 'ပြည်လမ်း' in nm or 'Pyay Road' in nm
def isPyay(t):
  return t.get('highway') in('trunk','primary','trunk_link','primary_link','secondary','tertiary')
pos={};G={}
for w in ways:
  if not isPyay(w['tags']):continue
  t=w['tags'];br=t.get('bridge')=='yes';ow=t.get('oneway')
  ns=w['nodes'];gs=w['geometry']
  for i,(n,g) in enumerate(zip(ns,gs)):pos[n]=P(g['lat'],g['lon'])
  for i in range(len(ns)-1):
    a,b=ns[i],ns[i+1]
    L=math.dist(pos[a],pos[b])
    info=dict(w=w['id'],br=br,lanes=t.get('lanes'),link='link' in t['highway'],py=namedPyay(t),name=t.get('name:en') or t.get('name'))
    G.setdefault(a,[]).append((b,L,info))
    if ow not in('yes','-1'):G.setdefault(b,[]).append((a,L,info))
def nearest(p,filt=None):
  return min((n for n in pos if (filt is None or filt(n))),key=lambda n:math.dist(pos[n],p))
def dijkstra(s,t,dirz):
  dist={s:0};prev={};pq=[(0,s)]
  while pq:
    c,u=heapq.heappop(pq)
    if u==t:break
    if c>dist.get(u,1e18):continue
    for v,L,info in G.get(u,[]):
      dz=pos[v][1]-pos[u][1]
      cost=L*(1 if info['py'] else 8)*(4 if info['br'] else 1)*(3 if info['link'] else 1)*(1 if dz*dirz>=-0.5 else 6)
      nc=c+cost
      if nc<dist.get(v,1e18):dist[v]=nc;prev[v]=(u,info);heapq.heappush(pq,(nc,v))
  path=[t];infos=[]
  while path[-1]!=s:
    u,info=prev[path[-1]];infos.append(info);path.append(u)
  return path[::-1],infos[::-1]
start=P(16.8534,96.1407);end=P(16.78302,96.14413)
# southbound start: node with outgoing edge heading south near Parami
sbS=nearest(start,lambda n:any(pos[v][1]>pos[n][1] for v,_,_ in G.get(n,[])))
sbE=nearest(end)
sb,sbi=dijkstra(sbS,sbE,1)
nbS=nearest(end,lambda n:any(pos[v][1]<pos[n][1] for v,_,_ in G.get(n,[])))
nbE=nearest(start)
nb,nbi=dijkstra(nbS,nbE,-1)
def length(p):return sum(math.dist(pos[p[i]],pos[p[i+1]]) for i in range(len(p)-1))
print('SB',len(sb),'nodes',round(length(sb)),'m start',[round(v) for v in pos[sb[0]]],'end',[round(v) for v in pos[sb[-1]]],'bridges',sum(i['br'] for i in sbi),'links',sum(i['link'] for i in sbi))
print('NB',len(nb),'nodes',round(length(nb)),'m',[round(v) for v in pos[nb[0]]],[round(v) for v in pos[nb[-1]]],'bridges',sum(i['br'] for i in nbi))
lanes=[i['lanes'] for i in sbi]
json.dump({'sb':[pos[n] for n in sb],'sbLanes':[i['lanes'] for i in sbi],'sbWay':[i['w'] for i in sbi],'nb':[pos[n] for n in nb],'nbLanes':[i['lanes'] for i in nbi],'sbNodes':sb,'nbNodes':nb},open(sys.argv[2],'w'))
import collections;print('SB non-pyay m',round(sum(math.dist(pos[sb[i]],pos[sb[i+1]]) for i in range(len(sb)-1) if not sbi[i]['py'])),set(i['name'] for i in sbi if not i['py']))
print('SB lanes',collections.Counter(lanes))
