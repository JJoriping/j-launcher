const FILTER_IMG = {
	filters: [{
		name: L('file-image'),
		extensions: [ 'jpg', 'png', 'gif' ]
	}],
	properties: [ "openFile" ]
};
const STATUS_CLASS = {
	'online': "online",
	'afk': "afk"
};
const USER_NOTICE = {
	id: "j-launcher",
	image: __dirname.replace(/\\/g, "/") + "/img/logo.ico",
	nickname: L('notice')
};
const CHANNEL_MENU = Remote.Menu.buildFromTemplate([
	{
		label: L('menu-actli-whisper'),
		click: () => { Activity.current.$stage.chat.val(`/w ${$data._cTarget} `).focus(); }
	},
	{
		label: L('menu-actli-note'),
		click: () => { Activity.current.$stage.chat.val(`/note ${$data._cTarget} `).focus(); }
	},
	{
		label: L('menu-actli-call'),
		click: () => Channel.callUser($data._cTarget)
	}
]);
const USERS_MENU = Remote.Menu.buildFromTemplate([
	{
		label: L('menu-diagu-1to1'),
		click: () => { }
	},
	{
		label: L('menu-diagu-kick'),
		click: () => {
			if($data._roomUsersAct.room.master.id == $data.myInfo.id){
				if(!confirm(L('kick-sure', $data._roomUsersTarget))) return;
				$("#diag-users-ti-" + $data._roomUsersTarget).remove();
				ipc.send('cojer', 'Kick', {
					room: $data._roomUsersAct.room,
					target: $data._roomUsersTarget
				});
			}else error(122);
		}
	},
	{
		label: L('menu-diagu-invite'),
		click: () => {
			log(L('invite-req', $data._roomUsersTarget), $data._roomUsersAct.room.id);
			ipc.send('cojer', 'Invite', {
				room: $data._roomUsersAct.room,
				target: $data._roomUsersTarget
			});
		}
	},
	{
		label: L('menu-diagu-delegate'),
		click: () => {
			if($data._roomUsersAct.room.master.id == $data.myInfo.id){
				if(!confirm(L('delegate-sure', $data._roomUsersTarget))) return;
				$data._roomUsersAct.room.master.id = $data._roomUsersTarget;
				ipc.send('cojer', 'Delegate', {
					room: $data._roomUsersAct.room,
					target: $data._roomUsersTarget
				});
			}else error(122);
		}
	}
]);
const ACT_OPENED = "opened";

/**
 * 액티비티를 정의한다.
 * 각 액티비티는 방 목록 또는 한 채팅방을 담당하며 탭으로 전환시킬 수 있다.
 * 한 채팅방은 한 채널과 연관되어 있다.
 */
class Activity{
	/**
	 * @type {Activity}
	 * 현재 액티비티 객체를 가리킨다.
	 */
	static get current(){
		return $data.acts[$data.currentAct];
	}

	constructor(id, title, ord, $obj){
		this.id = id;
		this.title = title;
		this.ord = ord;
		this.history = new ChatHistory(this);
		this.$obj = $obj;
		
		this.$stage = {
			board: $obj.children(".act-board")
				.on('scroll', e => this.onBoardScroll(e.originalEvent)),
			ghost: $obj.find(".act-ghost").on('click', e => {
				let b = this.$stage.board.get(0);

				b.scrollTop = b.scrollHeight - b.clientHeight;
				$(e.currentTarget).hide();
			}),
			menu: $obj.children(".act-menu"),
			list: $obj.children(".act-list"),
			chat: $obj.find(".act-chat")
				.on('keydown', e => this.onChatKeyDown(e))
				.on('keyup', e => this.onChatKeyUp(e))
				.on('click', e => setCommandHint(false))
				.on('paste', e => this.onChatPaste(e.originalEvent)),
			send: $obj.find(".act-send")
				.on('click', e => this.onSendClick(e)),
			image: $obj.find(".act-image")
				.on('click', e => this.onImageClick(e)),
			sticker: $obj.find(".act-sticker")
				.on('click', e => this.onStickerClick(e)),
			leaf: $obj.find(".act-menu-leaf")
				.on('click', e => this.onMenuLeafClick(e)),
			prev: $obj.find(".act-menu-prev")
				.on('click', e => this.onMenuPrevClick(e)),
			save: $obj.find(".act-menu-save")
				.on('click', e => this.onMenuSaveClick(e)),
			find: $obj.find(".act-menu-find")
				.on('click', e => this.onMenuFindClick(e)),
			quit: $obj.find(".act-menu-quit")
				.on('click', e => this.onMenuQuitClick(e))
		};
		this.initChannel();
	}
	/**
	 * 채널을 초기화한다.
	 * 
	 * @param {*} $list 채널 이용자 목록을 가리키는 jQuery 객체(기본값: 액티비티 스테이지로부터 얻은 jQuery 객체)
	 */
	initChannel($list){
		if(this.id == ACT_OPENED) return;

		if(!$list) $list = this.$stage.list;
		if(OPT['channel-pw']){
			this.channel = new Channel(this.id, $list);
		}else{
			this.$stage.list.html(`
				<label>${L('act-mr-chan-no')}</label><br/>
				<button class="act-mr-chan-go-login" style="color: blue;">${L('act-mr-chan-go-login')}</button><br/>
				<button class="act-mr-chan-go-email" style="color: blue;">${L('act-mr-chan-go-email')}</button>
			`);
			this.$stage.list.children(".act-mr-chan-go-login").on('click', e => {
				prompt(L('act-mr-chan-go-login')).then(pw => {
					if(!pw) return;
					setOpt('channel-pw', pw);
					
					Channel.init($data.myInfo.id, pw);
					for(let i in $data.acts) $data.acts[i].initChannel();
				});
			});
			this.$stage.list.children(".act-mr-chan-go-email").on('click', e => {
				$.post(`http://${CHANNEL_HOST}/ncc/email`, { id: $data.myInfo.id }, res => {
					if(res) $dialog('ce', true).show().find("#diag-ce-target").html(L('diag-ce-target', $data.myInfo.id));
				});
			});
		}
	}
	/**
	 * 이 액티비티가 가지는 방 정보를 설정하고 방 정보에 맞게 DOM 객체를 수정한다.
	 * 
	 * @param {*} room 방 정보
	 */
	setRoom(room){
		let onUser = `ipc.send('cojer', 'RoomUsers', { cafeId: ${room.cafe.id}, roomId: '${room.id}' });`;

		this.room = room;
		this.nCount = 0;

		$(`#at-item-${this.id}`)[room.isPublic ? 'removeClass' : 'addClass']("at-item-locked");
		this.$stage.menu.children(".act-menu-title").html(`
			<label class="actm-title-name"><b>${room.name}</b></label><i/>
			<label class="actm-title-user" onclick="${onUser}">${L('act-mr-user', room.userCount)}</label><i/>
			<a class="actm-title-cafe" href="#" title="${L('visit-cafe')}" onclick="shell.openExternal('${CAFE_BOARD_URL(room.cafe.id)}');">${room.cafe.name}</a>
			<label class="actm-title-watch actm-tw-${room.cafe.id}" href="#" title="${L('act-mr-watch')}" onclick="toggleWatch(${room.cafe.id});">${FA('eye')}</label><i/>
			<label class="actm-title-attr">${room.isPublic ? L('act-mr-public') : L('act-mr-private')}</label>
		`).children(".actm-title-name").on('click', e => {
			if(room.master.id == $data.myInfo.id) prompt(L('room-name-change'), room.name).then(v => {
				if(v) ipc.send('cojer', 'RoomRename', { room: room, name: v });
			});
		});
	}
	/**
	 * 이 액티비티가 포함한 채팅 기록을 저장한다.
	 * 
	 * @param {string} path 기록될 파일의 경로
	 */
	requestSaveChat(path){
		let data = [];

		this.$stage.board.children(".act-talk").each((i, o) => {
			let $o = $(o);

			data.push(`[${$o.children(".actt-stamp").html()}] ${$o.children(".actt-user").attr('title')}: ${$o.children(".actt-body").html().trim()}`);
		});
		ipc.send('cojer', "Save", {
			path: path,
			data: data.join('\n')
		});
	}
	/**
	 * 이전 대화를 불러오도록 요청한다.
	 */
	requestPrevChat(){
		let v = this._prevChat;
		
		this._prevChat = Math.max(0, v - OPT['prev-per-req']);
		ipc.send('cojer', "PrevChat", {
			room: this.room,
			from: this._prevChat + 1,
			to: v
		});
	}
	/**
	 * 이 액티비티가 가리키는 방에서 퇴장한다.
	 */
	requestQuit(){
		ipc.send('cojer', "Quit", {
			room: this.room
		});
	}

	onBoardScroll(e){
		if(checkScrollBottom(e.currentTarget)) this.$stage.ghost.hide();
	}
	onChatKeyDown(e){
		switch(e.key){
			case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9': case '0':
				if(e.ctrlKey){
					this.$stage.chat.val(OPT['macro'][(Number(e.key) + 9) % 10]);
				}
				break;
			case '/':
				if(!e.currentTarget.value){
					$data._hint = true;
					setCommandHint(true, "/");
				}
				break;
			case 'Enter':
				if(!e.shiftKey){
					if($data._shIndex >= 0){
						let argv = this.$stage.chat.val().split(' ');

						argv[$data._cmdArgIndex] = $data._subhint[$data._shIndex];
						this.$stage.chat.val(argv.join(' ') + " ");
					}else if($data._hint && $data._hIndex >= 0){
						this.$stage.chat.val("/" + $data._hList[$data._hIndex] + " ");
					}else{
						if(this.$stage.chat.val()){
							e.stopPropagation();
						}
						this.$stage.send.trigger('click');
					}
					e.preventDefault();
				}
				break;
			case 'Escape':
				if($data._hint){
					setCommandHint(false);
				}else{
					this.$stage.ghost.hide();
				}
				break;
			case 'ArrowUp':
			case 'ArrowDown':
				this.onChatArrowUpDown(e);
				return;
			default: break;
		}
		this.history.index = -1;
	}
	onChatArrowUpDown(e){
		if(!$data._hint){
			if(e.key == 'ArrowUp') this.history.up();
			else this.history.down();
			return;
		}
		let isSub = false;
		let iKey, iList;
		let vp;
		let di1, di2;
		
		if($data._subhint){
			isSub = true;
			iKey = '_shIndex';
			iList = '_subhint';
		}else{
			iKey = '_hIndex';
			iList = '_hList';
		}
		if($data[iKey] == -1){
			$data[iKey] = 0;
		}else{
			if(e.key == 'ArrowUp'){
				if(!$data[iKey]--) $data[iKey] = $data[iList].length - 1;
			}else{
				if(++$data[iKey] == $data[iList].length) $data[iKey] = 0;
			}
		}
		if(isSub){
			if($data._subhint[$data._shIndex] !== undefined){
				$(".chint-sub-item.chint-chosen").removeClass("chint-chosen");
				vp = $(`#chint-sub-${$data._subhint[$data._shIndex]}`).addClass("chint-chosen")[0].getBoundingClientRect();
			}
		}else{
			setCommandHint(true, e.currentTarget.value, $data[iList][$data[iKey]]);
			vp = $(".chint-chosen")[0].getBoundingClientRect();
		}
		if(vp){
			di1 = window.innerHeight - this.$stage.chat.height() - vp.height - 10;
			di2 = di1 + vp.height - $stage.cmdHint.height();
			if(vp.top > di1) $stage.cmdHint[0].scrollTop += vp.top - di1;
			else if(vp.top < di2) $stage.cmdHint[0].scrollTop += vp.top - di2;
		}
		e.preventDefault();
	}
	onChatKeyUp(e){
		if($data._hint){
			if(e.key == 'ArrowUp' || e.key == 'ArrowDown') return;
			$data._hIndex = -1;
			setCommandHint(true, e.currentTarget.value);
		}
	}
	onChatPaste(e){
		let files, len, i;

		switch(e.type){
			case "drop":
				files = e.dataTransfer.files;
				len = files.length;
				if(!len || files[0].kind == "string") return true;

				$data._uploading = files[0].path.replace(/\\/g, "/");
				$dialog('upload', true).show();
				$stage.diag.uploadImg.attr('src', $data._uploading);
				if(OPT['no-ask-upload']) $stage.diag.uploadOK.trigger('click');
				break;
			case "paste":
				files = e.clipboardData.items;
				len = files.length;
				if(!len || files[len - 1].kind == "string") return true;

				$data._uploading = Clipboard.readImage();
				$dialog('upload', true).show();
				$stage.diag.uploadImg.attr('src', $data._uploading.toDataURL());
				$data._uploading = $data._uploading.toPNG();
				if(OPT['no-ask-upload']) $stage.diag.uploadOK.trigger('click');
				break;
		}
		return false;
	}
	onSendClick(e){
		let text = this.$stage.chat.val();

		if(text.length > 500) if(!confirm(L('error-101'))){
			return this.$stage.chat.val(text.slice(0, 500));
		}
		sendMessage('text', this.room, text);
		setCommandHint(false);
		this.$stage.chat.val("");
	}
	onImageClick(e){
		Remote.dialog.showOpenDialog(Remote.getCurrentWindow(), FILTER_IMG, files => {
			if(!files) return;
			files.forEach(v => sendMessage('image', this.room, v));
		});
	}
	onStickerClick(e){
		setCommandHint(true, "/sticker ");
	}
	onMenuLeafClick(e){
		$stage.acts.toggleClass("channel-list-collapsed");
		getAppMenu("chat-list").checked = $stage.acts.hasClass("channel-list-collapsed");
	}
	onMenuPrevClick(e){
		this.$stage.prev.prop('disabled', true);
		setTimeout(() => this.$stage.prev.prop('disabled', false), 1000);

		this.requestPrevChat();
	}
	onMenuSaveClick(e){
		Remote.dialog.showSaveDialog(Remote.getCurrentWindow(), {
			title: L('act-mr-save'),
			defaultPath: `${this.room.name}-${Date.now()}.txt`
		}, path => path && this.requestSaveChat(path.replace(/\\/g, "/")));
	}
	onMenuFindClick(e){
		$dialog('find', true).show();
	}
	onMenuQuitClick(e){
		if(!confirm(L('sure-quit', this.room.name))) return;

		this.requestQuit();
	}
}

/**
 * 채널을 정의한다.
 * 채널에 접속하여 쪼런처를 이용하는 사람들에게 부가 기능을 제공한다.
 */
class Channel{
	/**
	 * 주어진 인증 정보로 채널 접속을 시도한다.
	 * 접속에 성공하는 경우 Channel 클래스의 정적 멤버 socket을 통해 통신할 수 있다.
	 * 
	 * @param {string} id 네이버 아이디
	 * @param {string} pw 채널 암호
	 */
	static init(id, pw){
		let socket = new WebSocket(`ws://${CHANNEL_HOST}:525/${id}@${pw}`);
		
		if(Channel.socket){
			Channel._queue = [];
			Channel.socket.onmessage = undefined;
			Channel.socket.onclose = undefined;
			Channel.socket.close();
			delete Channel.socket;
		}
		socket.onmessage = Channel.onMessage;
		socket.onclose = Channel.onClose;
	}
	/**
	 * 채널로 정보를 전송한다.
	 * 채널에 접속한 상태가 아닌 경우 큐에 정보를 저장한다.
	 * 
	 * @param {string} type 정보의 유형
	 * @param {string} data 정보
	 */
	static send(type, data){
		if(!data) data = {};
		data.type = type;
		data = JSON.stringify(data);

		if(Channel.socket) Channel.socket.send(data);
		else Channel._queue.push(data);
	}
	/**
	 * send() 메소드 등에 의해 큐에 저장된 정보를 즉시 채널로 전송하고 큐를 비운다.
	 * 
	 * @param {WebSocket} socket 웹소켓 객체
	 */
	static flushQueue(socket){
		Channel.socket = socket;
		while(Channel._queue[0]) socket.send(Channel._queue.shift());
	}
	/**
	 * 채널에 접속해 있는 해당 아이디를 가진 사용자를 호출한다.
	 * 
	 * @param {string} id 네이버 아이디
	 * @param {string} rId 채팅방 식별자(기본값: 현재 채팅방 식별자)
	 */
	static callUser(id, rId){
		log(L('sent-call', id));
		Channel.send('call', {
			rId: rId || Activity.current.room.id,
			target: id
		});
	}
	/**
	 * 주어진 정보를 바탕으로 사용자 정보를 갱신한다.
	 * 
	 * @param {*} user 사용자 정보
	 */
	static updateUser(user){
		let $items = $(`.actli-${user.id}`);
		let status = global.LANG[`diag-status-${user.status}`] || user.status;
		let title = `${user.nickname} (${user.id})\n${status}`;

		if($data.myInfo.id == user.id) $data.myInfo.status = user.status;
		$items.attr('title', title);
		$items.children(".act-list-item-status")
			.removeClass("actli-status-online actli-status-custom actli-status-afk")
			.addClass(`actli-status-${STATUS_CLASS[user.status] || 'custom'}`);
		$items.find(".act-list-item-nick").html(user.nickname);
		$items.children(".act-list-item-exordial").html(user.exordial);
	}
	static onMessage(e){
		let data = JSON.parse(e.data);
		let chan = ($data.acts[data.rId] || {}).channel;

		switch(data.type){
			case 'welcome':
				Channel.flushQueue(e.target);
				break;
			case 'error':
				error(data.code, data.msg);
				break;
			case 'conn':
				if(!OPT['optx-no-channel-notice']) log(L('chan-conn', data.user.nickname), chan.rId);
				chan.list.push(data.user);
				chan.renderList();
				break;
			case 'disconn':
				if(!OPT['optx-no-channel-notice']) log(L('chan-disconn', data.user.nickname), chan.rId);
				chan.list = chan.list.filter(v => v.id != data.user.id);
				chan.renderList();
				break;
			case 'list':
				chan.list = data.list;
				chan.renderList();
				break;
			case 'notes':
				processNotes(data);
				break;
			case 'user':
				Channel.updateUser(data.user);
				break;
			case 'whisper':
				processWhisper(data);
				break;
			default:
				console.warn("Unhandled data: ", data);
		}
	}
	static onClose(code){
		setOpt('channel-pw');
		$(".act-list").addClass("act-list-closed").html(`
			<label>${L('act-mr-chan-closed')}</label><br/>
			<button style="color: blue;" onclick="Activity.current.initChannel();">${L('act-mr-chan-retry')}</button>
		`);
	}

	constructor(rId, $list){
		this.rId = rId;
		this.$list = $list;
		this.list = [];

		Channel.send('join', { rId: rId });
	}
	renderList(){
		this.$list.removeClass("act-list-closed").empty();
		this.list.forEach(v => {
			let $item;

			this.$list.append($item = $(`
				<div id="actli-${this.rId}-${v.id}" class="act-list-item actli-${v.id}">
					<div class="act-list-item-status"/>
					<div class="act-list-item-name ellipse">
						<label class="act-list-item-nick"/>
						<label class="act-list-item-id"> (${v.id})</label>
					</div>
					<div class="act-list-item-exordial ellipse"/>
				</div>
			`.trim()));
			Channel.updateUser(v);
			$item.on('click', this.onClick).on('contextmenu', this.onClick);
			if(v.id == $data.myInfo.id) $item.addClass("act-list-item-me");
		});
	}
	onClick(e){
		$data._cTarget = e.currentTarget.id.split('-')[3];
		CHANNEL_MENU.popup(Remote.getCurrentWindow());
	}
	close(){
		Channel.send('leave', { rId: this.rId });
	}
}
Channel._queue = [];

/**
 * 채팅 내역을 정의한다.
 * 사용자의 키 입력에 따라 내역을 조회할 수 있다.
 */
class ChatHistory{
	constructor(activity){
		this.activity = activity;
		this.list = [];
		this.index = -1;
		this.lastChat = null;
	}

	/**
	 * 입력 내역에 주어진 내용을 추가한다.
	 * 
	 * @param {string} data 내용
	 */
	put(data){
		if(this.list.unshift(data) > OPT['history-max']){
			this.list.pop();
		}
		this.index = -1;
		this.lastChat = null;
	}

	/**
	 * 내역을 위로 하나 탐색하여 연결된 액티비티의 입력란에 넣는다.
	 */
	up(){
		let chat = this.activity.$stage.chat[0];
		let len = this.list.length;

		if(chat.selectionStart + chat.selectionEnd > 0) return;
		if(!len) return;
		if(this.index == -1) this.lastChat = chat.value;

		this.index = Math.min(this.index + 1, len - 1);
		chat.value = this.list[this.index];
	}

	/**
	 * 내역을 아래로 하나 탐색하여 연결된 액티비티의 입력란에 넣는다.
	 */
	down(){
		let chat = this.activity.$stage.chat[0];

		if(this.index == -1) return;
		if(this.index == 0 && this.lastChat){
			chat.value = this.lastChat;
			return;
		}
		if(chat.selectionStart != chat.selectionEnd || chat.selectionEnd != chat.value.length) return;
		if(!this.list.length) return;

		this.index = Math.max(this.index - 1, 0);
		chat.value = this.list[this.index];
	}
}