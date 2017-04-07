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
	sticker: data => {
		sendMessage('sticker', Activity.current.room, `${data.group}-${data.seq}`);
	},
	w: data => {
		Channel.send('whisper', {
			rId: Activity.current.id,
			target: data.target,
			data: data.data
		});
	}
};
/**
 * 명령어의 하위 힌트 도출을 담당하는 상수 객체이다.
 */
const CMD_SUBHINT = {
	sticker: [
		null,
		(data, argv) => {
			let R = "";

			$data._subhint = $data.myInfo.sticker.list.map(v => v.packCode).filter(v => v.indexOf(data) != -1);
			$data._subhint.forEach(v => {
				R += `<div id="chint-sub-${v}" class="chint-sub-item chint-sub-list">
					<img src="${STICKER_URL(v, 'tab_on', "type=m34_29")}" style="vertical-align: middle;"/> ${v.replace(data, `<label class="chint-match">${data}</label>`)}
				</div>`;
			});
			return R;
		},
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
				R += `<div id="chint-sub-${i + 1}" class="chint-sub-item chint-sub-block"
					style="background: url(${preview}) ${x}px ${y}px no-repeat;">
					${i + 1}
				</div>`;
			}
			return R;
		}
	]
};
const CMD_LIST = Object.keys(COMMANDS).sort();

ipc.on('command', (ev, type, data) => COMMANDS[type](data));