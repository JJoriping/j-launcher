const { readFile } = require('fs');
const {
	app: App,
	BrowserWindow,
	Menu,
	Tray
} = require('electron');
global.APP_PATH = App.getAppPath();
global.AUTH_FILE = global.APP_PATH + "/auth.json";
global.CLIP_FILE = global.APP_PATH + "/clipboard.png";
global.OPT_FILE = global.APP_PATH + "/settings.json";
const OPT = require(global.OPT_FILE);
const PKG = require("./package.json");
const Runner = require("./runner.js");
const Pug = require('electron-pug')({ pretty: true }, {
	version: PKG.version,
	OPT: OPT,
	L: Runner.L
});

let mainWindow;

App.on('ready', main);
App.on('window-all-closed', () => {
	if(process.platform != 'darwin') App.quit();
});
App.on('activate', () => {
	if(mainWindow === null) main();
});
Runner.send = (...argv) => {
	mainWindow.webContents.send.apply(mainWindow.webContents, argv);
};

function main(){
	Menu.setApplicationMenu(Menu.buildFromTemplate(Runner.MAIN_MENU));

	const V = `${PKG['name']} ${PKG['version']}`;
	let winOpt = {
		title: `${V} - Now Loading`,
		width: OPT['width'] || 900,
		height: OPT['height'] || 600,
		icon: `${__dirname}/views/img/logo.ico`
	};

	mainWindow = new BrowserWindow(winOpt);
	mainWindow.loadURL(`file://${__dirname}/views/index.pug`);
}