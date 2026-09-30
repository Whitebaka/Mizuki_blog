// Run against a private PHOTOBOOK_PREVIEW=1 build; no production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.PREVIEW_URL || 'http://127.0.0.1:4321';
const bookId=process.env.BOOK_ID || 'botan-20260829';
const output=process.env.QA_OUTPUT || '.preview/screenshots';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
const report={checks:[],errors:[],photoRequests:[]};
function passed(name){report.checks.push(name);console.log('PASS',name);}
async function open(page,path){await page.goto(base+path,{waitUntil:'domcontentloaded'});}
async function ready(page){await page.locator('[data-controls]').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('photobook-reader')?.dataset.mode==='scroll');}
async function visibleImages(page){
 await page.waitForFunction(()=>[...document.querySelectorAll('.photobook-shell img')].filter(img=>{const r=img.getBoundingClientRect();return img.checkVisibility() && r.top<innerHeight && r.bottom>0 && r.left<innerWidth && r.right>0;}).every(img=>img.complete && img.naturalWidth>0));
 await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.photobook-shell img')].filter(img=>{const r=img.getBoundingClientRect();return img.checkVisibility()&&r.top<innerHeight&&r.bottom>0;}).map(img=>img.decode()));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
}
async function noOverflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('/photobooks/'))report.photoRequests.push(r.url());});
 await open(page,`/books/${bookId}/`);await ready(page);await noOverflow(page);
 await page.waitForFunction(()=>document.querySelector('photobook-reader img')?.naturalWidth>0);
 assert.ok((await page.locator('.photobook-shell').boundingBox()).y<160);
 assert.equal(await page.locator('#l2d-iframe').isVisible(),false);
 assert.equal(report.photoRequests.some(url=>url.includes('-2400-')),false);
 report.initialPhotoRequests=[...report.photoRequests];assert.ok(new Set(report.initialPhotoRequests.map(url=>url.match(/p04-\d+/)?.[0])).size<16);
 await visibleImages(page);await page.screenshot({path:`${output}/reader-desktop.png`});passed('Desktop reader: no banner gap, no overflow, no zoom-size request before click');
 await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:`${output}/reader-dark.png`});assert.equal(await page.locator('.photobook-shell').evaluate(e=>getComputedStyle(e).getPropertyValue('--book-paper').trim()),'#212820');await page.evaluate(()=>document.documentElement.classList.remove('dark'));passed('Dark reading theme');
 await page.getByRole('button',{name:'画册翻阅',exact:true}).click();
 assert.equal(await page.locator('[data-page]:visible').count(),1);
 await page.locator('[data-next]').click();assert.equal(await page.locator('[data-progress]').innerText(),'02 / 08');
 assert.equal(await page.locator('[data-page]:visible [data-figure]:visible').count(),2);
 await visibleImages(page);await page.screenshot({path:`${output}/spread-desktop.png`});
 await page.locator('[data-chapter]').selectOption('alley');assert.equal(new URL(page.url()).hash,'#alley');
 await page.locator('[data-page]:visible h2').click();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-progress]').innerText(),'04 / 08');
 passed('Desktop spreads, chapter links and keyboard navigation');
 await page.locator('[data-page]:visible .book-image').first().click();
 await page.locator('.fancybox__container').waitFor({state:'visible'});
 await page.keyboard.press('Escape');await page.locator('.fancybox__container').waitFor({state:'detached'});
 assert.ok(report.photoRequests.some(url=>url.includes('-2400-')));passed('Existing Fancybox opens only-on-click large image and returns to reader');
 for(let i=0;i<2;i++){
  await page.locator('.book-back').click();await page.locator('.book-open').waitFor({state:'visible'});
  await page.locator('.book-open').click();await ready(page);
  await page.getByRole('button',{name:'画册翻阅',exact:true}).click();await page.locator('[data-next]').click();
  assert.equal(await page.locator('[data-progress]').innerText(),'02 / 08');
 }
 passed('Swup round trips initialize exactly one reader handler');
 await page.locator('.book-back').click();await page.locator('.book-shelf-intro a[href="/albums/"]').click();await page.locator('#albums-grid').waitFor({state:'visible'});
 assert.equal(await page.locator('.photobook-shell').count(),0);assert.equal(await page.locator('#banner-wrapper').isVisible(),true);await noOverflow(page);
 await page.getByRole('link',{name:'写真集',exact:true}).first().click();await page.locator('.book-studio-link').waitFor({state:'visible'});passed('Ordinary album layout restores after leaving reader');
 await page.locator('.book-studio-link').click();
 await page.getByRole('button',{name:'保存草稿',exact:true}).waitFor({state:'visible'});
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();await page.getByRole('status').filter({hasText:'草稿已保存'}).waitFor({state:'visible'});
 const title=page.getByLabel('标题',{exact:true});await title.fill('验收测试标题');await title.press('Tab');
 assert.ok(await page.locator('.studio-preview').innerText().then(s=>s.includes('验收测试标题')));
 await page.getByRole('button',{name:'撤销',exact:true}).click();assert.equal(await title.inputValue(),'街角与片刻');
 await page.getByRole('button',{name:'重做',exact:true}).click();assert.equal(await title.inputValue(),'验收测试标题');
 await page.getByRole('button',{name:'锁定',exact:true}).click();assert.equal(await title.isDisabled(),true);
 const draft=await page.evaluate(id=>JSON.parse(localStorage.getItem(`mizuki:photobook:${id}`)).book,bookId);
 const proposal={schemaVersion:1,bookId,baseRevision:draft.revision,reason:'检查锁定',pages:structuredClone(draft.pages)};
 proposal.pages[0].title='不得覆盖';await page.getByLabel('提案 JSON').fill(JSON.stringify(proposal));await page.getByRole('button',{name:'校验并预览差异'}).click();
 assert.match(await page.getByRole('alert').innerText(),/锁定/);
 proposal.pages=structuredClone(draft.pages);[proposal.pages[1],proposal.pages[2]]=[proposal.pages[2],proposal.pages[1]];
 await page.getByLabel('提案 JSON').fill(JSON.stringify(proposal));await page.getByRole('button',{name:'校验并预览差异'}).click();
 await page.getByRole('button',{name:'接受提案为草稿'}).click();
 const revised=await page.evaluate(id=>JSON.parse(localStorage.getItem(`mizuki:photobook:${id}`)).book,bookId);assert.equal(revised.pages[1].id,'alley');
 passed('Studio edit, undo/redo, lock enforcement and transactional AI proposal');
 await page.getByRole('button',{name:'手机重排'}).click();await noOverflow(page);
 await visibleImages(page);await page.screenshot({path:`${output}/studio-desktop.png`});
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'恢复草稿'}).click();
 assert.equal(await page.getByLabel('标题',{exact:true}).inputValue(),'验收测试标题');assert.equal(await page.getByLabel('标题',{exact:true}).isDisabled(),true);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出草稿',exact:true}).click();const download=await downloadPromise;await download.saveAs(`${output}/exported-draft.json`);
 assert.equal(JSON.parse(await fs.readFile(`${output}/exported-draft.json`,'utf8')).pages[1].id,'alley');passed('Browser draft restore and portable export');
 await context.close();
 for(const width of [390,768]){
  const c=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:width===390?2:1,isMobile:width===390,hasTouch:true,reducedMotion:'reduce'});
  const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await open(p,`/books/${bookId}/`);await ready(p);await noOverflow(p);
  await p.waitForFunction(()=>document.querySelector('photobook-reader img')?.naturalWidth>0);
  await visibleImages(p);await p.screenshot({path:`${output}/reader-${width}.png`});
  await p.getByRole('button',{name:'画册翻阅',exact:true}).click();await p.locator('[data-next]').click();
  assert.equal(await p.locator('[data-progress]').innerText(),width===390?'02 / 16':'02 / 08');
  assert.equal(await p.locator('[data-page]:visible [data-figure]:visible').count(),width===390?1:2);
  await visibleImages(p);await p.screenshot({path:`${output}/book-${width}.png`});passed(`${width}px: responsive reading, paging and no horizontal overflow`);
  if(width===390){
   await p.locator('[data-pages]').evaluate(target=>{
    const touch=(x,y)=>new Touch({identifier:1,target,clientX:x,clientY:y});
    target.dispatchEvent(new TouchEvent('touchstart',{touches:[touch(300,350)]}));target.dispatchEvent(new TouchEvent('touchend',{changedTouches:[touch(80,355)]}));
   });assert.equal(await p.locator('[data-progress]').innerText(),'03 / 16');
   await p.locator('[data-pages]').evaluate(target=>{
    const touch=(x,y)=>new Touch({identifier:1,target,clientX:x,clientY:y});
    target.dispatchEvent(new TouchEvent('touchstart',{touches:[touch(200,200)]}));target.dispatchEvent(new TouchEvent('touchend',{changedTouches:[touch(205,450)]}));
   });assert.equal(await p.locator('[data-progress]').innerText(),'03 / 16');passed('Touch swipe turns pages while vertical gestures do not');
   await open(p,`/studio/${bookId}/`);await p.getByRole('button',{name:'保存草稿',exact:true}).click();await noOverflow(p);await visibleImages(p);await p.screenshot({path:`${output}/studio-mobile.png`});passed('Mobile studio controls and no overflow');
  }
  await c.close();
 }
 const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const p=await nojs.newPage();await open(p,`/books/${bookId}/`);
 assert.equal(await p.locator('[data-page]:visible').count(),8);assert.equal(await p.locator('[data-controls]').isVisible(),false);await noOverflow(p);passed('Without JavaScript all chapters remain readable');await nojs.close();
 assert.deepEqual(report.errors,[]);
}finally{await fs.writeFile(`${output}/browser-results.json`,JSON.stringify(report,null,2));await browser.close();}
