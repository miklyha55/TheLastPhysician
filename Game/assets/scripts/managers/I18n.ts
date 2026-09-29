// The game's language, the way ThroughTheDeadCity picks it: the platform's, told once as the game
// starts, and never switched inside the game — Yandex Games wants no switch in the game and no
// two languages on one screen. Russian and English: whatever else the platform says goes to
// English. Outside the platform the browser's language stands in, and `?lang=` in the address
// overrides both, for checking. Every text the game shows is asked for here by its key, at the
// moment it is shown.

type Text = string | ((...args: (string | number)[]) => string);

const RU: { [key: string]: Text } = {
	"start.subtitle": "Выберись из подземелья",
	"start.play": "Играть",

	"level.title": (n) => `Уровень ${n}`,
	"level.passed": (n) => `Уровень ${n} пройден!`,
	"level.passedPlain": "Уровень пройден!",
	"level.allKilled": "Все зомби повержены",
	"level.goodJob": "Отличная работа",
	"level.continue": "Продолжить",
	"level.finish": "Завершить",

	"death.title": "Вы погибли",
	"death.again": "Ещё раз",
	"death.fromStart": "Заново",
	"death.confirmTitle": "Начать заново?",
	"death.confirmNote": "Пройденные уровни будут потеряны",
	"death.keep": "Отмена",
	"death.wipe": "Заново",

	"final.title": "Свобода!",
	"final.subtitle": "Подземелье пройдено",
	"final.again": "Играть снова",

	"row.levels": "Уровней пройдено",
	"row.killed": "Зомби убито",
	"row.thrown": "Склянок брошено",
	"row.collected": "Склянок собрано",
	"row.barrels": "Бочек взорвано",
	"row.time": "Время",
	"row.deaths": "Смертей",
	"row.attempt": "Попытка",
	"row.byBoth": "ловушки · бочки",
	"row.byTraps": "ловушками",
	"row.byBarrels": "взрывами бочек",

	"hint.title": "Веди героя",
	"hint.note": "Остановись — и он сам метнёт склянку в зомби",
	"hint.tailKeys": "нажми любую клавишу",
	"hint.tailTouch": "коснись экрана",

	"skip.keys": "Esc — пропустить",
	"skip.touch": "пропустить",
};

const EN: { [key: string]: Text } = {
	"start.subtitle": "Escape the dungeon",
	"start.play": "Play",

	"level.title": (n) => `Level ${n}`,
	"level.passed": (n) => `Level ${n} complete!`,
	"level.passedPlain": "Level complete!",
	"level.allKilled": "All zombies down",
	"level.goodJob": "Great job",
	"level.continue": "Continue",
	"level.finish": "Finish",

	"death.title": "You died",
	"death.again": "Once more",
	"death.fromStart": "From scratch",
	"death.confirmTitle": "Start over?",
	"death.confirmNote": "Levels you have passed will be lost",
	"death.keep": "Cancel",
	"death.wipe": "Start over",

	"final.title": "Freedom!",
	"final.subtitle": "The dungeon is behind you",
	"final.again": "Play again",

	"row.levels": "Levels cleared",
	"row.killed": "Zombies killed",
	"row.thrown": "Potions thrown",
	"row.collected": "Potions collected",
	"row.barrels": "Barrels blown up",
	"row.time": "Time",
	"row.deaths": "Deaths",
	"row.attempt": "Attempt",
	"row.byBoth": "traps · barrels",
	"row.byTraps": "by traps",
	"row.byBarrels": "by barrel blasts",

	"hint.title": "Lead the hero",
	"hint.note": "Stop — and he throws a potion at the zombie himself",
	"hint.tailKeys": "press any key",
	"hint.tailTouch": "touch the screen",

	"skip.keys": "Esc — skip",
	"skip.touch": "skip",
};

const WORDS: { [language: string]: { [key: string]: Text } } = { ru: RU, en: EN };

export class I18n {
	/** The languages the game knows; the first is the one its texts were written in. */
	static readonly languages = ["ru", "en"];

	private static _current = I18n.pick(I18n._override() || (typeof navigator !== "undefined" ? navigator.language : ""));

	/** The language the game is in: "ru" or "en". */
	static get language(): string {
		return I18n._current;
	}

	/** A code from the platform or the browser, brought to one the game knows; anything else is English. */
	static pick(code: string): string {
		const wanted = String(code || "").slice(0, 2).toLowerCase();
		return I18n.languages.indexOf(wanted) >= 0 ? wanted : "en";
	}

	/**
	 * Sets the language — the platform's, once it has answered; `?lang=` still wins. The page is
	 * told too: a browser seeing a Russian page with an English player offers to translate it,
	 * with a bar of its own over the game, and there is nothing to translate.
	 */
	static apply(code: string): void {
		I18n._current = I18n.pick(I18n._override() || code);
		typeof document !== "undefined" && document.documentElement && (document.documentElement.lang = I18n._current);
	}

	/** The text under `key` in the game's language, with `args` put into it where it takes them. */
	static t(key: string, ...args: (string | number)[]): string {
		const text = (WORDS[I18n._current] && WORDS[I18n._current][key]) || RU[key];
		if (text === undefined) {
			return key;
		}
		return typeof text === "function" ? text(...args) : text;
	}

	/** `?lang=` in the address, for checking the game in another language. */
	private static _override(): string {
		try {
			return typeof location !== "undefined" ? new URLSearchParams(location.search).get("lang") || "" : "";
		} catch {
			return "";
		}
	}
}
