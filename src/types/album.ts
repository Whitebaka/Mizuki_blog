import type { ImageVariant } from "./photobook";

export interface Photo {
	id?: string;
	src: string;
	alt?: string;
	title?: string;
	thumbnail?: string;
	fullsize?: string;
	variants?: ImageVariant[];
	tags?: string[];
	description?: string;
	date?: string;
	location?: string;
	width?: number;
	height?: number;
}

export interface AlbumGroup {
	id: string;
	title: string;
	description?: string;
	cover: string;
	date: string;
	location?: string;
	tags?: string[];
	photos: Photo[];
	password?: string;
	passwordHint?: string;
}
