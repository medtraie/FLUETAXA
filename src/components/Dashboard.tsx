import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Tank, FuelUsage } from '../types';
import { Fuel, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [recentUsages, setRecentUsages] = useState<FuelUsage[]>([]);

  useEffect(() => {
    const unsubTanks = onSnapshot(collection(db, 'tanks'), (snap) => {
      setTanks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tank)));
    });

    const q = query(collection(db, 'fuel_usages'), orderBy('date', 'desc'), limit(5));
    const unsubUsages = onSnapshot(q, (snap) => {
      setRecentUsages(snap.docs.map(doc => doc.data() as FuelUsage));
    });

    return () => {
      unsubTanks();
      unsubUsages();
    };
  }, []);

  const lowLevelTanks = tanks.filter(t => (t.currentLevel / t.capacity) <= 0.25);

  const chartData = tanks.map(t => ({
    name: `${t.site} - ${t.fuelType}`,
    level: t.currentLevel,
    capacity: t.capacity,
    percentage: Math.round((t.currentLevel / t.capacity) * 100)
  }));

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#1e293b] p-6 rounded-2xl border border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-[#0ea5e9]/10 rounded-lg">
              <Fuel className="w-6 h-6 text-[#0ea5e9]" />
            </div>
            <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">En ligne</span>
          </div>
          <p className="text-slate-400 text-sm font-medium">Citernes Actives</p>
          <h3 className="text-2xl font-bold text-white mt-1">{tanks.length}</h3>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl border border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-400/10 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            {lowLevelTanks.length > 0 && (
              <span className="animate-pulse text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">Alerte</span>
            )}
          </div>
          <p className="text-slate-400 text-sm font-medium">Niveaux Critiques</p>
          <h3 className="text-2xl font-bold text-white mt-1">{lowLevelTanks.length}</h3>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl border border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-400/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium">Consommation Totale</p>
          <h3 className="text-2xl font-bold text-white mt-1">
            {recentUsages.reduce((acc, curr) => acc + curr.quantity, 0).toFixed(1)} L
          </h3>
        </div>
      </div>

      {/* Charts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#1e293b] p-6 rounded-2xl border border-white/5 shadow-sm">
          <h3 className="text-lg font-semibold text-white mb-6">Niveaux des Citernes (%)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.percentage <= 25 ? '#f59e0b' : '#0ea5e9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl border border-white/5 shadow-sm">
          <h3 className="text-lg font-semibold text-white mb-6">Derniers Mouvements</h3>
          <div className="space-y-4">
            {recentUsages.map((usage, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${usage.fuelType === 'gasoil' ? 'bg-slate-400/10 text-slate-400' : 'bg-amber-400/10 text-amber-400'}`}>
                    <Fuel className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{usage.chassisNumber}</p>
                    <p className="text-xs text-slate-500">{usage.agentName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#0ea5e9]">{usage.quantity} L</p>
                  <p className="text-[10px] text-slate-500">{new Date(usage.date).toLocaleTimeString('fr-FR')}</p>
                </div>
              </div>
            ))}
            {recentUsages.length === 0 && (
              <p className="text-center text-slate-500 py-8 text-sm italic">Aucun mouvement récent</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
