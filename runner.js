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
			{ type: "separator" },
			{
				label: L('menu-chat-status'),
				accelerator: "CmdOrCtrl+T",
				click: () => exports.run("chat-status")
			},
			{
				label: L('menu-chat-list'),
				accelerator: "CmdOrCtrl+`",
				click: () => exports.run("chat-list")
			}
		]
	},
	{
		label: L('menu-program'),
		submenu: [
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

ipcMain.on('opt', (e, key, value) => {
	CoJer.setOpt(e.sender, key, value);
});
ipcMain.on('cojer', (e, type, opts) => {
	let F = CoJer[`request${type}`];

	if(typeof F != "function") throw Error(`The type ${type} is not a function`);
	F(e.sender, opts);
});