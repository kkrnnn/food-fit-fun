import React from 'react';
import { LearningGame } from './features/learning/LearningGame';

export const App: React.FC = () => {
  return (
    <div className="w-screen h-screen overflow-hidden relative select-none">
      <LearningGame />
    </div>
  );
};
