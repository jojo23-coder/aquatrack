import React, { useState, useEffect } from 'react';
import { AquariumState, TankType, WaterLog, PhaseId, ParameterRange, ReminderSettings } from './types';
import { INITIAL_TASKS, MOCK_LOGS, PHASES } from './constants';
import WaterParameterChart from './components/WaterParameterChart';
import Checklist from './components/Checklist';
import LogForm from './components/LogForm';
import { LayoutDashboard, ClipboardList, PlusCircle, Settings, Droplets, Info, ChevronRight, CheckCircle2, Trash2, Edit2, History, AlertCircle, Target, X, Wind, Layers, Bell, Clock, Calendar, BellRing, RefreshCw } from 'lucide-react';

type Tab = 'dashboard' | 'logs' | 'roadmap' | 'settings';

const STORAGE_KEY = 'aquatrack_v1_data';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [highlightedParam, setHighlightedParam] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<WaterLog | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; content: string } | null>(null);
  const [showPhasePicker, setShowPhasePicker] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>('default');
  
  // Initialize state from localStorage or defaults
  const [aquarium, setAquarium] = useState<AquariumState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Basic validation: ensure we have the minimum required structure
        if (parsed.tankName && Array.isArray(parsed.logs)) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to load saved aquarium data", e);
      }
    }
    
    // Default initial state
    return {
      tankName: "Lava Rock 60L",
      tankSize: 60,
      tankType: TankType.PLANTED,
      startDate: new Date().toISOString().split('T')[0],
      logs: MOCK_LOGS,
      tasks: INITIAL_TASKS,
      currentPhase: 'phase_1_initial_start_day_0',
      reminderSettings: {
        enabled: false,
        dailyTime: "09:00",
        weeklyDay: 1, // Monday
        monthlyDay: 1
      },
      targets: {
        temperature: { min: 22.0, max: 24.0 },
        pH: { min: 6.4, max: 7.8 },
        ammonia: 0.0,
        nitrite: 0.0,
        nitrate: { min: 5.0, max: 30.0 },
        gh: { min: 5.0, max: 7.0 },
        kh: { min: 2.0, max: 4.0 }
      }
    };
  });

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(aquarium));
  }, [aquarium]);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationStatus(Notification.permission);
    }
  }, []);

  const activePhaseData = PHASES.find(p => p.id === aquarium.currentPhase)!;

  const handleToggleTask = (id: string) => {
    setAquarium(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    }));
  };

  const handleAddLog = (newLogData: Omit<WaterLog, 'id'>) => {
    if (editingLog) {
      setAquarium(prev => ({
        ...prev,
        logs: prev.logs.map(l => l.id === editingLog.id ? { ...newLogData, id: editingLog.id } : l)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }));
      setEditingLog(null);
    } else {
      const logWithId: WaterLog = {
        ...newLogData,
        id: Math.random().toString(36).substr(2, 9)
      };
      setAquarium(prev => ({
        ...prev,
        logs: [...prev.logs, logWithId].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }));
    }
    setActiveTab('dashboard');
  };

  const handleDeleteLog = (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      setAquarium(prev => ({
        ...prev,
        logs: prev.logs.filter(l => l.id !== id)
      }));
    }
  };

  const updateTarget = (key: keyof AquariumState['targets'], field: 'min' | 'max' | 'val', value: number) => {
    setAquarium(prev => {
      const newTargets = { ...prev.targets };
      if (key === 'ammonia' || key === 'nitrite') {
        (newTargets[key] as number) = value;
      } else {
        (newTargets[key] as ParameterRange)[field as 'min' | 'max'] = value;
      }
      return { ...prev, targets: newTargets };
    });
  };

  const updateReminder = (field: keyof ReminderSettings, value: any) => {
    setAquarium(prev => ({
      ...prev,
      reminderSettings: {
        ...prev.reminderSettings,
        [field]: value
      }
    }));

    if (field === 'enabled' && value === true) {
      requestNotificationPermission();
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
    if (permission === 'granted') {
      new Notification("AquaTrack Reminders Enabled", {
        body: "We'll ping you about unfinished tasks on your scheduled days.",
        icon: "/favicon.ico"
      });
    }
  };

  const resetAllData = () => {
    if (confirm("WARNING: This will delete all your logs and reset the tank to defaults. This cannot be undone. Proceed?")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const latestLog = aquarium.logs[aquarium.logs.length - 1] || {} as WaterLog;
  const currentPhDrop = latestLog.degassedPH && latestLog.pH ? (latestLog.degassedPH - latestLog.pH) : null;

  const getStatusColor = (id: string, value: number | undefined) => {
    if (value === undefined) return 'text-slate-400';
    const targets = aquarium.targets;
    const isCycling = ['phase_1_initial_start_day_0', 'phase_2_first_week_days_1_7', 'phase_3_active_cycling_weeks_2_4', 'phase_4_cycle_complete_week_4_5'].includes(aquarium.currentPhase);

    switch(id) {
      case 'temperature':
        return (value >= targets.temperature.min && value <= targets.temperature.max) ? 'text-emerald-400' : 'text-red-400';
      case 'pH':
        return (value >= targets.pH.min && value <= targets.pH.max) ? 'text-emerald-400' : 'text-amber-400';
      case 'ammonia':
        if (isCycling) return value <= 3.0 ? 'text-slate-300' : 'text-red-400';
        return value <= targets.ammonia ? 'text-emerald-400' : 'text-red-400';
      case 'nitrite':
        if (isCycling) return 'text-slate-300';
        return value <= targets.nitrite ? 'text-emerald-400' : 'text-red-400';
      case 'nitrate':
        return (value >= targets.nitrate.min && value <= targets.nitrate.max) ? 'text-emerald-400' : 'text-amber-400';
      case 'hardness':
        const ghOk = (latestLog.gh || 0) >= targets.gh.min && (latestLog.gh || 0) <= targets.gh.max;
        const khOk = (latestLog.kh || 0) >= targets.kh.min && (latestLog.kh || 0) <= targets.kh.max;
        return (ghOk && khOk) ? 'text-emerald-400' : 'text-red-400';
      case 'co2':
        if (currentPhDrop === null) return 'text-slate-500';
        return (currentPhDrop >= 0.8 && currentPhDrop <= 1.2) ? 'text-emerald-400' : 'text-amber-400';
      default:
        return 'text-slate-300';
    }
  };

  const stats = [
    { 
      id: 'temperature', 
      label: 'Temp', 
      value: `${latestLog.temperature || '--'}°C`, 
      paramValue: latestLog.temperature,
      note: "Stable temperature preferred; short excursions of ±0.5 °C are acceptable."
    },
    { 
      id: 'pH', 
      label: 'pH', 
      value: `${latestLog.pH || '--'}`, 
      paramValue: latestLog.pH,
      note: "CO2 ON Target: 6.4–7.0.\nCO2 OFF Target: 7.2–7.8.\nTarget Drop: ~1.0 unit (Degassed minus CO2-on). Latest pH drop: " + (currentPhDrop ? currentPhDrop.toFixed(2) : '--')
    },
    { 
      id: 'nitrate', 
      label: 'NO₃', 
      subLabel: 'Nitrate',
      value: `${latestLog.nitrate ?? '--'}`, 
      paramValue: latestLog.nitrate,
      note: "NO₃ (Nitrate) - The final product of the cycle. Recommended Range: 5.0–30.0 ppm for plants. High levels (>40 ppm) can stress shrimp."
    },
    { 
      id: 'ammonia', 
      label: 'NH₃', 
      subLabel: 'Ammonia',
      value: `${latestLog.ammonia ?? '--'}`, 
      paramValue: latestLog.ammonia,
      note: "NH₃ (Ammonia) - The first stage of biological waste. Cycling: 1.5–2.0 ppm target. Post-Cycle: Must be 0."
    },
    { 
      id: 'nitrite', 
      label: 'NO₂', 
      subLabel: 'Nitrite',
      value: `${latestLog.nitrite ?? '--'}`, 
      paramValue: latestLog.nitrite,
      note: "NO₂ (Nitrite) - Extremely toxic middle stage. Must be 0 before adding livestock."
    },
    { 
      id: 'hardness', 
      label: 'GH/KH', 
      value: `${latestLog.gh ?? '--'}/${latestLog.kh ?? '--'}`, 
      paramValue: latestLog.gh,
      note: "GH: General Hardness (Target 5.5–6.0).\nKH: Carbonate Hardness (Target 3.0)."
    },
  ];

  const toggleHighlight = (id: string) => {
    setHighlightedParam(prev => prev === id ? null : id);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-4 pt-4 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-extrabold text-white mb-1">Status</h1>
                <p className="text-slate-400 text-sm font-medium">{aquarium.tankName} • {aquarium.tankSize}L</p>
              </div>
              <div className="flex gap-2">
                {aquarium.reminderSettings.enabled && (
                  <div className="bg-slate-900/80 p-2 rounded-2xl border border-slate-800 flex items-center justify-center">
                    <BellRing className="w-4 h-4 text-emerald-400 animate-pulse" />
                  </div>
                )}
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="bg-slate-900/80 p-2 rounded-2xl border border-slate-800 flex items-center gap-2 active:scale-95 transition-all"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 px-4">
              {stats.map((stat) => {
                const colorClass = getStatusColor(stat.id, stat.paramValue);
                const isWarning = colorClass === 'text-red-400' || colorClass === 'text-amber-400';
                
                return (
                  <div key={stat.id} className="relative group">
                    <button 
                      onClick={() => toggleHighlight(stat.id)}
                      className={`w-full bg-slate-900/50 border p-3 pt-4 rounded-2xl flex flex-col justify-center items-center text-center transition-all active:scale-95 overflow-hidden min-h-[85px] ${
                        highlightedParam === stat.id 
                        ? 'border-slate-300 bg-slate-300/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                        : 'border-slate-800'
                      }`}
                    >
                      {isWarning && <div className="absolute top-1 left-1"><AlertCircle className={`w-2 h-2 ${colorClass}`} /></div>}
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{stat.label}</span>
                        {stat.subLabel && <span className="text-[7px] font-bold text-slate-500 uppercase -mt-0.5 mb-1">{stat.subLabel}</span>}
                      </div>
                      <p className={`text-[14px] font-bold mt-auto ${colorClass}`}>{stat.value}</p>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoModal({ title: stat.label + (stat.subLabel ? ` (${stat.subLabel})` : ''), content: stat.note });
                      }}
                      className="absolute top-1.5 right-1.5 p-1 bg-slate-800 rounded-full border border-slate-700 text-slate-500 hover:text-white transition-colors z-10"
                    >
                      <Info className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="px-4">
              <WaterParameterChart data={aquarium.logs} highlightedParam={highlightedParam} targets={aquarium.targets} />
            </div>

            <div className="px-4 pb-24">
               <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="bg-slate-100/10 p-2 rounded-xl">
                      {activePhaseData.id === 'phase_co2_trimming' ? <Wind className="w-5 h-5 text-slate-300" /> : <Droplets className="w-5 h-5 text-slate-300" />}
                     </div>
                     <div>
                       <h3 className="font-bold text-white text-sm">{activePhaseData.name.split(' (')[0]}</h3>
                       <p className="text-[10px] text-slate-400">Current Phase Guidance</p>
                     </div>
                   </div>
                   <button 
                    onClick={() => setShowPhasePicker(true)}
                    className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                   >
                     <Layers className="w-4 h-4" />
                   </button>
                 </div>
                 
                 <div className="space-y-2">
                    {activePhaseData.objectives.slice(0, 3).map((obj, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{obj}</span>
                      </div>
                    ))}
                 </div>

                 <div className="grid grid-cols-2 gap-2">
                   <button 
                    onClick={() => setActiveTab('roadmap')}
                    className="py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 border border-slate-700 active:scale-95"
                   >
                     Full Manual
                   </button>
                   <button 
                    onClick={() => setActiveTab('logs')}
                    className="py-3 bg-slate-100 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-white/5"
                   >
                     Log Progress <ChevronRight className="w-4 h-4" />
                   </button>
                 </div>
               </div>
            </div>
          </div>
        );
      case 'logs':
        return (
          <div className="px-4 space-y-6 pb-24 animate-in fade-in duration-300 pt-4">
            <div className="flex justify-between items-end">
              <h1 className="text-3xl font-extrabold text-white">Entry</h1>
              {editingLog && (
                <button 
                  onClick={() => setEditingLog(null)}
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            
            <LogForm onAdd={handleAddLog} initialData={editingLog || undefined} />
            
            <div className="space-y-4 mt-8">
              <div className="flex items-center gap-2 px-1">
                <History className="w-4 h-4 text-slate-500" />
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">History</h2>
              </div>
              
              <div className="space-y-3">
                {[...aquarium.logs].reverse().map(log => (
                  <div key={log.id} className="bg-slate-900/40 border border-slate-800/60 p-4 rounded-2xl flex items-center justify-between group">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500">{new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <div className="flex gap-3 items-center">
                        <span className="text-xs font-bold text-white">NH₃: {log.ammonia}</span>
                        <span className="text-[8px] text-slate-600">•</span>
                        <span className="text-xs font-bold text-white">NO₂: {log.nitrite}</span>
                        <span className="text-[8px] text-slate-600">•</span>
                        <span className="text-xs font-bold text-white">pH: {log.pH}</span>
                        {log.bubbleRate && (
                          <>
                            <span className="text-[8px] text-slate-600">•</span>
                            <span className="text-xs font-bold text-slate-300">CO2: {log.bubbleRate}bps</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setEditingLog(log); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="p-2.5 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteLog(log.id)}
                        className="p-2.5 bg-red-900/10 rounded-xl text-red-500 hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'roadmap':
        return (
          <div className="px-4 space-y-6 pb-24 animate-in fade-in duration-300 pt-4">
             <h1 className="text-3xl font-extrabold text-white">Manual</h1>
             
             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
               {PHASES.map(phase => (
                 <button 
                  key={phase.id}
                  onClick={() => setAquarium(prev => ({...prev, currentPhase: phase.id as PhaseId}))}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border flex items-center gap-2 ${
                    aquarium.currentPhase === phase.id 
                    ? 'bg-slate-100 border-slate-100 text-slate-950 shadow-lg shadow-white/5' 
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                 >
                   {phase.name.split(' — ')[0]}
                   {aquarium.currentPhase === phase.id && <div className="w-1.5 h-1.5 bg-slate-950 rounded-full animate-pulse" />}
                 </button>
               ))}
             </div>

             <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-5 space-y-4">
               <h3 className="text-sm font-bold text-white flex items-center gap-2">
                 <span className="text-lg">{PHASES.find(p => p.id === aquarium.currentPhase)?.icon}</span> 
                 {PHASES.find(p => p.id === aquarium.currentPhase)?.name}
               </h3>
               
               <div className="space-y-3">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Instructions</h4>
                 <ul className="space-y-2">
                   {PHASES.find(p => p.id === aquarium.currentPhase)?.instructions.map((ins, i) => (
                     <li key={i} className="text-xs text-slate-300 leading-relaxed flex gap-2">
                       <span className="text-slate-400 font-bold">•</span> {ins}
                     </li>
                   ))}
                 </ul>
               </div>

               <div className="pt-4 border-t border-slate-800 space-y-3">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Expected Normal Behavior</h4>
                 <ul className="space-y-2">
                   {PHASES.find(p => p.id === aquarium.currentPhase)?.expected.map((exp, i) => (
                     <li key={i} className="text-xs text-slate-400 italic flex gap-2">
                       <span className="text-slate-600 shrink-0">→</span> {exp}
                     </li>
                   ))}
                 </ul>
               </div>
             </div>

             <Checklist 
              tasks={aquarium.tasks} 
              activePhase={aquarium.currentPhase} 
              onToggle={handleToggleTask} 
             />
          </div>
        );
      case 'settings':
        const reminderInputClasses = "w-full bg-slate-800 border border-slate-700 h-14 rounded-2xl text-base text-white outline-none focus:ring-2 focus:ring-slate-400 text-center transition-all appearance-none cursor-pointer";
        
        return (
          <div className="px-4 space-y-6 pb-24 animate-in fade-in duration-300 pt-4">
            <h1 className="text-3xl font-extrabold text-white">Setup</h1>
            
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-6">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">Tank Identity</label>
                <div className="space-y-3">
                  <input 
                    type="text"
                    placeholder="Tank Name"
                    value={aquarium.tankName}
                    onChange={e => setAquarium(prev => ({...prev, tankName: e.target.value}))}
                    className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-slate-500"
                  />
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      placeholder="Volume (L)"
                      value={aquarium.tankSize}
                      onChange={e => setAquarium(prev => ({...prev, tankSize: parseInt(e.target.value) || 0}))}
                      className="flex-1 bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    <select 
                      value={aquarium.tankType}
                      onChange={e => setAquarium(prev => ({...prev, tankType: e.target.value as TankType}))}
                      className="flex-1 bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-slate-500 appearance-none"
                    >
                      <option value={TankType.PLANTED}>Planted</option>
                      <option value={TankType.FRESHWATER}>Freshwater</option>
                      <option value={TankType.SALTWATER}>Saltwater</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Reminders Section */}
              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reminders & Alerts</h4>
                  <Bell className={`w-3.5 h-3.5 transition-colors ${aquarium.reminderSettings.enabled ? 'text-white' : 'text-slate-400'}`} />
                </div>
                
                <div className="space-y-4">
                  <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-[28px] flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-sm font-bold text-white">Enable Notifications</p>
                      <p className="text-[10px] text-slate-500 font-medium">Ping for unfinished tasks</p>
                    </div>
                    <button 
                      onClick={() => updateReminder('enabled', !aquarium.reminderSettings.enabled)}
                      className={`w-12 h-7 rounded-full transition-all relative ${aquarium.reminderSettings.enabled ? 'bg-slate-300' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${aquarium.reminderSettings.enabled ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  {notificationStatus === 'denied' && aquarium.reminderSettings.enabled && (
                    <div className="bg-red-950/20 border border-red-900/30 p-3 rounded-xl flex gap-2 items-start">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-red-400 leading-tight">Notifications are blocked by your browser. Please enable them in site settings.</p>
                    </div>
                  )}

                  <div className={`space-y-5 transition-opacity duration-300 ${aquarium.reminderSettings.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5 ml-1.5">
                          <Clock className="w-2.5 h-2.5" /> Daily Time
                        </label>
                        <input 
                          type="time"
                          value={aquarium.reminderSettings.dailyTime}
                          onChange={e => updateReminder('dailyTime', e.target.value)}
                          className={reminderInputClasses}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5 ml-1.5">
                          <Calendar className="w-2.5 h-2.5" /> Weekly Day
                        </label>
                        <select 
                          value={aquarium.reminderSettings.weeklyDay}
                          onChange={e => updateReminder('weeklyDay', parseInt(e.target.value))}
                          className={reminderInputClasses}
                          style={{ textAlignLast: 'center' }}
                        >
                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                            <option key={i} value={i}>{day}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5 ml-1.5">
                          <Calendar className="w-2.5 h-2.5" /> Monthly Day (1-28)
                        </label>
                        <input 
                          type="number"
                          min="1" max="28"
                          value={aquarium.reminderSettings.monthlyDay}
                          onChange={e => updateReminder('monthlyDay', parseInt(e.target.value) || 1)}
                          className={reminderInputClasses}
                        />
                      </div>
                      <div className="flex items-end pb-3 text-[10px] text-slate-600 font-medium italic">
                        Every month
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Safe Target Ranges</h4>
                  <Target className="w-3.5 h-3.5 text-slate-400" />
                </div>
                
                <div className="space-y-5">
                  {[
                    { id: 'temperature', label: 'Temp (°C)', key: 'temperature' },
                    { id: 'pH', label: 'pH Level', key: 'pH' },
                    { id: 'nitrate', label: 'Nitrate (ppm)', key: 'nitrate' },
                    { id: 'gh', label: 'GH (dGH)', key: 'gh' },
                    { id: 'kh', label: 'KH (dKH)', key: 'kh' },
                  ].map(target => (
                    <div key={target.id} className="grid grid-cols-2 gap-3 items-end">
                      <div className="col-span-2">
                        <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block ml-1">{target.label}</label>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">MIN</span>
                        <input 
                          type="number" step="0.1"
                          value={(aquarium.targets[target.key as keyof typeof aquarium.targets] as ParameterRange).min}
                          onChange={e => updateTarget(target.key as any, 'min', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-800/50 border border-slate-700 p-3 pl-10 rounded-xl text-xs text-white text-right outline-none"
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">MAX</span>
                        <input 
                          type="number" step="0.1"
                          value={(aquarium.targets[target.key as keyof typeof aquarium.targets] as ParameterRange).max}
                          onChange={e => updateTarget(target.key as any, 'max', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-800/50 border border-slate-700 p-3 pl-10 rounded-xl text-xs text-white text-right outline-none"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block ml-1">Ammonia Max</label>
                      <input 
                        type="number" step="0.01"
                        value={aquarium.targets.ammonia}
                        onChange={e => updateTarget('ammonia', 'val', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800/50 border border-slate-700 p-3 rounded-xl text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block ml-1">Nitrite Max</label>
                      <input 
                        type="number" step="0.01"
                        value={aquarium.targets.nitrite}
                        onChange={e => updateTarget('nitrite', 'val', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800/50 border border-slate-700 p-3 rounded-xl text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Management Section */}
              <div className="pt-8 border-t border-slate-800">
                <button 
                  onClick={resetAllData}
                  className="w-full py-4 bg-red-950/20 hover:bg-red-900/30 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all border border-red-900/30 active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" /> Reset All Data
                </button>
              </div>
            </div>
            <p className="text-center text-slate-600 text-[10px] px-8 pb-4">
              AquaTrack v1.4 • Locally Persistent Storage
            </p>
          </div>
        );
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-950 flex flex-col pt-8 safe-area-pt">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
        {renderContent()}
      </div>

      {infoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setInfoModal(null)} />
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl">
            <button 
              onClick={() => setInfoModal(null)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-slate-400" />
              {infoModal.title} Guidance
            </h3>
            <div className="text-[13px] text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              {infoModal.content}
            </div>
            <button 
              onClick={() => setInfoModal(null)}
              className="w-full mt-6 py-4 bg-slate-100 hover:bg-white text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-white/5 active:scale-[0.98]"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {showPhasePicker && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in slide-in-from-bottom-full duration-300">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowPhasePicker(false)} />
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-[40px] p-8 w-full max-w-md relative z-10 shadow-2xl safe-area-pb">
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-6" />
            <h3 className="text-xl font-black text-white mb-6 text-center">Switch Phase</h3>
            <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto no-scrollbar pb-4 px-1">
              {PHASES.map(phase => (
                <button 
                  key={phase.id}
                  onClick={() => {
                    setAquarium(prev => ({...prev, currentPhase: phase.id as PhaseId}));
                    setShowPhasePicker(false);
                  }}
                  className={`p-5 rounded-[24px] border text-left flex items-center gap-4 transition-all active:scale-95 ${
                    aquarium.currentPhase === phase.id 
                    ? 'bg-slate-100 border-slate-100 shadow-lg shadow-white/5' 
                    : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-2xl grayscale-[0.5] group-hover:grayscale-0">{phase.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${aquarium.currentPhase === phase.id ? 'text-slate-950' : 'text-white'}`}>
                      {phase.name.split(' — ')[1] || phase.name}
                    </p>
                    <p className={`text-[10px] font-medium truncate ${aquarium.currentPhase === phase.id ? 'text-slate-700' : 'text-slate-500'}`}>
                      {phase.objectives[0]}
                    </p>
                  </div>
                  {aquarium.currentPhase === phase.id && (
                    <div className="bg-slate-950 p-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowPhasePicker(false)}
              className="w-full mt-6 py-4 bg-slate-800 text-slate-300 font-bold rounded-2xl active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-slate-800/50 safe-area-pb z-50">
        <div className="max-w-md mx-auto grid grid-cols-4 h-20">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-500'}`}
          >
            <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'fill-white/10' : ''}`} />
            <span className="text-[9px] font-bold tracking-tight">Status</span>
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'logs' ? 'text-white' : 'text-slate-500'}`}
          >
            <PlusCircle className={`w-5 h-5 ${activeTab === 'logs' ? 'fill-white/10' : ''}`} />
            <span className="text-[9px] font-bold tracking-tight">Entry</span>
          </button>
          <button 
            onClick={() => setActiveTab('roadmap')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'roadmap' ? 'text-white' : 'text-slate-500'}`}
          >
            <ClipboardList className={`w-5 h-5 ${activeTab === 'roadmap' ? 'fill-white/10' : ''}`} />
            <span className="text-[9px] font-bold tracking-tight">Manual</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'settings' ? 'text-white' : 'text-slate-500'}`}
          >
            <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'fill-white/10' : ''}`} />
            <span className="text-[9px] font-bold tracking-tight">Setup</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;