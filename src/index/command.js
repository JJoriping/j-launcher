/**
 * 유효한 설정의 기본값을 나타낸다.
 */
const OPT_DEFAULTS = {
	'andromedish': true,
	'answer-cooldown': 10000,
	'answer-rule': [],
	'auto': {},
	'black': [],
	'black-log': "black.log",
	'channel-pw': null,
	'chat-prefix': "",
	'chat-suffix': "",
	'find-depth': 100,
	'history-max': 100,
	'idle-time': 300,
	'macro': [],
	'max-chat': 100,
	'mute': false,
	'no-ask-upload': false,
	'no-channel-list': [],
	'no-channel-notice': false,
	'no-image': false,
	'no-trace': false,
	'no-update-notice': false,
	'prev-per-req': 30,
	'sounds': {
		'chat': "./media/k.mp3",
		'alarm': "./media/alarm.mp3"
	},
	'status-list': [],
	'use-jom': false,
	'viewer-resize': true,
	'watch-interval': 30,
	'watch-list': [],
	'white': [],
	'youtube-view': true
};
/**
 * 유효한 설정의 목록을 나타낸다.
 */
const OPT_KEYS = Object.keys(OPT_DEFAULTS);
/**
 * 유효한 소리 식별자의 목록을 나타낸다.
 */
const SOUNDS = [ "chat", "alarm" ];
/**
 * link 명령어의 유효한 링크 주소를 나타낸다.
 */
const LINK_TABLE = {
	'bing': v => `http://www.bing.com/search?q=${v}`,
	'daum': v => `http://search.daum.net/search?q=${v}`,
	'google': v => `https://www.google.com/search?q=${v}`,
	'namu': v => `https://namu.wiki/w/${v}`,
	'naver': v => `https://search.naver.com/search.naver?query=${v}`,
	'wiki': v => `https://en.wikipedia.org/wiki/${v}`
};
/**
 * link 명령어의 유효한 링크 이름 목록을 나타낸다.
 */
const LINK_TABLE_KEYS = Object.keys(LINK_TABLE);
/**
 * 명령어의 실행을 담당하는 상수 객체이다.
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
	channel: data => {
		let arr = OPT['no-channel-list'];
		let id = Activity.current.id;
		let ii = arr.indexOf(id);
		let text;

		if(ii == -1){
			text = L('channel-closed', Activity.current.room.name);
			arr.push(id);
		}else{
			text = L('channel-opened', Activity.current.room.name);
			arr.splice(ii, 1);
		}
		setOpt('no-channel-list', arr);
		command(text, data.room.id, "cmd-receive");
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
	dict: null,
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
	image: data => {
		sendMessage('image', Activity.current.room, data.data);
	},
	initialize: data => {
		setOpt(OPT_DEFAULTS);
		location.reload();
	},
	js: data => {
		try{ data._res = String(eval(data.data)); }
		catch(e){ data._res = e.toString(); data._addr = `<label style='color: orange;'>${FA('warning', true)}</label>`; }
		command(data._res, data.room.id, 'cmd-receive', data._addr);
	},
	link: data => {
		let res = LINK_TABLE[data.key](data.value);

		command(res, data.room.id, 'cmd-receive');
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
	share: data => {
		if($data._cmdSend && $data._cmdReceive && $data._cmdSend[1] <= $data._cmdReceive[1]){
			let sendData = "// " + $data._cmdSend[0].slice(1) + "\n";

			if(data.data) sendData = "";
			sendMessage('text', Activity.current.room, sendData + $data._cmdReceive[0]);
		}else{
			log(L('error-109'));
		}
	},
	status: data => {
		Channel.send('status', { status: data.data.trim() });
	},
	sticker: data => {
		sendMessage('sticker', Activity.current.room, { pack: data.group, seq: data.seq });
	},
	w: data => {
		Channel.send('whisper', {
			rId: Activity.current.id,
			target: data.target,
			data: data.data
		});
		log(L('sent-whisper', data.target));
	}
};
/**
 * 표준 하위 힌트 도출 함수를 생성한다.
 * 
 * @param {Function} poolBuilder 검색 배열을 생성시키는 함수
 * @param {Function} renderer 필터링된 결과에 대해 DOM 그리기 작업을 수행하는 함수
 * @returns {Function} 생성된 하위 힌트 도출 함수
 */
const CMD_STD_SUBHINT = function(poolBuilder, renderer){
	let my = this;

	this.styler = v => v.replace(this.data, `<label class="chint-match">${this.data}</label>`);
	return (data, argv) => {
		let R = "";
		let pool = poolBuilder();

		this.data = data;
		this.argv = argv;
		$data._subhint = pool.filter(v => v.indexOf(data) != -1);
		$data._subhint.forEach(v => R += `
		<div id="chint-sub-${v}" class="chint-sub-item chint-sub-list" onclick="onSubhintClick(this);">
			${renderer.call(my, v, this.styler)}
		</div>`);
		return R;
	};
};
/**
 * 명령어의 하위 힌트 도출 함수들을 포함하는 상수 객체이다.
 */
const CMD_SUBHINT = {
	link: [
		null,
		new CMD_STD_SUBHINT(
			() => LINK_TABLE_KEYS,
			(v, styler) => `${styler(v)}`
		)
	],
	set: [
		null,
		new CMD_STD_SUBHINT(
			() => OPT_KEYS,
			(v, styler) => `${styler(v)}: <label style="color: #AAA;">${
				L('optx-' + v).match(/<br\/>.+$/)[0].slice(5)
			}</label>`
		),
		true,
		(data, argv) => LANG['optx-' + argv[1]] ? `<div class="chint-sub-item chint-sub-list">
			<label class="chint-match">${argv[1]}</label><br/>
			${L('optx-' + argv[1])}<br/>
			<label style="color: gold;">${L('opts-current')}</label>: ${OPT[argv[1]]}<br/>
			<label style="color: orange;">${L('default')}</label>: ${OPT_DEFAULTS[argv[1]]}
		</div>` : ""
	],
	status: [
		null,
		new CMD_STD_SUBHINT(
			() => [ "online" ].concat(OPT['status-list']).concat([ "afk" ]),
			(v, styler) => styler(v)
		)
	],
	sticker: [
		null,
		new CMD_STD_SUBHINT(
			() => $data.myInfo.sticker.list.map(v => v.packCode),
			(v, styler) => `
				<img src="${STICKER_URL(v, 'tab_on', "type=m34_29")}" style="vertical-align: middle;"/> ${styler(v)}
			`
		),
		(data, argv) => {
			let R = "";
			let i, len = $data.myInfo.sticker.table[argv[1]];
			let preview = STICKER_URL(argv[1], 'preview', "type=p100_100");

			$data._subhint = [];
			for(i=0; i<len; i++){
				let x, y;
				
				if(data && String(i + 1).indexOf(data) == -1) continue;
				x = -108 * (i % 3);
				y = -100 * Math.floor(i / 3);
				$data._subhint.push(i + 1);
				R += `<div id="chint-sub-${i + 1}" class="chint-sub-item chint-sub-block chint-si-sticker"
					onclick="onSubhintClick(this);"
					style="background: url(${preview}) ${x}px ${y}px no-repeat;">
					${i + 1}
				</div>`;
			}
			return R;
		}
	],
	w: [
		null,
		new CMD_STD_SUBHINT(
			() => Activity.current.channel ? Activity.current.channel.list.map(v => v.id) : [],
			(v, styler) => styler(Activity.current.channel.$list.children(".actli-" + v).attr('title'))
		)
	]
};
const CMD_LIST = Object.keys(COMMANDS).sort();

CMD_SUBHINT['note'] = CMD_SUBHINT['call'] = CMD_SUBHINT['w'];
ipc.on('command', (ev, type, data) => COMMANDS[type](data));

function onSubhintClick(item){
	let value = item.id.slice(10);
	let argv;

	if($(item).hasClass("chint-si-sticker")){
		argv = $data._cmdText.split(' ');
		sendMessage('sticker', Activity.current.room, { pack: argv[1], seq: value });
		setCommandHint(false);
	}else{
		setCommandHint(true, $data._cmdText + value + " ");
	}
}
// 빠진 설정을 기본값으로 변경
(() => {
	let list = {};

	for(let i in OPT_DEFAULTS){
		if(!OPT.hasOwnProperty(i)) list[i] = OPT_DEFAULTS[i];
	}
	setOpt(list);
})();