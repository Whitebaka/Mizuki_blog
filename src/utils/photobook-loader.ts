import fs from "node:fs";
import path from "node:path";
import type { Photobook } from "../types/photobook";
import { validateBook } from "./photobook";

export const previewBooks = process.env.PHOTOBOOK_PREVIEW === "1";
export function loadBooks(): Photobook[] {
	const directory = path.join(process.cwd(), "src/data/photobooks");
	if (!fs.existsSync(directory)) return [];
	return fs
		.readdirSync(directory)
		.filter((n) => n.endsWith(".json"))
		.flatMap((name) => {
			const book = JSON.parse(
				fs.readFileSync(path.join(directory, name), "utf8"),
			);
			const errors = validateBook(book);
			if (errors.length) throw new Error(`${name}: ${errors.join("; ")}`);
			return book.status === "published" || previewBooks
				? [book as Photobook]
				: [];
		})
		.sort((a, b) => b.date.localeCompare(a.date));
}
