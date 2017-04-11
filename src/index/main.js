/**
 * 명령어 사용에 대한 메시지를 출력한다.
 * 
 * @param {string} msg 메시지
 * @param {string} rId 출력할 채팅방 식별자(기본값: 현재 채팅방)
 * @param {string} group 채팅 jQuery 객체에 부가적으로 넣을 클래스의 접미어(기본값: 없음)
 * @param {string} addPre 기본 접두어에서 부가적으로 넣을 접두어(기본값: 없음)
 * @returns {*} 새로 생성된 채팅 jQuery 객체
 */
function command(msg, rId, group, addPre){
	let user = (group == "cmd-send") ? null : USER_NOTICE;
	let $R = emulateMessage("command", msg, `<label style="color: gray;">${FA('gear')}</label>${addPre || " "}`, rId, user);

	if(group) $R.addClass(`act-talk-${group}`);
	return $R;
}
/**
 * 채팅방에 로그를 출력한다.
 * 
 * @param {string} msg 메시지
 * @param {string} rId 출력할 채팅방 식별자(기본값: 현재 채팅방)
 */
function log(msg, rId){
	let $R = emulateMessage("command", msg, `<label style="color: deepskyblue;">${FA('info-circle', true)}</label>`, rId, USER_NOTICE);

	return $R;
}
/**
 * 업데이트를 확인하고 필요에 따라 안내 대화 상자를 띄운다.
 */
function checkUpdate(){
	$.get(LATEST_VERSION_URL, res => {
		if(res.tag_name == VER){
			return log(L('latest-version'));
		}
		notice(L('diag-notice-latest-head', res.tag_name), JOM.parse(res.body), e => {
			shell.openExternal(res.html_url);
			$dialog('notice').hide();
		});
	});
}
/**
 * 구독한 카페의 새 글을 확인하고 필요에 따라 알린다.
 */
function checkWatch(){
	ipc.send('cojer', 'Watch', {
		cafeList: OPT['watch-list'],
		urlList: OPT['watch-list'].map(CAFE_BOARD_URL)
	});
	if(OPT['watch-interval'] >= 1) $data._watchT = setTimeout(checkWatch, OPT['watch-interval'] * 60000);
}
/**
 * 카페를 구독하거나 구독 취소한다.
 * 일정 주기마다 구독한 카페의 새 글을 자동으로 확인한다.
 * 
 * @param {number} id 카페 식별자
 */
function toggleWatch(id){
	let list = OPT['watch-list'];
	let seq = list.indexOf(id);

	if(seq == -1) list.push(id);
	else list.splice(seq, 1);

	setOpt('watch-list', list);
	renderWatch();
}
/**
 * 카페의 구독 여부 표시를 갱신한다.
 */
function renderWatch(){
	$(".actm-title-watching").removeClass("actm-title-watching");
	OPT['watch-list'].forEach(v => {
		$(".actm-tw-" + v).addClass("actm-title-watching");
	});
}
/**
 * 게시글 정보를 비교하여 필요에 따라 알린다.
 * 
 * @param {number} cafe 카페 식별자
 * @param {any[]} before 이전 게시글 정보
 * @param {any[]} after 현재 게시글 정보
 */
function processWatch(cafe, before, after){
	let i, cafeName;
	let diff = [];
	let bLast = before[0];
	let aLast = after[0];
	let title, text;

	for(i in $data.myInfo.cafeList) if($data.myInfo.cafeList[i].id == cafe){
		cafeName = $data.myInfo.cafeList[i].name;
	}
	for(i in after){
		if(bLast.id < after[i].id) diff.push(after[i]);
	}
	title = L('watch-new', cafeName);
	if(diff.length > 1){
		text = L('watch-new-many', aLast.author, aLast.title, diff.length);
	}else if(diff.length){
		text = L('watch-new-one', aLast.author, aLast.title);
	}
	notify(title, text);
	$(".actm-tw-" + cafe).each((i, o) => {
		emulateMessage('watch', text,
			`<label style="color: dodgerblue;">${FA('eye')}</label>
			[<a href="#" onclick="shell.openExternal('${CAFE_ARTICLE_URL(cafe, aLast.id)}');">${L('go')}</a>]&nbsp;`,
			$(o).parents(".activity").attr('id').slice(4)
		, USER_NOTICE, null, true);
	});
}
/**
 * 주어진 방에서 채팅을 검색한다.
 * 
 * @param {string} word 검색어
 * @param {object} opts 검색 옵션{ regex: 진릿값, last: 검색 범위 출발 지점 }
 * @param {string} rId 채팅방 식별자(기본값: 현재 채팅방)
 */
function findChatting(word, opts, rId){
	let act = rId ? $data.acts[rId] : Activity.current;

	if(!opts) opts = {};
	ipc.send('cojer', 'Find', {
		word: word,
		opts: opts,
		room: act.room,
		last: opts.last || act._lastMsgId || act.room.lastMsgSn
	});
}
/**
 * 검색 결과 표를 갱신한다.
 * 
 * @param {object} data 검색 결과 정보
 */
function renderFindTable(data){
	let word = data.word;
	let $table = $stage.diag.find.table.empty();
	let dateRange = data.dateRange.map(v => new Date(v));

	$stage.diag.find.msgid.val($data._findLast = data.last);
	if(!dateRange.length) return $table.html(L('diag-find-no-res'));
	if(data.opts.regex) word = new RegExp(word);
	$stage.diag.find.status.html(L('diag-find-result', data.list.length,
		dateRange[0].toLocaleString(),
		dateRange[1].toLocaleString(),
		data.length
	));
	data.list.forEach((v, i) => {
		let cssContext = v.context.replace(word, w => `<label style="color: cornflowerblue;">${w}</label>`);

		$table.append(`<div id="diag-find-ti-${v.id}" class="diag-find-table-item" title="${v.context}">
			<div class="diag-find-ti-number">${i + 1}</div>
			<div class="diag-find-ti-context ellipse">${cssContext}</div>
			<div class="diag-find-ti-time">${new Date(v.time).toLocaleTimeString()}</div>
		</div>`);
	});
	$table.children(".diag-find-table-item").on('click', e => {
		let destId = Number(e.currentTarget.id.slice(13));
		let rId = data.rId.replace(":", "-");
		let act = $data.acts[rId];

		act.$stage.board.empty();
		ipc.send('cojer', 'PrevChat', {
			room: act.room,
			from: destId - 49,
			to: destId + 50
		});
		log(L('find-result'), rId);
	});
}
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
	let list = Object.keys($data.acts);
	let $wrapper = $("<div>").attr('id', "at-wrapper");
	let wrapperWidth = 0;

	$stage.actTab.empty().off('wheel').on('wheel', onWheel).append($wrapper);
	list.map(v => $data.acts[v]).sort((a, b) => a.ord - b.ord).forEach(v => {
		let $item;

		$wrapper.append($item = $(`
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
		wrapperWidth += $item[0].getBoundingClientRect().width + 1;
	});
	$wrapper.width(wrapperWidth);

	function onTabDragStart(e){
		$data._movingTab = $(e.currentTarget);
		$stage.actTab.on('dragenter', onTabDragEnter);

		e.originalEvent.dataTransfer.setData('text/plain', e.currentTarget.id);
	}
	function onTabDragEnter(e){
		let $t = $(e.originalEvent.target);
		let tId = $t.attr('id');

		if(tId == "act-tab" || tId == "at-wrapper"){
			$t.find(".at-item:last-child").after($data._movingTab);
		}else{
			$t.before($data._movingTab);
		}
	}
	function onTabDragEnd(e){
		saveTabOrdinal();
		delete $data._movingTab;
		$stage.actTab.off('dragenter', onTabDragEnter);
	}
	function onWheel(e){
		let delta = e.originalEvent.deltaX || e.originalEvent.deltaY;

		$wrapper.css('left', Math.min(0, Math.max(-wrapperWidth + window.innerWidth, $wrapper.position().left - delta)));
	}
	$(`#at-item-${$data.currentAct}`).addClass("at-current");
}
/**
 * 탭 순서 정보를 저장한다.
 */
function saveTabOrdinal(){
	let ord = [];
	
	$stage.actTab.find(".at-item").each((i, o) => ord.push(o.id));
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

	$stage.roomList.empty();
	$(".act-or-cm-count").html(L('act-or-room-count', list.length));
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
				<button class="act-menu-find" title="${L('act-mr-find')}">${FA('search')}</button>
			</div>
			<div class="act-board"></div>
			<div class="act-list act-list-closed"></div>
			<div class="act-ghost act-talk"></div>
			<div class="act-me">
				<textarea class="act-chat"></textarea>
				<button class="act-send">${L('act-mr-send')}</button>
				<button class="act-image">${L('act-mr-image')}</button>
				<button class="act-sticker">${L('act-mr-sticker')}</button>
			</div>
		`);
		if(noPrev) act._prevChat = 0;
		act.setRoom(v);
	});
	renderWatch();
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
 * @param {boolean} silent true인 경우 대화 카운트를 올리지 않는다.
 * @returns {*} 새로 생성된 채팅 jQuery 객체
 */
function processMessage(data, prev, saveId, silent){
	let rId = data.room.id.replace(":", "-");
	let act = $data.acts[rId];
	let profile = $data.myInfo.profile[act.room.cafe.id] || USER_NOTICE;
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
	let isMe = data.user.id == $data.myInfo.id;
	let isWhite = false;
	let isBottom = checkScrollBottom(board);
	let now = new Date(data.time);
	let $talk;
	let content = `${data.user.id}: ${data.message}`;

	if(isMe) data.user = profile;
	else{
		if(checkBW(OPT['white'], content)){
			isWhite = true;
			if(!prev) notify(L('on-white', data.user.nickname), data.message);
		}
		if(checkBW(OPT['black'], content)){
			if(!prev) ipc.send('black', {
				id: data.user.id,
				content: data.message,
				time: now
			});
			return;
		}
	}
	if(OPT['no-image']) data.type = "text";

	switch(data.type){
		case "text": content = `
			${cUser(data.user)}
			<div class="actt-body">${data.preMessage || ''}${produceText(data.message)}</div>
			`;
			break;
		case "image": content = `
			${cUser(data.user)}
			<div class="actt-body">
				<img src="${data.thumb || (data.image + "?type=w128")}" onerror="$(this).replaceWith(FA('exclamation-circle'));" onload="processImage(this, '${data.image}', ${isBottom});"/>
			</div>
			`;
			break;
		case "sticker":
			if(!data.image){
				data._sticker = data.message.split('-');
				data._sticker = STICKER_URL(data._sticker[0], data._sticker[1]);
				data.xxhdpi = data._sticker + "?type=p100_100";
				data.image = data._sticker + "?type=p50_50";
			}
			content = `
			${cUser(data.user)}
			<div class="actt-body">
				<img src="${data.image}" title="${data.image}" onerror="$(this).replaceWith(FA('exclamation-circle'));" onload="processImage(this, '${data.xxhdpi}', ${isBottom});"/>
			</div>
			`;
			break;
		case "join": // 입장
		case "leave": // 퇴장
			content = cNotice(data.type,
				data.user.nickname, data.user.id
			);
			act.setRoom(data.room);
			renderWatch();
			break;
		case "invite": // 초대
			content = cNotice(data.type,
				data.user.nickname, data.user.id,
				data.target.map(v => `${v.nickname} (${v.id})`).join(', ')
			);
			act.setRoom(data.room);
			renderWatch();
			break;
		case "reject": // 강퇴
			content = cNotice(data.type,
				data.user.nickname, data.user.id,
				data.target.nickname, data.target.id
			);
			act.setRoom(data.room);
			renderWatch();
			break;
		case "changeMaster": // 방장
			content = cNotice("change-master",
				data.target
			);
			act.setRoom(data.room);
			renderWatch();
			break;
		case "changeName": // 방 제목
			content = cNotice("change-name",
				data.user.nickname, data.user.id,
				data.target
			);
			act.setRoom(data.room);
			renderWatch();
			break;
		default:
			console.log(data);
	}
	$board[prev ? 'prepend' : 'append']($talk = $(`<div id="actt-${rId}-${data.id}" class="act-talk act-talk-${data.user.id}">
		${content}
		<div class="actt-stamp" title="${now.toLocaleString()}">${now.toLocaleTimeString()}</div>
	</div>`));
	$talk.on('click', e => {
		if(e.target.tagName == "IMG" || e.target.tagName == "A") return;
		traceMessage(data.user.id);
	});
	if(!silent && $data.currentAct != rId){
		if(act.nCount === 0) act.nStartId = data.id;
		$(`#at-item-${rId}`).addClass("at-notify")
			.children(".ati-count").show().html(++act.nCount);
	}
	if(!OPT['no-trace'] && $data._traced == data.user.id) $talk.addClass("act-talk-traced");
	if(isMe){
		$talk.addClass("act-my-talk");
		if($data._$pending){
			$data._$pending.remove();
			delete $data._$pending;
		}
	}else if(isWhite){
		$talk.addClass("act-white-talk");
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
	function cNotice(type, ...args){
		args.unshift("notice-" + type);

		return `<div class="actt-notice">${L.apply(this, args)}</div>`;
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
 * @param {boolean} silent true인 경우 대화 카운트를 올리지 않는다.
 * @returns {*} 새로 생성된 채팅 jQuery 객체
 */
function emulateMessage(type, msg, pre, rId, user, time, silent){
	let cafeId = rId ? $data.acts[rId.replace(":", "-")].room.cafe.id : Activity.current.room.cafe.id;

	return processMessage({
		id: `${type}-${++$data.localId}`,
		room: { id: rId || Activity.current.room.id },
		user: user || $data.myInfo.profile[cafeId] || USER_NOTICE,
		type: "text",
		preMessage: pre || "",
		message: msg,
		time: time || Date.now()
	}, false, false, silent);
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
 * 진행 이벤트를 처리한다.
 * 파일 업로드 등에서 진행 이벤트가 발생한다.
 * 
 * @param {*} data 진행 이벤트 정보
 */
function processProgress(data){
	if(!$data._$pending) return;
	$data._$pending.children(".actt-body").html(data.percent.toFixed(1) + "%");
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
 * 불러온 텍스트 정보를 가공한다.
 * 
 * @param {string} text 텍스트
 * @returns {string} 가공된 텍스트
 */
function produceText(text){
	const TABLE = {
		'<': "&lt;", '>': "&gt;", '&': "&amp;", '\n': "<br>", ' ': "&nbsp;"
	};
	let R;
	
	if(OPT['use-jom']) R = JOM.parse(text
		.replace(/ /g, "&nbsp;")
		.replace(/\n/g, "\n\n")
		.replace(/(https?:\/\/.+?\.[^)]+?)(?:&nbsp;|\s|<br>|$)/gi, (v, p1) => `[${p1}](${p1})`));
	else R = text
		.replace(/<|>|&|\n| /g, v => TABLE[v])
		.replace(/(https?:\/\/.+?\..+?)(?:&nbsp;|\s|<br>|$)/gi, (v, p1) => `<a href="#" onclick="shell.openExternal('${p1}');">${p1}</a>`);
	
	if(OPT['youtube-view']) R = R
		.replace(/<a\s+.+?onclick="shell\.openExternal\('https:\/\/(?:\w+?\.youtube\.com\/watch\?v=|youtu\.be\/)(.+?)(?:&.+)?'\);".*?>.+?<\/a>/g, (v, p1) => `${v}<iframe src="https://www.youtube.com/embed/${p1}" allowfullscreen frameborder="0"></iframe>`);

	return R;
}
/**
 * 주어진 명령어의 한 인자에 대한 하위 힌트를 가공한다.
 * 
 * @param {string} cmd 명령어
 * @param {number} index 인자 번호(0은 명령어)
 * @param {string} value 현재 인자 값
 * @param {string[]} argv 전체 명령어 배열
 * @returns {string} 가공된 하위 힌트
 */
function produceSubhint(cmd, index, value, argv){
	let lister = CMD_SUBHINT[cmd];
	let len;
	let R = "";

	$data._cmdArgIndex = index;
	if(!lister) return "";
	len = lister.length;
	if(lister[len - 2] === true && index >= len - 2) index = len - 1;
	if(!lister[index]) return "";

	return lister[index](value, argv);
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
		Activity.current.history.put(data);
		// 명령어 처리
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
	$data._$pending = emulateMessage('pending', (typeof data == "string") ? data : "...", FA('spinner fa-spin', true), room.id)
		.addClass("act-pending-talk");
	
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
	let cArg;

	$data._shIndex = -1;
	delete $data._subhint;
	if(!text){
		delete $data._cmdText;
		$data._hint = visible = false;
		$stage.cmdHint.hide();
		return;
	}
	$data._cmdText = text;
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

		if(!chosen && list.length == 1){
			chosen = list[0];
			cArg = argv.length - 1;
		}
		if(chosen){
			res = res
				.replace(`>%${chosen}%`, ` style="display: block;">${L('cmdx-' + chosen)}`)
				.replace("chint-" + chosen, `chint-${chosen}" class="chint-chosen`);
			if(cArg) res += produceSubhint(list[0], cArg, argv[cArg], argv);
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
	if(OPT['no-trace']) return;
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
 * 풀에 포함되는 채팅인지 검사한다.
 * 
 * @param {string[]} pool 대상을 검사할 문자열을 담은 배열
 * @param {string} serial 문맥. "(아이디): (내용)" 꼴로 주어진다.
 * @returns {boolean} 포함되는 경우 true
 */
function checkBW(pool, serial){
	for(let i in pool) if(serial.match(new RegExp(pool[i]))) return true;

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