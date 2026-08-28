import { createGameApp, type GameAppHandle } from '../composition/create-game-app.js';

export function bootstrapGame(documentRef: Document = document): GameAppHandle {
  return createGameApp(documentRef);
}
