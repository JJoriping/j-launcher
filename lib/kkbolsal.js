const Request = require("request");
const PRequest = require("request-promise");
const CookieJar = require("tough-cookie").CookieJar;
const encryptKey = require("node-ncc-es6/lib/loginEncrypt.js").default;

const CHAT_HOME_URL = "https://chat.cafe.naver.com/ChatHome.nhn";
const UPLOAD_URL = "https://up.cafe.naver.com";
const UPLOAD_PIC_URL = "/AttachChatPhotoForJindoUploader.nhn";
const STATIC_KEY_URL = "http://static.nid.naver.com/enclogin/keys.nhn";
const LOGIN_URL = "https://nid.naver.com/nidlogin.login";

let STICKER_CACHE = {};

module.exports = function(CoJer, Session, Credentials){
	Credentials.prototype.login = function(captcha, options){
		let self = this;

		if(!captcha) captcha = {};
		if(!options) options = {};

		this.cookieJar = new CookieJar();

		hookCookieJar(this.cookieJar);
		return PRequest(STATIC_KEY_URL).then(keyString => {
			const { keyName, key } = encryptKey(keyString, this.username, this.password);
			let form = {
				enctp: 1, encnm: keyName, svctype: 0,
				enc_url: "http0X0.0000000000001P-10220.0000000.000000www.naver.com",
				url: "www.naver.com",
				smart_level: 1,
				encpw: key
			};

			if(captcha.key){
				form.smart_LEVEL = -1;
				form.chptchakey = captcha.key;
				form.chptcha = captcha.value;
				form.captcha_type = "image";
			}
			for(let i in options) form[i] = options[i];

			return PRequest({
				url: LOGIN_URL,
				headers: {
					'Content-Type': "application/x-www-form-urlencoded",
					'Accept': "text/plain"
				},
				method: "POST",
				form: form,
				jar: this.cookieJar
			});
		}).then(body => {
			let cookieText = this.cookieJar.getCookieString("https://nid.naver.com", {});
			let captcha, addDevice, otp;

			if(cookieText.indexOf('NID_AUT') != -1){
				this.emit('login');
				return Promise.resolve();
			}else{
				captcha = body.match(/<img id="captchaimg"[\s\S]+?>/im);
				addDevice = body.match(/<form id="frmNIDLogin"[\s\S]+?loginAndDeviceAdd[\s\S]+?<\/form>/im);
				otp = body.match(/<form id="frmNIDLogin"[\s\S]+?"otp"[\s\S]+?<\/form>/im);
				
				return Promise.reject({
					text: "Failed to log in.",
					captcha: captcha ? captcha[0] : null,
					addDevice: addDevice ? addDevice[0] : null,
					otp: otp ? otp[0] : null,
					body: body
				});
			}
		}).catch(e => {
			this.emit('error', e);
			throw e;
		});
	};
	Session.prototype.cafeMemberSearch = function(cafeId, query){
		if(!this.connected) return Promise.reject(new Error('Not connected'));
		return this.request({
			url: "https://chat.cafe.naver.com/api/CafeMemberSearchAjax.nhn",
			qs: {
				'_callback': getCallbackFn2(),
				'q': query,
				'q_enc': "UTF-8",
				'st': 100,
				'frm': "test",
				'r_format': "json",
				'r_enc': "UTF-8",
				'r_unicode': 0,
				't_koreng': 1,
				'cafeId': cafeId,
				'memberId': this.username,
				'cmd': 1000010
			}
		}).then(body => {
			return JSON.parse(body.match(/\{[\s\S]+\}/m)[0]);
		});
	};
	Session.prototype.getStickerPackList = function(){
		if(!this.connected) return Promise.reject(new Error('Not connected'));
		return this.request({
			url: "https://chat.cafe.naver.com/gfmarket_sticker/StickerPackListAsync.nhn",
			method: "GET",
			timeout: 10000,
			json: true
		});
	};
	Session.prototype.getRoomMemberList = function(cafeId, roomId){
		if(!this.connected) return Promise.reject(new Error('Not connected'));
		return this.sendCommand('GetRoomMemberList', {
			cafeId: cafeId,
			roomId: roomId
		});
	};
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
	Session.prototype.createRoom = function(cafe, userList, options, captcha){
		const users = userList.map(user => user.id || user);
		
		if(!options) options = {};
		if(!captcha) captcha = {};

		return this.sendCommand('CreateRoom', {
			cafeId: cafe.id.toString(),
			roomType: (users.length !== 2 || options.isPublic) ? 1 : 0,
			openType: options.isPublic ? 'O' : 'C',
			masterUserId: options.masterId || this.username,
			roomName: options.name,
			captchaKey: captcha.key || "",
			captchaValue: captcha.value || "",
			memberList: users
		})
		.then(res => {
			if(res.bdy && res.bdy.roomId){
				const { roomId, cafeId } = res.bdy;
				return this.joinRoom(cafeId, roomId);
			}
			return { error: res.retMsg };
		});
	};
	Session.prototype.sendImage = function(room, image, options){
		if(image.path == null || image.fileSize == null){
			return uploadImage(this, image, options)
				.then(this.sendImage.bind(this, room));
		}
		return this.sendMsg({
			room: room,
			type: 'image',
			message: image
		});
	};
	Session.prototype.sendSticker = function(room, data){
		let table = STICKER_CACHE[data.pack];

		if(!table){
			STICKER_CACHE[data.pack] = true;
			this.request({
				url: "https://chat.cafe.naver.com/gfmarket_sticker/StickerListAsync.nhn?packCode=" + data.pack,
				method: "POST",
				timeout: 10000,
				json: true,
				body: { packCode: data.pack }
			}).then(body => {
				let list = {};

				body.list.forEach(v => list[v.seq] = v);
				STICKER_CACHE[data.pack] = list;
				this.sendSticker(room, data);
			});
			return;
		}else if(table === true){
			// loading
			return;
		}else if(table[data.seq]){
			data.width = table[data.seq].imageWidth;
			data.height = table[data.seq].imageHeight;
		}
		data.id = `${data.pack}-${data.seq}`;

		return this.sendMsg({
			room: room,
			type: 'sticker',
			message: data.width ? `${data.id}-${data.width}-${data.height}` : data.id
		});
	};
	function getCallbackFn1(){
		return 'tmpFrame_' + (Math.floor(Math.random() * 9000 + 1000) + '_func');
	}
	function getCallbackFn2(){
		return 'window.__jindo2_callback._$' + (Math.floor(Math.random() * 9000 + 1000)) + '_0';
	}
	function hookCookieJar(cookieJar){
		cookieJar.setCookie = function(cookieOrStr, uri, options, syncCb){
			if(syncCb) return CookieJar.prototype.setCookie.apply(this, arguments);
			return this.setCookieSync(cookieOrStr, uri, options || {});
		};
		cookieJar.getCookieString = function(){
			if(arguments[arguments.length - 1] instanceof Function){
				return CookieJar.prototype.getCookieString.apply(this, arguments);
			}
			return this.getCookieStringSync.apply(this, arguments);
		};
		cookieJar.getCookies = function(){
			if(arguments[arguments.length - 1] instanceof Function){
				return CookieJar.prototype.getCookies.apply(this, arguments);
			}
			return this.getCookiesSync.apply(this, arguments);
		};
	}
	function uploadImage(sess, readStream, options){
		let progressTimer;

		return new Promise((resolve, rej) => {
			let req = Request(UPLOAD_URL + UPLOAD_PIC_URL, {
				jar: sess.credentials.cookieJar,
				strictSSL: false,
				headers: {
					'Content-Type': 'application/json; charset=UTF-8',
					'Referer': CHAT_HOME_URL,
				},
				timeout: 20000
			}, (err, res, body) => {
				clearInterval(progressTimer);
				var regex = /\]\)\('([^']+)'\);/;
				var unpacked = regex.exec(body);
				var data, param;

				if(unpacked.length < 2){
					throw new Error('File transfer failed');
				}
				unpacked = unpacked[1];
				data = JSON.parse(unpacked);
				param = {
					path: data.savedPath,
					fileSize: data.size,
					width: data.width,
					height: data.height
				};
				resolve(param);
			});
			let form = req.form();

			form.append('photo', readStream, options);
			form.append('callback', '/html/AttachImageDummyCallback.html');
			form.append('callback_func', getCallbackFn1());

			progressTimer = setInterval(checkProgress, 100, req);
		});
		function checkProgress(req){
			let obj = {
				task: 'upload-image',
				bytesDispatched: req.req.connection._bytesDispatched,
				bytesTotal: readStream.bytesRead
			};

			obj.percent = Math.min(100, obj.bytesDispatched / obj.bytesTotal * 100);
			sess.emit('progress', obj);
		}
	}
};