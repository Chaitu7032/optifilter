import React, { createContext, useContext, useState } from 'react';

export type WorkstationMode = 'student' | 'clinic';

interface WorkstationContextType {
  mode: WorkstationMode;
  setMode: (mode: WorkstationMode) => void;
  isClinic: boolean;
  toggleMode: () => void;
}

const WorkstationContext = createContext<WorkstationContextType | undefined>(undefined);

export const WorkstationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<WorkstationMode>(() => {
    try {
      const saved = localStorage.getItem('optifilter_mode');
      if (saved === 'clinic' || saved === 'student') return saved;
    } catch {
      // ignore
    }
    return 'student'; // Student Mode is default
  });

  const setMode = (newMode: WorkstationMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem('optifilter_mode', newMode);
    } catch {
      // ignore
    }
  };

  const toggleMode = () => {
    setMode(mode === 'student' ? 'clinic' : 'student');
  };

  return (
    <WorkstationContext.Provider
      value={{
        mode,
        setMode,
        isClinic: mode === 'clinic',
        toggleMode,
      }}
    >
      {children}
    </WorkstationContext.Provider>
  );
};

export function useWorkstationMode(): WorkstationContextType {
  const context = useContext(WorkstationContext);
  if (!context) {
    throw new Error('useWorkstationMode must be used within a WorkstationProvider');
  }
  return context;
}
