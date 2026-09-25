import { Enum } from "cc";

const GameEvent = Enum({
	NONE: 0,
	RESIZE: 10,
	REDIRECT: 20,
	INPUT: 30,
	SET_AUDIO_VOLUME: 40,
	FIRST_TAP: 60,
	TOGGLE_HIDABLE: 70,
});

export default GameEvent;
