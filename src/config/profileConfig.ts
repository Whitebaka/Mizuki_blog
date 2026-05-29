import type { ProfileConfig } from "../types/config";

// 个人资料配置
export const profileConfig: ProfileConfig = {
	avatar: "assets/images/TENKA.JPG", // 相对于 /src 目录。如果以 '/' 开头，则相对于 /public 目录
	name: "白玖",
	bio: "做高质量可替换的支持者",
	typewriter: {
		enable: true, // 启用个人简介打字机效果
		speed: 80, // 打字速度（毫秒）
	},
	links: [
		{
			name: "Bilibili",
			icon: "fa7-brands:bilibili",
			url: "https://space.bilibili.com/701864046",
		},
		{
			name: "Weibo",
			icon: "fa7-brands:weibo",
			url: "https://gitee.com/matsuzakayuki",
		},
		{
			name: "RedNote",
			icon: "simple-icons:xiaohongshu",
			url: "https://codeberg.org",
		},
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/matsuzaka-yuki",
		},
	],
};
