import { Node, Vec3 } from "cc";
import { Prewarm } from "../Prewarm";
import { Sound } from "./Sound";

/** One of a set, at random. */
function any(set: string[]): string {
	return set[Math.floor(Math.random() * set.length)];
}

/** The player's language: the intro in Russian for Russian, in English otherwise. */
function isRussian(): boolean {
	const lang = (typeof navigator !== "undefined" && (navigator.language || (navigator.languages && navigator.languages[0]))) || "";
	return /^ru\b|^ru-/i.test(lang);
}

/**
 * The mix: each file's own volume, so that together they sit right — the music a bed under
 * everything, the voice over it, the blasts the loudest, the frequent things (shots, steps)
 * never tiring. Worked out from how loud each file is while it sounds (its loud part, in dB)
 * against a level for what it is for:
 *
 *   explosion −14 · player's death −16 · intro −18 · gate −20 · prop hit −20 · girl's throw −20
 *   chest −22 · shot, throw −22
 *   jump −23 · door −24 · fire −24 · key −24 · potion −26 · music −28 · zombies −28 · steps −30
 *
 * gain = 10^((level − file's loudness) / 20), never above 1 — the zombies' voices and the
 * quietest step are recorded quieter than their level and play as they are, and so the rest of
 * the mix is set around them. The distance from the camera comes on top of this, then the game's
 * volume. Measured files: new or changed ones need measuring again.
 */
const GAIN: { [path: string]: number } = {
	"explosion": 0.4, // −9.7 dB; down from its −14 level by ear
	"intro/intro_eng": 0.98, // −17.8
	"intro/intro_ru": 0.98, // −17.8
	"jump": 0.32, // −13.2
	"music/music_final": 0.19, // −13.7
	"music/music_game": 0.17, // −12.6
	"player_die": 0.35, // −10.7; down from its −16 level by ear
	"shoot": 1.0, // −20.4 (the quieter new file): as loud as it goes — the −16 asked for by ear would need 1.7
	"throw": 0.27, // −10.7
	"traps/fire": 0.13, // −6.4, and five seconds long
	// Steps 0.22 of their level by ear: barely there, under everything.
	"walk/walk1": 0.22, // −33.4
	"walk/walk2": 0.11, // −24.7
	"walk/walk3": 0.19, // −29.0
	"walk/walk4": 0.14, // −26.2
	// Zombies 0.55 of the file by ear: under the music.
	"zombie/zombie-speak-1": 0.55, // −30.7
	"zombie/zombie-speak-2": 0.55, // −29.4
	"zombie/zombie-speak-3": 0.55, // −29.2
	"zombie/zombie-speak-4": 0.55, // −28.0
	"zombie/zombie-speak-5": 0.55, // −32.3
	// Recorded quiet, all of them: as they are.
	"get_potion": 1.0, // −30.6
	"get_key": 1.0, // −32.6
	"door_open_key_or_button": 1.0, // −27.6, as loud as it goes by ear
	"door_close": 0.15, // −9.3, to −26: level with the door opening
	"chest_appear": 1.0, // −22.2
	"gate_open": 0.8, // −23.9, a touch down by ear
	"kick_from_fly_prop": 0.21, // −12.4, to −20, then halved by ear: a thing flying into someone
	"throw_zombie_wooman": 0.35, // −11.1, to −20: the girl's throw, a warning to hear
};

/** How much quieter the music goes under the intro's voice. */
const DUCK = 0.5;

// The game's sounds by what they are for — the paths in the sound bundle (assets/audio) in one
// place — and the way each is played, each at its own volume in the mix (GAIN). Everything but
// the music sounds from where it happens and falls off with the distance from where the camera
// looks (Sound.playOneShotAt); the music plays everywhere alike, on a channel of its own.
export const Sfx = {
	MUSIC_ID: "music",
	music: "music/music_game",
	musicFinal: "music/music_final",
	walk: ["walk/walk1", "walk/walk2", "walk/walk3", "walk/walk4"],
	zombie: ["zombie/zombie-speak-1", "zombie/zombie-speak-2", "zombie/zombie-speak-3", "zombie/zombie-speak-4", "zombie/zombie-speak-5"],
	fire: "traps/fire",
	explosion: "explosion",
	jump: "jump",
	playerDie: "player_die",
	shoot: "shoot",
	throw: "throw",
	getPotion: "get_potion",
	getKey: "get_key",
	doorOpen: "door_open_key_or_button",
	/** A door swinging shut: after the player has stepped off its button. */
	doorClose: "door_close",
	/** The chest shutting once its last potion is taken (the file is called chest_appear). */
	chestClose: "chest_appear",
	gateOpen: "gate_open",
	/** A thrown thing hitting someone — a zombie it fells, the player the girl hits. */
	propHit: "kick_from_fly_prop",
	/** The zombie girl throwing. */
	girlThrow: "throw_zombie_wooman",

	get intro(): string {
		return isRussian() ? "intro/intro_ru" : "intro/intro_eng";
	},

	/** A file's own volume in the mix. */
	gain(path: string): number {
		return GAIN[path] === undefined ? 1 : GAIN[path];
	},

	/** The game's music, round and round; the same channel, so one tune takes over from the other. */
	playMusic(final = false): void {
		const path = final ? Sfx.musicFinal : Sfx.music;
		Sfx._musicPath = path;
		Sound.play(path, { id: Sfx.MUSIC_ID, loop: true, volume: Sfx.gain(path) * (Sfx._ducked ? DUCK : 1) });
	},

	/** The music under a voice: down while `on`, back up after. */
	duckMusic(on: boolean): void {
		Sfx._ducked = on;
		Sound.setVolume(Sfx.MUSIC_ID, Sfx.gain(Sfx._musicPath) * (on ? DUCK : 1));
	},

	/** A sound from a place: `path` or one of a set, at random; `volume` on top of its own in the mix. */
	at(path: string | string[], where: Vec3 | Node, volume = 1): void {
		// The warm-up behind the loading screen sets everything off at once: nothing to hear.
		if (Prewarm.active) {
			return;
		}
		const chosen = Array.isArray(path) ? any(path) : path;
		Sound.playOneShotAt(chosen, where, volume * Sfx.gain(chosen));
	},

	/** Loads what plays often, so its first time is not late. */
	preload(): void {
		Sound.preload([...Sfx.walk, ...Sfx.zombie, Sfx.explosion, Sfx.jump, Sfx.playerDie, Sfx.shoot, Sfx.throw, Sfx.getPotion, Sfx.getKey, Sfx.doorOpen, Sfx.doorClose, Sfx.chestClose, Sfx.gateOpen, Sfx.propHit, Sfx.girlThrow]);
	},

	_musicPath: "music/music_game",
	_ducked: false,
};
