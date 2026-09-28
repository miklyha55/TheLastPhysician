import { director, v3, Vec3 } from "cc";
import { CameraManager } from "../managers/camera/CameraManager";
import { Prewarm } from "../managers/Prewarm";
import { PlayerAttack } from "./PlayerAttack";
import { Zombie } from "./Zombie";

const _screen = v3();
const _point = v3();
const _at = v3();
const _forward = v3();

// Zombies die of the level's traps as the player does — fire out of the floor, a fireball,
// spikes, a pendulum's blade — but only where the camera sees them: off screen a trap leaves
// them be, so no zombie is lost out of sight, where the player would not see it fall. Every
// trap tests these zombies the way it tests the player and hands the ones it catches here.
export class HazardVictims {
	/** Height up a zombie's body the camera must see for it to count as in sight. */
	static sightHeight = 0.4;

	/** Is the point in the camera's picture? */
	static inSight(point: Vec3): boolean {
		const manager = CameraManager.instance;
		const camera = manager && manager.cameras[0];
		if (!camera || !camera.camera) {
			return false;
		}
		// In front of the camera, and within its picture.
		const eye = camera.node.worldPosition;
		Vec3.transformQuat(_forward, Vec3.FORWARD, camera.node.worldRotation);
		if ((point.x - eye.x) * _forward.x + (point.y - eye.y) * _forward.y + (point.z - eye.z) * _forward.z <= 0) {
			return false;
		}
		camera.worldToScreen(point, _screen);
		const width = camera.camera.width;
		const height = camera.camera.height;
		return _screen.x >= 0 && _screen.x <= width && _screen.y >= 0 && _screen.y <= height;
	}

	private static _frame = -1;
	private static _seen: Zombie[] = [];

	/** The living zombies on screen: those a trap may kill. Worked out once a frame, for all the traps. */
	static zombies(): Zombie[] {
		const frame = director.getTotalFrames();
		if (frame === HazardVictims._frame) {
			return HazardVictims._seen.filter((zombie) => !zombie.isDead);
		}
		HazardVictims._frame = frame;
		const found: Zombie[] = (HazardVictims._seen = []);
		// The warm-up behind the loading screen sets every fire going at once: nobody burns then.
		if (Prewarm.active) {
			return found;
		}
		for (const zombie of Zombie.all) {
			if (zombie.isDead || !zombie.isValid) {
				continue;
			}
			const at = zombie.node.worldPosition;
			_point.set(at.x, at.y + HazardVictims.sightHeight, at.z);
			if (HazardVictims.inSight(_point)) {
				found.push(zombie);
			}
		}
		return found;
	}

	/** A zombie caught by a trap, struck from `from`: blood, and it falls. */
	static kill(zombie: Zombie, from: Vec3): void {
		if (zombie.isDead) {
			return;
		}
		const player = PlayerAttack.instance;
		const blood = player && player.zombieBlood;
		if (blood) {
			const at = zombie.node.worldPosition;
			_at.set(at.x, at.y + 0.4, at.z);
			blood.splash(_at, from, player.killSplash);
		}
		zombie.kill();
	}
}
