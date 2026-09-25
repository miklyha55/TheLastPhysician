import {Animation, Component, director, geometry, MeshRenderer, Node, SkeletalAnimation, sp, tween, v2, v3, Vec2, Vec3} from "cc";

class Utils {
	static component: Component | null = null;

	static pickAtRandom(array: [any]): [any] {
		return array[Math.floor(Math.random() * array.length)];
	}

	static pickRandomInt(min: number, max: number): number {
		min = Math.ceil(min);
		max = Math.floor(max);

		return Math.floor(Math.random() * (max - min) + min);
	}

	static pickRandomFloat(min: number, max: number): number {
		return Math.random() * (max - min) + min;
	}


	public static getRandomVec2(min: Vec2, max: Vec2): Vec2 {
		const vector = v2(this.pickRandomFloat(min.x, max.x), this.pickRandomFloat(min.y, max.y));

		return vector;
	}

	public static getRandomVec3(min: Vec3, max: Vec3): Vec3 {
		const vector = v3(this.pickRandomFloat(min.x, max.x), this.pickRandomFloat(min.y, max.y), this.pickRandomFloat(min.z, max.z));

		return vector;
	}

	public static getRandomItem<T>(items: T[]): T {
		return items[Math.floor(Math.random() * items.length)];
	}

	public static async waitFor(timeToWait: number): Promise<void> {
		return new Promise((resolve) => {
			tween(this)
				.delay(timeToWait)
				.call(() => resolve())
				.start();
		});
	}

	public static playAnimation(animation: Animation, animationName?: string): Promise<void> {
		animationName = animationName ?? animation.defaultClip.name;

		animation.play(animationName);

		return new Promise((resolve) => {
			animation.on(Animation.EventType.FINISHED, () => {
				resolve();
			});
		});
	}

	public static async playSpineAnimation(spine: sp.Skeleton, animationName?: string, trackIndex: number = 0): Promise<void> {
		animationName = animationName ?? spine.animation;

		spine.setAnimation(trackIndex, animationName, false);

		return new Promise<void>((resolve) => {
			spine.setCompleteListener(() => {
				spine.setCompleteListener(null);
				resolve();
			});
		});
	}

	public static shuffleArray<T>(array: T[]): T[] {
		const result = [...array];

		for (let i = result.length - 1; i > 0; i--) {
			let j = Math.floor(Math.random() * (i + 1));
			let temp = result[i];
			result[i] = result[j];
			result[j] = temp;
		}

		return result;
	}

	static normalize(val: number, max: number, min: number): number {
		return (val - min) / (max - min);
	}

	static clamp(number: number, max: number, min: number): number {
		return Math.max(min, Math.min(number, max));
	}

	static globalScheduleOnce(callback: () => void, delay: number) {
		Utils.component = Utils.component ? Utils.component : new Component();

		Utils.component.scheduleOnce(() => {
			callback();
		}, delay);
	}

	static globalSchedule(callback: () => void, delay: number) {
		Utils.component = Utils.component ? Utils.component : new Component();

		Utils.component.schedule(() => {
			callback();
		}, delay);
	}

	static getMeshBoundingBox(meshRenderer: MeshRenderer): {
		size: Vec3;
		center: Vec3;
	} {
		if (!meshRenderer) {
			return;
		}

		meshRenderer.model.updateWorldBound();

		const worldAABB: geometry.AABB = meshRenderer.model.worldBounds!;

		const center: Vec3 = worldAABB.center.clone();
		const size: Vec3 = worldAABB.halfExtents.clone().multiplyScalar(2);

		return {size, center};
	}

	static getChildByName(parent: Node, name: string): Node | null {
		if (!parent) {
			return null;
		}

		if (parent.name.indexOf(name) >= 0) {
			return parent;
		}

		for (let i = 0; i < parent.children.length; i++) {
			const foundNode = Utils.getChildByName(parent.children[i], name);

			if (foundNode) {
				return foundNode;
			}
		}

		return null;
	}

	static getParentByName(parent: Node, name: string) {
		if (!parent) {
			return null;
		}

		if (parent.name.indexOf(name) >= 0) {
			return parent;
		}

		const foundNode = Utils.getParentByName(parent.parent, name);

		if (foundNode) {
			return foundNode;
		}

		return null;
	}

	static getMoreStableDelta(delta: number): number {
		const count = Math.round(director.root.fps);
		const customDelta = 1 / count;
		if (count !== 0 && customDelta < 0.1) {
			return customDelta;
		} else {
			return delta;
		}
	}
}

export default Utils;
