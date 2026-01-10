
import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea
} from 'recharts';
import { WaterLog, AquariumState } from '../types';
import { CHART_COLORS } from '../constants';

interface Props {
  data: WaterLog[];
  highlightedParam?: string | null;
  targets: AquariumState['targets'];
}

const WaterParameterChart: React.FC<Props> = ({ data, highlightedParam, targets }) => {
  const getLineStyle = (id: string) => {
    if (!highlightedParam) return { opacity: 0.8, strokeWidth: 1.5 };
    
    // Group highlights
    if (highlightedParam === 'hardness' && (id === 'gh' || id === 'kh')) {
      return { opacity: 1, strokeWidth: 3 };
    }
    
    const isHighlighted = highlightedParam === id;
    return {
      opacity: isHighlighted ? 1 : 0.05,
      strokeWidth: isHighlighted ? 4 : 1.5
    };
  };

  const renderTargetZone = () => {
    if (!highlightedParam) return null;

    // Use stroke="none" to prevent the horizontal lines of the area from looking like a frame
    switch (highlightedParam) {
      case 'ammonia':
        return <ReferenceArea yAxisId="left" y1={0} y2={targets.ammonia} fill={CHART_COLORS.ammonia} fillOpacity={0.1} stroke="none" />;
      case 'nitrite':
        return <ReferenceArea yAxisId="left" y1={0} y2={targets.nitrite} fill={CHART_COLORS.nitrite} fillOpacity={0.1} stroke="none" />;
      case 'nitrate':
        return <ReferenceArea yAxisId="left" y1={targets.nitrate.min} y2={targets.nitrate.max} fill={CHART_COLORS.nitrate} fillOpacity={0.1} stroke="none" />;
      case 'temperature':
        return <ReferenceArea yAxisId="tertiary" y1={targets.temperature.min} y2={targets.temperature.max} fill={CHART_COLORS.temp} fillOpacity={0.1} stroke="none" />;
      case 'pH':
        return <ReferenceArea yAxisId="right" y1={targets.pH.min} y2={targets.pH.max} fill={CHART_COLORS.pH} fillOpacity={0.1} stroke="none" />;
      case 'hardness':
        return (
          <>
            <ReferenceArea 
              yAxisId="right" 
              y1={targets.gh.min} 
              y2={targets.gh.max} 
              fill={CHART_COLORS.gh} 
              fillOpacity={0.1} 
              stroke="none"
            />
            <ReferenceArea 
              yAxisId="right" 
              y1={targets.kh.min} 
              y2={targets.kh.max} 
              fill={CHART_COLORS.kh} 
              fillOpacity={0.1} 
              stroke="none"
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className="h-[400px] w-full bg-slate-900/50 p-4 pb-6 rounded-3xl border border-slate-800 flex flex-col overflow-hidden select-none"
      style={{ 
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        boxShadow: 'none'
      }}
    >
      {/* Internal style to kill SVG focus rings across all browsers */}
      <style>{`
        .recharts-surface, .recharts-surface:focus, svg:focus {
          outline: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
      `}</style>

      {/* Header with Triple Axis Legend */}
      <div className="flex justify-between items-start mb-4 px-1 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Left</span>
          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wide">ppm (N)</span>
        </div>
        <div className="flex flex-col text-center">
          <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Right 1</span>
          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wide">dGH/dKH/pH</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Right 2</span>
          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wide">Temp</span>
        </div>
      </div>
      
      {/* Chart area */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={data} 
            margin={{ top: 5, right: -10, left: -15, bottom: 20 }}
            style={{ outline: 'none' }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis 
              dataKey="date" 
              hide
            />
            
            {/* Primary Axis: NH3, NO2, NO3 */}
            <YAxis 
              yAxisId="left"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#475569', fontSize: 8 }}
              width={35}
              style={{ pointerEvents: 'none' }}
            />
            
            {/* Secondary Axis: GH, KH */}
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#475569', fontSize: 8 }}
              width={35}
              style={{ pointerEvents: 'none' }}
            />

            {/* Tertiary Axis: Temp (0-40 scale) */}
            <YAxis 
              yAxisId="tertiary"
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 8 }}
              width={35}
              domain={[0, 40]}
              style={{ pointerEvents: 'none' }}
            />

            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0f172a', 
                borderRadius: '12px', 
                border: '1px solid #1e293b', 
                fontSize: '10px',
                color: '#f8fafc',
                padding: '8px',
                outline: 'none'
              }}
              itemStyle={{ padding: '0px' }}
              cursor={{ stroke: '#334155', strokeWidth: 1 }}
            />
            
            <Legend 
              verticalAlign="bottom" 
              align="center"
              iconType="circle"
              iconSize={6}
              wrapperStyle={{ 
                fontSize: '9px', 
                color: '#94a3b8',
                paddingTop: '15px',
                pointerEvents: 'none'
              }}
            />

            {renderTargetZone()}

            {/* PPM Lines (Left Axis) */}
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="ammonia" 
              stroke={CHART_COLORS.ammonia} 
              dot={false}
              name="NH3"
              isAnimationActive={false}
              {...getLineStyle('ammonia')}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="nitrite" 
              stroke={CHART_COLORS.nitrite} 
              dot={false}
              name="NO2"
              isAnimationActive={false}
              {...getLineStyle('nitrite')}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="nitrate" 
              stroke={CHART_COLORS.nitrate} 
              dot={false}
              name="NO3"
              isAnimationActive={false}
              {...getLineStyle('nitrate')}
            />
            
            {/* Hardness Lines (Right Axis) */}
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="gh" 
              stroke={CHART_COLORS.gh} 
              strokeDasharray="4 4"
              dot={highlightedParam === 'hardness' ? { r: 3, fill: CHART_COLORS.gh, strokeWidth: 0 } : false}
              name="GH"
              isAnimationActive={false}
              {...getLineStyle('gh')}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="kh" 
              stroke={CHART_COLORS.kh} 
              strokeDasharray="4 4"
              dot={highlightedParam === 'hardness' ? { r: 3, fill: CHART_COLORS.kh, strokeWidth: 0 } : false}
              name="KH"
              isAnimationActive={false}
              {...getLineStyle('kh')}
            />

            {/* Environment Lines (Tertiary Axis) */}
            <Line 
              yAxisId="tertiary"
              type="monotone" 
              dataKey="temperature" 
              stroke={CHART_COLORS.temp} 
              strokeWidth={1}
              dot={false}
              name="Temp"
              isAnimationActive={false}
              {...getLineStyle('temperature')}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="pH" 
              stroke={CHART_COLORS.pH} 
              strokeWidth={1}
              dot={false}
              name="pH"
              isAnimationActive={false}
              {...getLineStyle('pH')}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WaterParameterChart;
