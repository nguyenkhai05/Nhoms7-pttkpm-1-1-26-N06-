// Adapter demo một tiến trình. Khi triển khai nhiều instance, thay bằng Redis.
export class HoldStore {
 clock:()=>number;items:Map<string,number>;
 constructor(clock=Date.now){this.clock=clock;this.items=new Map();}
 key(pitch:number,date:string,slot:number){return `${pitch}:${date}:${slot}`;}
 hold(pitch:number,date:string,slot:number,ttl=900000){this.items.set(this.key(pitch,date,slot),this.clock()+ttl);}
 isHeld(pitch:number,date:string,slot:number){const k=this.key(pitch,date,slot),t=this.items.get(k);if(t!==undefined&&t>this.clock())return true;this.items.delete(k);return false;}
}
