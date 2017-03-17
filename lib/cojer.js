const FS = require('fs');
const OPT = require("../settings.json");
const {
	Session, Credentials
} = require("node-ncc-es6");

const AUTH_FILE = "./auth.json";
const OPT_FILE = "./settings.json";

let cred = new Credentials();
let session;

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

	if(session) session.removeAllListeners();
	cred.username = opts.id;
	cred.password = opts.pw;
	if(opts.captcha){
		cred.captcha = opts.captcha;
		cred.captchaKey = opts.captchaKey;
		exports.log(cred.captchaKey);
	}
	session = new Session(cred);

	exports.log("Logging in...");
	R
		.then(jar => Credentials.setCookieJar(jar))
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
			client.send('event', "login-ok");
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
exports.requestMyRoomList = (client) => {
	session.getRoomList().then(list => {
		client.send('event', "my-rooms", list);
	});
};