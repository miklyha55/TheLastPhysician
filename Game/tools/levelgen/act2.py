"""Levels 11-15, rebuilt 2026-09-30 from what the first ten taught.

What the first ten settled, and these follow:
- a safe start room in the top left (the player and a chest, no zombies) and a safe end room with
  the lever and the gate in the bottom wall;
- zombies spread out — two cells apart at the least — and three from any door, none in the start;
  as many as the tenth has, give or take, for the frame rate: the bats and furniture come later,
  in the scene;
- every room about one thing, the things of the first ten in new mixes: a pendulum snake, a spike
  wave to time, fire vents in rows, slime slowing the way, keys in an order, a button far from
  its door;
- the traps' neighbours out of step, so there is always a moment to get through.

The maps are drawn by rooms — carve, doors, traps — and the zombies, girls and chests are put
in by rule (seeded), so the counts and the spacing hold without hand-counting.
"""
import math
import random

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
DOORS = 'DrbgE'


class Map:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.m = [['#'] * w for _ in range(h)]

    def carve(self, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.m[y][x] = '.'
        return (x0, y0, x1, y1)

    def put(self, x, y, ch):
        self.m[y][x] = ch

    def at(self, x, y):
        return self.m[y][x] if 0 <= x < self.w and 0 <= y < self.h else ' '

    def cells(self, ch):
        return [(x, y) for y in range(self.h) for x in range(self.w) if self.m[y][x] in ch]

    def rows(self):
        return [''.join(r) for r in self.m]


def populate(mp, rect, kind, count, seed, near_door=3.0, apart=2.0, avoid=()):
    """`count` of `kind` in the room `rect`: on plain floor, `near_door` from every door, `apart`
    from every zombie, girl and chest already there, not on the cells in `avoid` — spread out: each
    one where it is farthest from the rest, a little randomness between equals."""
    rnd = random.Random(seed)
    x0, y0, x1, y1 = rect
    doors = mp.cells(DOORS)
    placed = []
    for _ in range(count):
        others = mp.cells('ZVC')
        best, key = None, None
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if mp.at(x, y) != '.' or (x, y) in avoid:
                    continue
                if any(math.hypot(x - a, y - b) < near_door for a, b in doors):
                    continue
                if any(math.hypot(x - a, y - b) < apart for a, b in others):
                    continue
                k = min([math.hypot(x - a, y - b) for a, b in others] or [9]) + rnd.random() * 0.6
                if key is None or k > key:
                    best, key = (x, y), k
        if not best:
            raise AssertionError(f'no room for {kind} {len(placed) + 1}/{count} in {rect}')
        mp.put(*best, kind)
        placed.append(best)
    return placed


def pendulum_lanes(mp, pendulums):
    """The cells beside the pendulums and the lanes past them: kept free, the lane rules use them."""
    out = set()
    for (x, y), (turn, _) in pendulums.items():
        for dx, dy in N4:
            out.add((x + dx, y + dy))
    return out


def wave(cells, step, period):
    return {c: round((i * step) % period, 2) for i, c in enumerate(cells)}


def level11():
    """Red key over the top, a pendulum snake down the long corridor, slime and a far button below."""
    mp = Map(23, 17)
    start = mp.carve(1, 1, 5, 6)
    mid = mp.carve(7, 1, 15, 6)
    right = mp.carve(17, 1, 21, 6)
    hall = mp.carve(1, 8, 21, 10)
    end = mp.carve(1, 12, 5, 15)
    low = mp.carve(7, 12, 21, 15)
    mp.put(6, 2, 'D'); mp.put(16, 4, 'D')
    mp.put(2, 7, 'r')            # the start room's floor opens on the corridor once the key is got
    mp.put(21, 11, '.')          # the corridor's far end drops into the room below
    mp.put(6, 14, 'D')           # shut, the far button opens it
    mp.put(3, 16, 'E')
    for y in range(12, 16): mp.put(12, y, '~')
    mp.put(2, 2, 'P'); mp.put(3, 4, 'C')
    mp.put(19, 3, 'R'); mp.put(2, 13, 'L'); mp.put(8, 15, 'O')
    pend = {(x, 9): (0, 0) for x in (5, 10, 15, 20)}
    pend = {c: (0, p) for c, p in wave(sorted(pend), 0.55, 2.2).items()}
    for c in pend: mp.put(*c, 'M')
    lanes = pendulum_lanes(mp, pend)
    populate(mp, mid, 'Z', 6, 111); populate(mp, mid, 'V', 1, 112)
    populate(mp, right, 'Z', 4, 113, avoid={(19, 3)})
    populate(mp, hall, 'Z', 4, 114, avoid=lanes | {(21, 10)})
    populate(mp, low, 'Z', 6, 115, avoid={(21, 12), (20, 12)}); populate(mp, low, 'V', 1, 116)
    populate(mp, mid, 'C', 1, 117, near_door=2); populate(mp, right, 'C', 1, 118, near_door=2)
    populate(mp, low, 'C', 1, 119, near_door=2)
    return {"name": "Level_11", "ammo": 3, "map": mp.rows(),
            "buttons": [[[8, 15], [[6, 14]]]],
            "pendulums": pend,
            "furniture": [["Barrel", 11, 3, 0], ["Barrel", 16, 13, 0], ["Table", 20, 6, 0], ["Bench", 9, 12, 0]]}


def level12():
    """Fire in rows over the top, the blue key at its far end; back along a band of spikes rising
    in a wave to the red key; down through the zombies to a button ringed with fire."""
    mp = Map(23, 17)
    start = mp.carve(1, 1, 5, 5)
    top = mp.carve(7, 1, 21, 5)
    band = mp.carve(1, 7, 21, 9)
    low = mp.carve(1, 11, 9, 15)
    mid = mp.carve(11, 11, 15, 15)
    end = mp.carve(17, 11, 21, 15)
    mp.put(6, 3, 'D'); mp.put(17, 6, 'b'); mp.put(2, 10, 'r')
    mp.put(10, 13, 'D'); mp.put(16, 13, 'D'); mp.put(19, 16, 'E')
    mp.put(2, 2, 'P'); mp.put(3, 4, 'C')
    mp.put(20, 3, 'B'); mp.put(2, 8, 'R'); mp.put(20, 12, 'L'); mp.put(13, 15, 'O')
    fire = {}
    cols = (9, 12, 15, 18)
    for i, x in enumerate(cols):
        for y in (2, 4):
            mp.put(x, y, 'F'); fire[(x, y)] = round((i * 1.0 + (0 if y == 2 else 2.5)) % 5, 2)
    for x in (12, 14):
        mp.put(x, 15, 'F'); fire[(x, 15)] = 0 if x == 12 else 2.5
    field = [(x, y) for y in (7, 8, 9) for x in range(6, 17)]
    spikes = {}
    for x, y in field:
        mp.put(x, y, 'S'); spikes[(x, y)] = round(((16 - x) * 0.375) % 3, 3)
    populate(mp, top, 'Z', 8, 121, avoid={(20, 3)}); populate(mp, top, 'V', 1, 122)
    populate(mp, (1, 7, 5, 9), 'Z', 2, 123, avoid={(2, 8)})
    populate(mp, (17, 7, 21, 9), 'Z', 2, 124, near_door=2.5)
    populate(mp, low, 'Z', 5, 125); populate(mp, low, 'V', 1, 126)
    populate(mp, mid, 'Z', 1, 127, near_door=2.8)
    populate(mp, top, 'C', 1, 128, near_door=2); populate(mp, low, 'C', 1, 129, near_door=2)
    populate(mp, (17, 7, 21, 9), 'C', 1, 130, near_door=1.5)
    return {"name": "Level_12", "ammo": 3, "map": mp.rows(),
            "buttons": [[[13, 15], [[16, 13]]]],
            "fire": fire, "spikes": spikes,
            "furniture": [["Barrel", 14, 3, 0], ["Barrel", 6, 13, 0], ["Table", 8, 1, 0], ["Crate", 21, 1, 0]]}


def level13():
    """Three keys in turn: green in the first room, blue behind the green door, red behind the
    blue one below the slime hall; the red door lets down to the way out."""
    mp = Map(23, 17)
    start = mp.carve(1, 1, 5, 5)
    a = mp.carve(7, 1, 12, 5)
    b = mp.carve(14, 1, 21, 5)
    hall = mp.carve(1, 7, 21, 10)
    end = mp.carve(1, 12, 5, 15)
    d = mp.carve(7, 12, 11, 15)
    c = mp.carve(13, 12, 21, 15)
    mp.put(3, 6, 'D'); mp.put(10, 6, 'D'); mp.put(13, 3, 'g')
    mp.put(18, 11, 'b'); mp.put(12, 13, 'r'); mp.put(6, 14, 'D'); mp.put(3, 16, 'E')
    for x in range(1, 22): mp.put(x, 9, '~')
    mp.put(2, 2, 'P'); mp.put(4, 3, 'C')
    mp.put(8, 2, 'G'); mp.put(20, 3, 'B'); mp.put(20, 14, 'R'); mp.put(2, 13, 'L')
    spikes = {}
    for i, (x, y) in enumerate([(9, 12), (9, 13), (9, 14), (9, 15)]):
        mp.put(x, y, 'S'); spikes[(x, y)] = (i % 2) * 1.5
    populate(mp, a, 'Z', 3, 131, avoid={(8, 2)})
    populate(mp, b, 'Z', 5, 132, avoid={(20, 3)}); populate(mp, b, 'V', 1, 133)
    populate(mp, hall, 'Z', 7, 134); populate(mp, hall, 'V', 1, 135)
    populate(mp, d, 'Z', 1, 136, near_door=2.5)
    populate(mp, c, 'Z', 4, 137, avoid={(20, 14)}); populate(mp, c, 'V', 1, 138)
    populate(mp, b, 'C', 1, 139, near_door=2); populate(mp, hall, 'C', 1, 140, near_door=2)
    populate(mp, c, 'C', 1, 141, near_door=2)
    return {"name": "Level_13", "ammo": 3, "map": mp.rows(),
            "spikes": spikes,
            "furniture": [["Barrel", 11, 8, 0], ["Barrel", 16, 13, 0], ["Table", 17, 1, 0], ["Bench", 5, 10, 0]]}


def level14():
    """Slime down the top hall past the red key, a pendulum snake with fire at its end, a button
    in the zombies' room and a fire-vent room before the way out."""
    mp = Map(23, 17)
    start = mp.carve(1, 1, 5, 5)
    top = mp.carve(7, 1, 21, 5)
    hall = mp.carve(1, 7, 21, 9)
    low = mp.carve(1, 11, 9, 15)
    fire_room = mp.carve(11, 11, 16, 15)
    end = mp.carve(18, 11, 21, 15)
    mp.put(6, 3, 'D'); mp.put(18, 6, 'r'); mp.put(1, 10, '.')
    mp.put(10, 13, 'D'); mp.put(17, 13, 'D'); mp.put(19, 16, 'E')
    for y in range(1, 6): mp.put(14, y, '~')
    mp.put(2, 2, 'P'); mp.put(3, 4, 'C')
    mp.put(20, 2, 'R'); mp.put(20, 12, 'L'); mp.put(2, 15, 'O')
    pend = {c: (0, p) for c, p in wave([(15, 8), (10, 8), (5, 8)], 0.7, 2.2).items()}
    for cc in pend: mp.put(*cc, 'M')
    fire = {}
    for i, x in enumerate((12, 14, 16)):
        for y in (11, 12, 14, 15):
            mp.put(x, y, 'F'); fire[(x, y)] = round((i * 1.2 + (0 if y < 13 else 2.5)) % 5, 2)
    lanes = pendulum_lanes(mp, pend)
    populate(mp, top, 'Z', 8, 141, avoid={(20, 2)}); populate(mp, top, 'V', 1, 142)
    populate(mp, hall, 'Z', 3, 143, avoid=lanes | {(1, 9)})
    populate(mp, low, 'V', 2, 145, avoid={(1, 11), (2, 11)}); populate(mp, low, 'Z', 6, 144, avoid={(1, 11), (2, 11)})
    populate(mp, fire_room, 'Z', 1, 146, near_door=2.5)
    populate(mp, top, 'C', 2, 147, near_door=2); populate(mp, low, 'C', 1, 148, near_door=2)
    return {"name": "Level_14", "ammo": 3, "map": mp.rows(),
            "buttons": [[[2, 15], [[10, 13]]]],
            "pendulums": pend, "fire": fire,
            "furniture": [["Barrel", 10, 2, 0], ["Barrel", 18, 4, 0], ["Barrel", 5, 13, 0], ["Table", 8, 5, 0], ["Crate", 7, 11, 0]]}


def level15():
    """The last: fire and the blue key, a spike wave with the button that opens the hall, the red
    key over the slime in the hall among the most zombies, the green one past pendulums below."""
    mp = Map(25, 19)
    start = mp.carve(1, 1, 5, 5)
    a = mp.carve(7, 1, 15, 5)
    b = mp.carve(17, 1, 23, 5)
    hall = mp.carve(1, 7, 23, 11)
    end = mp.carve(1, 13, 7, 17)
    d = mp.carve(9, 13, 15, 17)
    e = mp.carve(17, 13, 23, 17)
    mp.put(6, 3, 'D'); mp.put(16, 3, 'b'); mp.put(20, 6, 'D')
    mp.put(20, 12, 'D'); mp.put(12, 12, 'r'); mp.put(8, 15, 'g'); mp.put(4, 18, 'E')
    for y in range(7, 12): mp.put(10, y, '~')
    mp.put(2, 2, 'P'); mp.put(3, 4, 'C')
    mp.put(14, 3, 'B'); mp.put(4, 9, 'R'); mp.put(14, 16, 'G'); mp.put(2, 14, 'L'); mp.put(23, 1, 'O')
    fire = {}
    for i, x in enumerate((9, 11, 13)):
        for y in (2, 4):
            mp.put(x, y, 'F'); fire[(x, y)] = round((i * 0.9 + (0 if y == 2 else 2.5)) % 5, 2)
    spikes = {}
    for x in range(18, 23):
        for y in (2, 3, 4):
            mp.put(x, y, 'S'); spikes[(x, y)] = round(((x - 18) * 0.5) % 3, 2)
    pend = {c: (90, p) for c, p in wave([(11, 15), (13, 14)], 1.1, 2.2).items()}
    for cc in pend: mp.put(*cc, 'M')
    lanes = pendulum_lanes(mp, pend)
    populate(mp, a, 'Z', 3, 151, avoid={(14, 3)})
    populate(mp, b, 'Z', 1, 152, near_door=2.5, avoid={(23, 1)})
    populate(mp, hall, 'Z', 9, 153, avoid={(4, 9), (12, 12)}); populate(mp, hall, 'V', 2, 154)
    populate(mp, d, 'Z', 2, 155, near_door=2.5, avoid=lanes | {(14, 16)})
    populate(mp, e, 'Z', 5, 156); populate(mp, e, 'V', 1, 157)
    populate(mp, a, 'C', 1, 158, near_door=2); populate(mp, hall, 'C', 2, 159, near_door=2)
    populate(mp, e, 'C', 1, 160, near_door=2)
    return {"name": "Level_15", "ammo": 3, "map": mp.rows(),
            "buttons": [[[23, 1], [[20, 6]]]],
            "pendulums": pend, "fire": fire, "spikes": spikes,
            "furniture": [["Barrel", 8, 9, 0], ["Barrel", 17, 9, 0], ["Barrel", 20, 15, 0], ["Table", 7, 1, 0], ["Crate", 1, 11, 0]]}


def _furniture_on_floor(spec):
    """Furniture only on plain floor: a piece the rules put a zombie or a chest on moves to the
    nearest free cell of the same room (a barrel is moved to a crowd later anyway)."""
    m = [list(r) for r in spec['map']]
    taken = set()
    out = []
    for name, x, y, rot in spec.get('furniture', []):
        if m[y][x] != '.' or (x, y) in taken:
            free = [(a, b) for b in range(len(m)) for a in range(len(m[0])) if m[b][a] == '.' and (a, b) not in taken
                    and not any(m[b + dy][a + dx] in DOORS for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                                if 0 <= b + dy < len(m) and 0 <= a + dx < len(m[0]))]
            x, y = min(free, key=lambda q: math.hypot(q[0] - x, q[1] - y))
        taken.add((x, y))
        out.append([name, x, y, rot])
    spec['furniture'] = out
    return spec


def specs():
    return {n: _furniture_on_floor(f()) for n, f in ((11, level11), (12, level12), (13, level13), (14, level14), (15, level15))}


if __name__ == '__main__':
    for n, s in specs().items():
        print(s['name'])
        print('\n'.join(s['map']))
        m = s['map']
        cnt = {k: sum(r.count(k) for r in m) for k in 'ZVCSFM~'}
        print(cnt)
