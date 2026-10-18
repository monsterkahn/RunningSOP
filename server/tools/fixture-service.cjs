'use strict';
// Isolated load-test process. IPC controls are never part of the HTTP API.
const {TeamStore}=require('../store.cjs');
const {createTeamServer}=require('../app.cjs');
if (!process.send || !process.env.SOP_TEST_DATABASE) throw Error('Use only from the isolated benchmark');
let offset=0,connections=0,peakConnections=0;
const store=new TeamStore({dbPath:process.env.SOP_TEST_DATABASE,now:()=>Date.now()+offset});
const server=createTeamServer({store,joinCode:'synthetic-benchmark-join-code'});
server.on('connection',socket=>{connections++;peakConnections=Math.max(peakConnections,connections);socket.on('close',()=>connections--);});
server.listen({port:0,host:'127.0.0.1',backlog:1024},()=>process.send({ready:true,port:server.address().port}));
process.on('message',m=>{
  if(m.type==='stats')process.send({stats:true,memory:process.memoryUsage(),connections,peakConnections});
  if(m.type==='advance'){offset+=m.ms;process.send({advanced:true});}
  if(m.type==='stop'){server.close(()=>{store.close();process.exit(0);});server.closeIdleConnections();}
});
process.on('disconnect',()=>{server.closeAllConnections();server.close(()=>{store.close();process.exit(0);});});
