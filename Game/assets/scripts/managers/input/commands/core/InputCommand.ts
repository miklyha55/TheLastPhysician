import { EventTouch } from "cc";
import { InputCatcher } from "../../InputCatcher";

export default class InputCommand {
	constructor() {}

	onDown(props: any, touch: EventTouch, place: InputCatcher): void {}
	onMove(props: any, touch: EventTouch, place: InputCatcher): void {}
	onUp(props: any, touch: EventTouch, place: InputCatcher): void {}
}
