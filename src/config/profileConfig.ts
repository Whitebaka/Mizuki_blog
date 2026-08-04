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
			url: "https://space.bilibili.com/307200",
		},
		{
			name: "Weibo",
			icon: "fa7-brands:weibo",
			url: "https://weibo.com/u/7896645956",
		},
		{
			name: "RedNote",
			icon: "simple-icons:xiaohongshu",
			url: "https://www.xiaohongshu.com/user/profile/6535e130000000000301dbc5?xsec_token=ABWfxUD07IFxJwf_-x2eRHe9l9VVSR1Mo_XSht1zr8ytc=&xsec_source=pc_note",
		},
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/Whitebaka",
		},
	],
};
