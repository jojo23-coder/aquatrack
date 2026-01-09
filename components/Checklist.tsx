import React from 'react';
import { Task, PhaseId, TaskFrequency } from '../types';
import { PHASES } from '../constants';
import { Calendar, Clock, RotateCcw, CheckCircle2 } from 'lucide-react';

interface Props {
  tasks: Task[];
  activePhase: PhaseId;
  onToggle: (id: string) => void;
  phaseOrder?: PhaseId[];
}

const Checklist: React.FC<Props> = ({ tasks, activePhase, onToggle, phaseOrder }) => {
  // Helper to determine if a task is available in the current phase
  const isTaskAvailable = (task: Task) => {
    if (task.frequency === 'one-time') {
      return task.phaseId === activePhase;
    }
    
    if (!task.startPhaseId) return true;
    
    const orderedPhases = phaseOrder && phaseOrder.length ? phaseOrder : PHASES.map(p => p.id);
    const activeIndex = orderedPhases.indexOf(activePhase);
    const startIndex = orderedPhases.indexOf(task.startPhaseId);
    const endIndex = task.endPhaseId ? orderedPhases.indexOf(task.endPhaseId) : -1;
    
    if (activeIndex === -1 || startIndex === -1) {
      return task.startPhaseId === activePhase;
    }

    if (endIndex !== -1 && activeIndex > endIndex) {
      return false;
    }
    
    return activeIndex >= startIndex;
  };

  const groups: { label: string; icon: React.ReactNode; frequency: TaskFrequency; color: string }[] = [
    { label: 'At Start', icon: <CheckCircle2 className="w-3.5 h-3.5" />, frequency: 'one-time', color: 'text-slate-300' },
    { label: 'Daily Routine', icon: <RotateCcw className="w-3.5 h-3.5" />, frequency: 'daily', color: 'text-slate-400' },
    { label: 'Interval Routine', icon: <RotateCcw className="w-3.5 h-3.5" />, frequency: 'interval', color: 'text-slate-500' },
    { label: 'Weekly Maintenance', icon: <Calendar className="w-3.5 h-3.5" />, frequency: 'weekly', color: 'text-slate-500' },
    { label: 'Monthly Deep Clean', icon: <Clock className="w-3.5 h-3.5" />, frequency: 'monthly', color: 'text-slate-600' },
  ];

  const renderTaskSection = (label: string, icon: React.ReactNode, frequency: TaskFrequency, color: string) => {
    const filteredTasks = tasks.filter(t => t.frequency === frequency && isTaskAvailable(t));

    if (filteredTasks.length === 0) return null;

    return (
      <div key={frequency} className="space-y-3">
        <div className="flex items-center gap-2 px-2">
          <span className={`${color} bg-slate-900 p-1.5 rounded-lg border border-slate-800`}>
            {icon}
          </span>
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">{label}</h4>
        </div>
        
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800/50">
          {filteredTasks.map(task => (
            <div 
              key={task.id}
              onClick={() => onToggle(task.id)}
              className="flex items-center p-4 cursor-pointer active:bg-slate-800 transition-colors group"
            >
              <div className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center transition-all shrink-0 ${
                task.completed ? 'bg-slate-100 border-slate-100 shadow-[0_0_8px_rgba(255,255,255,0.1)]' : 'border-slate-700 group-hover:border-slate-500'
              }`}>
                {task.completed && (
                  <svg className="w-3.5 h-3.5 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`text-[13px] font-medium leading-tight transition-all ${task.completed ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                {task.title}{task.frequency === 'interval' && task.everyDays ? ` (every ${task.everyDays} days)` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 mt-4">
      {groups.map(group => renderTaskSection(group.label, group.icon, group.frequency, group.color))}
    </div>
  );
};

export default Checklist;
