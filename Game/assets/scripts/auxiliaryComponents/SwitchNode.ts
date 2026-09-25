import {
	_decorator,
	CCBoolean,
	CCInteger,
	Component,
	EventTarget,
	Node,
} from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

@ccclass("SwitchNode")
export class SwitchNode extends Component {
	@property([Node]) nodes: Node[] = [];
	@property({ type: GameEvent }) switchEvent = GameEvent.NONE;
	@property(CCInteger) startIndex: number = 0;
	@property(CCBoolean) isEventToNode: boolean = false;

	private _targetEvent: Node | EventTarget = this.node;

	protected onLoad() {
		this.handleEvents(true);
	}

	protected onDestroy() {
		this.handleEvents(false);
	}

	protected handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";

		this._targetEvent = this.isEventToNode ? this.node : gameEventTarget;
		this.switchEvent != GameEvent.NONE &&
			this._targetEvent[func](this.switchEvent, this.onSwitcherEvent, this);
	}

	protected start(): void {
		this.onSwitcherEvent(this.startIndex);
	}

	onSwitcherEvent(index: number = 0) {
		this._hideAllNodes(index);
		this.nodes[index].active = true;
	}

	private _hideAllNodes(index: number) {
		this.nodes.forEach((node, nodeIndex) => {
			index !== nodeIndex && (node.active = false);
		});
	}
}
