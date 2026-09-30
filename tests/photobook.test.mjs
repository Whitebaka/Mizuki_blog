import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateBook, applyProposal } from "../src/utils/photobook.ts";
import { photoPresentation, encryptedPhotoMarkup } from "../src/utils/album-images.ts";
import { assertPublication } from "../scripts/photobook/build-guard.mjs";
const asset = id => ({id,alt:"测试照片",width:1200,height:1800,publicationApproved:false,variants:[{url:`/photobooks/${id}.webp`,width:600,height:900,bytes:24000,format:"webp"},{url:`/photobooks/${id}.jpg`,width:600,height:900,bytes:45000,format:"jpeg"}]});
const page = (id,a) => ({id,chapter:"街边",title:id,caption:"",template:"hero",assets:[a],locked:false});
const fixture = () => ({schemaVersion:1,id:"test-book",title:"一本书",subtitle:"",date:"2026-09-30",credit:"摄影者",status:"draft",revision:1,cover:"a",assets:{a:asset("a"),b:asset("b")},pages:[page("first","a"),page("second","b")]});
const proposal = b => ({schemaVersion:1,bookId:b.id,baseRevision:b.revision,reason:"改变节奏",pages:structuredClone(b.pages)});
test("valid book and real pixel-width srcset",()=>{ const b=fixture(); assert.deepEqual(validateBook(b),[]); const p=photoPresentation({src:"/original.jpg",thumbnail:"/thumb.jpg",variants:b.assets.a.variants,width:1200,height:1800}); assert.equal(p.src,"/thumb.jpg"); assert.match(p.webp,/600w/); assert.doesNotMatch(p.webp,/900w/); assert.equal(p.zoom,"/photobooks/a.webp"); });
test("legacy albums keep original, thumbnails stay separate, markup is escaped",()=>{const p={src:"/full.jpg",thumbnail:"/thumb.jpg",alt:'"><script>x</script>',width:1200,height:1800};assert.equal(photoPresentation(p).zoom,"/full.jpg");const html=encryptedPhotoMarkup(p,"test");assert.match(html,/src="\/thumb.jpg"/);assert.match(html,/href="\/full.jpg"/);assert.doesNotMatch(html,/<script>/);assert.match(html,/width="1200"/);});
test("publication requires approval; private data and invalid variants rejected",()=>{const b=fixture();b.status="published";assert.ok(validateBook(b).some(e=>e.includes("批准")));b.status="draft";b.assets.a.sourceRef="/private/NAS";assert.ok(validateBook(b).length);delete b.assets.a.sourceRef;b.assets.a.variants[0]=null;assert.ok(validateBook(b).length);});
test("unknown references, repeated photos, invalid template capacity and unsafe URLs rejected",()=>{for(const change of [b=>b.pages[1].assets=["missing"],b=>b.pages[1].assets=["a"],b=>b.pages[0].template="pair",b=>b.assets.a.variants[0].url="javascript:alert(1)",b=>b.assets.a.variants[0].bytes=0]){const b=fixture();change(b);assert.ok(validateBook(b).length);}});
test("proposal is transactional and only updates draft revision",()=>{const b=fixture(),p=proposal(b);p.pages.reverse();const next=applyProposal(b,p);assert.equal(next.pages[0].id,"second");assert.equal(next.revision,2);assert.equal(b.pages[0].id,"first");assert.equal(next.status,"draft");});
test("stale proposals, locks, removals and unexpected fields are rejected",()=>{const b=fixture();b.pages[0].locked=true;for(const change of [p=>p.baseRevision=0,p=>p.pages.reverse(),p=>p.pages[0].caption="changed",p=>p.pages.shift(),p=>p.html="x"]){const p=proposal(b);change(p);assert.throws(()=>applyProposal(b,p));}});
test("locked object property order does not affect semantic equality",()=>{const b=fixture();b.pages[0].locked=true;const p=proposal(b);p.pages[0]=Object.fromEntries(Object.entries(p.pages[0]).reverse());assert.equal(applyProposal(b,p).revision,2);});
test("production rejects even unlinked draft files in public, preview allows them",()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),"book-test-"));try{fs.mkdirSync(path.join(root,"public/photobooks"),{recursive:true});fs.writeFileSync(path.join(root,"public/photobooks/a.webp"),"image");assert.throws(()=>assertPublication(root));assert.doesNotThrow(()=>assertPublication(root,true));const b=fixture();b.status="published";Object.values(b.assets).forEach(a=>a.publicationApproved=true);fs.mkdirSync(path.join(root,"src/data/photobooks"),{recursive:true});fs.writeFileSync(path.join(root,"src/data/photobooks/test.json"),JSON.stringify(b));assert.doesNotThrow(()=>assertPublication(root));}finally{fs.rmSync(root,{recursive:true,force:true});}});

test("external album scanner preserves variants, thumbnail, fullsize and dimensions",async()=>{
 const {scanAlbums}=await import('../src/utils/album-scanner.ts');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'album-scan-')),cwd=process.cwd();
 try{
  const directory=path.join(root,'public/images/albums/sample');fs.mkdirSync(directory,{recursive:true});
  const variants=asset('a').variants;
  fs.writeFileSync(path.join(directory,'info.json'),JSON.stringify({mode:'external',cover:'/cover.jpg',photos:[{src:'/read.jpg',thumbnail:'/thumb.jpg',fullsize:'/zoom.jpg',width:1200,height:1800,variants}]}));
  process.chdir(root);const [album]=await scanAlbums();assert.equal(album.photos[0].thumbnail,'/thumb.jpg');assert.equal(album.photos[0].fullsize,'/zoom.jpg');assert.equal(album.photos[0].width,1200);assert.deepEqual(album.photos[0].variants,variants);
 }finally{process.chdir(cwd);fs.rmSync(root,{recursive:true,force:true});}
});
