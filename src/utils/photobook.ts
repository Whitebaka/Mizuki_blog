import type { BookPage, BookProposal, Photobook } from "../types/photobook";

const templates = {
	hero: [1, 1],
	pair: [2, 2],
	sequence: [2, 3],
	ending: [1, 1],
} as const;
const isObject = (x: unknown): x is Record<string, any> =>
	!!x && typeof x === "object" && !Array.isArray(x);
const text = (x: unknown, limit: number): x is string =>
	typeof x === "string" && x.length <= limit;
const id = (x: unknown): x is string =>
	typeof x === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(x);
const positive = (x: unknown) => Number.isSafeInteger(x) && Number(x) > 0;
const only = (x: object, keys: string[]) =>
	Object.keys(x).every((k) => keys.includes(k));
const safeUrl = (x: unknown) =>
	typeof x === "string" &&
	!/[\s<>"'\\]/.test(x) &&
	(/^\/(?!\/)/.test(x) || /^https:\/\/[^/]+\//.test(x));

export function validateBook(value: unknown): string[] {
	const errors: string[] = [];
	if (!isObject(value)) return ["书册必须是 JSON 对象"];
	const b = value;
	if (
		!only(b, [
			"schemaVersion",
			"id",
			"title",
			"subtitle",
			"date",
			"credit",
			"status",
			"revision",
			"cover",
			"assets",
			"pages",
		])
	)
		errors.push("书册含未知或私有字段");
	if (b.schemaVersion !== 1 || !id(b.id) || !positive(b.revision))
		errors.push("书册版本或 ID 无效");
	if (
		!text(b.title, 100) ||
		!b.title?.trim() ||
		!text(b.subtitle, 400) ||
		!text(b.credit, 200) ||
		!/^\d{4}-\d{2}-\d{2}$/.test(b.date)
	)
		errors.push("标题、说明、日期或署名无效");
	if (!["draft", "published"].includes(b.status)) errors.push("状态无效");
	if (
		!isObject(b.assets) ||
		!Object.keys(b.assets).length ||
		Object.keys(b.assets).length > 200
	)
		return [...errors, "图片库必须包含 1–200 张图片"];
	for (const [key, a] of Object.entries(b.assets)) {
		if (
			!isObject(a) ||
			!only(a, [
				"id",
				"alt",
				"width",
				"height",
				"variants",
				"publicationApproved",
			]) ||
			!id(key) ||
			a.id !== key ||
			!text(a.alt, 400) ||
			!a.alt.trim() ||
			!positive(a.width) ||
			!positive(a.height) ||
			typeof a.publicationApproved !== "boolean"
		) {
			errors.push(`图片 ${key} 元数据无效`);
			continue;
		}
		if (
			!Array.isArray(a.variants) ||
			!a.variants.length ||
			a.variants.length > 16
		) {
			errors.push(`图片 ${key} 缺少尺寸版本`);
			continue;
		}
		const seen = new Set<string>();
		for (const v of a.variants) {
			if (
				!isObject(v) ||
				!only(v, ["url", "width", "height", "bytes", "format"]) ||
				!safeUrl(v.url) ||
				!positive(v.width) ||
				!positive(v.height) ||
				!positive(v.bytes) ||
				!["webp", "jpeg"].includes(v.format) ||
				Math.abs(v.width / v.height - a.width / a.height) > 0.01 ||
				v.width > a.width ||
				v.height > a.height
			) {
				errors.push(`图片 ${key} 的尺寸、URL 或字节数无效`);
				continue;
			}
			const variantKey = `${v.format}:${v.width}`;
			if (seen.has(variantKey)) errors.push(`图片 ${key} 有重复尺寸版本`);
			seen.add(variantKey);
		}
		if (
			!a.variants.some((v) => isObject(v) && v.format === "jpeg") ||
			!a.variants.some((v) => isObject(v) && v.format === "webp")
		)
			errors.push(`图片 ${key} 需要 WebP 和 JPEG 版本`);
		if (b.status === "published" && !a.publicationApproved)
			errors.push(`图片 ${key} 尚未批准发布`);
	}
	if (!Object.hasOwn(b.assets, b.cover)) errors.push("封面引用不存在");
	if (!Array.isArray(b.pages) || !b.pages.length || b.pages.length > 100)
		return [...errors, "阅读单元数量必须在 1–100 之间"];
	const pageIds = new Set<string>();
	const used = new Set<string>();
	for (const p of b.pages) {
		if (
			!isObject(p) ||
			!only(p, [
				"id",
				"chapter",
				"title",
				"caption",
				"template",
				"assets",
				"locked",
			]) ||
			!id(p.id) ||
			!text(p.chapter, 60) ||
			!text(p.title, 100) ||
			!text(p.caption, 500) ||
			typeof p.locked !== "boolean" ||
			!Object.hasOwn(templates, p.template)
		) {
			errors.push("阅读单元字段或模板无效");
			continue;
		}
		if (pageIds.has(p.id)) errors.push(`重复单元 ${p.id}`);
		pageIds.add(p.id);
		const [min, max] = templates[p.template as keyof typeof templates];
		if (
			!Array.isArray(p.assets) ||
			p.assets.length < min ||
			p.assets.length > max
		) {
			errors.push(`单元 ${p.id} 图片数量不符合模板`);
			continue;
		}
		for (const asset of p.assets) {
			if (!id(asset) || !Object.hasOwn(b.assets, asset))
				errors.push(`单元 ${p.id} 引用了不存在的图片`);
			if (used.has(asset)) errors.push(`图片 ${asset} 重复使用`);
			used.add(asset);
		}
	}
	return errors;
}

export function applyProposal(book: Photobook, value: unknown): Photobook {
	if (
		!isObject(value) ||
		!only(value, [
			"schemaVersion",
			"bookId",
			"baseRevision",
			"reason",
			"pages",
		]) ||
		value.schemaVersion !== 1 ||
		value.bookId !== book.id ||
		value.baseRevision !== book.revision ||
		!text(value.reason, 1000) ||
		!value.reason.trim() ||
		!Array.isArray(value.pages)
	)
		throw new Error("提案格式无效，或书册版本已变化；请重新生成提案");
	const proposal = value as BookProposal;
	const next: Photobook = {
		...structuredClone(book),
		pages: structuredClone(proposal.pages),
		revision: book.revision + 1,
		status: "draft",
	};
	const errors = validateBook(next);
	if (errors.length) throw new Error(errors.join("；"));
	for (let i = 0; i < book.pages.length; i++) {
		const p = book.pages[i];
		if (
			p.locked &&
			(
				[
					"id",
					"chapter",
					"title",
					"caption",
					"template",
					"assets",
					"locked",
				] as const
			).some(
				(key) =>
					JSON.stringify(next.pages[i]?.[key]) !== JSON.stringify(p[key]),
			)
		)
			throw new Error(`已锁定单元「${p.title || p.id}」的位置或内容被改变`);
	}
	return next;
}

export function describeChanges(
	before: BookPage[],
	after: BookPage[],
): string[] {
	const changes: string[] = [];
	for (const [index, p] of after.entries()) {
		const previous = before.findIndex((x) => x.id === p.id);
		if (previous < 0) changes.push(`新增单元：${p.title || p.id}`);
		else {
			if (previous !== index)
				changes.push(
					`「${p.title || p.id}」：第 ${previous + 1} 单元 → 第 ${index + 1} 单元`,
				);
			if (JSON.stringify(before[previous]) !== JSON.stringify(p))
				changes.push(`修改「${p.title || p.id}」的图片、版式或文案`);
		}
	}
	for (const p of before)
		if (!after.some((x) => x.id === p.id))
			changes.push(`移除单元：${p.title || p.id}`);
	return changes.length ? changes : ["内容与顺序没有变化"];
}
