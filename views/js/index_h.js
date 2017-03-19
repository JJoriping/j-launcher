const FILTER_IMG = {
	filters: [{
		name: L('file-image'),
		extensions: [ 'jpg', 'png', 'gif' ]
	}],
	properties: [ "openFile" ]
};

/**
 * 액티비티를 정의한다.
 * 각 액티비티는 방 목록 또는 한 채팅방을 담당하며 탭으로 전환시킬 수 있다.
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
		this.$obj = $obj;
		
		this.$stage = {
			board: $obj.children(".act-board"),
			ghost: $obj.find(".act-ghost").on('click', e => {
				let b = this.$stage.board.get(0);

				b.scrollTop = b.scrollHeight - b.clientHeight;
				$(e.currentTarget).hide();
			}),
			list: $obj.children(".act-list"),
			chat: $obj.find(".act-chat")
				.on('keydown', e => this.onChatKeyDown(e))
				.on('paste', e => this.onChatPaste(e.originalEvent)),
			send: $obj.find(".act-send")
				.on('click', e => this.onSendClick(e)),
			image: $obj.find(".act-image")
				.on('click', e => this.onImageClick(e)),
			prev: $obj.find(".act-menu-prev")
				.on('click', e => this.onMenuPrevClick(e)),
			save: $obj.find(".act-menu-save")
				.on('click', e => this.onMenuSaveClick(e)),
			quit: $obj.find(".act-menu-quit")
				.on('click', e => this.onMenuQuitClick(e))
		};
	}
	/**
	 * 이 액티비티가 가지는 방 정보를 설정한다.
	 * 
	 * @param {*} room 방 정보
	 */
	setRoom(room){
		this.room = room;
		this.nCount = 0;
		$(`#at-item-${this.id}`)[room.isPublic ? 'removeClass' : 'addClass']("at-item-locked");
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

			data.push(`[${$o.children(".actt-stamp").html()}] ${$o.children(".actt-user").attr('title')}: ${$o.children(".actt-body").html()}`);
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
		let v = this.room._prevChat;
		
		this.room._prevChat = Math.max(0, v - OPT['prev-per-req']);
		ipc.send('cojer', "PrevChat", {
			room: this.room,
			from: this.room._prevChat + 1,
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
	onChatKeyDown(e){
		if(!e.shiftKey && e.keyCode == 13){
			this.$stage.send.trigger('click');
			e.preventDefault();
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
				if(!len || files[0].kind == "string") return true;

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
		sendMessage("text", this.room, text);
		this.$stage.chat.val("");
	}
	onImageClick(e){
		Remote.dialog.showOpenDialog(Remote.getCurrentWindow(), FILTER_IMG, files => {
			if(!files) return;
			files.forEach(v => sendMessage('image', this.room, v));
		});
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
		}, path => requestSaveChat(path.replace(/\\/g, "/")));
	}
	onMenuQuitClick(e){
		if(!confirm(L('sure-quit', this.room.name))) return;

		this.requestQuit();
	}
}