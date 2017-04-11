let $stage;
let $sound;

$(() => {
	$data.localId = 0;
	// 스테이지 등록
	$stage = {
		body: $("body"),
		diag: {
			loginCaptcha: $("#diag-login-captcha-box"),
			loginOTP: $("#diag-login-otp-box"),
			loginOK: $("#diag-login-ok"),
			loginOut: $("#diag-login-output"),
			uploadImg: $("#diag-upload-img"),
			uploadOK: $("#diag-upload-ok"),
			ceOK: $("#diag-ce-ok"),
			statusList: $("#diag-status-list"),
			statusOK: $("#diag-status-ok"),
			bw: {
				_: $("#diag-bw"),
				bTable: $("#diag-bw-black"),
				bAdd: $("#diag-bw-black-add"),
				bCount: $("#diag-bw-black-count"),
				wTable: $("#diag-bw-white"),
				wAdd: $("#diag-bw-white-add"),
				wCount: $("#diag-bw-white-count"),
				ok: $("#diag-bw-ok")
			},
			macro: {
				_: $("#diag-macro"),
				list: $(".diag-macro-item"),
				ok: $("#diag-macro-ok")
			},
			find: {
				_: $("#diag-find"),
				input: $("#diag-find-input"),
				msgid: $("#diag-find-msgid"),
				status: $("#diag-find-status"),
				ok: $("#diag-find-ok"),
				back: $("#diag-find-back"),
				table: $("#diag-find-table")
			}
		},
		actTab: $("#act-tab"),
		acts: $("#activities"),
		cmdHint: $("#command-hint")
	};
	// 기존 설정 반영
	if(getAppMenu("chat-time").checked) onEvent(null, 'chat-time');
	if(getAppMenu("chat-list").checked) onEvent(null, 'chan-list');
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
			case 'Tab':
				if(e.ctrlKey){
					let $list = $(".at-item");
					let $c = $(".at-current");
					let len = $list.length;
					let vp;

					if(e.shiftKey) $c = $c.prev()[0];
					else $c = $c.next()[0];
					if(!$c) $c = $list.get(!e.shiftKey - 1);
					
					setActivity($c.id.slice(8));
					vp = $c.getBoundingClientRect();
					if(vp.left < 0) $("#at-wrapper").css('left', "-=" + vp.left);
					if(vp.left + vp.width > window.innerWidth) $("#at-wrapper").css('left', "-=" + (vp.left + vp.width - window.innerWidth))
				}
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
		if($data._loginForm && $data._loginForm['otp']) $data._loginForm['otp'] = $("#diag-login-otp").val();
		ipc.send('cojer', 'Login', {
			id: $("#diag-login-id").val(),
			pw: $("#diag-login-pw").val(),
			captcha: $("#diag-login-captcha").val(),
			captchaKey: $data._ckey,
			form: $data._loginForm,
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
			id: $data.myInfo.id,
			pw: pw,
			nickname: $data.myInfo.profile[Activity.current.room.cafe.id].nickname
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
	// 대화 흑백 설정 상자
	$stage.diag.bw._.on('appear', e => {
		$data._bw_black = OPT['black'].map(v => v);
		$data._bw_white = OPT['white'].map(v => v);
		$stage.diag.bw._.trigger('change');
	}).on('change', e => {
		let putter;

		[ 'black', 'white' ].forEach(key => {
			let head = key.charAt();
			let $table = $stage.diag.bw[head + 'Table'];
			let arr = $data['_bw_' + key];

			$table.empty();
			$stage.diag.bw[head + 'Count'].html(L('diag-bw-count', arr.length));
			arr.forEach((v, i) => {
				$table.append(produceBWItem(key, i, v));
			});
		});
		$(".diag-bw-table-item>div").on('click', e => {
			let target = e.currentTarget;

			$data._bwEdit = target.parentNode.id.slice(11).split('-');
			target.parentNode.className = 'diag-bw-table-item diag-bw-ti-edit';
			$(target.parentNode).children('input').focus().trigger('keyup');
		});
		$(".diag-bw-table-item>input").on('keyup', e => {
			let target = e.currentTarget;
			let rx;

			$('.diag-bw-filter').removeClass('diag-bw-filter');
			if(target.value){
				try{ rx = new RegExp(target.value); }
				catch(e){ return; }
				if(rx) $('.act-talk').each((i, o) => {
					let $o = $(o);
					let id = $o.children('.actt-user').attr('title');
					let content;
					
					if(!id) return;
					id = id.match(/\((.+)\)$/)[1];
					content = id + ': ' + $o.children('.actt-body').text();
					
					if(content.match(rx)) $o.addClass('diag-bw-filter');
				});
			}
			if(event.which == 13) $(target).blur();
		}).each((i, o) => {
			o.onblur = onBlur;
		});
		if($data._bwEdit){
			$("#diag-bw-ti-" + $data._bwEdit).children("div").trigger('click');
		}
		function onBlur(e){
			let target = e.currentTarget;
			
			if(target.value) $data['_bw_' + $data._bwEdit[0]][$data._bwEdit[1]] = target.value;
			else $data['_bw_' + $data._bwEdit[0]].splice($data._bwEdit[1], 1);
			$('.diag-bw-filter').removeClass('diag-bw-filter');
			delete $data._bwEdit;
			setTimeout(() => $stage.diag.bw._.trigger('change'), 1);
		}
		function produceBWItem(type, i, rx){
			let onRemove = `
				$data._bw_${type}.splice(${i}, 1);
				$stage.diag.bw._.trigger('change');
			`;

			return `<div id="diag-bw-ti-${type}-${i}" class="diag-bw-table-item">
				<div class="diag-bw-ti-content">${rx.replace(/</g, "&lt;")}</div>
				<input id="diag-bw-tiv-${type}-${i}" class="diag-bw-ti-content" value="${rx}" placeholder="${L('diag-bw-placeholder')}"/>
				<button class="diag-action" onclick="${onRemove}">${FA('remove')}</button>
			</div>`;
		}
	});
	$stage.diag.bw.bAdd.on('click', e => {
		$data._bwEdit = 'black-' + ($data._bw_black.push("") - 1);
		$stage.diag.bw._.trigger('change');
	});
	$stage.diag.bw.wAdd.on('click', e => {
		$data._bwEdit = 'white-' + ($data._bw_white.push("") - 1);
		$stage.diag.bw._.trigger('change');
	});
	$stage.diag.bw.ok.on('click', e => {
		if(document.activeElement.className == "diag-bw-ti-content") return;
		setOpt({
			'black': $data._bw_black,
			'white': $data._bw_white
		});
		$dialog('bw').hide();
	});
	// 매크로 대화 상자
	$stage.diag.macro._.on('appear', e => {
		$stage.diag.macro.list.each((i, o) => {
			$(o).children("input").val(OPT['macro'][i]);
		});
	});
	$stage.diag.macro.ok.on('click', e => {
		let macro = [];

		$stage.diag.macro.list.each((i, o) => {
			macro[i] = $(o).children("input").val();
		});
		setOpt('macro', macro);
		$dialog('macro').hide();
	});
	// 대화 검색 대화 상자
	$stage.diag.find._.on('appear', e => {
		delete $data._findLast;
		$stage.diag.find.input.select().focus();
		$stage.diag.find.msgid.val("");
	}).on('disappear', e => {
		Activity.current.$stage.chat.focus();
	});
	$stage.diag.find.input.on('keydown', e => {
		if(e.shiftKey && e.key == 'Enter'){
			$stage.diag.find.back.trigger('click');
			e.stopPropagation();
		}
	}).on('keyup', e => {
		if($data._fInput != e.currentTarget.value) if($data._findLast){
			delete $data._findLast;
			$stage.diag.find.status.empty();
			$stage.diag.find.msgid.val("");
			$stage.diag.find.table.empty();
		}
		$data._fInput = e.currentTarget.value;
	});
	$stage.diag.find.ok.on('click', e => {
		let value = $stage.diag.find.input.val();
		let last = Number($stage.diag.find.msgid.val());

		if(!value) return;
		findChatting(value, {
			regex: $("#diag-find-opt-regex").is(':checked'),
			last: last ? (last - OPT['find-depth']) : null
		});
	});
	$stage.diag.find.back.on('click', e => {
		let value = $stage.diag.find.input.val();
		let last = Number($stage.diag.find.msgid.val());

		if(!value) return;
		findChatting(value, {
			regex: $("#diag-find-opt-regex").is(':checked'),
			last: last ? (last + OPT['find-depth']) : null
		});
	});
	// 특수 액티비티 등록
	$data.acts = {};
	$data.currentAct = ACT_OPENED;
	createActivity(ACT_OPENED, L('act-or-title'), `
		<select id="act-or-cafe-list">
			<option>${L('loading')}</option>
		</select>
		<div id="act-or-cafe-menu">
			<div class="act-or-cm-count"></div>
			<button id="act-or-cm-visit" title="${L('visit-cafe')}">${FA('external-link')}</button>
			<button id="act-or-cm-new" title="${L('act-or-cm-new')}">${FA('magic')}</button>
		</div>
		<div id="act-or-room-list"></div>
	`);
	$stage.cafeMenu = $("#act-or-cafe-menu");
	$stage.roomList = $("#act-or-room-list");
	$stage.cafeList = $("#act-or-cafe-list").on('mousedown', e => {
		$stage.cafeList.off('mousedown').children("option:first-child").html(L('act-or-cafe-list')).prop('disabled', true);
	}).on('change', e => {
		$data.currentCafe = $data.myInfo.cafeList[$stage.cafeList.val()];
		ipc.send('cojer', 'OpenRoomList', {
			cafe: $data.currentCafe
		});
	});
	$("#act-or-cm-new").on('click', e => {
		prompt(L('act-or-cm-new'), L('act-or-cm-title-default', $data.currentCafe.name)).then(res => {
			if(!res) return;
			ipc.send('cojer', 'CreateRoom', {
				cafe: $data.currentCafe,
				userList: [ $data.myInfo.id ],
				options: { name: res, isPublic: 'O' }
			});
		});
	});
	$("#act-or-cm-visit").on('click', e => {
		if(!$data.currentCafe) return error(105);
		shell.openExternal(CAFE_BOARD_URL($data.currentCafe.id));
	});
	// 자동 로그인 / 세션 처리
	if(OPT['auto']) ipc.send('cojer', 'Login', OPT.auto);
	else ipc.send('cojer', 'CheckAuth');
	// 업데이트 확인
	if(!OPT['no-update-notice']) checkUpdate();
	// 창 크기, 줌 기억
	if($data._zoom = localStorage.getItem('zoom')){
		webFrame.setZoomFactor(Number($data._zoom));
	}
	if($data._winSize = localStorage.getItem('winSize')){
		$data._winSize = $data._winSize.split(',').map(v => Number(v));
		Remote.getCurrentWindow().setSize($data._winSize[0], $data._winSize[1], false);
	}
	window.onbeforeunload = e => {
		localStorage.setItem('zoom', webFrame.getZoomFactor());
		localStorage.setItem('winSize', Remote.getCurrentWindow().getSize().join(','));
	};
});