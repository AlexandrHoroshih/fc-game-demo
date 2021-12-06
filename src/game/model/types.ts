export type Y = number;
export type X = number;
export type GameSize = { w: number; h: number };
export type Position = { x: X; y: Y };

export type Id = string;
export type Health = number;
export type Bot = {
  id: Id;
  name?: string;
  position: Position;
  health: Health;
  viewDir: Dir;
};

// 0 - is 12 o'clock
export const dir = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export type Dir = typeof dir[number];

export type Move = {
  type: "move";
  dir: Dir;
  id: Id;
};

export type Rotate = {
  type: "rotate";
  dir: Dir;
  id: Id;
};

export type Shoot = {
  type: "shoot";
  id: Id;
  dir?: undefined;
};

export type Nothing = {
  type: "nothing";
  dir?: Dir;
  id: Id;
};

export type Action = Move | Rotate | Shoot | Nothing | undefined;

export type Stash = Record<string, any>;

export type GameState = {
  myBots: Bot[];
  enemyBots: Bot[];
  stash: Stash;
  lib: {
    getDir: (me: Bot, target: Bot) => Dir;
    inGunRange: (me: Bot, target: Bot) => boolean;
    getDistance: (me: Bot, target: Bot) => number;
    findClosest: (me: Bot, targets: Bot[]) => Bot;
  };
  meta: {
    field: GameSize;
  }
}
