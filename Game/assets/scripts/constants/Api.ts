import { Enum } from "cc";

class Api {
	static apiName = Enum({
		VUNGLE_MRAID: "Vungle",
		APPLOVIN_MRAID: "AppLovin",
		MINTEGRAL: "Mintegral",
		GOOGLE: "Google",
		UNITY_MRAID: "Unity",
		TIKTOK: "TikTok",
		BIGO: "Bigo",
		FACEBOOK: "Facebook",
		LIFTOFF_MRAID: "Liftoff",
		MOLOCO: "Moloco",
	});
}

export default Api;
