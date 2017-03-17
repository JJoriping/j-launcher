const OPT = require("../settings.json");
let $stage;

$(() => {
	$stage = {
		diag: {
			loginCaptcha: $("#diag-login-captcha-box"),
			loginOK: $("#diag-login-ok"),
			loginOut: $("#diag-login-output")
		},
		actTab: $("#act-tab"),
		acts: $("#activities")
	};
	$stage.diag.loginOK.on('click', e => {
		$stage.diag.loginOK.prop('disabled', true);
		$stage.diag.loginOut.css('color', "").html("");
		ipc.send('cojer', 'Login', {
			id: $("#diag-login-id").val(),
			pw: $("#diag-login-pw").val(),
			captcha: $("#diag-login-captcha").val(),
			captchaKey: $data._ckey,
			auto: $("#diag-login-auto").is(':checked')
		});
	});
	$data.acts = [];
	$data.currentAct = 0;
	if(OPT.auto){
		ipc.send('cojer', 'Login', OPT.auto);
	}
	createActivity('opened', L('act-or-title'), `
		<p>공사 중...</p>
	`);
});
ipc.on('event', (ev, type, data) => {
	switch(type){
		case 'login-ok':
			$stage.diag.loginOK.prop('disabled', false);
			notify(L('login-ok'));
			$dialog('login').hide();
			ipc.send('cojer', 'MyRoomList');
			break;
		case 'login-no':
			$stage.diag.loginOK.prop('disabled', false);
			$stage.diag.loginOut.css('color', "red").html(data);
			notify(L('login-no'), data);
			if(data.indexOf("img") != -1){
				$data._ckey = data.match(/key=(\w+)/)[1];
				$stage.diag.loginCaptcha.show();
			}
			break;
		case 'my-rooms':
			renderMyRooms(data);
			break;
	}
});

/**
 * 새 액티비티를 생성하고 탭을 갱신한다.
 * 
 * @param {string} id 액티비티 식별자 
 * @param {string} title 탭 제목
 * @param {*} $obj 액티비티 내용
 */
function createActivity(id, title, $obj){
	$data.acts.push([ id, title ]);
	$stage.acts.append($(`<div id="act-${id}" class="activity">`).append($obj));
	renderActTab();
}
/**
 * 현재 액티비티를 설정한다.
 * 
 * @param {string} id 액티비티 식별자
 */
function setActivity(id){
	$(".activity").hide();
	$(`#act-${id}`).show();
	$data.currentAct = id;
}
/**
 * 탭을 갱신한다. 현재 생성된 액티비티가 나타난다.
 */
function renderActTab(){
	$stage.actTab.empty();
	$data.acts.forEach(v => {
		$stage.actTab.append(`
			<div id="at-item-${v[0]}" class="at-item">
				<label>${v[1]}</label>
			</div>
		`);
	});
}
/**
 * 내 채팅방들을 각각 액티비티로 취급하여 생성한다. 이 함수는 중복 검사를 하지 않는다.
 * 
 * @param {any[]} list 내 채팅방 목록
 */
function renderMyRooms(list){
	list.forEach(v => {
		console.log(v);
		createActivity(v.id.replace(":", "-"), v.name, `
			<div>Hello, World!</div>
		`);
	});
}