const FS = require('fs');
const OPT = require(global.OPT_FILE);
const {
	Session, Credentials
} = require("node-ncc-es6");
const JSDOM = require("jsdom");
const KKBolsal = require("./kkbolsal.js");

let cred = new Credentials();
let session;

KKBolsal(exports, Session, Credentials);

exports.log = msg => {
	// override this
};
exports.setOpt = (client, data) => {
	for(let i in data.obj){
		if(data.obj[i] === undefined || data.obj[i] === null) delete OPT[i];
		else OPT[i] = data.obj[i];
	}
	FS.writeFile(OPT_FILE, JSON.stringify(OPT));
};
exports.setBlackLog = (client, data) => {
	if(OPT['black-log']) FS.appendFile(OPT['black-log'], `[${data.time.toLocaleString()}] ${data.id}: ${data.content}\n`);
};

exports.requestCheckAuth = (client) => {
	FS.exists(global.AUTH_FILE, bool => {
		if(bool) exports.requestLogin(client, {});
	});
};
exports.requestCommand = (client, data) => {
	let res = { room: data.room };

	switch(data.type){
		case 'call':
			res.target = next();
			client.send('command', "call", res);
			break;
		case 'chance':
		case 'coin':
			data._date = new Date().getDate();
			res.chance = new Buffer(data.data).toString('base64').split('').reduce((pv, v, i) => {
				let c = v.charCodeAt();

				return (pv + (i + c) * c * (i + data._date)) % (778 + i);
			}, 0) / (777 + data.data.length);
		case 'dice':
			res.max = next() || 6;
		case 'clear':
		case 'help':
		case 'help_opt':
		case 'initialize':
			client.send('command', data.type, res);
			break;
		case 'image':
		case 'js':
		case 'status':
			res.data = data.data;
			client.send('command', data.type, res);
			break;
		case 'set':
			res.key = next(), res.value = data.data;
			client.send('command', "set", res);
			break;
		case 'sticker':
			res.group = next(), res.seq = next();
			client.send('command', "sticker", res);
			break;
		case 'note':
		case 'w':
			res.target = data.target = next();
			res.data = data.data;
			if(res.data == ""){
				client.send('event', "set-chat", { data: "" });
			}else{
				client.send('command', data.type, res);
				client.send('event', "set-chat", { data: `/${data.type} ${data.target} ` });
			}
			break;
		case '/':
			exports.requestSend(client, {
				type: 'text',
				room: data.room,
				data: '/' + data.raw.slice(3)
			});
			break;
		default:
			client.send('event', "error", { code: 103, msg: data.type });
	}
	function next(){
		let ci = data.data.indexOf(' ');
		let R;
		
		if(ci == -1) ci = data.data.length;
		R = data.data.slice(0, ci);
		data.data = data.data.slice(ci + 1);
		return R;
	}
};
exports.requestCreateRoom = (client, data) => {
	session.createRoom(data.cafe, data.userList, data.options).then(res => {
		if(res.error) client.send('event', "error", { code: 120, msg: res.error });
	});
};
exports.requestFind = (client, data) => {
	let depth = OPT['find-depth'];
	let filter = byString;
	let word = data.word;

	if(data.opts.regex){
		try{
			word = new RegExp(word);
		}catch(e){ return client.send('event', "error", { code: 108 }); }
		filter = byRegExp;
	}
	session.getMsg(data.room, data.last - depth, data.last).then(list => {
		let dateRange = list.length ? [ list[0].time, list[list.length - 1].time ] : [];

		client.send('event', "find", {
			rId: data.room.id,
			word: data.word,
			last: data.last,
			depth: depth,
			opts: data.opts,
			length: list.length,
			list: list.filter(v => filter(v.context = `${v.user.id}: ${v.message}`)),
			dateRange: dateRange
		});
	});
	function byString(context){
		return context.indexOf(word) != -1;
	}
	function byRegExp(context){
		return word.test(context);
	}
};
exports.requestJoin = (client, data) => {
	session.joinRoom(data.cId, data.rId).then(res => {
		client.send('event', "join", res);
	});
};
exports.requestLogin = (client, opts) => {
	let R = new Promise((res, rej) => {
		FS.readFile(global.AUTH_FILE, "utf8", (err, data) => {
			if(err) return rej(err);
			return res(JSON.parse(data));
		});
	});
	let captcha;

	if(session) session.removeAllListeners();
	cred.username = opts.id;
	cred.password = opts.pw;
	if(opts.captcha) captcha = { key: opts.captchaKey, value: opts.captcha };
	session = new Session(cred);

	exports.log("Logging in...");
	R
		.then(jar => cred.setCookieJar(jar))
		.then(() => cred.validateLogin())
		.then(name => {
			exports.log(`Login has been validated: Hello, ${name}!`);
			cred.username = name;
		}, () => {
			return cred.login(captcha, opts.form || {}).then(() => {
				if(!opts.disposable) FS.writeFile(global.AUTH_FILE, JSON.stringify(cred.getCookieJar()));
			});
		})
		.then(() => session.connect())
		.then(() => {
			if(opts.auto){
				exports.setOpt(client, {
					obj: { auto: { id: opts.id, pw: opts.pw } }
				});
			}
			return exports.requestMyInfo(client);
		})
		.then(info => {
			info.id = cred.username;
			client.send('event', "login-ok", info);
		})
		.catch(err => {
			client.send('event', "login-no", err.context ? err.context : err);
		});
	session.on('error', err => {
		client.send('event', "sess-err", err);
	});
	session.on('message', msg => {
		client.send('event', "sess-msg", msg);
	});
	session.on('progress', data => {
		client.send('event', "sess-progress", data);
	});
};
exports.requestLogout = (client) => {
	FS.unlink(global.AUTH_FILE, err => {
		client.send('event', "logout");
	});
};
exports.requestMyInfo = (client) => {
	let R = {};

	return session.findMyCafeList()
		.then(list => {
			R.cafeList = list;
			R.profile = {};
			return session.getStickerPackList();
		})
		.then(data => {
			let table = {};

			R.sticker = data;
			data.list.forEach(v => table[v.packCode] = v.stickerCount);
			R.sticker.table = table;

			return R;
		});
};
exports.requestMyProfile = (client, data) => {
	return session.getCafeMemberList(data.cId).then(list => {
		client.send('event', "my-profile", {
			cId: data.cId,
			image: list.bdy.myInfo.memberProfileImageUrl,
			nickname: list.bdy.myInfo.nickname
		});
	});
};
exports.requestMyRoomList = (client) => {
	let cafeList = {};

	session.getRoomList().then(list => {
		list.forEach(v => cafeList[v.cafe.id] = true);
		Promise.all(Object.keys(cafeList).map((v, i, my) => {
			return exports.requestMyProfile(client, { cId: v });
		})).then(() => {
			client.send('event', "my-rooms", list);
		});
	});
};
exports.requestOpenRoomList = (client, data) => {
	session.findOpenRoomList(data.cafe).then(list => {
		client.send('event', "open-rooms", list);
	});
};
exports.requestPrevChat = (client, data) => {
	session.getMsg(data.room, data.from, data.to).then(list => {
		client.send('event', "prev-chat", list);
	});
};
exports.requestSave = (client, data) => {
	FS.writeFile(data.path, data.data);
};
exports.requestSend = (client, data) => {
	switch(data.type){
		case 'text':
			session.sendText(data.room, data.data);
			break;
		case 'image':
			if(data.data instanceof Buffer){
				FS.writeFileSync(global.CLIP_FILE, data.data);
				data.data = global.CLIP_FILE;
			}else if(!FS.existsSync(data.data)){
				client.send('event', "error", { code: 104 });
				break;
			}
			session.sendImage(data.room, FS.createReadStream(data.data));
			break;
		case 'sticker':
			session.sendSticker(data.room, data.data);
			break;
		default:
			exports.log(data);
	}
};
exports.requestQuit = (client, data) => {
	session.deleteRoom(data.room).then(() => {
		client.send('event', "quit", data.room);
	});
};
exports.requestWatch = (client, data) => {
	if(!session) return client.send('event', "error", { code: 106 });
	
	FS.exists("data", e => {
		if(!e) FS.mkdirSync("data");
		data.urlList.forEach((v, i) => session.request(v).then(body => onCafeBoard(i, body)));
	});
	function onCafeBoard(index, body){
		if(!body) return;
		JSDOM.env(body, [], (err, window) => {
			if(err) return client.send('event', "error", { code: 107, msg: err.toString() });

			let res = [];
			let list = window.document.querySelectorAll("._articleListItem");
			let path = `data/${data.cafeList[index]}.log`;
			let i, len = list.length;
			
			for(i=0; i<len; i++){
				res.push({
					id: Number(list[i].id.match(/\d+$/)[0]),
					title: list[i].querySelector("strong").innerHTML.trim(),
					author: list[i].querySelector(".user_area>.nick>.ellip").innerHTML.trim()
				});
			}
			window.close();

			res = JSON.stringify(res);
			FS.readFile(path, (err, _res) => {
				if(_res && res != _res) client.send('event', "watch-new", {
					cafe: data.cafeList[index],
					before: _res,
					after: res
				});
				FS.writeFile(path, res);
			});
		});
	}
};