export interface ImageVariant {
	url: string;
	width: number;
	height: number;
	bytes: number;
	format: "webp" | "jpeg";
}
export interface BookAsset {
	id: string;
	alt: string;
	width: number;
	height: number;
	variants: ImageVariant[];
	publicationApproved: boolean;
}
export type BookTemplate = "hero" | "pair" | "sequence" | "ending";
export interface BookPage {
	id: string;
	chapter: string;
	title: string;
	caption: string;
	template: BookTemplate;
	assets: string[];
	locked: boolean;
}
export interface Photobook {
	schemaVersion: 1;
	id: string;
	title: string;
	subtitle: string;
	date: string;
	credit: string;
	status: "draft" | "published";
	revision: number;
	cover: string;
	assets: Record<string, BookAsset>;
	pages: BookPage[];
}
export interface BookProposal {
	schemaVersion: 1;
	bookId: string;
	baseRevision: number;
	reason: string;
	pages: BookPage[];
}
