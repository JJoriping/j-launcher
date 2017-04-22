function onEvent(ev, type, data){
	switch(type){
		case 'login-ok':
			$data.myInfo = data;
			$stage.diag.loginOK.prop('disabled', false);
			notify(L('login-ok'));
			$dialog('login').hide();
			renderMyCafes();
			checkWatch();
			renderMyRooms(data.roomList);
			if(localStorage.hasOwnProperty('recentAct')){
				setActivity(localStorage.getItem('recentAct'));
			}
			if(OPT['channel-pw']) Channel.init($data.myInfo.id, OPT['channel-pw']);
			break;
		case 'login-no':
			if(!data) data = {};
			$stage.diag.loginOK.prop('disabled', false);
			$stage.diag.loginOut.css('color', "red").html(data.text);
			notify(L('login-no'), data.text);
			if(data.captcha){
				$data._ckey = data.match(/key=(\w+)/)[1];
				$stage.diag.loginCaptcha.show();
			}else if(data.addDevice){
				$data._loginForm = {};
				$stage.diag.loginOut.css('color', "red")
					.append($("<label>").addClass("diag-label").html(L('error-121')))
					.append(data.addDevice);
				$stage.diag.loginOut.find("input[type=hidden]").each((i, o) => {
					$data._loginForm[o.name] = o.value;
				});
				$stage.diag.loginOut.find(".btn_upload>a").attr('onclick', "").on('click', e => {
					$data._loginForm['regyn'] = "Y";
					$stage.diag.loginOK.trigger('click');
				});
				$stage.diag.loginOut.find(".btn_cancel>a").attr('onclick', "").on('click', e => {
					$data._loginForm['regyn'] = "N";
					$stage.diag.loginOK.trigger('click');
				});
			}else if(data.otp){
				$data._loginForm = {};
				$stage.diag.loginOut.find("input[type=hidden]").each((i, o) => {
					$data._loginForm[o.name] = o.value;
				});
				$data._loginForm['otp'] = true;
				$stage.diag.loginOTP.show();
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
		case 'sess-msg':
			processMessage(data, false, true);
			break;
		case 'sess-err':
			console.error(data);
			break;
		case 'sess-progress':
			processProgress(data);
			break;
		case 'room-users':
			data.memberList.unshift(data.masterInfo);
			$data._roomUsersAct = $data.acts[data.roomId.replace(':', '-')];
			$data._roomUsers = data.memberList;
			$data._usersPool = data.memberList;
			$dialog('users', true).show().trigger('appear');
			break;
		case 'search-users':
			$data._searchUsers = data.items[0].map(v => v[0]);
			$data._usersPool = $data._searchUsers;
			$dialog('users').trigger('appear');
			break;
		case 'dict':
			console.log(data);
			break;
		case 'req-prev':
			Activity.current.$stage.prev.trigger('click');
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
		case 'log':
			log(data);
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
		case 'zoom':
			moveZoom(data);
			break;
	}
}
ipc.on('event', onEvent);