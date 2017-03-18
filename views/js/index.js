const OPT = require("../settings.json");
const ACT_OPENED = "opened";
let $stage;

$(() => {
	// 스테이지 등록
	$stage = {
		diag: {
			loginCaptcha: $("#diag-login-captcha-box"),
			loginOK: $("#diag-login-ok"),
			loginOut: $("#diag-login-output")
		},
		actTab: $("#act-tab"),
		acts: $("#activities")
	};
	// 로그인 대화 상자에 대한 처리
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
	// 특수 액티비티 등록
	$data.acts = {};
	$data.currentAct = ACT_OPENED;
	createActivity(ACT_OPENED, L('act-or-title'), `
		<select id="act-or-cafe-list">
			<option>${L('loading')}</option>
		</select>
		<div id="act-or-room-list"></div>
	`);
	$stage.roomList = $("#act-or-room-list");
	$stage.cafeList = $("#act-or-cafe-list").on('mousedown', e => {
		$stage.cafeList.off('mousedown').children("option:first-child").html(L('act-or-cafe-list')).prop('disabled', true);
	}).on('change', e => {
		$data.currentCafe = $data.myInfo.cafeList[$stage.cafeList.val()];
		ipc.send('cojer', 'OpenRoomList', {
			cafe: $data.currentCafe
		});
	});
	// 자동 로그인 처리
	if(OPT.auto) ipc.send('cojer', 'Login', OPT.auto);
});
ipc.on('event', (ev, type, data) => {
	switch(type){
		case 'login-ok':
			$data.myInfo = data;
			$stage.diag.loginOK.prop('disabled', false);
			notify(L('login-ok'));
			$dialog('login').hide();
			renderMyCafes();
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
		case 'open-rooms':
			renderOpenRooms(data);
			break;
		case 'my-rooms':
			renderMyRooms(data);
			if(localStorage.hasOwnProperty('recentAct')){
				setActivity(localStorage.getItem('recentAct'));
			}
			break;
		case 'sess-msg':
			processMessage(data);
			break;
		case 'sess-err':
			console.error(data);
			break;
		case 'prev-chat':
			data.reverse().forEach(v => processMessage(v, true));
			break;
		case 'join':
			renderMyRooms([ data ]);
			setActivity(data.id.replace(":", "-"));
			break;
		case 'quit':
			removeActivity(data.id.replace(":", "-"));
			break;
	}
});

/**
 * 새 액티비티를 생성하고 탭을 갱신한다.
 * 
 * @param {string} id 액티비티 식별자 
 * @param {string} title 탭 제목
 * @param {*} $obj 액티비티 내용. 이 함수 내에서는 생성되는 액티비티 자체로 취급한다.
 * @returns {Activity} 생성된 액티비티
 */
function createActivity(id, title, $obj){
	$stage.acts.append($obj = $(`<div id="act-${id}" class="activity">`).html($obj));
	$data.acts[id] = new Activity(id, title, Object.keys($data.acts).length, $obj);

	renderActTab();
	return $data.acts[id];
}
/**
 * 해당 액티비티를 목록에서 제외시키고 탭을 갱신한다.
 * 
 * @param {string} id 액티비티 식별자
 */
function removeActivity(id){
	$(`#act-${id}`).remove();
	delete $data.acts[id];
	if($data.currentAct == id) setActivity(ACT_OPENED);

	renderActTab();
}
/**
 * 현재 액티비티를 설정한다.
 * 
 * @param {string} id 액티비티 식별자
 */
function setActivity(id){
	let cr;

	$data.currentAct = id;
	localStorage.setItem('recentAct', id);
	$(".act-talk-last").remove();
	if(Activity.current.nCount > 0){
		$(`#actt-${id}-${Activity.current.nStartId}`).before(`<div class="act-talk act-talk-last"/>`);
		Activity.current.nCount = 0;
	}
	$(".at-current").removeClass("at-current");
	$(`#at-item-${id}`).removeClass("at-notify").addClass("at-current")
		.children(".ati-count").hide();
	$(".activity").hide();
	$(`#act-${id}`).show();
	if(id != ACT_OPENED && (cr = Activity.current.room)){
		if(!cr.hasOwnProperty('_prevChat') && cr.lastMsgSn > 0){
			cr._prevChat = cr.lastMsgSn;
			Activity.current.requestPrevChat();
		}
	}
	Activity.current.$stage.chat.focus();
}
/**
 * 탭을 갱신한다. 현재 생성된 액티비티가 나타난다.
 */
function renderActTab(){
	$stage.actTab.empty();
	Object.keys($data.acts).map(v => $data.acts[v]).sort((a, b) => a.ord - b.ord).forEach(v => {
		$stage.actTab.append(`
			<div id="at-item-${v.id}" class="at-item ellipse${(v.room && !v.room.isPublic) ? " at-item-locked" : ""}" onclick="setActivity('${v.id}');">
				<label class="ati-count" style="display: none;"></label>
				<i class="fa fa-lock ati-locked"/>
				<label>${v.title}</label>
			</div>
		`);
	});
	$(`#at-item-${$data.currentAct}`).addClass("at-current");
}
/**
 * 카페 목록을 갱신한다.
 */
function renderMyCafes(){
	$stage.cafeList.empty().append(`<option>${L('act-or-cafe-select')}</option>`);
	$data.myInfo.cafeList.forEach((v, i) => {
		$stage.cafeList.append(`<option value="${i}">${v.name}</option>`);
	});
}
/**
 * 선택된 카페에서 공개된 채팅방들의 목록을 갱신한다.
 * 
 * @param {any[]} list 공개된 채팅방 목록
 */
function renderOpenRooms(list){
	let now = Date.now();

	$stage.roomList.empty().append(`<div class="act-or-room-count">${L('act-or-room-count', list.length)}</div>`);
	list.forEach(v => {
		let id = v.id.replace(":", "-");
		let u = (now - new Date(v.updated).getTime()) * 0.001;

		if(u < 60) u = L('act-or-room-time-sec');
		else if(u < 3600) u = L('act-or-room-time-min', Math.round(u / 60));
		else if(u < 86400) u = L('act-or-room-time-hour', Math.round(u / 3600));
		else u = L('act-or-room-time-day', Math.round(u / 86400));

		$stage.roomList.append(`
			<div id="act-or-room-${id}" class="act-or-room" onclick="requestJoin('${$data.currentCafe.id}', '${v.id}');">
				<div class="acto-room-name"><b>${v.name}</b></div>
				<div class="acto-room-user">${L('act-mr-user', v.userCount)}</div>
				<div class="acto-room-attr">${v.isPublic ? L('act-mr-public') : L('act-mr-private')}</div>
				<div class="acto-room-time">${u}</div>
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
		let act = createActivity(v.id.replace(":", "-"), v.name, `
			<div class="act-menu">
				<div class="act-menu-title ellipse">
					<label class="actm-title-name"><b>${v.name}</b></label><i/>
					<label class="actm-title-user">${L('act-mr-user', v.userCount)}</label><i/>
					<label class="actm-title-cafe">${v.cafe.name}</label><i/>
					<label class="actm-title-attr">${v.isPublic ? L('act-mr-public') : L('act-mr-private')}</label>
				</div>
				<button class="act-menu-quit">${L('act-mr-quit')}</button>
				<button class="act-menu-prev">${L('act-mr-prev-chat')}</button>
			</div>
			<div class="act-board"></div>
			<div class="act-ghost act-talk"></div>
			<div class="act-list"></div>
			<div class="act-me">
				<textarea class="act-chat"></textarea>
				<button class="act-send">${L('act-mr-send')}</button>
			</div>
		`);
		act.setRoom(v);
	});
}
/**
 * 세션에서 받은 정보를 처리한다.
 * 
 * @param {*} data 받은 정보
 * @param {boolean} prev 이전 채팅 여부. true인 경우 가장 위에 배치된다.
 */
function processMessage(data, prev){
	let rId = data.room.id.replace(":", "-");
	let act = $data.acts[rId];
	if(!act){
		renderMyRooms([ data.room ]);
		act = $data.acts[rId];
	}
	let $board = act.$stage.board, board = $board.get(0);
	let isMe = data.user.id == $data.myInfo.profile.id;
	let isBottom = board.scrollHeight - board.scrollTop === board.clientHeight;
	let $talk;
	let content;

	if(isMe) data.user = $data.myInfo.profile;
	switch(data.type){
		case "text": content = `
			${cUser(data.user)}
			<div class="actt-body">${processText(data.message)}</div>
			`;
			break;
		case "image": content = `
			${cUser(data.user)}
			<div class="actt-body">
				<img src="${data.thumb}" onload="processImage(this, '${data.image}', ${isBottom});"/>
			</div>
			`;
			break;
		case "sticker": content = `
			${cUser(data.user)}
			<div class="actt-body">
				<img src="${data.image}" onload="processImage(this, '${data.xxhdpi}', ${isBottom});"/>
			</div>
			`;
			break;
		case "join":
			content = cNotice(L('notice-join', data.user.nickname, data.user.id));
			break;
		case "leave":
			content = cNotice(L('notice-leave', data.user.nickname, data.user.id));
			break;
		default:
			console.log(data);
	}
	$board[prev ? 'prepend' : 'append']($talk = $(`<div id="actt-${rId}-${data.id}" class="act-talk${isMe ? " act-my-talk" : ""}">
		${content}
		<div class="actt-stamp">${new Date(data.time).toLocaleTimeString()}</div>
	</div>`));
	if($data.currentAct != rId){
		if(act.nCount === 0) act.nStartId = data.id;
		$(`#at-item-${rId}`).addClass("at-notify")
			.children(".ati-count").show().html(++act.nCount);
	}
	if(isBottom || isMe){
		board.scrollTop = board.scrollHeight - board.clientHeight;
	}else{
		act.$stage.ghost.show().html($talk.html());
	}

	function cUser(user){
		return `
			<div class="actt-user ellipse" title="${user.nickname} (${user.id})">
				<div class="actt-user-image" style="background-image: url(${user.image});"/>
				${data.user.nickname}
			</div>
		`;
	}
	function cNotice(msg){
		return `<div class="actt-notice">${msg}</div>`;
	}
	console.log(data);
}
/**
 * 불러온 텍스트 정보를 처리한다.
 * 
 * @param {string} text 텍스트
 * @returns {string} 처리된 텍스트
 */
function processText(text){
	const TABLE = {
		'<': "&lt;", '>': "&gt;", '&': "&amp;"
	};
	text = text.replace(/<|>|&/g, v => TABLE[v]);

	return text;
}
/**
 * 불러온 이미지 정보를 처리한다.
 * 
 * @param {HTMLImageElement} img 이미지 DOM 객체
 * @param {string} source 원본 이미지 경로
 * @param {boolean} downScroll 스크롤 내리기 여부. true인 경우 이미지의 높이만큼 스크롤을 내린다.
 */
function processImage(img, source, downScroll){
	let $img = $(img).on('click', e => popupImage(source));

	if(downScroll) $img.parent().parent().parent().get(0).scrollTop += img.height;
}
/**
 * 메시지를 전송한다.
 * 전송하려는 메시지는 현재 DOM의 상황에 따라 자동적으로 결정된다.
 * 
 * @param {string} type 정보 유형(다음 중 하나: text)
 * @param {*} room 보낼 채팅방 객체
 * @param {*} data 보낼 정보
 */
function sendMessage(type, room, data){
	ipc.send('cojer', 'Send', {
		type: type,
		room: room,
		data: data
	});
}
/**
 * 이미지에 대한 팝업을 띄운다.
 * 
 * @param {string} url 이미지 경로
 */
function popupImage(url){
	window.open(url);
}
/**
 * 방에 입장한다.
 * 
 * @param {string} cId 입장할 채팅방이 소속된 카페의 식별자
 * @param {string} rId 입장할 채팅방의 식별자
 */
function requestJoin(cId, rId){
	if($data.acts[rId.replace(":", "-")]) return error(100);
	ipc.send('cojer', 'Join', {
		cId: cId, rId: rId
	});
}
/**
 * 오류를 알린다.
 * 
 * @param {number} code 오류 번호
 * @param {*} msg 부가 메시지
 */
function error(code, msg){
	alert(L(`error-${code}`, msg));
}