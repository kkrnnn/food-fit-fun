import React from 'react';
import { ThreeGame } from './game/three/ThreeGame';

export const App: React.FC = () => {
  return (
    <div className="w-screen h-screen overflow-hidden relative select-none">
      <ThreeGame />
    </div>
  );
};
