import { Node, Vec3 } from "cc";
import { Prewarm } from "../Prewarm";
import { Sound } from "./Sound";
import { I18n } from "../I18n";

/** One of a set, at random. */
function any(set: string[]): string {
	return set[Math.floor(Math.random() * set.length)];
}

/**
 * The mix: each file's own volume, so that together they sit right — the music a bed under
 * everything, the voice over it, the blasts the loudest, the frequent things (shots, steps)
 * never tiring. Worked out from how loud each file is while it sounds (its loud part, in dB)
 * against a level for what it is for:
 *
 *   explosion −14 · player's death −16 · "yes!" −16.9 · intro −18 · gate −20 · prop hit −20 · girl's throw −21
 *   chest −22 · shot, throw −22 · potion on someone −27.5
 *   jump −23 · door −24 · fire −24 · key −24 · bat −25 · potion −26 · zombie's strike −26.5 · zombies −32.2 · music −32
 *   steps −35.5 · level's results −20 (a card over the game, not from a place)
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
	"music/music_final": 0.12, // −13.7; down by ear, twice
	"music/music_game": 0.11, // −12.6; down by ear, twice
	"player_die": 0.35, // −10.7; down from its −16 level by ear
	"shoot": 1.0, // −20.4 (the quieter new file): as loud as it goes — the −16 asked for by ear would need 1.7
	"throw": 0.27, // −10.7
	"traps/fire": 0.13, // −6.4, and five seconds long
	// Steps 0.12 of their level by ear: barely there, under everything.
	"walk/walk1": 0.12, // −33.4
	"walk/walk2": 0.06, // −24.7
	"walk/walk3": 0.105, // −29.0
	"walk/walk4": 0.075, // −26.2
	// Zombies 0.34 of the file by ear: just under the music — down from 0.41, then half a step back up.
	"zombie/zombie-speak-1": 0.34, // −32.4
	"zombie/zombie-speak-2": 0.34, // −31.1
	"zombie/zombie-speak-3": 0.34, // −30.9
	"zombie/zombie-speak-4": 0.34, // −29.7
	"zombie/zombie-speak-5": 0.34, // −34.0
	// Recorded quiet, all of them: as they are.
	"get_potion": 1.0, // −30.6
	"get_key": 1.0, // −32.6
	"door_open_key_or_button": 1.0, // −27.6, as loud as it goes by ear
	"door_close": 0.15, // −9.3, to −26: level with the door opening
	"chest_appear": 1.0, // −22.2
	"gate_open": 0.8, // −23.9, a touch down by ear
	"kick_from_fly_prop": 0.32, // −12.4: −22 by ear, a thing flying into someone
	"throw_zombie_wooman": 0.32, // −11.1, to −21: the girl's throw, a warning to hear — a step down by ear
	"zombie_man_attack": 0.27, // −15.2, to −26.5: a zombie's swing, a little over their voices
	"show_results_by_level": 1.0, // −28.4, recorded quiet: as it is
	"yes": 0.45, // −10.0, to −16.9: the player's "yes!", heard over the blast — up by ear, then a step back down
	"bullet_to_enemy": 0.5, // −21.5, to −27.5: a short knock, half the shot by ear
	"bat": 0.35, // −15.8, to −25: a bat's cry, a warning to hear, a touch over a zombie's swing
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
	/** A potion landing on a zombie, the girl or a bat — every kind, the drone's hits too. */
	bulletHit: "bullet_to_enemy",
	/** The zombie girl throwing. */
	girlThrow: "throw_zombie_wooman",
	/** A zombie swinging at the player. */
	zombieAttack: "zombie_man_attack",
	/** The card of a level passed coming up. */
	levelResults: "show_results_by_level",
	/** A bat's cry: as it drops at the player, and as it is shot down. */
	bat: "bat",
	/** The player's "yes!": a zombie shot down at arm's length, a barrel gone off. */
	yes: "yes",

	get intro(): string {
		// In the game's language: the platform's, as all its texts.
		return I18n.language === "ru" ? "intro/intro_ru" : "intro/intro_eng";
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

	/** A sound of the screen, not of a place: at its own volume in the mix, wherever the camera is. */
	ui(path: string): void {
		Sound.playOneShot(path, Sfx.gain(path));
	},

	/** Loads what plays often, so its first time is not late. */
	preload(): void {
		Sound.preload([...Sfx.walk, ...Sfx.zombie, Sfx.explosion, Sfx.jump, Sfx.playerDie, Sfx.shoot, Sfx.throw, Sfx.getPotion, Sfx.getKey, Sfx.doorOpen, Sfx.doorClose, Sfx.chestClose, Sfx.gateOpen, Sfx.propHit, Sfx.girlThrow, Sfx.zombieAttack, Sfx.levelResults, Sfx.bat, Sfx.yes, Sfx.bulletHit]);
	},

	_musicPath: "music/music_game",
	_ducked: false,
};
