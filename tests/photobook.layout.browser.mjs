// Visual acceptance: the complete photograph and pager must share the viewport.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.PREVIEW_URL || 'http://127.0.0.1:4321';
const output=process.env.QA_OUTPUT || '.preview/compact-layout';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
async function geometry(page,label){
 await page.waitForFunction(()=>{const e=document.querySelector('[data-pager]');return e && e.getBoundingClientRect().bottom<=innerHeight+1;});
 const metrics=await page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};
  return {height:innerHeight,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,toolbar:rect(document.querySelector('.book-toolbar')),pager:rect(document.querySelector('[data-pager]')),images:[...document.querySelectorAll('[data-page]:not([hidden]) [data-figure]:not([hidden]) img')].map(e=>({...rect(e),fit:getComputedStyle(e).objectFit})),headingVisible:document.querySelector('.book-heading').checkVisibility()};
 });
 assert.equal(metrics.headingVisible,false,label+' hides introduction');
 assert.equal(metrics.overflow,false,label+' no horizontal overflow');
 assert.ok(metrics.toolbar.top>=0 && metrics.pager.bottom<=metrics.height+1,label+' controls in viewport');
 for(const img of metrics.images){
  assert.equal(img.fit,'contain');
  assert.ok(img.top>=metrics.toolbar.bottom && img.bottom<=metrics.pager.top+1,label+' image fits between controls');
  assert.ok(img.height>100,label+' image remains useful');
  assert.ok(img.left>=0 && img.right<=metrics.width+1,label+' image fits horizontally');
 }
 return metrics;
}
try{
 for(const [width,height,zoom] of [[1440,900,1],[1280,720,1],[1920,1080,1],[390,844,1],[390,667,1],[768,844,1],[1440,900,1.25]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/books/botan-20260829/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-controls]').waitFor({state:'visible'});
  if(zoom!==1)await page.evaluate(z=>document.body.style.zoom=String(z),zoom);
  // Chapter intro is compact enough for the opening photo to begin in the first screen.
  const first=await page.locator('.book-image img').first().boundingBox();assert.ok(first.y<height*.7,'opening photo starts before lower third');
  await page.getByRole('button',{name:'画册翻阅',exact:true}).click();
  const label=`${width}x${height}-zoom${zoom}`;
  const firstMetrics=await geometry(page,label);
  for(const option of await page.locator('[data-chapter] option').evaluateAll(es=>es.map(e=>e.value))){
   await page.locator('[data-chapter]').selectOption(option);await geometry(page,label+'/'+option);
  }
  await page.locator('[data-chapter]').selectOption({index:0});
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-page]:not([hidden]) img')].every(e=>e.complete && e.naturalWidth>0));
  await page.screenshot({path:`${output}/${label}.png`});
  if(width===1440 && zoom===1){
   await page.setViewportSize({width:1100,height:650});await geometry(page,'live resize');
   await page.getByRole('button',{name:'章节阅读',exact:true}).click();assert.equal(await page.locator('.book-heading').isVisible(),true);
   await page.getByRole('button',{name:'画册翻阅',exact:true}).click();await geometry(page,'return from chapter reading');
  }
  assert.deepEqual(errors,[]);results.push({label,...firstMetrics});console.log('PASS',label,'all chapters, full photo and pager visible');await context.close();
 }
}finally{await fs.writeFile(output+'/results.json',JSON.stringify(results,null,2));await browser.close();}
