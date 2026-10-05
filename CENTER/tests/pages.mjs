// True Pages/workerd smoke suite: isolated local D1 + R2, never production.
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const state=mkdtempSync(join(tmpdir(),'sfrc-pages-'));
const cli='node_modules/wrangler/bin/wrangler.js',origin='http://localhost:8899';
const secret=crypto.randomUUID(),password=crypto.randomUUID();
execFileSync(process.execPath,[cli,'d1','migrations','apply','tt','--local','--persist-to',state],{stdio:'pipe'});
const server=spawn(process.execPath,[cli,'pages','dev','public','--port','8899','--ip','127.0.0.1','--persist-to',state,'--binding',`APP_ORIGIN=${origin}`,'--binding',`SETUP_SECRET=${secret}`],{stdio:'pipe'});
let output='',browser,passed=0;
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
try{
 let ready=false;
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(origin+'/api/v1/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
 assert.ok(ready,'Pages did not start: '+output);
 for(const path of ['/','/about','/explore','/contact','/privacy'])await check('HTML entry '+path,async()=>{const r=await fetch(origin+path);assert.equal(r.status,200);const t=await r.text();assert.match(t,/src="\/app.js"/);assert.match(t,/href="\/style.css"/);assert.ok(t.length>1200);});
 for(const [path,mime]of [['/app.js','javascript'],['/catalog.js','javascript'],['/style.css','text/css'],['/sky-first-logo.png','image/png'],['/manifest.webmanifest','manifest'],['/robots.txt','text/plain'],['/sitemap.xml','application/xml']])await check('Asset/metadata '+path,async()=>{const r=await fetch(origin+path);assert.equal(r.status,200);assert.ok(r.headers.get('content-type')?.includes(mime));assert.ok((await r.arrayBuffer()).byteLength>50);});
 await check('Auth blocks anonymous admin',async()=>assert.equal((await fetch(origin+'/api/v1/admin/users')).status,401));
 const post=async(path,b,cookie='')=>fetch(origin+'/api/v1'+path,{method:'POST',headers:{origin,'x-requested-with':'SFRC','content-type':'application/json',cookie},body:JSON.stringify(b)});
 await check('D1 bootstrap with PBKDF2 in workerd',async()=>{const r=await post('/setup',{secret,email:'pages-qa@example.test',name:'Local Pages QA',password,confirm_password:password});assert.equal(r.status,201,await r.text());});
 const login=await post('/login',{email:'pages-qa@example.test',password});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 let id;
 await check('D1 project creation in Pages',async()=>{const r=await post('/records',{kind:'projects',title:'Pages smoke project',summary:'Local only',data:{}},cookie);const d=await r.json();assert.equal(r.status,201,JSON.stringify(d));id=d.item.id;});
 await check('Private R2 upload/download through Pages',async()=>{const r=await fetch(origin+'/api/v1/records/'+id+'/files?name=qa.pdf',{method:'POST',headers:{origin,'x-requested-with':'SFRC',cookie,'content-type':'application/pdf','x-file-name':'qa.pdf'},body:'%PDF-1.4\nlocal QA\n%%EOF'});const d=await r.json();assert.equal(r.status,201,JSON.stringify(d));const fileId=d.id || d.item?.id;assert.ok(fileId);const download=await fetch(origin+'/api/v1/files/'+fileId,{headers:{cookie}});assert.equal(download.status,200);assert.match(await download.text(),/%PDF/);assert.equal((await fetch(origin+'/api/v1/files/'+fileId)).status,401);});
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],assets=new Set();
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.ok())assets.add(new URL(r.url()).pathname);});
 await check('Chromium public render loads CSS JS and official logo',async()=>{await page.goto(origin);await page.waitForSelector('.hero');for(const path of ['/app.js','/style.css','/catalog.js','/sky-first-logo.png'])assert.ok(assets.has(path),path);assert.equal(await page.locator('.public-top .brand img').evaluate(i=>i.complete&&i.naturalWidth>0),true);});
 await check('Chromium login and admin email page',async()=>{await page.goto(origin+'/#setup');await page.waitForURL(origin+'/#login');await page.locator('[name=email]').fill('pages-qa@example.test');await page.locator('[name=password]').fill(password);await page.locator('#authForm button[type=submit]').click();await page.waitForSelector('.stats');await page.goto(origin+'/#w/email');await page.waitForSelector('#flushEmail');assert.match(await page.locator('#main').innerText(),/RESEND_API_KEY/);});
 await check('Mobile responsive and no JavaScript runtime errors',async()=>{await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.waitForSelector('.hero');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);});
 mkdirSync('.local/pages-screens',{recursive:true});await page.screenshot({path:'.local/pages-screens/mobile.png',fullPage:true});
 console.log(`Pages smoke: ${passed} PASS, 0 FAIL`);
}finally{await browser?.close();server.kill('SIGTERM');await new Promise(r=>{if(server.exitCode!==null)return r();server.once('exit',r);setTimeout(()=>{server.kill('SIGKILL');r();},3000).unref();});rmSync(state,{recursive:true,force:true});}
