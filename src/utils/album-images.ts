import type { Photo } from "../types/album";
import type { ImageVariant } from "../types/photobook";

export function imageSet(variants: ImageVariant[] = [], maxEdge = 1600) {
	const usable = variants.filter(
		(v) =>
			v.width > 0 && v.height > 0 && Math.max(v.width, v.height) <= maxEdge,
	);
	const webp = usable
		.filter((v) => v.format === "webp")
		.sort((a, b) => a.width - b.width);
	const jpeg = usable
		.filter((v) => v.format === "jpeg")
		.sort((a, b) => a.width - b.width);
	const set = (rows: ImageVariant[]) =>
		rows.map((v) => `${v.url} ${v.width}w`).join(", ");
	return {
		webp: set(webp),
		jpeg: set(jpeg),
		fallback: jpeg.at(-1) || webp.at(-1),
	};
}
export function photoPresentation(photo: Photo) {
	const set = imageSet(photo.variants);
	const zoom = [...(photo.variants || [])]
		.filter((v) => v.format === "webp")
		.sort((a, b) => b.width - a.width)[0];
	return {
		...set,
		src: photo.thumbnail || set.fallback?.url || photo.src,
		zoom: photo.fullsize || zoom?.url || photo.src,
	};
}
const escapeHtml = (value: unknown) =>
	String(value ?? "").replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			]!,
	);
export function encryptedPhotoMarkup(photo: Photo, albumId: string) {
	const p = photoPresentation(photo);
	const alt = escapeHtml(photo.alt || photo.title);
	const sizes = "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 320px";
	return `<div class="gallery-masonry-item"><a data-fancybox="album-${escapeHtml(albumId)}" href="${escapeHtml(p.zoom)}" data-caption="${alt}"><picture>${p.webp ? `<source type="image/webp" srcset="${escapeHtml(p.webp)}" sizes="${sizes}">` : ""}<img src="${escapeHtml(p.src)}" ${p.jpeg ? `srcset="${escapeHtml(p.jpeg)}" sizes="${sizes}"` : ""} ${photo.width && photo.height ? `width="${photo.width}" height="${photo.height}"` : ""} alt="${alt}" loading="lazy" decoding="async" class="w-full rounded-lg"></picture></a></div>`;
}
