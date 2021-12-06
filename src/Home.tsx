import React, {MutableRefObject} from 'react';
import {Provider, useEvent, useStore} from 'effector-react/scope'
import * as PIXI from 'pixi.js'
import {createGame} from './game/model/run'
import {ViewModel as GameModel} from './game/model/game'

// @ts-ignore
import shooterUrl from './assets/shooter.png'
// @ts-ignore
import zombieUrl from './assets/zombie.png'
// @ts-ignore
import floorUrl from './assets/floor.jpg';
import {GameSize} from "./game/model/types";

function Game() {
  const nodeRef = React.useRef<HTMLDivElement>(null)
  useApplication(nodeRef)
  return (
    <div className="Home" ref={nodeRef}/>
  )
}

function Home() {
  const [scope, setScope] = React.useState(() => createGame({size: {w: 10, h: 10}, interval: 100}).scope)
  return (
    <Provider value={scope}>
      <Game/>
    </Provider>
  )
}

function useApplication(nodeRef: MutableRefObject<HTMLElement>) {
  const gameStart = useEvent(GameModel.startGameFx)

  const gameSize = useStore(GameModel.$gameSize)
  const teamA = useStore(GameModel.$teamA)
  const teamB = useStore(GameModel.$teamB)

  const appRef = React.useRef<PIXI.Application>(null);
  const gameFieldRef = React.useRef<PIXI.Container>(null);
  const gameRef = React.useRef({singleFieldSize: 0})
  const zombieTextureRef = React.useRef<PIXI.Texture>(null)
  const shooterTextureRef = React.useRef<PIXI.Texture>(null)

  React.useEffect(() => {
    let app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
    })
    nodeRef.current.appendChild(app.view)
    appRef.current = app;

    const gameField = createGameField(app.screen);
    const screenSquareSize = Math.min(app.screen.width, app.screen.height);
    app.stage.addChild(gameField)
    gameFieldRef.current = gameField;

    const singleFieldSize = screenSquareSize / gameSize.h // assuming game is a square
    gameRef.current = {singleFieldSize}

    const floor = createFloor(singleFieldSize, gameSize)
    gameField.addChild(floor)

    zombieTextureRef.current = PIXI.Texture.from(zombieUrl);
    shooterTextureRef.current = PIXI.Texture.from(shooterUrl);

    return () => {
      app.destroy(true, {
        children: true,
        texture: true,
      })
      app = null
    }
  }, [])

  React.useEffect(() => {
    // TODO: move to the upper scope, to save cache between updates
    let localA: Record<string, Unit> = {}
    let localB: Record<string, Unit> = {}

    Object.values(teamA).forEach(bot => {
      if (bot.health <= 0) return // TODO: replace with bloody puddle
      localA[bot.id] = createUnit(bot.id, shooterTextureRef.current, gameRef.current.singleFieldSize)
        .setRotation(bot.viewDir)
        .setPosition(bot.position)
        .addTo(gameFieldRef.current);
    })

    Object.values(teamB).forEach(bot => {
      if (bot.health <= 0) return
      localB[bot.id] = createUnit(bot.id, zombieTextureRef.current, gameRef.current.singleFieldSize)
        .setRotation(bot.viewDir)
        .setPosition(bot.position)
        .addTo(gameFieldRef.current);
    })

    return () => {
      Object.values(localA).forEach(unit => unit.destroy())
      localA = null

      Object.values(localB).forEach(unit => unit.destroy())
      localB = null
    }
  }, [teamA, teamB])

  React.useEffect(() => {
    gameStart('what')
  }, [])
}

function createGameField(parentScreen: PIXI.Rectangle) {
  const gameField = new PIXI.Container();
  const size = Math.min(parentScreen.width, parentScreen.height);
  gameField.width = size;
  gameField.height = size;
  gameField.pivot.x = size / 2;
  gameField.pivot.y = size / 2;
  gameField.x = parentScreen.width / 2;
  gameField.y = parentScreen.height / 2;
  return gameField
}

function createFloor(fieldSize: number, gameSize: GameSize) {
  const texture = PIXI.Texture.from(floorUrl)
  const sprite = new PIXI.Sprite(texture);
  sprite.width = fieldSize * gameSize.w;
  sprite.height = fieldSize * gameSize.h;
  return sprite
}

const rotations = {
  n: 0,
  ne: 45,
  e: 90,
  se: 135,
  s: 180,
  sw: 225,
  w: 270,
  nw: 315,
} as const;

type Unit = ReturnType<typeof createUnit>;

function createUnit(id: string, texture: PIXI.Texture, fieldSize: number) {
  let sprite = new PIXI.Sprite(texture);
  sprite.width = fieldSize;
  sprite.height = fieldSize;
  sprite.anchor.set(0.5);

  let api = {
    sprite,
    setPosition({y, x}: { y: number; x: number }) {
      sprite.x = x * fieldSize - Math.abs(sprite.width - fieldSize) / 2 + sprite.width / 2;
      sprite.y = y * fieldSize - Math.abs(sprite.height - fieldSize) / 2 + sprite.width / 2;
      return api
    },
    setRotation(rotation: keyof typeof rotations) {
      sprite.angle = rotations[rotation];
      return api;
    },
    addTo(gameField: PIXI.Container) {
      gameField.addChild(sprite)
      return api;
    },
    destroy(gameField?: PIXI.Container) {
      if (gameField) gameField.removeChild(sprite);
      else sprite.destroy()
      sprite = null
      api = null;
    }
  }
  api.setRotation('n')
  return api
}


export default Home;

