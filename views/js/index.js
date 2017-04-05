const OPT_KEYS = [
	"auto", "block", "block-log", "channel-pw", "idle-time", "max-chat", "mute",
	"no-ask-upload", "prev-per-req", "status-list", "viewer-resize"
];
let $stage;
let $sound;

$(() => {
	$data.localId = 0;
	// 스테이지 등록
	$stage = {
		body: $("body"),
		diag: {
			loginCaptcha: $("#diag-login-captcha-box"),
			loginOK: $("#diag-login-ok"),
			loginOut: $("#diag-login-output"),
			uploadImg: $("#diag-upload-img"),
			uploadOK: $("#diag-upload-ok"),
			ceOK: $("#diag-ce-ok"),
			statusList: $("#diag-status-list"),
			statusOK: $("#diag-status-ok")
		},
		actTab: $("#act-tab"),
		acts: $("#activities"),
		cmdHint: $("#command-hint")
	};
	// 소리 등록
	$sound = {};
	[
		'k', 'alarm'
	].map(v => $sound[v] = new Audio(`media/${v}.mp3`));
	// 전역 입력 핸들링 / 유휴 상태 검사
	window.onmousemove = e => {
		breakIdle();
	};
	window.onkeydown = e => {
		breakIdle();
		switch(e.key){
			case 'Enter':
				$(".dialog:visible .ok-button:last").trigger('click');
				break;
			case 'Escape':
				$(".dialog:visible:last").hide();
				break;
			default: return;
		}
	};
	setInterval(checkIdle, 1000);
	// 탭 순서 불러오기
	loadTabOrdinal();
	// 창에 드롭하는 경우
	document.body.addEventListener('dragenter', e => {
		$data._dType = e.dataTransfer.items[0].kind;
	});
	document.body.addEventListener('dragover', e => {
		$stage.body.addClass("dark-body");
		if($data._dType != "string"){
			e.preventDefault();
			e.stopPropagation();
		}
	});
	document.body.addEventListener('dragleave', e => {
		$stage.body.removeClass("dark-body");
	});
	document.body.addEventListener('drop', e => {
		$stage.body.removeClass("dark-body");
		if(!Activity.current.onChatPaste(e)){
			e.preventDefault();
			e.stopPropagation();
		}
	});
	// 로그인 대화 상자
	$stage.diag.loginOK.on('click', e => {
		$stage.diag.loginOK.prop('disabled', true);
		$stage.diag.loginOut.css('color', "").html("");
		ipc.send('cojer', 'Login', {
			id: $("#diag-login-id").val(),
			pw: $("#diag-login-pw").val(),
			captcha: $("#diag-login-captcha").val(),
			captchaKey: $data._ckey,
			auto: $("#diag-login-auto").is(':checked'),
			disposable: $("#diag-login-disposable").is(':checked')
		});
	});
	// 업로드 대화 상자
	$stage.diag.uploadOK.on('click', e => {
		if($("#diag-upload-auto").is(':checked')) setOpt('no-ask-upload', true);
		$dialog('upload').hide();
		sendMessage('image', Activity.current.room, $data._uploading);
		delete $data._uploading;
	});
	// 채널 이메일 대화 상자
	$stage.diag.ceOK.on('click', e => {
		let pw = $("#diag-ce-pass").val();

		if(pw.length < 4 || pw.length > 20) return error(102);
		$stage.diag.ceOK.prop('disabled', true);
		$("#diag-ce-output").empty();
		$.post(`http://${CHANNEL_HOST}/ncc/set`, {
			key: $("#diag-ce-serial").val(),
			id: $data.myInfo.profile.id,
			pw: pw,
			nickname: $data.myInfo.profile.nickname
		}, res => {
			$stage.diag.ceOK.prop('disabled', false);
			if(res.error) $("#diag-ce-output").html(L(`error-${res.error}`));
			else{
				notify(L('ce-ok'));
				setOpt('channel-pw', pw);
				$dialog('ce').hide();
				location.reload();
			}
		});
	});
	// 상태 대화 상자
	$stage.diag.statusOK.on('click', e => {
		Channel.send('status', { status: $stage.diag.statusList.val() });
		$dialog('status').hide();
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
	// 자동 로그인 / 세션 처리
	if(OPT.auto) ipc.send('cojer', 'Login', OPT.auto);
	else ipc.send('cojer', 'CheckAuth');
});
/**
 * 명령어를 총괄하는 상수 객체이다.
 */
const COMMANDS = {
	'/': null,
	call: data => {
		Channel.callUser(data.target, data.room.id);
	},
	chance: data => {
		let tui = "";
		let chance = data.chance * 100;
		let i;

		for(i=0; i<100; i+=10){
			if(i < chance) tui += "■";
			else tui += "□";
		}
		command(`${tui} ${(chance).toFixed(2)}%`, data.room.id, 'cmd-receive', FA('random', true));
	},
	clear: data => {
		clearBoard($data.currentAct);
		command(L('cleared'), data.room.id, "cmd-receive");
	},
	coin: data => {
		let tui = "";
		let chance = data.chance;

		if(chance < 0.49) tui = L('coin-yes');
		else if(chance < 0.98) tui = L('coin-no');
		else tui = L('coin-undefined');
		command(tui, data.room.id, 'cmd-receive', FA('random', true));
	},
	dice: data => {
		let res = Math.floor(Math.random() * data.max) + 1;

		command(res.toString(), data.room.id, 'cmd-receive', FA('random', true));
	},
	help: data => {
		let pre = CMD_LIST.map(v => {
			let usage = L('cmdu-' + v).replace(/\((.+?)\)/g, (v, p1) => `<u>${p1}</u>`);

			return `<li><b>/${v} ${usage}</b><br/>${L('cmdx-' + v)}</li>`;
		}).join('');

		command("", data.room.id, 'cmd-receive', `<ul>${pre}</ul>${L('cmdx')}`);
	},
	help_opt: data => {
		let pre = OPT_KEYS.map(v => {
			return `<li><b>${v}</b><br/>${L('optx-' + v)}</li>`
		}).join('');

		command("", Activity.current.room.id, 'cmd-receive', `<ul>${pre}</ul>${L('cmdx')}`);
	},
	js: data => {
		try{ data._res = String(eval(data.data)); }
		catch(e){ data._res = e.toString(); data._addr = `<label style='color: orange;'>${FA('warning', true)}</label>`; }
		command(data._res, data.room.id, 'cmd-receive', data._addr);
	},
	note: data => {
		Channel.send('note', {
			target: data.target,
			data: data.data
		});
	},
	set: data => {
		setOpt(data.key, eval(data.value));
	},
	status: data => {
		Channel.send('status', { status: data.data });
	},
	w: data => {
		Channel.send('whisper', {
			rId: Activity.current.id,
			target: data.target,
			data: data.data
		});
	}
};
const CMD_LIST = Object.keys(COMMANDS).sort();
ipc.on('command', (ev, type, data) => COMMANDS[type](data));
/**
 * 명령어 사용에 대한 메시지를 출력한다.
 * 
 * @param {*} msg 메시지
 * @param {string} rId 출력할 채팅방 식별자(기본값: 현재 채팅방)
 * @param {string} group 채팅 jQuery 객체에 부가적으로 넣을 클래스의 접미어(기본값: 없음)
 * @param {string} addPre 기본 접두어에서 부가적으로 넣을 접두어(기본값: 없음)
 * @returns {*} 새로 생성된 채팅 jQuery 객체
 */
function command(msg, rId, group, addPre){
	let $R = emulateMessage("command", msg, `<label style="color: gray;">${FA('gear')}</label>${addPre || " "}`);

	if(group) $R.addClass(`act-talk-${group}`);
	return $R;
}
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
		case 'logout':
			setOpt('auto');
			setOpt('channel-pw');
			alert(L('logout'));
			break;
		case 'open-rooms':
			renderOpenRooms(data);
			break;
		case 'my-rooms':
			renderMyRooms(data);
			if(localStorage.hasOwnProperty('recentAct')){
				setActivity(localStorage.getItem('recentAct'));
			}
			if(OPT['channel-pw']) Channel.init($data.myInfo.profile.id, OPT['channel-pw']);
			break;
		case 'sess-msg':
			processMessage(data, false, true);
			break;
		case 'sess-err':
			console.error(data);
			break;
		case 'prev-chat':
			data.reverse().forEach(v => processMessage(v, true));
			break;
		case 'chan-list':
			$stage.acts.toggleClass("channel-list-collapsed");
			break;
		case 'chat-image':
			Activity.current.$stage.board.find("img:last").trigger('click');
			break;
		case 'error':
			error(data.code, data.msg);
			break;
		case 'set-chat':
			Activity.current.$stage.chat.val(data.data);
			break;
		case 'join':
			renderMyRooms([ data ], true);
			setActivity(data.id.replace(":", "-"));
			saveTabOrdinal();
			break;
		case 'quit':
			removeActivity(data.id.replace(":", "-"));
			saveTabOrdinal();
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
	let ord = $data.tabOrdinal[`at-item-${id}`] || Object.keys($data.acts).length;

	$stage.acts.append($obj = $(`<div id="act-${id}" class="activity">`).html($obj));
	$data.acts[id] = new Activity(id, title, ord, $obj);

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
	if($data.acts[id].channel) $data.acts[id].channel.close();
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
	if(Activity.current && Activity.current.nCount > 0){
		$(`#actt-${id}-${Activity.current.nStartId}`).before(`<div class="act-talk act-talk-last"/>`);
		Activity.current.nCount = 0;
	}
	$(".at-current").removeClass("at-current");
	$(`#at-item-${id}`).removeClass("at-notify").addClass("at-current")
		.children(".ati-count").hide();
	$(".activity").hide();
	$(`#act-${id}`).show();
	if(id != ACT_OPENED && (cr = Activity.current.room)){
		if(!Activity.current.hasOwnProperty('_prevChat') && cr.lastMsgSn > 0){
			Activity.current._prevChat = cr.lastMsgSn;
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
		$stage.actTab.append($(`
			<div id="at-item-${v.id}" class="at-item ellipse${(v.room && !v.room.isPublic) ? " at-item-locked" : ""}" draggable="true" onclick="setActivity('${v.id}');">
				<label class="ati-count" style="display: none;"></label>
				<i class="fa fa-lock ati-locked"/>
				<label>${v.title}</label>
			</div>
		`.trim())
			.on('dragstart', onTabDragStart)
			.on('dragenter', onTabDragEnter)
			.on('dragend', onTabDragEnd)
		);
	});
	function onTabDragStart(e){
		$data._movingTab = $(e.currentTarget);
		$stage.actTab.on('dragenter', onTabDragEnter);

		e.originalEvent.dataTransfer.setData('text/plain', e.currentTarget.id);
	}
	function onTabDragEnter(e){
		let $t = $(e.originalEvent.target);
		
		if($t.attr('id') == "act-tab"){
			$t.children(":last-child").after($data._movingTab);
		}else{
			$t.before($data._movingTab);
		}
	}
	function onTabDragEnd(e){
		saveTabOrdinal();
		delete $data._movingTab;
		$stage.actTab.off('dragenter', onTabDragEnter);
	}
	$(`#at-item-${$data.currentAct}`).addClass("at-current");
}
/**
 * 탭 순서 정보를 저장한다.
 */
function saveTabOrdinal(){
	let ord = [];
	
	$stage.actTab.children().each((i, o) => ord.push(o.id));
	localStorage.setItem('tab-ordinal', ord.join(','));
	loadTabOrdinal();
}
/**
 * 탭 순서 정보를 불러온다.
 */
function loadTabOrdinal(){
	let ord = localStorage.getItem('tab-ordinal');

	if(ord) ord = ord.split(',');
	else ord = [];

	$data.tabOrdinal = {};
	ord.map((v, i) => $data.tabOrdinal[v] = i);
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
 * @param {boolean} prevAble true인 경우 자동으로 이전 채팅 기록을 불러오지 않는다.
 */
function renderMyRooms(list, noPrev){
	list.forEach(v => {
		let act = createActivity(v.id.replace(":", "-"), v.name, `
			<div class="act-menu">
				<div class="act-menu-title ellipse"></div>
				<button class="act-menu-quit" title="${L('act-mr-quit')}">${FA('sign-out')}</button>
				<button class="act-menu-prev" title="${L('act-mr-prev')}">${FA('backward')}</button>
				<button class="act-menu-save" title="${L('act-mr-save')}">${FA('download')}</button>
			</div>
			<div class="act-board"></div>
			<div class="act-list act-list-closed"></div>
			<div class="act-ghost act-talk"></div>
			<div class="act-me">
				<textarea class="act-chat"></textarea>
				<button class="act-send">${L('act-mr-send')}</button>
				<button class="act-image">${L('act-mr-image')}</button>
			</div>
		`);
		if(noPrev) act._prevChat = 0;
		act.setRoom(v);
	});
}
/**
 * 주어진 DOM 객체의 스크롤이 가장 아래에 있는지 확인한다.
 * 
 * @param {HTMLElement} obj DOM 객체
 * @returns {boolean} true인 경우 스크롤이 가장 아래에 있는 상태이다.
 */
function checkScrollBottom(obj){
	return obj.scrollHeight - obj.scrollTop - obj.clientHeight < 1;
}
/**
 * 세션에서 받은 정보를 처리한다.
 * 
 * @param {*} data 받은 정보
 * @param {boolean} prev 이전 채팅 여부. true인 경우 가장 위에 배치된다.
 * @param {boolean} saveId true인 경우 대상 액티비티의 최근 메시지 번호가 이 정보의 번호로 설정된다.
 * @returns {*} 새로 생성된 채팅 jQuery 객체
 */
function processMessage(data, prev, saveId){
	let rId = data.room.id.replace(":", "-");
	let act = $data.acts[rId];
	if(!act){
		// 일대일 채팅이 생겼을 때 방 정보가 나타나지 않는 경우에 대한 처리
		if(!data.room.name){
			data.room.name = data.user.nickname;
			data.room.userCount = 2;
		}
		renderMyRooms([ data.room ], true);
		act = $data.acts[rId];
	}
	let $board = act.$stage.board, board = $board.get(0);
	let isMe = data.user.id == $data.myInfo.profile.id;
	let isBottom = checkScrollBottom(board);
	let now = new Date(data.time);
	let $talk;
	let content;

	if(isMe) data.user = $data.myInfo.profile;
	else if(checkBlock(`${data.user.id}: ${data.message}`)){
		if(!prev) ipc.send('block', {
			id: data.user.id,
			content: data.message,
			time: now
		});
		return;
	}
	switch(data.type){
		case "text": content = `
			${cUser(data.user)}
			<div class="actt-body">${data.preMessage || ''}${processText(data.message)}</div>
			`;
			break;
		case "image": content = `
			${cUser(data.user)}
			<div class="actt-body">
				<img src="${data.thumb || (data.image + "?type=w128")}" onload="processImage(this, '${data.image}', ${isBottom});"/>
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
			act.setRoom(data.room);
			break;
		case "leave":
			content = cNotice(L('notice-leave', data.user.nickname, data.user.id));
			act.setRoom(data.room);
			break;
		default:
			console.log(data);
	}
	$board[prev ? 'prepend' : 'append']($talk = $(`<div id="actt-${rId}-${data.id}" class="act-talk act-talk-${data.user.id}" onclick="traceMessage('${data.user.id}');">
		${content}
		<div class="actt-stamp" title="${now.toLocaleString()}">${now.toLocaleTimeString()}</div>
	</div>`));
	if($data.currentAct != rId){
		if(act.nCount === 0) act.nStartId = data.id;
		$(`#at-item-${rId}`).addClass("at-notify")
			.children(".ati-count").show().html(++act.nCount);
	}
	if($data._traced == data.user.id) $talk.addClass("act-talk-traced");
	if(isMe){
		$talk.addClass("act-my-talk");
		if($data._$pending){
			$data._$pending.remove();
			delete $data._$pending;
		}
	}
	if(isBottom || isMe){
		board.scrollTop = board.scrollHeight - board.clientHeight;
	}else if(!prev){
		act.$stage.ghost.show().html($talk.html());
	}
	if(!prev && board.children.length > OPT['max-chat']){
		act._prevChat++;
		board.removeChild(board.children[0]);
	}
	if(saveId) act._lastMsgId = data.id;
	playSound('k');

	function cUser(user){
		return `
			<div class="actt-user ellipse" title="${user.nickname} (${user.id})">
				<div class="actt-user-image" style="background-image: url(${user.image});"/>
				${user.nickname}
			</div>
		`;
	}
	function cNotice(msg){
		return `<div class="actt-notice">${msg}</div>`;
	}
	return $talk;
}
/**
 * 메시지 출력을 모방한다.
 * 
 * @param {string} type 모방 유형 식별자
 * @param {string} msg 메시지(기본값: "")
 * @param {string} pre 전(pre)-메시지(기본값: "")
 * @param {string} rId 채팅방 식별자(기본값: 현재 채팅방)
 * @param {*} user 사용자 정보(기본값: 내 정보)
 * @param {number} time 시간 정보(기본값: 현재)
 */
function emulateMessage(type, msg, pre, rId, user, time){
	return processMessage({
		id: `${type}-${++$data.localId}`,
		room: { id: rId || Activity.current.room.id },
		user: user || $data.myInfo.profile,
		type: "text",
		preMessage: pre || "",
		message: msg,
		time: time || Date.now()
	});
}
/**
 * 채널로부터의 쪽지를 처리한다.
 * 
 * @param {*} data 쪽지 정보
 */
function processNotes(data){
	let pre = `<label style="color: skyblue;">${FA('envelope')}</label> `;

	data.list.forEach(v => {
		emulateMessage("notes", v.data, pre, undefined, v.from, v.time);
	});
}
/**
 * 채널로부터의 귓속말을 처리한다.
 * 
 * @param {*} data 귓속말 정보
 */
function processWhisper(data){
	let $window = Remote.getCurrentWindow();
	let pre = `<label style="color: orange;">${FA('lock')}</label> `;
	let $talk;
	let notiTitle;
	
	if(data.data === true){ // 호출
		pre = pre.replace(FA('lock'), FA('feed'));
		notiTitle = data.data = L('on-call', data.from.nickname);
		playSound('alarm');
	}else if(data.data === 1){ // 쪽지 보내기에 성공
		pre = pre.replace(FA('lock'), FA('envelope'));
		data.data = L('noted');
		notiTitle = null;
	}else{
		notiTitle = L('on-whisper', data.from.nickname);
	}
	$talk = emulateMessage('whisper', data.data, pre, data.rId, data.from)
		.addClass("act-talk-cmd-receive");

	if(notiTitle) if(!$window.isFocused() || $window.isMinimized()) notify(notiTitle, data.data);
}
/**
 * 불러온 텍스트 정보를 처리한다.
 * 
 * @param {string} text 텍스트
 * @returns {string} 처리된 텍스트
 */
function processText(text){
	const TABLE = {
		'<': "&lt;", '>': "&gt;", '&': "&amp;", '\n': "<br>"
	};
	return text
		.replace(/<|>|&|\n/g, v => TABLE[v])
		.replace(/(https?:\/\/.+?\..+?)(\s|<br>|$)/gi, (v, p1, p2) => `<a href="#" onclick="shell.openExternal('${p1}');">${p1}</a>${p2}`);
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
 * @param {string} type 정보 유형(다음 중 하나: text, image, sticker)
 * @param {*} room 보낼 채팅방 객체
 * @param {*} data 보낼 정보
 */
function sendMessage(type, room, data){
	if(!data) return;

	if(type == "text"){
		if(data[0] == '/'){
			let ci = data.indexOf(' ');
			let form;
			
			if(ci == -1) ci = data.length;
			form = {
				type: data.slice(1, ci),
				room: room,
				raw: data,
				data: data.slice(ci + 1)
			};
			command(form.raw, form.room.id, 'cmd-send');
			ipc.send('cojer', 'Command', form);
			return;
		}
		if(!data.trim()) return;
	}
	if($data._$pending) $data._$pending.remove();
	$data._$pending = emulateMessage('pending', (typeof data == "string") ? data : "...", FA('spinner fa-spin', true), room.id).addClass("act-pending-talk");
	ipc.send('cojer', 'Send', {
		type: type,
		room: room,
		data: data
	});
}
/**
 * 명령어 힌트 상태를 설정한다.
 * 
 * @param {boolean} visible 힌트 표시 여부
 * @param {string} text 검색 문자열
 * @param {string} chosen 선택된 명령어
 */
function setCommandHint(visible, text, chosen){
	let reg;
	let argv;

	if(!text){
		$data._hint = visible = false;
		$stage.cmdHint.hide();
		return;
	}
	try{
		argv = text.slice(1).split(' ');
		reg = new RegExp(`^(${argv[0]})${(argv.length > 1) ? '$' : ''}`);
	}catch(e){
		$stage.cmdHint.hide();
		return;
	}
	if(visible){
		let list = CMD_LIST.filter(v => reg.test(v));
		let res = list.map(v => `
			<li id="chint-${v}">/${v.replace(reg, "<label class='chint-match'>$1</label>")} <label class="chint-usage">${L('cmdu-' + v)}</label><div class="chint-expl">%${v}%</div></li>
		`).join('');

		if(!chosen && list.length == 1) chosen = list[0];
		if(chosen){
			res = res
				.replace(`>%${chosen}%`, ` style="display: block;">${L('cmdx-' + chosen)}`)
				.replace("chint-" + chosen, `chint-${chosen}" class="chint-chosen`);
		}
		$stage.cmdHint.show().html(res);
		$data._hList = list;
	}else{
		$stage.cmdHint.hide();
	}
}
/**
 * 주어진 아이디를 가진 사용자의 채팅을 강조 표시한다.
 * 
 * @param {string} id 사용자 아이디
 */
function traceMessage(id){
	let already = $data._traced == id;

	$data._traced = id;
	$(".act-talk-traced").removeClass("act-talk-traced");
	if(already) delete $data._traced;
	else $(`.act-talk-${id}`).addClass("act-talk-traced");
}
/**
 * 해당 액티비티의 채팅 내용을 비운다.
 * 
 * @param {string} id 액티비티 식별자
 */
function clearBoard(id){
	let act = $data.acts[id];
	
	act._prevChat = act._lastMsgId;
	act.$stage.board.empty();
}
/**
 * 이미지에 대한 팝업을 띄운다.
 * 
 * @param {string} url 이미지 경로
 */
function popupImage(url){
	window.open(`./viewer.pug?url=${encodeURIComponent(url)}`);
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
 * 소리를 재생한다.
 * 
 * @param {string} key 소리 식별자
 */
function playSound(key){
	if(OPT['mute']) return;
	$sound[key].play();
}
/**
 * 유휴 상태를 해제한다.
 */
function breakIdle(){
	if($data.isIdle){
		Channel.send('status', { status: "online" });
	}
	$data.isIdle = false;
	$data._idle = 0;
}
/**
 * 유휴 상태를 확인한다.
 */
function checkIdle(){
	if($data.isIdle) return;
	if(++$data._idle >= OPT['idle-time']){
		$data.isIdle = true;
		Channel.send('status', { status: "afk" });
	}
}
/**
 * 차단 대상인 채팅인지 검사한다.
 * 
 * @param {string} serial 채팅 구문. "(아이디): (내용)" 꼴로 주어진다.
 * @returns {boolean} 차단 대상인 경우 true
 */
function checkBlock(serial){
	let list, i;
	
	list = OPT['block'];
	for(i in list) if(serial.match(new RegExp(list[i]))) return true;

	return false;
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