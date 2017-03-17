const PKG = require("./package.json");
const OPT = require("./settings.json");
const Runner = require("./runner.js");
const {
	app: App,
	BrowserWindow,
	Menu,
	Tray
} = require('electron');
const Pug = require('electron-pug')({ pretty: true }, {
	version: PKG.version,
	L: Runner.L
});

let mainWindow;
// let tray;

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
		width: OPT['width'] || 800,
		height: OPT['height'] || 600,
		icon: __dirname + "/logo.ico"
	};

	mainWindow = new BrowserWindow(winOpt);
	// tray = new Tray(winOpt.icon);
	
	mainWindow.loadURL(__dirname + "/views/index.pug");
	/*tray.setToolTip(V);
	tray.setContextMenu(Menu.buildFromTemplate(Runner.MAIN_MENU));*/
}