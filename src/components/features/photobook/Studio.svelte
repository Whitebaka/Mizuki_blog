<script lang="ts">
import { onMount, untrack } from "svelte";
import type {
	BookPage,
	BookTemplate,
	Photobook,
} from "../../../types/photobook";
import { imageSet } from "../../../utils/album-images";
import {
	applyProposal,
	describeChanges,
	validateBook,
} from "../../../utils/photobook";

let { initial }: { initial: Photobook } = $props();
function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}
let book = $state<Photobook>(untrack(() => clone(initial)));
let selected = $state(0);
let past = $state<Photobook[]>([]);
let future = $state<Photobook[]>([]);
let message = $state("");
let error = $state("");
let saved = $state(false);
let mobile = $state(false);
let proposalText = $state("");
let candidate = $state<Photobook | null>(null);
let changes = $state<string[]>([]);
let dragIndex: number | null = null;
let storageKey = $derived(`mizuki:photobook:${initial.id}`);
const templates: Record<BookTemplate, string> = {
	hero: "整页图",
	pair: "双图对页",
	sequence: "连续动作",
	ending: "留白尾页",
};
let page = $derived(book.pages[selected]);
let unused = $derived(
	Object.keys(book.assets).filter(
		(id) => !book.pages.some((p) => p.assets.includes(id)),
	),
);
const thumbnail = (id: string) =>
	imageSet(book.assets[id].variants, 640).fallback!.url;
const reading = (id: string) =>
	imageSet(book.assets[id].variants).fallback!.url;
onMount(() => {
	try {
		saved = !!localStorage.getItem(storageKey);
	} catch {
		message = "浏览器禁用了本地存储，请使用导出草稿保存。";
	}
});
function persist() {
	try {
		localStorage.setItem(
			storageKey,
			JSON.stringify({ sourceRevision: initial.revision, book }),
		);
		saved = true;
		message = "草稿已保存在此浏览器";
	} catch {
		message = "本地保存失败，请导出草稿文件。";
	}
}
function commit(next: Photobook) {
	const errors = validateBook(next);
	if (errors.length) {
		error = errors.join("；");
		return false;
	}
	past = [...past.slice(-49), clone(book)];
	future = [];
	book = { ...clone(next), revision: book.revision + 1, status: "draft" };
	selected = Math.min(selected, book.pages.length - 1);
	error = "";
	candidate = null;
	persist();
	return true;
}
function edit(field: keyof BookPage, value: string | boolean | string[]) {
	if (page.locked && field !== "locked") {
		error = "先解锁此单元，再修改内容。";
		return;
	}
	const next = clone(book);
	Object.assign(next.pages[selected], { [field]: value });
	commit(next);
}
function template(value: BookTemplate) {
	const next = clone(book);
	const p = next.pages[selected];
	if (p.locked) return;
	const min = value === "pair" || value === "sequence" ? 2 : 1;
	p.template = value;
	if (min === 1) p.assets = p.assets.slice(0, 1);
	while (p.assets.length < min && unused.length) {
		const id = unused.find((id) => !p.assets.includes(id));
		if (!id) break;
		p.assets.push(id);
	}
	commit(next);
}
function move(from: number, to: number) {
	if (to < 0 || to >= book.pages.length || from === to) return;
	if (
		book.pages
			.slice(Math.min(from, to), Math.max(from, to) + 1)
			.some((p) => p.locked)
	) {
		error = "移动会改变已锁定单元的位置，请先解锁。";
		return;
	}
	const next = clone(book);
	next.pages.splice(to, 0, next.pages.splice(from, 1)[0]);
	if (commit(next)) selected = to;
}
function addPage() {
	if (!unused.length) {
		error =
			"所有照片都已使用。可先移除一个单元，或将双图改成整页图，释放照片。";
		return;
	}
	const next = clone(book);
	next.pages.push({
		id: `page-${Date.now()}`,
		chapter: "新章节",
		title: "新的片刻",
		caption: "",
		template: "hero",
		assets: [unused[0]],
		locked: false,
	});
	if (commit(next)) selected = book.pages.length - 1;
}
function remove() {
	if (page.locked || book.pages.length === 1) return;
	if (book.pages.slice(selected + 1).some((p) => p.locked)) {
		error = "删除会改变后续锁定单元的位置，请先解锁。";
		return;
	}
	const next = clone(book);
	next.pages.splice(selected, 1);
	commit(next);
}
function undo(redo = false) {
	const source = redo ? future : past;
	if (!source.length) return;
	const prior = clone(source.at(-1)!);
	if (redo) {
		future = future.slice(0, -1);
		past = [...past, clone(book)];
	} else {
		past = past.slice(0, -1);
		future = [...future, clone(book)];
	}
	book = { ...prior, revision: book.revision + 1, status: "draft" };
	selected = Math.min(selected, book.pages.length - 1);
	candidate = null;
	error = "";
	persist();
}
function importDraft(value: unknown) {
	const errors = validateBook(value);
	if (errors.length) throw new Error(errors.join("；"));
	const draft = value as Photobook;
	if (
		draft.id !== initial.id ||
		JSON.stringify(draft.assets) !== JSON.stringify(initial.assets)
	)
		throw new Error("草稿必须属于当前书册并使用原有图片库");
	commit({ ...draft, status: "draft" });
}
function restore() {
	try {
		const data = JSON.parse(localStorage.getItem(storageKey) || "null");
		if (!data || data.sourceRevision !== initial.revision)
			throw new Error("网页源版本已变化，请导出并核对旧草稿后再导入");
		importDraft(data.book);
		message = "已恢复浏览器草稿";
	} catch (e) {
		error = (e as Error).message;
	}
}
function download(name: string, value: unknown) {
	const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importFile(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	try {
		if (file.size > 2_000_000) throw new Error("草稿文件过大");
		importDraft(JSON.parse(await file.text()));
	} catch (e) {
		error = (e as Error).message;
	}
	input.value = "";
}
function review() {
	try {
		if (proposalText.length > 1_000_000) throw new Error("提案过大");
		candidate = applyProposal(clone(book), JSON.parse(proposalText));
		changes = describeChanges(book.pages, candidate.pages);
		error = "";
	} catch (e) {
		candidate = null;
		error = (e as Error).message;
	}
}
function exportBrief() {
	download(`${book.id}-ai-brief-r${book.revision}.json`, {
		instructions:
			"根据当前书册给出排版提案，只返回 proposal 格式。保持 locked 单元完整内容和绝对位置，不编造经历或对白。仅使用以下照片 ID，模板 hero/ending 各1张，pair 2张，sequence 2–3张，不重复图片。裁切固定 contain。",
		assets: Object.values(book.assets).map((a) => ({
			id: a.id,
			alt: a.alt,
			width: a.width,
			height: a.height,
		})),
		proposal: {
			schemaVersion: 1,
			bookId: book.id,
			baseRevision: book.revision,
			reason: "说明编排理由",
			pages: clone(book.pages),
		},
	});
}
</script>

<div class="studio">
	<header class="studio-heading"><div><a href="/books/">← 写真集</a><p class="book-eyebrow">写真集 / 编排</p><h1>编排工作台</h1><p>{book.title} · 草稿 r{book.revision}</p></div><a class="studio-btn" href={`/books/${book.id}/`}>查看源版本 ↗</a></header>
	<p class="studio-note">修改仅保存到此浏览器。导出草稿可备份或交回更新样册；不会直接发布。锁定可保护单元内容和位置。</p>
	<div class="studio-toolbar">
		<button onclick={()=>undo()} disabled={!past.length}>撤销</button><button onclick={()=>undo(true)} disabled={!future.length}>重做</button>
		<button onclick={persist}>保存草稿</button><button onclick={restore} disabled={!saved}>恢复草稿</button>
		<button onclick={()=>download(`${book.id}-draft-r${book.revision}.json`,book)}>导出草稿</button>
		<label class="studio-btn">导入草稿<input type="file" accept="application/json,.json" onchange={importFile} /></label>
		<span role="status">{message}</span>
	</div>
	{#if error}<p class="studio-error" role="alert">{error}</p>{/if}
	<div class="studio-workspace">
		<aside class="studio-outline" aria-label="书册单元">
			<div class="studio-outline-title"><h2>阅读顺序</h2><button onclick={addPage} aria-label="添加阅读单元">＋</button></div>
			<ol>{#each book.pages as item,index (item.id)}
				<li class:active={index===selected} draggable={!item.locked} ondragstart={()=>dragIndex=index} ondragover={event=>event.preventDefault()} ondrop={event=>{event.preventDefault();if(dragIndex!==null) move(dragIndex,index);dragIndex=null;}}>
					<button class="studio-page-select" onclick={()=>selected=index} aria-current={index===selected ? "true" : undefined}><img src={thumbnail(item.assets[0])} alt="" width="48" height="58" /><span><small>{String(index+1).padStart(2,"0")} {item.locked ? "· 已锁定" : ""}</small>{item.title}</span></button>
					<div class="studio-order"><button onclick={()=>move(index,index-1)} disabled={index===0 || item.locked} aria-label={`上移${item.title}`}>↑</button><button onclick={()=>move(index,index+1)} disabled={index===book.pages.length-1 || item.locked} aria-label={`下移${item.title}`}>↓</button></div>
				</li>
			{/each}</ol>
			<p>{unused.length} 张照片尚未编排</p>
		</aside>
		<section class="studio-canvas" aria-label="当前单元预览">
			<div class="studio-preview-controls"><h2>预览</h2><div class="book-mode"><button aria-pressed={!mobile} onclick={()=>mobile=false}>桌面对页</button><button aria-pressed={mobile} onclick={()=>mobile=true}>手机重排</button></div></div>
			<div class:mobile class="studio-preview photobook book-art" data-artwork={book.id}>
				<section class={`book-page book-${page.template}`}>
					<div class="book-section-heading"><span>{String(selected+1).padStart(2,"0")}</span><div><p>{page.chapter}</p><h2>{page.title}</h2></div></div>
					<div class="book-composition">{#each page.assets as id}<figure><img src={reading(id)} alt={book.assets[id].alt} width={book.assets[id].width} height={book.assets[id].height} /><figcaption>{book.assets[id].alt}</figcaption></figure>{/each}</div>
					{#if page.caption}<p class="book-caption">{page.caption}</p>{/if}
				</section>
			</div>
		</section>
		<aside class="studio-properties" aria-label="单元设置">
			<div class="studio-outline-title"><h2>单元设置</h2><button onclick={()=>edit("locked",!page.locked)} aria-pressed={page.locked}>{page.locked ? "解锁" : "锁定"}</button></div>
			<label>章节标记<input value={page.chapter} maxlength="60" disabled={page.locked} onchange={e=>edit("chapter",e.currentTarget.value)} /></label>
			<label>标题<input value={page.title} maxlength="100" disabled={page.locked} onchange={e=>edit("title",e.currentTarget.value)} /></label>
			<label>版式<select value={page.template} disabled={page.locked} onchange={e=>template(e.currentTarget.value as BookTemplate)}>{#each Object.entries(templates) as [key,label]}<option value={key}>{label}</option>{/each}</select></label>
			<label>短文<textarea value={page.caption} maxlength="500" disabled={page.locked} rows="4" onchange={e=>edit("caption",e.currentTarget.value)}></textarea></label>
			<h3>照片顺序</h3>
			{#each page.assets as id,i}<label>照片 {i+1}<select value={id} disabled={page.locked} onchange={e=>{const ids=[...page.assets];ids[i]=e.currentTarget.value;edit("assets",ids);}}>{#each [id,...unused] as option}<option value={option}>{option} · {book.assets[option].alt}</option>{/each}</select></label>{/each}
			{#if page.assets.length>1}<button disabled={page.locked} onclick={()=>edit("assets",[...page.assets].reverse())}>反转照片顺序</button>{/if}
			<p class="studio-note">完整保留画面，不裁切人物。双图在手机上按顺序上下排列。</p>
			<button class="studio-remove" disabled={page.locked || book.pages.length===1} onclick={remove}>移除此单元</button>
		</aside>
	</div>
	<section class="studio-ai" aria-label="AI提案审查"><div><p class="book-eyebrow">辅助编排</p><h2>让 AI 提案，由你定稿</h2><p>导出编排简报交给 AI，再粘贴返回的提案 JSON。先校验和查看差异，接受后只更新草稿。</p><button onclick={exportBrief}>导出 AI 编排简报</button></div>
		<div><label>提案 JSON<textarea bind:value={proposalText} oninput={()=>candidate=null} rows="6" placeholder="粘贴 AI 返回的提案 JSON"></textarea></label><button onclick={review}>校验并预览差异</button>
		{#if candidate}<div class="studio-diff"><h3>待接受的变更</h3><ul>{#each changes as change}<li>{change}</li>{/each}</ul><button onclick={()=>{if(candidate) commit(candidate);}}>接受提案为草稿</button><button onclick={()=>candidate=null}>取消</button></div>{/if}</div>
	</section>
</div>

<style>
.studio { padding:clamp(16px,3vw,40px); }
.studio-heading { display:flex; justify-content:space-between; gap:20px; align-items:center; }
.studio-heading a,.studio-heading p { font-size:12px; color:var(--book-ui-muted); }
.studio-heading h1 { position:relative; font-size:32px; font-weight:700; margin-bottom:10px; }
.studio-heading h1::before { content:""; position:absolute; left:-14px; top:6px; width:4px; height:30px; border-radius:4px; background:var(--primary); }
.studio button,.studio-btn { border:1px solid transparent; color:var(--btn-content); border-radius:8px; padding:8px 12px; font-size:12px; cursor:pointer; display:inline-block; background:var(--btn-regular-bg); transition:background-color .15s; }
.studio button:not(:disabled):hover,.studio-btn:hover { background:var(--btn-regular-bg-hover); }
.studio .book-mode button[aria-pressed=true] { background:var(--primary); color:var(--deep-text); border-color:transparent; }
.studio button:disabled { opacity:.35; cursor:default; }
.studio input,.studio textarea,.studio select { width:100%; padding:10px; background:var(--book-ui-paper); border:1px solid var(--line-color); border-radius:8px; color:var(--book-ui-ink); font-size:13px; }
.studio label { display:block; font-size:12px; margin-bottom:14px; line-height:2; }
.studio label.studio-btn { margin:0; line-height:normal; }
.studio input[type=file] { position:absolute; width:1px; height:1px; opacity:0; }
.studio label:focus-within { outline:2px solid var(--book-ui-accent); }
.studio-note { font-size:12px; line-height:1.9; color:var(--book-ui-muted); margin:20px 0; }
.studio-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; border-block:1px solid color-mix(in srgb,var(--book-ui-ink) 10%,transparent); padding:14px 0; }
.studio-toolbar span { font-size:11px; color:var(--book-ui-muted); }
.studio-workspace { display:grid; grid-template-columns:200px minmax(0,1fr) 220px; gap:22px; margin-top:24px; align-items:start; }
.studio h2 { font-size:15px; font-weight:600; }
.studio-outline-title,.studio-preview-controls { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:8px; }
.studio-outline ol { list-style:none; padding:0; }
.studio-outline li { border:1px solid transparent; border-radius:8px; margin-bottom:8px; }
.studio-outline li.active { border-color:var(--book-ui-accent); background:var(--btn-regular-bg); }
.studio button.studio-page-select { display:flex; text-align:left; width:100%; align-items:center; border:0; gap:10px; padding:6px; background:transparent; }
.studio-page-select img { width:44px; height:54px; object-fit:contain; }
.studio-page-select small { display:block; font-size:10px; color:var(--book-ui-muted); margin-bottom:5px; }
.studio-order { display:flex; justify-content:end; gap:4px; padding:0 5px 5px; }
.studio-order button { padding:3px 10px; }
.studio-outline > p { font-size:11px; color:var(--book-ui-muted); margin-top:16px; }
.studio-canvas { min-width:0; background:var(--page-bg); border-radius:var(--radius-large); padding:16px; }
.studio-preview { margin:auto; background:var(--book-art-paper); border-radius:12px; overflow:hidden; box-shadow:0 2px 8px #0001; }
.studio-preview .book-page { padding:24px; }
.studio-preview .book-section-heading { gap:14px; }
.studio-preview .book-section-heading h2 { font-size:20px; }
.studio-preview img { width:100%; height:auto; max-height:480px; object-fit:contain; }
.studio-preview.mobile { max-width:390px; }
.studio-preview.mobile .book-composition { grid-template-columns:1fr; }
.studio-preview.mobile .book-composition figure:first-child { width:100%; }
.studio-properties h3 { font-size:12px; margin:20px 0 10px; }
.studio-error { padding:14px; background:#fff0e8; border:1px solid #b45d34; border-radius:8px; color:#6f3218; font-size:13px; margin-top:16px; }
.studio-ai { border-top:1px solid color-mix(in srgb,var(--book-ui-ink) 15%,transparent); margin-top:40px; padding-top:30px; display:grid; grid-template-columns:1fr 1.5fr; gap:30px; }
.studio-ai p { font-size:13px; line-height:1.9; margin:16px 0; }
.studio-ai textarea { font-family:monospace; }
.studio-diff { margin-top:20px; border:1px solid var(--book-ui-accent); border-radius:8px; padding:16px; font-size:13px; }
.studio-diff ul { margin:12px 0; padding-left:18px; list-style:disc; line-height:1.8; }
.studio-diff button { margin-right:8px; }
@media(max-width:1100px) { .studio-workspace { grid-template-columns:160px minmax(0,1fr); } .studio-properties { grid-column:1/-1; display:grid; grid-template-columns:1fr 1fr; gap:12px; } .studio-properties .studio-outline-title { grid-column:1/-1; } }
@media(max-width:700px) { .studio-workspace,.studio-ai { grid-template-columns:1fr; } .studio-outline ol { display:flex; overflow:auto; gap:8px; } .studio-outline li { min-width:160px; } .studio-properties { grid-template-columns:1fr; } .studio-heading { align-items:start; } .studio-preview-controls { flex-wrap:wrap; } .studio-canvas { padding:10px; } .studio-preview .book-page { padding:18px; } }
</style>
