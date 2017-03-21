$(() => {
	let query = parseQuery(location.href);
	let url = decodeURIComponent(query.url);

	$("#Middle").html(`
		<img src="${url}" style="cursor: pointer;" onload="onImageLoad(this);" onclick="window.close();"/>
	`);
	window.onkeydown = e => {
		if(e.keyCode == 27 || (e.ctrlKey && e.keyCode == 87)){
			window.close();
		}
	};
});
/**
 * URL로부터 쿼리를 파싱한다.
 * 
 * @param {string} url URL
 * @returns {*} 파싱된 쿼리 객체
 */
function parseQuery(url){
	let R = {};
	let chunk;
	let parser = /(\?|&)(\w+?)=(.+?)(&|$)/g;

	while(chunk = parser.exec(url)){
		R[chunk[2]] = chunk[3];
	}
	return R;
}
function onImageLoad(img){
	let $window = Remote.getCurrentWindow();
	let fileName = img.src.match(/^.+\/(.+?)\?.+$/)[1];

	document.title = `${decodeURI(fileName)}(${img.naturalWidth}x${img.naturalHeight}) - ${document.title}`;
	if(OPT['viewer-resize']) $window.setSize(
		Math.min(Math.max(img.naturalWidth + 60, 200), 1000),
		Math.min(Math.max(img.naturalHeight + 90, 200), 1000)
	);
}