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
			chat: $obj.find(".act-chat").on('keydown', e => this.onChatKeyDown(e)),
			send: $obj.find(".act-send").on('click', e => this.onSendClick(e)),
			prev: $obj.find(".act-menu-prev").on('click', e => this.onMenuPrevClick(e)),
			quit: $obj.find(".act-menu-quit").on('click', e => this.onMenuQuitClick(e))
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
	onSendClick(e){
		sendMessage("text", this.room, this.$stage.chat.val());
		this.$stage.chat.val("");
	}
	onMenuPrevClick(e){
		this.$stage.prev.prop('disabled', true);
		setTimeout(() => this.$stage.prev.prop('disabled', false), 1000);

		this.requestPrevChat();
	}
	onMenuQuitClick(e){
		if(!confirm(L('sure-quit', this.room.name))) return;

		this.requestQuit();
	}
}