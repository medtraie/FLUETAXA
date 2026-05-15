import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Tank, FuelSupply, FuelType } from '../types';
import { Fuel, Plus, History, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import TankGauge from './TankGauge';

export default function TanksModule() {
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [selectedTank, setSelectedTank] = useState<Tank | null>(null);
  const [supplyAmount, setSupplyAmount] = useState('');
  const [supplier, setSupplier] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tanks'), (snap) => {
      const tankList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tank));
      
      // Initialize tanks if they don't exist (4 tanks: 2 sites x 2 fuel types)
      if (tankList.length === 0) {
        const initialTanks = [
          { name: 'Citerne Gasoil - Site 1', site: 'Site 1', fuelType: 'gasoil', capacity: 5000, currentLevel: 2500, lastUpdated: new Date().toISOString() },
          { name: 'Citerne Essence - Site 1', site: 'Site 1', fuelType: 'essence', capacity: 3000, currentLevel: 1500, lastUpdated: new Date().toISOString() },
          { name: 'Citerne Gasoil - Site 2', site: 'Site 2', fuelType: 'gasoil', capacity: 5000, currentLevel: 2500, lastUpdated: new Date().toISOString() },
          { name: 'Citerne Essence - Site 2', site: 'Site 2', fuelType: 'essence', capacity: 3000, currentLevel: 1500, lastUpdated: new Date().toISOString() },
        ];
        initialTanks.forEach(async (t) => {
          await addDoc(collection(db, 'tanks'), t);
        });
      } else {
        setTanks(tankList);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'tanks'));
    return unsubscribe;
  }, []);

  const handleSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTank || !supplyAmount || !supplier) return;

    const amount = parseFloat(supplyAmount);
    const newLevel = Math.min(selectedTank.currentLevel + amount, selectedTank.capacity);

    try {
      await updateDoc(doc(db, 'tanks', selectedTank.id), {
        currentLevel: newLevel,
        lastUpdated: new Date().toISOString()
      });

      await addDoc(collection(db, 'fuel_supplies'), {
        date: new Date().toISOString(),
        quantity: amount,
        supplier,
        site: selectedTank.site,
        fuelType: selectedTank.fuelType,
        tankId: selectedTank.id
      });

      setShowSupplyModal(false);
      setSupplyAmount('');
      setSupplier('');
    } catch (error) {
      console.error("Supply failed", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {tanks.map((tank) => {
          const percentage = (tank.currentLevel / tank.capacity) * 100;
          const isLow = percentage <= 25;

          return (
            <motion.div 
              key={tank.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#1e293b] p-6 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden"
            >
              {isLow && (
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 animate-pulse" />
              )}
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">{tank.name}</h3>
                  <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">{tank.site}</p>
                </div>
                <div className={`p-3 rounded-xl ${tank.fuelType === 'gasoil' ? 'bg-slate-400/10 text-slate-400' : 'bg-amber-400/10 text-amber-400'}`}>
                  <Fuel className="w-6 h-6" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-400">Niveau Réservoir</span>
                  <div className="text-right">
                    <span className={`text-2xl font-bold ${isLow ? 'text-amber-400' : 'text-white'}`}>
                      {Math.round(percentage)}%
                    </span>
                    <p className="text-[10px] text-slate-500">{tank.currentLevel.toLocaleString()} / {tank.capacity.toLocaleString()} L</p>
                  </div>
                </div>

                {/* Professional Tank Gauge */}
                <TankGauge percentage={percentage} fuelType={tank.fuelType} />

                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => {
                      setSelectedTank(tank);
                      setShowSupplyModal(true);
                    }}
                    className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-2 border font-bold ${
                      isLow 
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20' 
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    {isLow ? 'Remplissage Urgent' : 'Niveau Optimal'}
                  </button>
                </div>

                {isLow && (
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-medium bg-amber-400/10 p-2 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    Alerte: Niveau bas (inférieur à 25%)
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Supply Modal */}
      {showSupplyModal && selectedTank && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1e293b] w-full max-w-md p-8 rounded-2xl border border-white/10 shadow-2xl"
          >
            <h3 className="text-2xl font-bold text-white mb-2">Approvisionnement</h3>
            <p className="text-slate-400 text-sm mb-6">{selectedTank.name}</p>

            <form onSubmit={handleSupply} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Fournisseur</label>
                <input 
                  type="text" 
                  required
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9] transition-all"
                  placeholder="Ex: TotalEnergies"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Quantité (L)</label>
                <input 
                  type="number" 
                  required
                  value={supplyAmount}
                  onChange={(e) => setSupplyAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9] transition-all"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  type="button"
                  onClick={() => setShowSupplyModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-[#0ea5e9]/20"
                >
                  Confirmer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
