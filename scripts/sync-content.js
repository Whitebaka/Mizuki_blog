import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "./load-env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

loadEnv();
console.log("已加载 .env 配置文件\n");

// 内容同步必须显式启用；未设置或其他值均视为关闭。
const enableContentSync = process.env.ENABLE_CONTENT_SYNC === "true";
const contentRepoUrl = process.env.CONTENT_REPO_URL || "";
const contentDir = path.resolve(
	rootDir,
	process.env.CONTENT_DIR || "content",
);

function runGit(args, cwd, capture = false) {
	return execFileSync("git", args, {
		cwd,
		encoding: capture ? "utf8" : undefined,
		stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
	});
}

function readGit(args, cwd) {
	return runGit(args, cwd, true).trim();
}

console.log("开始同步内容...\n");

if (!enableContentSync) {
	console.log("内容分离功能已关闭（需显式设置 ENABLE_CONTENT_SYNC=true）");
	console.log("将使用主仓库中的本地内容\n");
	process.exit(0);
}

if (!contentRepoUrl) {
	console.error("错误：启用内容分离时必须设置 CONTENT_REPO_URL");
	process.exit(1);
}

if (!fs.existsSync(contentDir)) {
	console.log(`正在克隆内容仓库：${contentRepoUrl}`);
	try {
		runGit(["clone", "--depth", "1", contentRepoUrl, contentDir], rootDir);
	} catch (error) {
		console.error("内容仓库克隆失败：", error.message);
		process.exit(1);
	}
} else {
	const gitMetadata = path.join(contentDir, ".git");
	if (!fs.existsSync(gitMetadata)) {
		console.error(`错误：内容目录已存在但不是 Git 仓库：${contentDir}`);
		process.exit(1);
	}

	try {
		const status = readGit(["status", "--porcelain"], contentDir);
		if (status) {
			console.error("错误：内容仓库有未提交修改，已停止同步以避免覆盖内容。");
			console.error("请先提交或手动处理这些修改。");
			process.exit(1);
		}

		const branch = readGit(
			["symbolic-ref", "--quiet", "--short", "HEAD"],
			contentDir,
		);
		console.log(`正在更新内容仓库分支：${branch}`);
		runGit(["fetch", "origin", "--prune"], contentDir);
		runGit(["merge", "--ff-only", `origin/${branch}`], contentDir);
	} catch (error) {
		console.error("内容仓库无法安全快进更新，已停止同步。");
		console.error("请手动检查分支、远程或分叉状态：", error.message);
		process.exit(1);
	}
}

const contentMappings = [
	{ src: "posts", dest: "src/content/posts" },
	{ src: "spec", dest: "src/content/spec" },
	{ src: "data", dest: "src/data" },
	{ src: "images", dest: "public/images" },
];

// 在修改任何目标前完成预检，避免只替换一部分目录。
for (const mapping of contentMappings) {
	const srcPath = path.join(contentDir, mapping.src);
	const destPath = path.join(rootDir, mapping.dest);
	const backupPath = `${destPath}.backup`;

	if (
		fs.existsSync(srcPath) &&
		fs.existsSync(destPath) &&
		!fs.lstatSync(destPath).isSymbolicLink() &&
		fs.existsSync(backupPath)
	) {
		console.error(`错误：备份已存在，不会覆盖：${backupPath}`);
		console.error("请确认备份内容并手动移走后重试。");
		process.exit(1);
	}
}

console.log("\n正在建立内容链接...");

for (const mapping of contentMappings) {
	const srcPath = path.join(contentDir, mapping.src);
	const destPath = path.join(rootDir, mapping.dest);
	const backupPath = `${destPath}.backup`;

	if (!fs.existsSync(srcPath)) {
		console.log(`跳过不存在的源目录：${mapping.src}`);
		continue;
	}

	if (fs.existsSync(destPath) && !fs.lstatSync(destPath).isSymbolicLink()) {
		fs.renameSync(destPath, backupPath);
		console.log(`已备份原内容：${mapping.dest}.backup`);
	} else if (fs.existsSync(destPath)) {
		fs.unlinkSync(destPath);
	}

	try {
		const relPath = path.relative(path.dirname(destPath), srcPath);
		fs.symlinkSync(relPath, destPath, "junction");
		console.log(`已创建符号链接：${mapping.dest} -> ${mapping.src}`);
	} catch (error) {
		console.error(`无法创建符号链接：${mapping.dest}`);
		console.error("原内容仍保留在备份目录中：", error.message);
		process.exit(1);
	}
}

console.log("\n内容同步完成。请检查 git status，并手动决定是否提交变更。\n");
