const {
	ipcMain
} = require('electron');
const PKG = require("./package.json");
const LANG = require("./language.json");
const CoJer = require("./lib/cojer.js");
const SCRIPTS = {
	'account-login': () => exports.send('dialog', "login"),
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
			}
		]
	},
	{
		label: L('menu-program'),
		submenu: [
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

ipcMain.on('cojer', (e, type, opts) => {
	let F = CoJer[`request${type}`];

	if(typeof F != "function") throw Error(`The type ${type} is not a function`);
	F(e.sender, opts);
});