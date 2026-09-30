import type { AlbumGroup, Photo } from "../../../types/album";

export interface AlbumCardProps {
	album: AlbumGroup;
}

export interface PhotoCardProps extends Photo {
	albumId: string;
}
