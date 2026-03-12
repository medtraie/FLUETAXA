import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { FuelUsage, FuelSupply } from '../types';
import { History, Download, Filter, Calendar, Search, FileText, Table, Users, Car } from 'lucide-react';
import { formatDateTime, exportToPDF, exportToExcel } from '../utils';
import { motion } from 'motion/react';

export default function MovementsModule() {
  const [usages, setUsages] = useState<FuelUsage[]>([]);
  const [supplies, setSupplies] = useState<FuelSupply[]>([]);
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterSite, setFilterSite] = useState('');

  useEffect(() => {
    const qUsages = query(collection(db, 'fuel_usages'), orderBy('date', 'desc'));
    const unsubUsages = onSnapshot(qUsages, (snap) => {
      setUsages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelUsage)));
    });

    const qSupplies = query(collection(db, 'fuel_supplies'), orderBy('date', 'desc'));
    const unsubSupplies = onSnapshot(qSupplies, (snap) => {
      setSupplies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelSupply)));
    });

    return () => {
      unsubUsages();
      unsubSupplies();
    };
  }, []);

  const filteredUsages = usages.filter(u => {
    const date = new Date(u.date);
    const start = filterDateStart ? new Date(filterDateStart) : null;
    const end = filterDateEnd ? new Date(filterDateEnd) : null;
    
    if (start && date < start) return false;
    if (end && date > end) return false;
    if (filterAgent && !u.agentName.toLowerCase().includes(filterAgent.toLowerCase())) return false;
    if (filterVehicle && !u.chassisNumber.toLowerCase().includes(filterVehicle.toLowerCase())) return false;
    if (filterSite && u.site !== filterSite) return false;
    
    return true;
  });

  const handleExportPDF = () => {
    const columns = ["Date", "Agent", "Véhicule", "Quantité (L)", "Site", "Type"];
    const data = filteredUsages.map(u => [
      formatDateTime(u.date),
      u.agentName,
      u.chassisNumber,
      u.quantity.toString(),
      u.site,
      u.fuelType
    ]);
    exportToPDF("Rapport des Mouvements de Carburant", columns, data, "mouvements_carburant");
  };

  const handleExportExcel = () => {
    const data = filteredUsages.map(u => ({
      Date: formatDateTime(u.date),
      Agent: u.agentName,
      Véhicule: u.chassisNumber,
      'Quantité (L)': u.quantity,
      Site: u.site,
      Type: u.fuelType,
      Kilométrage: u.mileage
    }));
    exportToExcel(data, "mouvements_carburant");
  };

  const agentSummary = filteredUsages.reduce((acc: any, curr) => {
    acc[curr.agentName] = (acc[curr.agentName] || 0) + curr.quantity;
    return acc;
  }, {});

  const vehicleSummary = filteredUsages.reduce((acc: any, curr) => {
    acc[curr.chassisNumber] = (acc[curr.chassisNumber] || 0) + curr.quantity;
    return acc;
  }, {});

  return (
    <div className="space-y-6 pb-20">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1e293b] p-6 rounded-2xl border border-white/5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0ea5e9]" /> Consommation par Agent
          </h3>
          <div className="space-y-3">
            {Object.entries(agentSummary).sort((a: any, b: any) => b[1] - a[1]).map(([name, total]: any) => (
              <div key={name} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-sm text-white font-medium">{name}</span>
                <span className="text-sm font-bold text-[#0ea5e9]">{total.toFixed(1)} L</span>
              </div>
            ))}
            {Object.keys(agentSummary).length === 0 && <p className="text-xs text-slate-500 italic">Aucune donnée</p>}
          </div>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl border border-white/5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Car className="w-4 h-4 text-[#0ea5e9]" /> Consommation par Voiture
          </h3>
          <div className="space-y-3">
            {Object.entries(vehicleSummary).sort((a: any, b: any) => b[1] - a[1]).map(([chassis, total]: any) => (
              <div key={chassis} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-sm text-white font-mono">{chassis}</span>
                <span className="text-sm font-bold text-[#0ea5e9]">{total.toFixed(1)} L</span>
              </div>
            ))}
            {Object.keys(vehicleSummary).length === 0 && <p className="text-xs text-slate-500 italic">Aucune donnée</p>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1e293b] p-6 rounded-2xl border border-white/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold mb-2">
          <Filter className="w-5 h-5 text-[#0ea5e9]" />
          <span>Filtres de Rapport</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Début</label>
            <input 
              type="date" 
              value={filterDateStart}
              onChange={(e) => setFilterDateStart(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#0ea5e9] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Fin</label>
            <input 
              type="date" 
              value={filterDateEnd}
              onChange={(e) => setFilterDateEnd(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#0ea5e9] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Agent</label>
            <input 
              type="text" 
              placeholder="Nom..."
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#0ea5e9] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Véhicule</label>
            <input 
              type="text" 
              placeholder="Châssis..."
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#0ea5e9] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Site</label>
            <select 
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#0ea5e9] outline-none"
            >
              <option value="" className="bg-[#1e293b]">Tous les sites</option>
              <option value="Site 1" className="bg-[#1e293b]">Site 1</option>
              <option value="Site 2" className="bg-[#1e293b]">Site 2</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-all text-sm font-medium"
          >
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl transition-all text-sm font-medium"
          >
            <Table className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1e293b] rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Date & Heure</th>
                <th className="px-6 py-4 font-semibold">Agent</th>
                <th className="px-6 py-4 font-semibold">Véhicule</th>
                <th className="px-6 py-4 font-semibold">Quantité</th>
                <th className="px-6 py-4 font-semibold">Site</th>
                <th className="px-6 py-4 font-semibold">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsages.map((usage) => (
                <tr key={usage.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-sm text-white font-medium">{formatDateTime(usage.date)}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{usage.agentName}</td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-400">{usage.chassisNumber}</td>
                  <td className="px-6 py-4 text-sm font-bold text-[#0ea5e9]">{usage.quantity} L</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{usage.site}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      usage.fuelType === 'gasoil' ? 'bg-slate-400/10 text-slate-400' : 'bg-amber-400/10 text-amber-400'
                    }`}>
                      {usage.fuelType}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredUsages.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                    Aucun mouvement enregistré
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
