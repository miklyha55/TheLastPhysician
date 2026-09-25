window.apiName = "Facebook";

if (typeof navigator !== "undefined") {
	navigator.getGamepads = () => [];
}

function callToAction() {
	window.FbPlayableAd.onCTAClick();
}

window.callToAction = callToAction;
