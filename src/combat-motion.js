"use strict";
// Authored pose families shared by every miniature, selected from actual controls.
module.exports=function motion(e,key,sequence,input=e.input||{}){
 const airborne=e.mode==='flight',moving=Math.hypot(input.x||0,input.y||0)>.1,
 boosted=!!input.boost,forward=(input.x||0)*Math.cos(e.angle)+(input.y||0)*Math.sin(e.angle),
 side=sequence%2?1:-1;
 let pose;
 if(key==='heavy')pose=airborne?(boosted?'airDive':'meteor'):(boosted?'dashHammer':sequence%2?'guardBreak':'uppercut');
 else if(key==='finisher')pose=airborne?['airSpin','heelDrop','airDive'][sequence%3]:['roundhouse','spinKick','risingKnee'][sequence%3];
 else if(boosted&&moving)pose=airborne?['flyingCross','airDive'][sequence%2]:['lunge','dashHammer'][sequence%2];
 else if(airborne)pose=key==='link'?['airCross','airKnee','flyingCross'][sequence%3]:['airJab','airCross','airKnee','bodyHook'][sequence%4];
 else if(moving)pose=forward>.3?['stepJab','thrust'][sequence%2]:forward<-.3?['retreatJab','sweep'][sequence%2]:['slipHook','bodyHook'][sequence%2];
 else pose=key==='link'?['cross','bodyHook','elbow','risingKnee'][sequence%4]:['jab','cross','hook','uppercut','bodyHook','elbow','thrust','sweep'][sequence%8];
 return {pose,side,moving,boosted,airborne,sequence};
};
