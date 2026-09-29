"use strict";
// Authored pose families shared by every miniature, selected from actual controls.
module.exports=function motion(e,key,sequence,input=e.input||{}){
 const airborne=e.mode==='flight',moving=Math.hypot(input.x||0,input.y||0)>.1,
 boosted=!!input.boost,forward=(input.x||0)*Math.cos(e.angle)+(input.y||0)*Math.sin(e.angle),
 side=sequence%2?1:-1, beat=Math.max(0,(sequence||1)-1), chain=Math.floor(beat/3);
 let pose;
 if(key==='heavy')pose=airborne?(boosted?'airDive':'meteor'):(boosted?'dashHammer':sequence%2?'guardBreak':'uppercut');
 else if(key==='finisher')pose=airborne?['airSpin','heelDrop','airDive'][chain%3]:['uppercut','roundhouse','spinKick','risingKnee'][chain%4];
 else if(boosted&&moving)pose=airborne?['flyingCross','airDive'][beat%2]:['lunge','dashHammer'][beat%2];
 else if(airborne)pose=key==='link'?['airCross','bodyHook','flyingCross'][chain%3]:['airJab','airCross','airKnee','bodyHook'][beat%4];
 else if(moving)pose=forward>.3?['stepJab','thrust'][beat%2]:forward<-.3?['retreatJab','slipHook'][beat%2]:['slipHook','bodyHook'][beat%2];
 else pose=key==='link'?['cross','bodyHook','elbow','hook'][chain%4]:['jab','cross','hook','uppercut','bodyHook','elbow','thrust','stepJab'][beat%8];
 return {pose,side,moving,boosted,airborne,sequence};
};
