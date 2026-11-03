// Local-only synthetic fixture preview. Start the app on 127.0.0.1:3100 first.
import http from 'node:http';
import fs from 'node:fs';
http.createServer((req,res)=>{
 if(req.url==='/__fixtures') {
 const fixtures=JSON.parse(fs.readFileSync('/tmp/destiny-result-fixtures.json','utf8'));
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>Destiny Code 로컬 검증</title><body><h1>로컬 검증용 합성 결과</h1><p>실제 개인정보와 실제 손금 사진을 사용하지 않습니다.</p>${fixtures.map(f=>`<button data-id="${f.id}">${f.nickname} 열기</button>`).join(' ')}<script>const fixtures=${JSON.stringify(fixtures).replace(/</g,'\\u003c')};document.querySelectorAll('button').forEach(b=>b.onclick=()=>{localStorage.setItem('destiny_ai_v1',JSON.stringify([fixtures.find(f=>f.id===b.dataset.id)]));location.href='/';});</script></body></html>`);return;
 }
 const upstream=http.request({host:'127.0.0.1',port:3100,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
 upstream.on('error',()=>{res.statusCode=502;res.end('Local preview server unavailable');});req.pipe(upstream);
}).listen(3101,'127.0.0.1');
