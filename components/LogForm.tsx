import React, { useState, useEffect } from 'react';
import { WaterLog } from '../types';

interface Props {
  onAdd: (log: Omit<WaterLog, 'id'>) => void;
  initialData?: WaterLog;
}

const LogForm: React.FC<Props> = ({ onAdd, initialData }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    temperature: '23.0',
    pH: '7.0',
    ammonia: '0',
    nitrite: '0',
    nitrate: '0',
    gh: '6.0',
    kh: '3.0',
    degassedPH: '',
    bubbleRate: '',
    notes: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        date: initialData.date,
        temperature: String(initialData.temperature ?? ''),
        pH: String(initialData.pH ?? ''),
        ammonia: String(initialData.ammonia ?? ''),
        nitrite: String(initialData.nitrite ?? ''),
        nitrate: String(initialData.nitrate ?? ''),
        gh: String(initialData.gh ?? 6.0),
        kh: String(initialData.kh ?? 3.0),
        degassedPH: initialData.degassedPH === undefined ? '' : String(initialData.degassedPH),
        bubbleRate: initialData.bubbleRate === undefined ? '' : String(initialData.bubbleRate),
        notes: initialData.notes || ''
      });
    }
  }, [initialData]);

  const sanitizeDecimalInput = (value: string) => {
    const normalized = value.replace(/,/g, '.').replace(/\s+/g, '');
    let cleaned = '';
    let hasDot = false;
    for (const char of normalized) {
      if (char >= '0' && char <= '9') {
        cleaned += char;
        continue;
      }
      if (char === '.' && !hasDot) {
        cleaned += char;
        hasDot = true;
      }
    }
    return cleaned;
  };

  const toNumber = (value: string, fallback = 0) => {
    if (!value) return fallback;
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const toOptionalNumber = (value: string) => {
    if (!value) return undefined;
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      date: formData.date,
      temperature: toNumber(formData.temperature, 0),
      pH: toNumber(formData.pH, 0),
      ammonia: toNumber(formData.ammonia, 0),
      nitrite: toNumber(formData.nitrite, 0),
      nitrate: toNumber(formData.nitrate, 0),
      gh: toNumber(formData.gh, 0),
      kh: toNumber(formData.kh, 0),
      degassedPH: toOptionalNumber(formData.degassedPH),
      bubbleRate: toOptionalNumber(formData.bubbleRate),
      notes: formData.notes
    });
    if (!initialData) {
      setFormData({
        ...formData,
        date: new Date().toISOString().split('T')[0],
        notes: '',
        degassedPH: '',
        bubbleRate: ''
      });
    }
  };

  const labelClasses = "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1 block";
  const inputClasses = "w-full p-3.5 bg-slate-800 border border-slate-700 rounded-2xl text-base text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-slate-400 outline-none transition-all appearance-none";

  const phDrop = (() => {
    const degassed = parseFloat(formData.degassedPH);
    const current = parseFloat(formData.pH);
    if (Number.isNaN(degassed) || Number.isNaN(current)) {
      return null;
    }
    return (degassed - current).toFixed(2);
  })();

  return (
    <form onSubmit={handleSubmit} className={`bg-slate-900/50 p-6 rounded-3xl border space-y-4 transition-all ${initialData ? 'border-slate-300 shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'border-slate-800'}`}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClasses}>Date</label>
          <input 
            type="date" 
            value={formData.date}
            onChange={e => setFormData({...formData, date: e.target.value})}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Temp (°C)</label>
          <input 
            type="text"
            inputMode="decimal"
            value={formData.temperature}
            onChange={e => setFormData({...formData, temperature: sanitizeDecimalInput(e.target.value)})}
            className={inputClasses}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={`${labelClasses} text-slate-400`}>Ammonia NH₃</label>
          <input 
            type="text"
            inputMode="decimal"
            value={formData.ammonia}
            onChange={e => setFormData({...formData, ammonia: sanitizeDecimalInput(e.target.value)})}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={`${labelClasses} text-slate-400`}>Nitrite NO₂</label>
          <input 
            type="text"
            inputMode="decimal"
            value={formData.nitrite}
            onChange={e => setFormData({...formData, nitrite: sanitizeDecimalInput(e.target.value)})}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={`${labelClasses} text-slate-400`}>Nitrate NO₃</label>
          <input 
            type="text"
            inputMode="decimal"
            value={formData.nitrate}
            onChange={e => setFormData({...formData, nitrate: sanitizeDecimalInput(e.target.value)})}
            className={inputClasses}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClasses}>pH (CO2 On)</label>
          <input 
            type="text"
            inputMode="decimal"
            value={formData.pH}
            onChange={e => setFormData({...formData, pH: sanitizeDecimalInput(e.target.value)})}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>GH</label>
          <input 
            type="text"
            inputMode="decimal"
            value={formData.gh}
            onChange={e => setFormData({...formData, gh: sanitizeDecimalInput(e.target.value)})}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>KH</label>
          <input 
            type="text"
            inputMode="decimal"
            value={formData.kh}
            onChange={e => setFormData({...formData, kh: sanitizeDecimalInput(e.target.value)})}
            className={inputClasses}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800">
        <h4 className="text-[9px] font-bold text-slate-600 uppercase mb-3 ml-1">CO2 Trimming Data</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
          <label className={labelClasses}>Degassed pH</label>
          <input 
            type="text"
            inputMode="decimal"
            value={formData.degassedPH}
            onChange={e => setFormData({...formData, degassedPH: sanitizeDecimalInput(e.target.value)})}
            className={inputClasses}
            placeholder="Cup + 24h air"
          />
        </div>
        <div>
          <label className={labelClasses}>Bubble Rate (bps)</label>
          <input 
            type="text"
            inputMode="decimal"
            value={formData.bubbleRate}
            onChange={e => setFormData({...formData, bubbleRate: sanitizeDecimalInput(e.target.value)})}
            className={inputClasses}
            placeholder="0.0"
          />
          </div>
        </div>
        {phDrop && (
          <div className="mt-3 bg-slate-100/10 border border-slate-100/20 p-3 rounded-xl flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400">Calculated pH Drop</span>
            <span className={`text-sm font-black ${parseFloat(phDrop) >= 0.8 && parseFloat(phDrop) <= 1.2 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {phDrop} unit
            </span>
          </div>
        )}
      </div>

      <div>
        <label className={labelClasses}>Notes</label>
        <textarea 
          value={formData.notes}
          onChange={e => setFormData({...formData, notes: e.target.value})}
          className={`${inputClasses} min-h-[80px] resize-none`}
          placeholder="Feeding, behavior, etc."
        />
      </div>

      <button 
        type="submit"
        className={`w-full py-4 text-slate-950 font-extrabold rounded-2xl transition-all shadow-xl active:scale-95 ${initialData ? 'bg-slate-300 hover:bg-white' : 'bg-slate-100 hover:bg-white shadow-white/5'}`}
      >
        {initialData ? 'Update Entry' : 'Save Log Entry'}
      </button>
    </form>
  );
};

export default LogForm;
