const FS = require('fs');
const JLog = require("./jjlog.js");

FS.readdir("./src", (err, list) => {
	if(err) throw Error(err);

	list.forEach(v => {
		const DEST_URL = `./views/js/${v}.min.js`;
		let dest = FS.createWriteStream(DEST_URL);

		FS.readdir("./src/" + v, (_err, _list) => {
			if(_err) throw Error(_err);

			_list.forEach((w, i) => {
				let stream = FS.createReadStream(`./src/${v}/${w}`);

				stream.pipe(dest).once('close', () => {
					JLog.log(`[${v[0]}${i}] ${v}/${w} (${prettyBytes(stream.bytesRead)})`);
				});
			});
		});
	});
});
function prettyBytes(v){
	if(v < 1024) return v + " B";
	if(v < 1048576) return (v / 1024).toFixed(1) + " kB";
	return (v / 1048576).toFixed(1) + " MB";
}