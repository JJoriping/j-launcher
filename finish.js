const FS = require('fs');

const LIST = [
	"/language.json", "/settings.json"
];

LIST.forEach(v => {
	let src = __dirname + v;
	let dest = __dirname + process.argv[2] + v;

	FS.createReadStream(src).pipe(FS.createWriteStream(dest));
});