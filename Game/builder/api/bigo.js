window.apiName = "Bigo";

function gameClose() {
	cc.game.end();
}
function gameStart() {
	cc.game.run();
}
function callToAction() {
	window.BGY_MRAID && window.BGY_MRAID.open();
}
function gameReady() {
	window.BGY_MRAID && window.BGY_MRAID.gameReady();
}
function gameEnd() {
	window.BGY_MRAID && window.BGY_MRAID.gameEnd();
}

window.callToAction = callToAction;
window.gameReady = gameReady;
window.gameEnd = gameEnd;
