const FS = require('fs');
const OPT = require(global.OPT_FILE);
const {
	Session, Credentials
} = require("node-ncc-es6");

let cred = new Credentials();
let session;

Session.prototype.getCafeMemberList = function(cafeId){
	if(!this.connected) return Promise.reject(new Error('Not connected'));
	return this.request({
		url: "https://chat.cafe.naver.com/api/CafeMemberList.nhn",
		method: "POST",
		timeout: 10000,
		json: true,
		body: {
			ver: 1,
			uid: this.username,
			tid: Date.now(),
			deviceType: 2001,
			cmd: 1000001,
			bdy: { cafeId: cafeId, limit: 1 }
		}
	});
};

exports.log = msg => {
	// override this
};
exports.setOpt = (client, key, value) => {
	if(value === undefined || value === null) delete OPT[key];
	else OPT[key] = value;
	FS.writeFile(OPT_FILE, JSON.stringify(OPT));
};
exports.setBlockLog = (client, data) => {
	if(OPT['block-log']) FS.appendFile(OPT['block-log'], `[${data.time.toLocaleString()}] ${data.id}: ${data.content}\n`);
};

exports.requestCheckAuth = (client) => {
	FS.exists(global.AUTH_FILE, bool => {
		if(bool) exports.requestLogin(client, {});
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
			return cred.login().then(() => {
				if(!opts.disposable) FS.writeFile(global.AUTH_FILE, JSON.stringify(cred.getCookieJar()));
			});
		})
		.then(() => session.connect())
		.then(() => {
			if(opts.auto){
				exports.setOpt(client, 'auto', {
					id: opts.id,
					pw: opts.pw
				});
			}
			return exports.requestMyInfo(client);
		})
		.then(info => {
			client.send('event', "login-ok", info);
		})
		.catch(err => {
			client.send('event', "login-no", err.message);
		});
	session.on('error', err => {
		client.send('event', "sess-err", err);
	});
	session.on('message', msg => {
		client.send('event', "sess-msg", msg);
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
			return session.getCafeMemberList(list[0].id);
		})
		.then(list => {
			R.profile = {
				id: list.bdy.myInfo.memberId,
				image: list.bdy.myInfo.memberProfileImageUrl,
				nickname: list.bdy.myInfo.nickname
			};
			return R;
		});
};
exports.requestOpenRoomList = (client, data) => {
	session.findOpenRoomList(data.cafe).then(list => {
		client.send('event', "open-rooms", list);
	});
};
exports.requestMyRoomList = (client) => {
	session.getRoomList().then(list => {
		client.send('event', "my-rooms", list);
	});
};
exports.requestPrevChat = (client, data) => {
	session.getMsg(data.room, data.from, data.to).then(list => {
		client.send('event', "prev-chat", list);
	});
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
			}
			session.sendImage(data.room, FS.createReadStream(data.data));
			break;
		default:
			exports.log(data);
	}
};
exports.requestCommand = (client, data) => {
	let res = { room: data.room };

	exports.log(data);
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
			client.send('command', data.type, res);
			break;
		case 'js':
		case 'status':
			res.data = data.data;
			client.send('command', "js", res);
			break;
		case 'set':
			res.key = next(), res.value = next();
			client.send('command', "set", res);
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
exports.requestSave = (client, data) => {
	FS.writeFile(data.path, data.data);
};
exports.requestJoin = (client, data) => {
	session.joinRoom(data.cId, data.rId).then(res => {
		client.send('event', "join", res);
	});
};
exports.requestQuit = (client, data) => {
	session.deleteRoom(data.room).then(() => {
		client.send('event', "quit", data.room);
	});
};