const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// In-memory Admin SDK substitute: transactions serialize, commit atomically,
// and reject reads after writes. No production Firebase connection is created.
class Timestamp {
  constructor(milliseconds) {
    this.seconds = Math.floor(milliseconds / 1000);
    this.nanoseconds = (milliseconds % 1000) * 1000000;
  }
  toDate() { return new Date(this.valueOf()); }
  valueOf() { return this.seconds * 1000 + this.nanoseconds / 1000000; }
  static fromDate(date) { return new Timestamp(date.getTime()); }
  static fromMillis(milliseconds) { return new Timestamp(milliseconds); }
}
function copy(value) {
  if (value instanceof Timestamp) return new Timestamp(value.valueOf());
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,copy(v)]));
  return value;
}
function makeBackend() {
  const collections = new Map();
  let nextId = 0;
  let transactionTail = Promise.resolve();
  const dataFor = name => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  class Ref {
    constructor(name,id) { this.name=name; this.id=id; }
    async get() {
      const value = copy(dataFor(this.name).get(this.id));
      return {id:this.id, ref:this, exists:value !== undefined, data:()=>value};
    }
    async set(value) { dataFor(this.name).set(this.id,copy(value)); }
    async update(value) {
      assert.ok(dataFor(this.name).has(this.id));
      await this.set({...dataFor(this.name).get(this.id),...value});
    }
    async delete() { dataFor(this.name).delete(this.id); }
  }
  class Query {
    constructor(name, options={}) { this.name=name; this.options=options; }
    orderBy(field,direction) { return new Query(this.name,{...this.options,field,direction}); }
    where(field,operator,value) { return new Query(this.name,{...this.options,filter:{field,operator,value}}); }
    limit(limit) { assert.ok(Number.isInteger(limit) && limit>0); return new Query(this.name,{...this.options,limit}); }
    startAfter(cursor) { return new Query(this.name,{...this.options,cursor}); }
    doc(id='auto'+(++nextId)) { return new Ref(this.name,id); }
    async add(data) { const ref=this.doc(); await ref.set(data); return ref; }
    count() { return {get:async()=>({data:()=>({count:dataFor(this.name).size})})}; }
    async get() {
      const {field,direction,filter,limit,cursor}=this.options;
      let rows=[...dataFor(this.name).entries()];
      if (filter) rows=rows.filter(([,data]) => data[filter.field] > filter.value);
      if (field) {
        rows=rows.filter(([,data]) => data[field] !== undefined);
        rows.sort((a,b) => (a[1][field] < b[1][field] ? -1 : a[1][field] > b[1][field] ? 1 : 0) * (direction==='desc' ? -1:1));
      }
      if (cursor !== undefined) rows=rows.filter(([,data]) => direction==='desc' ? data[field]<cursor : data[field]>cursor);
      if (limit) rows=rows.slice(0,limit);
      const docs=await Promise.all(rows.map(([id])=>this.doc(id).get()));
      return {docs,size:docs.length,empty:docs.length===0,forEach:fn=>docs.forEach(fn)};
    }
  }
  const db={
    collection:name=>new Query(name),
    runTransaction(fn) {
      const run=transactionTail.then(async()=>{
        const writes=[];
        const result=await fn({
          get(ref) { assert.equal(writes.length,0,'all transaction reads precede writes'); return ref.get(); },
          set(ref,data) { writes.push(()=>ref.set(data)); },
          update(ref,data) { writes.push(()=>ref.update(data)); },
          delete(ref) { writes.push(()=>ref.delete()); }
        });
        for (const write of writes) await write();
        return result;
      });
      transactionTail=run.catch(()=>{});
      return run;
    },
    batch() {
      const refs=[];
      return {delete:ref=>refs.push(ref),commit:()=>Promise.all(refs.map(ref=>ref.delete()))};
    }
  };
  class HttpsError extends Error { constructor(code,message) { super(message); this.code=code; } }
  const firestore=()=>db;
  firestore.Timestamp=Timestamp;
  firestore.FieldValue={serverTimestamp:()=>new Timestamp(Date.now())};
  const context=vm.createContext({
    exports:{}, console:{log(){},error(){}}, setInterval(){ return {unref(){}}; },
    require(name) {
      if(name==='firebase-functions/v2/https') return {onCall:fn=>fn,HttpsError};
      if(name==='firebase-functions/v2') return {setGlobalOptions(){}};
      if(name==='firebase-admin') return {initializeApp(){},firestore};
      if(name==='node:net') return require(name);
      throw Error('Unexpected dependency: '+name);
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../functions/index.js'),'utf8'),context);
  return {
    api:context.exports, db,
    validateToken:vm.runInContext('validateAndUseToken',context),
    seed:(name,id,data)=>dataFor(name).set(id,copy(data)),
    rows:name=>dataFor(name)
  };
}
const request=(data,ip='192.0.2.1')=>({data,rawRequest:{headers:{'x-forwarded-for':ip}}});
async function tokenFor(backend,actionType,ip='192.0.2.1') {
  return (await backend.api.getValidationToken(request({actionType},ip))).token;
}
async function submit(backend,score,ip='192.0.2.1',extra={}) {
  const validationToken=await tokenFor(backend,'score_submit',ip);
  return backend.api.submitScore(request({playerName:'Test',score,validationToken,...extra},ip));
}

test('leaderboard returns 50 sorted display records without legacy IPs or arbitrary flags',async()=>{
  const backend=makeBackend();
  for(let i=0;i<55;i++) backend.seed('scores','s'+i,{
    playerName:'P'+i,score:i,countryCode:'kr',flag:'<svg onload=alert(1)>',
    ip:'192.0.2.44',votedIps:['192.0.2.99'],privateNote:'secret',timestamp:new Timestamp(1700000000123)
  });
  const result=await backend.api.getLeaderboard(request({}));
  assert.equal(result.scores.length,50);
  assert.equal(result.scores[0].score,54);
  assert.equal(result.scores[49].score,5);
  const item=result.scores[0];
  assert.deepEqual(Object.keys(item).sort(),['id','playerName','score','countryCode','flag','timestamp'].sort());
  assert.equal(item.flag,'🇰🇷');
  assert.equal(item.countryCode,'KR');
  assert.equal(item.timestamp.seconds,1700000000);
  assert.equal(item.timestamp.nanoseconds,123000000);
  assert.ok(!JSON.stringify(result).includes('192.0.2.'));
});

test('chat projects display fields and recomputes masked IP for legacy documents',async()=>{
  const backend=makeBackend();
  backend.seed('chat','legacy',{
    username:'Old',message:'hello',timestamp:new Timestamp(1700000000000),
    ip:'192.0.2.45',maskedIP:'192.0.2.45',votedIps:['198.51.100.99'],deleteVotes:1,privateNote:'secret'
  });
  backend.seed('chat','malformed',{timestamp:'invalid',message:'broken',ip:'192.0.2.1'});
  const result=await backend.api.getChatMessages(request({}));
  assert.equal(result.messages.length,1);
  assert.deepEqual(Object.keys(result.messages[0]).sort(),['id','username','message','timestamp','serverTime','deleteVotes','maskedIP'].sort());
  assert.equal(result.messages[0].maskedIP,'192.0.*.**');
  assert.ok(!JSON.stringify(result).includes('192.0.2.45'));
  assert.ok(!JSON.stringify(result).includes('198.51.100.99'));
});

test('malformed public request fields fail as invalid arguments',async()=>{
  const backend=makeBackend();
  for(const limit of [NaN,Infinity,0,-1,1.5,'10',{},null]) {
    await assert.rejects(backend.api.getChatMessages(request({limit})),{code:'invalid-argument'});
  }
  await assert.rejects(backend.api.getChatMessages(request({startAfterTimestamp:{}})),{code:'invalid-argument'});
  for(const messageId of [{},'chat/other','']) {
    await assert.rejects(backend.api.deleteChatMessage(request({messageId})),{code:'invalid-argument'});
  }
});

test('validation token is single use under concurrent requests',async()=>{
  const backend=makeBackend();
  const token=await tokenFor(backend,'score_submit');
  const results=await Promise.allSettled([
    backend.validateToken(token,'192.0.2.1','score_submit'),
    backend.validateToken(token,'192.0.2.1','score_submit')
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'permission-denied');
});

test('token owner, action, expiry and ID are validated without consuming on rejection',async()=>{
  const backend=makeBackend();
  const token=await tokenFor(backend,'chat_send');
  await assert.rejects(backend.validateToken(token,'192.0.2.2','chat_send'),{code:'permission-denied'});
  await assert.rejects(backend.validateToken(token,'192.0.2.1','score_submit'),{code:'permission-denied'});
  assert.equal(backend.rows('validation_tokens').get(token).used,false);
  backend.rows('validation_tokens').get(token).timestamp=Date.now()-300001;
  await assert.rejects(backend.validateToken(token,'192.0.2.1','chat_send'),{code:'deadline-exceeded'});
  await assert.rejects(backend.validateToken({},'192.0.2.1','chat_send'),{code:'unauthenticated'});
});

test('loopback token issuance and consumption keep the same identity',async()=>{
  const backend=makeBackend();
  const validationToken=await tokenFor(backend,'board_refresh','127.0.0.1');
  assert.equal((await backend.api.validateBoardRefresh(request({validationToken},'127.0.0.1'))).success,true);
});

test('scores reject invalid numbers and derive flags instead of trusting HTML',async()=>{
  for(const score of [NaN,Infinity,-1,1.5,10000000,'100']) {
    await assert.rejects(submit(makeBackend(),score),{code:'invalid-argument'});
  }
  const backend=makeBackend();
  await submit(backend,100,'192.0.2.1',{countryCode:'kr',flag:'<img src=x onerror=alert(1)>',country:{bad:true}});
  const saved=[...backend.rows('scores').values()][0];
  assert.equal(saved.flag,'🇰🇷');
  assert.equal(saved.countryCode,'KR');
  assert.equal(saved.country,'Unknown');
  await submit(backend,200,'192.0.2.2',{countryCode:'<svg>'});
  assert.equal((await backend.api.getLeaderboard(request({}))).scores[0].flag,'🌍');
});

test('concurrent submissions preserve the top 50, including existing overflow',async()=>{
  const backend=makeBackend();
  for(let i=0;i<52;i++) backend.seed('scores','s'+i,{score:i,timestamp:new Timestamp(i)});
  const results=await Promise.all([
    submit(backend,100,'192.0.2.1'),
    submit(backend,101,'192.0.2.2')
  ]);
  assert.ok(results.every(result=>result.success));
  assert.equal(backend.rows('scores').size,50);
  assert.deepEqual([...backend.rows('scores').values()].map(v=>v.score).sort((a,b)=>a-b),
    [...Array.from({length:48},(_,i)=>i+4),100,101]);
  assert.equal((await submit(backend,0,'192.0.2.3')).success,false);
  assert.equal(backend.rows('scores').size,50);
});

test('only the owner or three distinct voters can delete a message',async()=>{
  const backend=makeBackend();
  backend.seed('chat','one',{ip:'192.0.2.1',votedIps:[],deleteVotes:0});
  const vote=ip=>backend.api.deleteChatMessage(request({messageId:'one'},ip));
  assert.equal((await vote('192.0.2.2')).deleted,false);
  await assert.rejects(vote('192.0.2.2'),{code:'permission-denied'});
  assert.equal((await vote('192.0.2.3')).currentVotes,2);
  assert.ok(backend.rows('chat').has('one'));
  assert.equal((await vote('192.0.2.4')).deleted,true);
  assert.ok(!backend.rows('chat').has('one'));
  backend.seed('chat','one',{ip:'192.0.2.1',votedIps:[],deleteVotes:0});
  assert.equal((await vote('192.0.2.1')).deleted,true);
});

test('invalid username types return validation errors instead of crashing',async()=>{
  const backend=makeBackend();
  const validationToken=await tokenFor(backend,'chat_send');
  await assert.rejects(backend.api.sendChatMessage(request({validationToken,username:{bad:true},message:'hello'})),{code:'invalid-argument'});
});
