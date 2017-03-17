const {
	ipcRenderer: ipc,
	shell
} = require("electron");

let $data = {};

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
	let $diag = $dialog(type);

	$diag.toggle();
	$diag.css({
		'left': (window.innerWidth - $diag.width()) * 0.5,
		'top': (window.innerHeight - $diag.height()) * 0.5
	});
});
ipc.on('external', (ev, href) => {
	shell.openExternal(href);
});
ipc.on('log', (ev, msg) => {
	console.log(msg);
});

function notify(title, msg){
	new Notification(`${title} - ${L('title')}`, {
		icon: "img/logo.ico",
		body: msg
	});
}
function $dialog(type){
	return $(`#diag-${type}`);
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