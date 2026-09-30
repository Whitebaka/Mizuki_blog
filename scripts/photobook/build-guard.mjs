import fs from "node:fs";
import path from "node:path";

// public/ is copied verbatim by Astro. A draft route filter alone does not protect images.
export function assertPublication(root, preview = false) {
	if (preview) return;
	const approved = new Set();
	const directory=path.join(root,"src/data/photobooks");
	if(fs.existsSync(directory)) for(const name of fs.readdirSync(directory).filter(n=>n.endsWith(".json"))) {
		const book=JSON.parse(fs.readFileSync(path.join(directory,name),"utf8"));
		if(book.status!=="published") continue;
		for(const asset of Object.values(book.assets || {})) {
			if(asset.publicationApproved!==true) throw new Error(`Unapproved photobook asset: ${asset.id}`);
			for(const variant of asset.variants || []) if(variant.url.startsWith("/photobooks/")) approved.add(decodeURI(variant.url));
		}
	}
	const publicRoot=path.join(root,"public/photobooks");
	if(!fs.existsSync(publicRoot)) return;
	function walk(directory) {
		for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
			const file=path.join(directory,entry.name);
			if(entry.isDirectory()) walk(file);
			else {
				const url="/"+path.relative(path.join(root,"public"),file).split(path.sep).join("/");
				if(!approved.has(url)) throw new Error(`Draft/unreferenced photo would enter public output: ${url}. Use PHOTOBOOK_PREVIEW=1 only for a private preview, or remove draft material before publishing.`);
			}
		}
	}
	walk(publicRoot);
}
export default function photobookGuard() {
	return {name:"photobook-publication-guard",hooks:{"astro:build:start":()=>assertPublication(process.cwd(),process.env.PHOTOBOOK_PREVIEW==="1")}};
}
