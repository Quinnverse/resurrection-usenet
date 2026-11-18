const fs=require('fs');
const {makeCanvas,toPNG}=require('./softcanvas.js');
const art=require('../frontend/p3/art.js').createArt(makeCanvas);
const sheet=makeCanvas(330,170); const cx=sheet.getContext('2d');
cx.fillStyle='#8aa8e8'; cx.fillRect(0,0,330,170);
// tiles row
['G0','G1','E0','R0','r0','S0','s0','D','Lleft','Lmid','Lright','Lone','P','F','T'].forEach((k,i)=>cx.drawImage(art.tiles[k],4+i*21,4));
// props
let x=4,y=30;
const P=art.props;
const list=[P.star[0],P.star[1],P.bigStar,P.tree,P.palm,P.bush,P.flower[0],P.flower[1],P.flower[3],P.shell,P.sign[0],P.sign[1],P.cat[0],P.cat[1],P.crab[0],P.flag[0],P.flag[1],P.door[0],P.floppy,P.rack.archive[0],P.rack.lab[1],P.rack.mirror[0]];
list.forEach(s=>{ if(x+s.width>326){x=4;y+=60;} cx.drawImage(s,x,y); x+=s.width+6; });
fs.writeFileSync(process.argv[2]||'/projects/sandbox/review/props.png',toPNG(sheet,4));
