import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'pitch-smoke-'));const child=spawn(process.execPath,['dist/main.js'],{env:{...process.env,PORT:'3109',DB_PATH:join(dir,'test.sqlite')},stdio:'pipe'});let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
try{let ready=false;for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:3109/api/pitches');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
for(const [path,status] of [['?type=7',200],['/1',200],['/1/schedule?date=2026-10-25',200],['/1/schedule?date=2026-02-30',400],['/99',404],['?type=6',400]]){const r=await fetch('http://127.0.0.1:3109/api/pitches'+path);assert.equal(r.status,status);const body=await r.json();assert.ok(status===200?body.data:body.message);console.log('PASS',status,path);}
}finally{if(child.exitCode===null&&child.signalCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}await rm(dir,{recursive:true,force:true});}
