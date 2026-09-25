"use strict";

const networkConfigs = {
	Vungle: {
		nameFile: "ad.html",
		nameCode: "VU",
		headScript:
			'<script src="mraid.js"></script><script>window.apiName = "Vungle";</script>',
		apiScriptName: "mraid",
		jsonConfig: null,
	},
	AppLovin: {
		nameCode: "AL",
		headScript: `<script src='mraid.js'></script><script>
		if (typeof window.ALPlayableAnalytics != "undefined") {
			window.ALPlayableAnalytics.trackEvent("LOADING");
		}

		// Загрузка игрового процесса завершена
		window.addEventListener(
			"ALP_LOADED",
			() => {
				if (typeof window.ALPlayableAnalytics != "undefined") {
					window.ALPlayableAnalytics.trackEvent("LOADED");
				}
			},
			{ once: true },
		);

		// HTML-шаблон отображается пользователю и готов к взаимодействию с ним
		window.addEventListener(
			"ALP_DISPLAYED",
			() => {
				if (typeof window.ALPlayableAnalytics != "undefined") {
					window.ALPlayableAnalytics.trackEvent("DISPLAYED");
				}
			},
			{ once: true },
		);

		// Пользователь начинает задание в HTML-коде. Запуск происходит, когда пользователь нажимает кнопку «старт» или активно взаимодействует с креативом.
		window.addEventListener(
			"ALP_CHALLENGE_STARTED",
			() => {
				if (typeof window.ALPlayableAnalytics != "undefined") {
					window.ALPlayableAnalytics.trackEvent("CHALLENGE_STARTED");
				}
			},
			{ once: true },
		);

		// Пользователь проваливает задание, достигнув состояния неудачи
		window.addEventListener("ALP_CHALLENGE_FAILED", () => {
			if (typeof window.ALPlayableAnalytics != "undefined") {
				window.ALPlayableAnalytics.trackEvent("CHALLENGE_FAILED");
			}
		});

		// Пользователь повторно пытается пройти проверку, которая оказалась неудачной
		window.addEventListener("ALP_CHALLENGE_RETRY", () => {
			if (typeof window.ALPlayableAnalytics != "undefined") {
				window.ALPlayableAnalytics.trackEvent("CHALLENGE_RETRY");
			}
		});

		// Пользователь достиг 25% выполнения задания
		window.addEventListener(
			"ALP_CHALLENGE_PASS_25",
			() => {
				if (typeof window.ALPlayableAnalytics != "undefined") {
					window.ALPlayableAnalytics.trackEvent("CHALLENGE_PASS_25");
				}
			},
			{ once: true },
		);

		// Пользователь достиг 50% выполнения задания
		window.addEventListener(
			"ALP_CHALLENGE_PASS_50",
			() => {
				if (typeof window.ALPlayableAnalytics != "undefined") {
					window.ALPlayableAnalytics.trackEvent("CHALLENGE_PASS_50");
				}
			},
			{ once: true },
		);

		// Пользователь достиг 75% выполнения задания
		window.addEventListener(
			"ALP_CHALLENGE_PASS_75",
			() => {
				if (typeof window.ALPlayableAnalytics != "undefined") {
					window.ALPlayableAnalytics.trackEvent("CHALLENGE_PASS_75");
				}
			},
			{ once: true },
		);

		// Пользователь успешно выполнил задание
		window.addEventListener(
			"ALP_CHALLENGE_SOLVED",
			() => {
				if (typeof window.ALPlayableAnalytics != "undefined") {
					window.ALPlayableAnalytics.trackEvent("CHALLENGE_SOLVED");
				}
			},
			{ once: true },
		);

		// Редирект
		window.addEventListener("ALP_CTA_CLICKED", () => {
			if (typeof window.ALPlayableAnalytics != "undefined") {
				window.ALPlayableAnalytics.trackEvent("CTA_CLICKED");
			}
		});

		// В HTML-интерфейсе отображается заключительная заставка или итоговый экран.
		window.addEventListener(
			"ALP_ENDCARD_SHOWN",
			() => {
				if (typeof window.ALPlayableAnalytics != "undefined") {
					window.ALPlayableAnalytics.trackEvent("ENDCARD_SHOWN");
				}
			},
			{ once: true },
		);

		window.apiName = "AppLovin";

		</script>`,
		apiScriptName: "mraid",
		jsonConfig: null,
	},
	Mintegral: {
		nameCode: "MW",
		headScript: '<script>window.apiName = "Mintegral";</script>',
		apiScriptName: "mw",
		jsonConfig: null,
	},
	GoogleAdwords: {
		nameCode: "GA",
		headScript:
			'<script>window.apiName = "Google";</script><script src= "https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>',
		apiScriptName: "ga",
		jsonConfig: null,
	},
	GoogleLI: {
		nameCode: "GA_LI",
		headScript: ({ iosLink }) =>
			'<meta name="ad.size" content="width=480, height=320" /><meta name="ad.orientation" content="landscape" /><script>var clickTag="' +
			iosLink +
			'"</script><script>window.apiName = "Google";</script><script src= "https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>',
		apiScriptName: "ga",
		jsonConfig: null,
	},
	GooglePI: {
		nameCode: "GA_PI",
		headScript: ({ iosLink }) =>
			'<meta name="ad.size" content="width=320, height=480" /><meta name="ad.orientation" content="portrait" /><script>var clickTag="' +
			iosLink +
			'"</script><script>window.apiName = "Google";</script><script src= "https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>',
		apiScriptName: "ga",
		jsonConfig: null,
	},
	GoogleLA: {
		nameCode: "GA_LA",
		headScript: ({ androidLink }) =>
			'<meta name="ad.size" content="width=480, height=320" /><meta name="ad.orientation" content="landscape" /><script>var clickTag="' +
			androidLink +
			'"</script><script>window.apiName = "Google";</script><script src= "https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>',
		apiScriptName: "ga",
		jsonConfig: null,
	},
	GooglePA: {
		nameCode: "GA_PA",
		headScript: ({ androidLink }) =>
			'<meta name="ad.size" content="width=320, height=480" /><meta name="ad.orientation" content="portrait" /><script>var clickTag="' +
			androidLink +
			'"</script><script>window.apiName = "Google";</script><script src= "https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>',
		apiScriptName: "ga",
		jsonConfig: null,
	},
	Unity: {
		nameCode: "UN",
		headScript:
			"<script src='mraid.js'></script><script>window.apiName = 'Unity';</script>",
		apiScriptName: "mraid",
		jsonConfig: null,
	},
	TikTok: {
		nameCode: "TK",
		headScript:
			'<script>window.apiName = "TikTok";</script><script src="https://sf16-muse-va.ibytedtos.com/obj/union-fe-nc-i18n/playable/sdk/playable-sdk.js"></script>',
		apiScriptName: "tiktok",
		jsonConfig: { playable_orientation: 0 },
	},
	Bigo: {
		nameCode: "BG",
		headScript:
			'<script>window.apiName = "Bigo";</script><script src="https://static-web.likeevideo.com/as/common-static/big-data/dsp-public/bgy-mraid-sdk.js"></script>',
		apiScriptName: "bigo",
		jsonConfig: { orientation: 0 },
	},
	Facebook: {
		nameCode: "FB",
		headScript: "<script>window.apiName = 'Facebook';</script>",
		apiScriptName: "fb",
		isSeparateJs: true,
		jsonConfig: null,
	},
	Liftoff: {
		nameCode: "LF",
		headScript:
			"<script src='mraid.js'></script><script>window.apiName = 'Liftoff';</script>",
		apiScriptName: "mraid",
		jsonConfig: null,
	},
	Moloco: {
		nameCode: "MC",
		headScript: "<script>window.apiName = 'Moloco';</script>",
		apiScriptName: "fb",
		jsonConfig: null,
	},
};

module.exports = networkConfigs;
