import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Vehicle, Brand } from '../types';
import { Car, Plus, Trash2, Download, Upload, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';

const BRANDS: Brand[] = ['Skoda', 'Volkswagen', 'Seat', 'Cupra', 'Audi', 'Porsche', 'Bentley', 'Autre'];

const BRAND_LOGOS: Record<Brand, string> = {
  'Skoda': 'https://www.vectorlogo.zone/logos/skoda/skoda-icon.svg',
  'Volkswagen': 'https://www.vectorlogo.zone/logos/volkswagen/volkswagen-icon.svg',
  'Seat': 'https://www.vectorlogo.zone/logos/seat/seat-icon.svg',
  'Cupra': 'https://www.vectorlogo.zone/logos/cupra/cupra-icon.svg',
  'Audi': 'https://www.vectorlogo.zone/logos/audi/audi-icon.svg',
  'Porsche': 'https://www.vectorlogo.zone/logos/porsche/porsche-icon.svg',
  'Bentley': 'https://www.vectorlogo.zone/logos/bentley/bentley-icon.svg',
  'Autre': 'https://www.svgrepo.com/show/439247/more.svg'
};

const getFallbackLogo = (brand: Brand) => {
  const domains: Record<string, string> = {
    'Skoda': 'skoda-auto.com',
    'Volkswagen': 'volkswagen.com',
    'Seat': 'seat.com',
    'Cupra': 'cupraofficial.com',
    'Audi': 'audi.com',
    'Porsche': 'porsche.com',
    'Bentley': 'bentleymotors.com'
  };
  return domains[brand] 
    ? `https://www.google.com/s2/favicons?domain=${domains[brand]}&sz=128`
    : 'https://www.svgrepo.com/show/439247/more.svg';
};

export default function VehiclesModule() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChassis, setNewChassis] = useState('');
  const [newBrand, setNewBrand] = useState<Brand>('Skoda');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'vehicles'), orderBy('addedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setVehicles(snap.docs.map(doc => doc.data() as Vehicle));
    });
    return unsubscribe;
  }, []);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChassis) return;

    try {
      await setDoc(doc(db, 'vehicles', newChassis), {
        chassisNumber: newChassis,
        brand: newBrand,
        addedAt: new Date().toISOString()
      });
      setNewChassis('');
      setShowAddModal(false);
    } catch (error) {
      console.error("Add vehicle failed", error);
    }
  };

  const handleDelete = async (chassis: string) => {
    if (window.confirm(`Supprimer le véhicule ${chassis} ?`)) {
      await deleteDoc(doc(db, 'vehicles', chassis));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      data.forEach(async (row) => {
        const chassis = row['numéro de châssis'] || row['chassis'] || row['Chassis'];
        const brand = row['marque'] || row['brand'] || 'Autre';
        if (chassis) {
          await setDoc(doc(db, 'vehicles', chassis.toString()), {
            chassisNumber: chassis.toString(),
            brand: BRANDS.includes(brand) ? brand : 'Autre',
            addedAt: new Date().toISOString()
          });
        }
      });
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const data = [{ 'numéro de châssis': 'WVWZZZ123456789', 'marque': 'Volkswagen' }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vehicles");
    XLSX.writeFile(wb, 'modele_import_vehicules.xlsx');
  };

  const filteredVehicles = vehicles.filter(v => 
    v.chassisNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            type="text"
            placeholder="Rechercher un châssis ou une marque..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e293b] border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9] transition-all"
          />
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <label className="flex-1 sm:flex-none cursor-pointer bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-white/5">
            <Upload className="w-4 h-4" />
            <span>Importer</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0ea5e9]/20"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      <div className="bg-[#1e293b] rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Marque</th>
                <th className="px-6 py-4 font-semibold">Numéro de Châssis</th>
                <th className="px-6 py-4 font-semibold">Date d'ajout</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredVehicles.map((vehicle) => (
                <tr key={vehicle.chassisNumber} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 flex items-center justify-center bg-white rounded p-1.5 shadow-sm">
                        <img 
                          src={BRAND_LOGOS[vehicle.brand as Brand]} 
                          alt={vehicle.brand} 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getFallbackLogo(vehicle.brand as Brand);
                          }}
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-300">
                        {vehicle.brand}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-white">{vehicle.chassisNumber}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(vehicle.addedAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDelete(vehicle.chassisNumber)}
                      className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredVehicles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                    Aucun véhicule trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#1e293b] w-full max-w-md p-8 rounded-2xl border border-white/10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">Nouveau Véhicule</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddVehicle} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-3">Marque</label>
                  <div className="grid grid-cols-4 gap-3">
                    {BRANDS.map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setNewBrand(b)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                          newBrand === b 
                            ? 'bg-[#0ea5e9]/10 border-[#0ea5e9] scale-105 shadow-lg shadow-[#0ea5e9]/10' 
                            : 'bg-white/5 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="w-12 h-12 flex items-center justify-center mb-2 bg-white rounded-lg p-2 shadow-md">
                          <img 
                            src={BRAND_LOGOS[b]} 
                            alt={b} 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getFallbackLogo(b);
                            }}
                            className="max-w-full max-h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span className={`text-[10px] font-medium ${newBrand === b ? 'text-[#0ea5e9]' : 'text-slate-400'}`}>
                          {b}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Numéro de Châssis</label>
                  <input 
                    type="text" 
                    required
                    value={newChassis}
                    onChange={(e) => setNewChassis(e.target.value.toUpperCase())}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-[#0ea5e9] transition-all"
                    placeholder="WVWZZZ..."
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-6 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-[#0ea5e9]/20"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
