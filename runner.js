const {
	ipcMain
} = require('electron');
const PKG = require("./package.json");
const LANG = require("./language.json");
const CoJer = require("./lib/cojer.js");
const SCRIPTS = {
	'account-login': () => exports.send('dialog', "login"),
	'account-logout': () => CoJer.requestLogout(exports),

	'chat-status': () => exports.send('dialog', "status"),
	'chat-list': () => exports.send('event', "chan-list"),
	'chat-image': () => exports.send('event', "chat-image"),
	'chat-time': () => exports.send('event', "chat-time"),
	'chat-bw': () => exports.send('dialog', "bw"),
	'chat-macro': () => exports.send('dialog', "macro"),

	'program-check-update': () => {
		exports.send('event', "check-update");
	},
	'program-o-settings': () => {
		exports.send('command', "help_opt");
		exports.send('external', global.OPT_FILE, true)
	},
	'program-info': () => {
		exports.send('alert', [
			`=== ${PKG.name} ===`,
			`${PKG.description}`, "",
			`Version: ${PKG.version}`,
			`Author: ${PKG.author}`,
			`License: ${PKG.license}`,
			`Repository: ${PKG.repository}`
		].join('\n'));
	},
	'program-blog': () => exports.send('external', "http://blog.jjo.kr/"),
	'program-repo': () => exports.send('external', "https://github.com/JJoriping/j-launcher"),

	'exit': () => process.exit(0)
};

function L(key){
	return LANG[key] || `#${key}`;
}
exports.MAIN_MENU = [
	{
		label: L('menu-account'),
		submenu: [
			{
				label: L('menu-account-login'),
				accelerator: "CmdOrCtrl+L",
				click: () => exports.run("account-login")
			},
			{
				label: L('menu-account-logout'),
				click: () => exports.run("account-logout")
			}
		]
	},
	{
		label: L('menu-chat'),
		submenu: [
			{
				label: L('menu-chat-image'),
				accelerator: "CmdOrCtrl+Space",
				click: () => exports.run("chat-image")
			},
			{
				type: "checkbox",
				label: L('menu-chat-time'),
				accelerator: "CmdOrCtrl+H",
				click: () => exports.run("chat-time")
			},
			{
				label: L('menu-chat-bw'),
				accelerator: "CmdOrCtrl+B",
				click: () => exports.run("chat-bw")
			},
			{
				label: L('menu-chat-macro'),
				accelerator: "CmdOrCtrl+M",
				click: () => exports.run("chat-macro")
			},
			{ type: "separator" },
			{
				label: L('menu-chat-status'),
				accelerator: "CmdOrCtrl+T",
				click: () => exports.run("chat-status")
			},
			{
				type: "checkbox",
				label: L('menu-chat-list'),
				accelerator: "CmdOrCtrl+`",
				click: () => exports.run("chat-list")
			},
			{ type: "separator" },
			{
				label: L('menu-chat-zoom-in'),
				accelerator: "CmdOrCtrl+Shift+,",
				role: "zoomin"
			},
			{
				label: L('menu-chat-zoom-reset'),
				accelerator: "CmdOrCtrl+Shift+.",
				role: "resetzoom"
			},
			{
				label: L('menu-chat-zoom-out'),
				accelerator: "CmdOrCtrl+Shift+/",
				role: "zoomout"
			}
		]
	},
	{
		label: L('menu-program'),
		submenu: [
			{
				label: L('menu-program-check-update'),
				click: () => exports.run("program-check-update")
			},
			{
				label: L('menu-program-o-settings'),
				click: () => exports.run("program-o-settings")
			},
			{ type: "separator" },
			{
				label: L('menu-program-info'),
				click: () => exports.run("program-info")
			},
			{
				label: L('menu-program-blog'),
				click: () => exports.run("program-blog")
			},
			{
				label: L('menu-program-repo'),
				click: () => exports.run("program-repo")
			},
			{ type: "separator" },
			{
				label: L('menu-program-reload'),
				accelerator: "F5",
				role: "reload"
			},
			{
				label: L('menu-program-dev'),
				role: "toggledevtools"
			},
			{ type: "separator" },
			{
				label: L('menu-program-exit'),
				accelerator: "Alt+F4",
				click: () => exports.run("exit")
			}
		]
	}
];
exports.L = L;
exports.run = (cmd) => {
	SCRIPTS[cmd]();
};
exports.send = (...argv) => {
	// override this
};
CoJer.log = msg => {
	exports.send('log', msg);
};

ipcMain.on('opt', (e, data) => {
	CoJer.setOpt(e.sender, data);
});
ipcMain.on('black', (e, data) => {
	CoJer.setBlackLog(e.sender, data);
});
ipcMain.on('cojer', (e, type, opts) => {
	let F = CoJer[`request${type}`];

	if(typeof F != "function") throw Error(`The type ${type} is not a function`);
	F(e.sender, opts);
});