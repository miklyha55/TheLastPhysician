import { game } from "cc";

// What happened on the level being played, for the results screen between levels. Started
// afresh each time a level starts (again after a death too — the attempt is counted by
// GameState); the game's pieces report into it as things happen.
export class LevelStats {
	/** Zombies the level started with, girls among them. */
	static zombies = 0;
	/** Zombies dead by any means. */
	static killed = 0;
	/** Of them: caught by the level's traps — fire, fireballs, spikes, pendulums. */
	static byTraps = 0;
	/** Of them: blown up with a barrel. */
	static byBarrels = 0;
	/** Barrels that went off. */
	static barrels = 0;
	/** Potions thrown — at zombies, at barrels. */
	static thrown = 0;
	/** Potions picked up: out of chests, off the floor. */
	static collected = 0;

	private static _startedAt = 0;

	/** A level starts with `zombies` in it. */
	static begin(zombies: number): void {
		LevelStats.zombies = zombies;
		LevelStats.killed = 0;
		LevelStats.byTraps = 0;
		LevelStats.byBarrels = 0;
		LevelStats.barrels = 0;
		LevelStats.thrown = 0;
		LevelStats.collected = 0;
		LevelStats._startedAt = game.totalTime;
	}

	/** Seconds since the level started. */
	static get seconds(): number {
		return Math.max(0, (game.totalTime - LevelStats._startedAt) / 1000);
	}
}
