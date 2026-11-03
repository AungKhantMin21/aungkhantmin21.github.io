import json,sys,math
import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
r=json.load(open(sys.argv[1]));o=json.load(open(sys.argv[2]))
cl=r['cl'];med=r['med'];lan=r['lanes']
def side(off):
  pts=[]
  for k,p in enumerate(cl):
    a=cl[max(k-1,0)];b=cl[min(k+1,len(cl)-1)];tx,tz=b[0]-a[0],b[1]-a[1];l=math.hypot(tx,tz) or 1;nx,nz=-tz/l,tx/l
    d=off(k);pts.append((p[0]+nx*d,p[1]+nz*d))
  return pts
fig,axs=plt.subplots(1,3,figsize=(30,14))
for ax,(z0,z1) in zip(axs,[(0,2900),(2700,5600),(5400,8300)]):
  sel=lambda pts:[p for p in pts]
  for b in r['buildings']:
    xs=[p[0] for p in b['p']]+[b['p'][0][0]];zs=[p[1] for p in b['p']]+[b['p'][0][1]];ax.fill(xs,zs,color='#bbb',lw=0.3,ec='#666')
  for off,c in [(lambda k:med[k],'#c90'),(lambda k:-med[k],'#c90'),(lambda k:med[k]+lan[k]*3.5+0.5,'k'),(lambda k:-(med[k]+lan[k]*3.5+0.5),'k')]:
    pts=side(off);ax.plot([p[0] for p in pts],[p[1] for p in pts],c,lw=0.8)
  ax.plot([p[0] for p in o['sb']],[p[1] for p in o['sb']],'b-',lw=0.4,alpha=.6);ax.plot([p[0] for p in o['nb']],[p[1] for p in o['nb']],'r-',lw=0.4,alpha=.6)
  for f in r['flyovers']:ax.plot([p[0] for p in f['p']],[p[1] for p in f['p']],'m-',lw=3,alpha=.5)
  for j in r['junctions']:
    k=min(len(cl)-1,int(j['s']/5));ax.plot(cl[k][0],cl[k][1],'go' if j['side']==0 else 'g^',ms=5)
  for s in r['signals']:
    k=min(len(cl)-1,int(s['stop']/5));ax.plot(cl[k][0],cl[k][1],'rs',ms=6)
  ax.set_ylim(z1,z0);ax.set_aspect('equal');xs=[p[0] for p in cl if z0<=p[1]<=z1];ax.set_xlim(min(xs)-150,max(xs)+150)
plt.tight_layout();plt.savefig(sys.argv[3],dpi=55)
