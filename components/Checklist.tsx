import React from 'react';
import { Task, PhaseId, TaskFrequency } from '../types';
import { PHASES } from '../constants';
import { Calendar, Clock, RotateCcw, CheckCircle2 } from 'lucide-react';
import { CadenceContext, formatDateKeyForDisplay, getTaskSchedule } from '../services/cadence';

interface Props {
  tasks: Task[];
  activePhase: PhaseId;
  onToggle: (id: string) => void;
  onTaskClick?: (task: Task) => void;
  phaseOrder?: PhaseId[];
  cadenceContext: CadenceContext;
  isReadOnly?: boolean;
  nowOverride?: Date | null;
}

const Checklist: React.FC<Props> = ({ tasks, activePhase, onToggle, onTaskClick, phaseOrder, cadenceContext, isReadOnly = false, nowOverride = null }) => {
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

  const getCountdownLabel = (daysUntilDue: number | null, status: string) => {
    if (daysUntilDue === null) return '';
    if (status === 'overdue') return `${Math.abs(daysUntilDue)}d overdue`;
    if (daysUntilDue === 0) return 'today';
    if (daysUntilDue > 0) return `in ${daysUntilDue}d`;
    return `${Math.abs(daysUntilDue)}d overdue`;
  };

  const getStatusLabel = (task: Task, dueDateKey: string | null, status: string) => {
    if (status === 'overdue') return 'Overdue';
    if (status === 'due') return 'Due today';
    if (status === 'completed' && task.frequency === 'one-time') return 'Completed';
    if (dueDateKey) {
      return `Next due ${formatDateKeyForDisplay(dueDateKey, cadenceContext.timezone)}`;
    }
    return 'Next due';
  };

  const getStatusColor = (status: string) => {
    if (status === 'overdue') return 'text-rose-400';
    if (status === 'due') return 'text-amber-300';
    if (status === 'completed') return 'text-emerald-300';
    return 'text-slate-400';
  };

  const renderTaskSection = (label: string, icon: React.ReactNode, frequency: TaskFrequency, color: string) => {
    const filteredTasks = tasks.filter(t => t.frequency === frequency && isTaskAvailable(t));
    const now = nowOverride || new Date();

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
              onClick={() => {
                if (isReadOnly) return;
                onTaskClick?.(task);
                if (task.logParameter) return;
                onToggle(task.id);
              }}
              className={`flex items-center p-4 transition-colors group ${
                isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer active:bg-slate-800'
              }`}
            >
              {(() => {
                const schedule = getTaskSchedule(task, cadenceContext, now);
                const statusLabel = getStatusLabel(task, schedule.dueDateKey, schedule.status);
                const countdownLabel = (task.frequency === 'one-time' && schedule.status === 'completed')
                  ? ''
                  : getCountdownLabel(schedule.daysUntilDue, schedule.status);
                const statusColor = getStatusColor(schedule.status);
                return (
                  <>
                    <div className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center transition-all shrink-0 ${
                      schedule.isCompletedForPeriod ? 'bg-slate-100 border-slate-100 shadow-[0_0_8px_rgba(255,255,255,0.1)]' : 'border-slate-700 group-hover:border-slate-500'
                    }`}>
                      {schedule.isCompletedForPeriod && (
                        <svg className="w-3.5 h-3.5 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-medium leading-tight transition-all ${schedule.isCompletedForPeriod ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                          {task.title}{task.frequency === 'interval' && task.everyDays ? ` (every ${task.everyDays} days)` : ''}
                        </span>
                        {isReadOnly && task.logDerived && (
                          <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            Historical
                          </span>
                        )}
                      </div>
                      <div className={`text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between ${statusColor}`}>
                        <span>{statusLabel}</span>
                        {countdownLabel && <span className="text-[9px] font-medium text-slate-500">{countdownLabel}</span>}
                      </div>
                    </div>
                  </>
                );
              })()}
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
