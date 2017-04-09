function onEvent(ev, type, data){
	switch(type){
		case 'login-ok':
			$data.myInfo = data;
			$stage.diag.loginOK.prop('disabled', false);
			notify(L('login-ok'));
			$dialog('login').hide();
			renderMyCafes();
			checkWatch();
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
			location.reload();
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
		case 'sess-progress':
			processProgress(data);
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
		case 'chat-time':
			$stage.acts.toggleClass("time-always-visible");
			break;
		case 'check-update':
			checkUpdate();
			break;
		case 'error':
			error(data.code, data.msg);
			break;
		case 'set-chat':
			Activity.current.$stage.chat.val(data.data);
			break;
		case 'watch-new':
			processWatch(data.cafe, JSON.parse(data.before), JSON.parse(data.after));
			break;
		case 'find':
			renderFindTable(data);
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
}
ipc.on('event', onEvent);