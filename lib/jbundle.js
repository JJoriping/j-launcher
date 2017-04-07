const FS = require('fs');
const JLog = require("./jjlog.js");

FS.readdir("./src", (err, list) => {
	if(err) throw Error(err);

	list.forEach(v => {
		const DEST_URL = `./views/js/${v}.min.js`;
		let dest = FS.createWriteStream(DEST_URL);

		JLog.info("Packing " + v);
		FS.readdir("./src/" + v, (_err, _list) => {
			if(_err) throw Error(_err);

			_list.forEach((w, i) => {
				JLog.log(`[${i}] ${v}/${w}`);
				FS.createReadStream(`./src/${v}/${w}`).pipe(dest);
			});
		});
	});
});