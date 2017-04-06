const Request = require("request");

const CHAT_HOME_URL = "https://chat.cafe.naver.com/ChatHome.nhn";
const UPLOAD_URL = "https://up.cafe.naver.com";
const UPLOAD_PIC_URL = "/AttachChatPhotoForJindoUploader.nhn";

module.exports = function(CoJer, Session){
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
	function getCallbackFn(){
		return 'tmpFrame_' + (Math.floor(Math.random() * 9000 + 1000) + '_func');
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
			form.append('callback_func', getCallbackFn());

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