const {
	clipboard: Clipboard,
	ipcRenderer: ipc,
	remote: Remote,
	shell
} = require("electron");
const OPT = require("../settings.json");
const VER = require("../package.json").version;

const CHANNEL_HOST = "jjo.kr";
const LATEST_VERSION_URL = "https://api.github.com/repos/JJoriping/j-launcher/releases/latest";
const STICKER_URL = (pack, seq, qs) => `https://ssl.phinf.net/gfmarket/${pack}/original_${seq}.png${qs ? `?${qs}` : ""}`;
const CAFE_BOARD_URL = id => `http://m.cafe.naver.com/ArticleList.nhn?search.clubid=${id}`;
const CAFE_ARTICLE_URL = (id, aId) => `http://m.cafe.naver.com/ArticleRead.nhn?clubid=${id}&articleid=${aId}`;