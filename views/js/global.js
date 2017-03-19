const {
	clipboard: Clipboard,
	ipcRenderer: ipc,
	remote: Remote,
	shell
} = require("electron");
const OPT = require("../settings.json");

let $data = {};

function L(key){
	let v = global.LANG[key];

	if(v) return v.replace(/\{(\d+?)\}/g, (v, p1) => (arguments[p1] === undefined) ? v : arguments[p1])
		.replace(/FA\{(.+?)\}/g, (v, p1) => `<i class="fa fa-${p1}"/>`);
	return "#" + key;
}
$(() => {
	$(".diag-title").on('mousedown', e => {
		$data.$drag = $(e.currentTarget).parent().parent();
		$data.cx = e.pageX;
		$data.cy = e.pageY;
		$(window)
			.on('mousemove', onDiagMouseMove)
			.on('mouseup', onDiagMouseUp);
	});
	$(".diag-close").on('click', e => {
		$(e.currentTarget).parent().parent().hide();
	});
});
ipc.on('alert', (ev, msg) => {
	alert(msg);
});
ipc.on('dialog', (ev, type) => {
	return $dialog(type, true).toggle();
});
ipc.on('external', (ev, href) => {
	shell.openExternal(href);
});
ipc.on('log', (ev, msg) => {
	console.log(msg);
});

function setOpt(key, value){
	OPT[key] = value;
	ipc.send('opt', 'no-ask-upload', true);
}
function notify(title, msg){
	new Notification(`${title} - ${L('title')}`, {
		icon: "img/logo.ico",
		body: msg
	});
}
function $dialog(type, toCenter){
	let $R = $(`#diag-${type}`);

	if(toCenter) $R.css({
		'left': (window.innerWidth - $R.width()) * 0.5,
		'top': (window.innerHeight - $R.height()) * 0.5
	});
	return $R;
}
function onDiagMouseMove(e){
	let pos = $data.$drag.position();
	let dx = e.clientX - $data.cx, dy = e.clientY - $data.cy;
	
	$data.$drag.css({ 'top': pos.top + dy, 'left': pos.left + dx });
	$data.cx = e.clientX;
	$data.cy = e.clientY;
}
function onDiagMouseUp(e){
	delete $data.$drag, $data.cx, $data.cy;
	$(window)
		.off('mousemove', onDiagMouseMove)
		.off('mouseup', onDiagMouseUp);
}