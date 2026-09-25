window.isGlobalSound = true;

if (window["mraid"] && mraid.getState() === "loading") {
	mraid.addEventListener("ready", onSDKReady);
}

function onSDKReady() {
	mraid.removeEventListener("ready", onSDKReady);

	mraid.addEventListener("viewableChange", onViewableChange);
	mraid.addEventListener("audioVolumeChange", onAudioVolumeChange);
}

function onAudioVolumeChange(volume) {
	window.isGlobalSound = !!volume;

	window.dispatchEvent(
		new CustomEvent("setAudioVolume", {
			detail: {
				volume,
				fade: true,
			},
		})
	);
}

function onViewableChange(isViewable) {
	window["cc"] && cc.game[isViewable ? "run" : "pause"]();
}

function callToAction() {
	var userAgent = navigator.userAgent;
	var isAndroid = /android/i.test(userAgent);
	var url = isAndroid ? androidLink : iosLink;

	mraid.open(url);
}

window.callToAction = callToAction;
