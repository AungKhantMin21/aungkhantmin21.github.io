// Car specs (manufacturer data, rounded) and engine-sound profiles.
export const CARS=[
 {id:'markii',name:'Mark II Tourer V',short:'Mark II',sub:'JZX110 · JDM',engine:'1JZ-GTE 2.5 L turbo straight-six',
  mass:1490,drive:'RWD',cgF:0.53,hcg:0.52,L:4.76,W:1.76,H:1.42,wb:2.78,track:1.5,wr:0.318,
  vlim:180,curve:[[700,150],[1500,215],[2000,300],[2400,378],[4800,378],[5600,356],[6200,326],[6800,290],[7100,250]],turbo:true,
  idle:750,red:6900,gears:[3.285,1.894,1.275,1.0,0.783],final:3.909,box:'5-speed',cd:0.30,area:2.05,mu:0.95,value:85e6,
  ps:'280 PS', nm:'378 Nm', paint:0xe9e9e4,sound:'i6t',fuel:{gpk:270}},
 {id:'crown',name:'Crown Royal Saloon',short:'Crown',sub:'S180 · executive',engine:'4GR-FSE 2.5 L V6',
  mass:1540,drive:'RWD',cgF:0.52,hcg:0.55,L:4.84,W:1.78,H:1.47,wb:2.85,track:1.53,wr:0.33,
  vlim:180,curve:[[700,165],[2000,222],[3000,248],[3800,260],[5000,252],[6000,240],[6400,235],[6900,205]],
  idle:700,red:6700,gears:[3.52,2.04,1.40,1.0,0.716,0.586],final:3.73,box:'6-speed auto',cd:0.28,area:2.15,mu:0.93,value:95e6,
  ps:'215 PS',nm:'260 Nm',paint:0x15181b,sound:'v6',fuel:{gpk:265}},
 {id:'ev',name:'BYD Atto 3',short:'Atto 3 EV',sub:'Electric SUV',engine:'150 kW permanent-magnet motor',
  mass:1750,drive:'FWD',cgF:0.55,hcg:0.58,L:4.455,W:1.875,H:1.615,wb:2.72,track:1.58,wr:0.345,ev:true,
  evT:310,evP:150000,evMax:14000,vlim:160,gears:[9.0],final:1,box:'Single speed',cd:0.29,area:2.5,mu:0.92,value:120e6,
  ps:'204 PS',nm:'310 Nm',paint:0x4f6a86,sound:'ev',idle:0,red:14000,kwh:60.5},
 {id:'probox',name:'Probox Taxi',short:'Probox',sub:'NCP51 · Yangon taxi',engine:'1NZ-FE 1.5 L straight-four',
  mass:1100,drive:'FWD',cgF:0.6,hcg:0.6,L:4.195,W:1.695,H:1.5,wb:2.55,track:1.45,wr:0.29,
  curve:[[800,96],[2000,118],[3000,128],[4200,141],[5200,136],[6000,127],[6400,112]],
  idle:800,red:6300,gears:[2.847,1.552,1.0,0.7],final:4.237,box:'4-speed auto',cd:0.33,area:2.2,mu:0.9,value:45e6,
  ps:'109 PS',nm:'141 Nm',paint:0xf3f3ef,sound:'i4',taxi:true,fuel:{gpk:280}},
 {id:'hijet',name:'Hijet Truck',short:'Hijet',sub:'S200P · kei truck',engine:'EF-VE 660 cc three-cylinder',
  mass:800,drive:'RWD',cgF:0.5,hcg:0.75,L:3.395,W:1.475,H:1.78,wb:1.9,track:1.3,wr:0.27,
  curve:[[800,40],[2000,50],[3000,56],[4000,60],[5000,58],[5700,57],[6500,49],[7000,42]],
  idle:850,red:6900,gears:[2.731,1.526,1.0],final:5.6,box:'3-speed auto',cd:0.42,area:2.3,mu:0.86,value:25e6,
  ps:'46 PS',nm:'60 Nm',paint:0xf1f1ec,sound:'i3',truck:true,fuel:{gpk:300}},
];
CARS.forEach(c=>{c.mass+=75;c.eff=/auto/.test(c.box)?0.82:c.ev?0.92:0.9;c.a=c.wb*(1-c.cgF);c.b=c.wb*c.cgF;c.Iz=c.mass*c.a*c.b*1.05;});
// engine sound profiles: firing angles over 720° of crank rotation
export const SOUND={
 i6t:{angles:[0,120,240,360,480,600],pulseMs:1.6,formants:[[92,3.5,0.9],[240,4,0.55],[610,5,0.3],[1450,5,0.12]],lp:900,pipeMs:7.5,pipeFb:0.55,pipeDamp:0.35,bodyG:0.8,subG:0.75,sub:140,gain:1,intakeG:0.5,turbo:true,pops:1,master:0.6,cylVar:0.06},
 v6:{angles:[0,118,242,360,478,602],pulseMs:1.8,formants:[[105,3,0.9],[310,4,0.5],[780,5,0.22]],lp:700,pipeMs:9,pipeFb:0.5,pipeDamp:0.3,bodyG:0.85,subG:0.8,sub:150,gain:1,intakeG:0.25,master:0.5,cylVar:0.12},
 i4:{angles:[0,180,360,540],pulseMs:2.2,formants:[[125,2.5,0.8],[410,3.5,0.5],[1150,4,0.3],[2300,4,0.1]],lp:1300,pipeMs:5.5,pipeFb:0.45,pipeDamp:0.4,bodyG:0.7,subG:0.55,sub:170,gain:1,intakeG:0.6,master:0.55,cylVar:0.1},
 i3:{angles:[0,240,480],pulseMs:2.6,formants:[[140,2.5,0.85],[480,3,0.55],[1250,3.5,0.35]],lp:1500,pipeMs:4.5,pipeFb:0.4,pipeDamp:0.45,bodyG:0.7,subG:0.6,sub:180,gain:1,intakeG:0.6,master:0.55,cylVar:0.15},
 ev:{ev:true,poles:4,gearTeeth:28},
};
