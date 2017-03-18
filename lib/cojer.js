const FS = require('fs');
const OPT = require("../settings.json");
const {
	Session, Credentials
} = require("node-ncc-es6");

const AUTH_FILE = "./auth.json";
const OPT_FILE = "./settings.json";

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
exports.requestLogin = (client, opts) => {
	let R = new Promise((res, rej) => {
		FS.readFile(AUTH_FILE, "utf8", (err, data) => {
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
		}, () => {
			return cred.login().then(() => {
				FS.writeFile(AUTH_FILE, JSON.stringify(cred.getCookieJar()));
			});
		})
		.then(() => session.connect())
		.then(() => {
			if(opts.auto){
				OPT.auto = {
					id: opts.id,
					pw: opts.pw
				};
				FS.writeFile(OPT_FILE, JSON.stringify(OPT));
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
		default:
			exports.log(data);
	}
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