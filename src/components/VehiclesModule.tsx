import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, updateDoc } from 'firebase/firestore';
import { Vehicle, Brand, Agent, VehicleGroup, LimitPeriod, Frequency, FuelType } from '../types';
import { Car, Plus, Trash2, Download, Upload, Search, X, Users, Layers, FileSpreadsheet, CheckSquare, Square, Check, Pause, Play } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

const BRANDS: Brand[] = ['Skoda', 'Volkswagen', 'Seat', 'Cupra', 'Audi', 'Porsche', 'Bentley', 'Autre'];

const BRAND_LOGOS: Record<Brand, string> = {
  'Skoda': 'https://www.vectorlogo.zone/logos/skoda/skoda-icon.svg',
  'Volkswagen': 'https://www.vectorlogo.zone/logos/volkswagen/volkswagen-icon.svg',
  'Seat': 'https://upload.wikimedia.org/wikipedia/commons/e/ee/SEAT_Logo_from_2017.svg',
  'Cupra': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Cupra_logo.svg/1200px-Cupra_logo.svg.png',
  'Audi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Audi-Logo_2016.svg/1200px-Audi-Logo_2016.svg.png',
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
  const [activeTab, setActiveTab] = useState<'vehicles' | 'groups'>('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [deleteConfirmChassis, setDeleteConfirmChassis] = useState<string | null>(null);
  const [deleteConfirmGroupId, setDeleteConfirmGroupId] = useState<string | null>(null);
  
  // New Vehicle State
  const [newChassis, setNewChassis] = useState('');
  const [newBrand, setNewBrand] = useState<Brand>('Skoda');
  
  // New Group State
  const [groupName, setGroupName] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [fuelLimit, setFuelLimit] = useState(0);
  const [limitPeriod, setLimitPeriod] = useState<LimitPeriod>('month');
  const [isCumulable, setIsCumulable] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('once_per_month');
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<FuelType[]>([]);
  const [isKmRequired, setIsKmRequired] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const vQuery = query(collection(db, 'vehicles'), orderBy('addedAt', 'desc'));
    const unSubVehicles = onSnapshot(vQuery, (snap) => {
      setVehicles(snap.docs.map(doc => doc.data() as Vehicle));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'vehicles'));

    const aQuery = query(collection(db, 'agents'));
    const unSubAgents = onSnapshot(aQuery, (snap) => {
      setAgents(snap.docs.map(doc => doc.data() as Agent));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'agents'));

    const gQuery = query(collection(db, 'vehicle_groups'), orderBy('createdAt', 'desc'));
    const unSubGroups = onSnapshot(gQuery, (snap) => {
      setGroups(snap.docs.map(doc => doc.data() as VehicleGroup));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'vehicle_groups'));

    return () => {
      unSubVehicles();
      unSubAgents();
      unSubGroups();
    };
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
    await deleteDoc(doc(db, 'vehicles', chassis));
    setDeleteConfirmChassis(null);
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || selectedVehicles.length === 0 || selectedAgents.length === 0) {
      alert("Veuillez remplir le nom du groupe, choisir au moins un véhicule et un agent.");
      return;
    }

    const groupId = crypto.randomUUID();
    const newGroup: VehicleGroup = {
      id: groupId,
      name: groupName,
      vehicleIds: selectedVehicles,
      agentIds: selectedAgents,
      fuelLimit,
      limitPeriod,
      isCumulable,
      frequency,
      sites: selectedSites,
      fuelTypes: selectedFuelTypes,
      isKmRequired,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'vehicle_groups', groupId), newGroup);
      resetGroupForm();
      setShowGroupModal(false);
    } catch (error) {
      console.error("Error adding group:", error);
    }
  };

  const resetGroupForm = () => {
    setGroupName('');
    setSelectedVehicles([]);
    setSelectedAgents([]);
    setFuelLimit(0);
    setLimitPeriod('month');
    setIsCumulable(false);
    setFrequency('once_per_month');
    setSelectedSites([]);
    setSelectedFuelTypes([]);
    setIsKmRequired(false);
  };

  const handleGroupVehicleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const importedChassis = data.map(row => (row['numéro de châssis'] || row['chassis'] || row['Chassis'])?.toString().toUpperCase()).filter(Boolean);
      setSelectedVehicles(prev => Array.from(new Set([...prev, ...importedChassis])));
    };
    reader.readAsBinaryString(file);
  };

  const toggleGroupStatus = async (groupId: string, currentStatus: 'active' | 'suspended') => {
    try {
      await updateDoc(doc(db, 'vehicle_groups', groupId), {
        status: currentStatus === 'active' ? 'suspended' : 'active'
      });
    } catch (error) {
      console.error("Toggle group status failed", error);
    }
  };

  const toggleSelection = (list: any[], setList: Function, item: any) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
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
        <div className="flex items-center gap-1 bg-[#1e293b] p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'vehicles' ? 'bg-[#0ea5e9] text-white shadow-lg shadow-[#0ea5e9]/20' : 'text-slate-400 hover:text-white'}`}
          >
            Véhicules ({vehicles.length})
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'groups' ? 'bg-[#0ea5e9] text-white shadow-lg shadow-[#0ea5e9]/20' : 'text-slate-400 hover:text-white'}`}
          >
            Groupes ({groups.length})
          </button>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <label className="flex-1 sm:flex-none cursor-pointer bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-white/5">
            <Upload className="w-4 h-4" />
            <span>Importer</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={() => setShowGroupModal(true)}
            className="flex-1 sm:flex-none bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-white/5"
          >
            <Layers className="w-4 h-4" />
            <span>Groupe</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0ea5e9]/20"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      {activeTab === 'vehicles' ? (
        <>
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

          <div className="bg-[#1e293b] rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left relative">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#1e293b] text-slate-400 text-xs uppercase tracking-wider shadow-sm border-b border-white/5">
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
                          onClick={() => setDeleteConfirmChassis(vehicle.chassisNumber)}
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
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => (
            <motion.div
              layout
              key={group.id}
              className="bg-[#1e293b] rounded-2xl border border-white/5 p-6 space-y-4 hover:border-[#0ea5e9]/30 transition-all group"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0ea5e9]/10 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-[#0ea5e9]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{group.name}</h4>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-500">{new Date(group.createdAt).toLocaleDateString()}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${group.status === 'suspended' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {group.status === 'suspended' ? 'Suspendu' : 'Actif'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleGroupStatus(group.id, group.status || 'active')}
                    className={`p-2 transition-all rounded-lg ${group.status === 'suspended' ? 'text-emerald-400 hover:bg-emerald-400/10' : 'text-amber-400 hover:bg-amber-400/10'}`}
                    title={group.status === 'suspended' ? 'Activer' : 'Suspendre'}
                  >
                    {group.status === 'suspended' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setDeleteConfirmGroupId(group.id)}
                    className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-400/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Volume</p>
                  <p className="text-sm text-white font-mono">{group.fuelLimit}L / {group.limitPeriod === 'day' ? 'Jour' : group.limitPeriod === 'week' ? 'Semaine' : 'Mois'}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Passes</p>
                  <p className="text-sm text-white">
                    {group.frequency === 'once' ? 'Unique' : group.frequency.replace('once_per_', '').replace('day','Jour').replace('week','Semaine').replace('month','Mois')}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${group.isCumulable ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'}`}>
                    {group.isCumulable ? 'Cumulable' : 'Non cumulable'}
                  </div>
                  <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${group.isKmRequired ? 'bg-orange-500/10 text-orange-500' : 'bg-white/5 text-slate-600'}`}>
                    KM {group.isKmRequired ? 'Obligatoire' : 'Facultatif'}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Car className="w-3 h-3" />
                    <span>{group.vehicleIds.length} Voitures</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    <span>{group.agentIds.length} Agents</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {groups.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 italic bg-white/5 rounded-2xl border border-dashed border-white/10">
              Aucun groupe créé
            </div>
          )}
        </div>
      )}

      {/* Delete Vehicle Confirmation */}
      {deleteConfirmChassis && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="bg-[#1e293b] p-8 rounded-2xl border border-white/10 shadow-2xl max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Supprimer le véhicule ?</h3>
            <p className="text-slate-400 text-sm mb-8">Châssis: {deleteConfirmChassis}</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirmChassis(null)} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-400 font-bold">Annuler</button>
              <button onClick={() => handleDelete(deleteConfirmChassis)} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">Supprimer</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Group Confirmation */}
      {deleteConfirmGroupId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="bg-[#1e293b] p-8 rounded-2xl border border-white/10 shadow-2xl max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Supprimer ce groupe ?</h3>
            <p className="text-slate-400 text-sm mb-8">Cette action dissociera les véhicules et agents de ce groupe.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirmGroupId(null)} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-400 font-bold">Annuler</button>
              <button 
                onClick={async () => {
                  await deleteDoc(doc(db, 'vehicle_groups', deleteConfirmGroupId));
                  setDeleteConfirmGroupId(null);
                }} 
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold"
              >
                Supprimer
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Group Modal */}
      <AnimatePresence>
        {showGroupModal && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
            onClick={() => setShowGroupModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#1e293b] w-full max-w-4xl p-8 rounded-2xl border border-white/10 shadow-2xl my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0ea5e9]/20 flex items-center justify-center">
                    <Layers className="w-6 h-6 text-[#0ea5e9]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Nouveau Groupe</h3>
                    <p className="text-sm text-slate-400">Gérer une flotte de véhicules et agents</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowGroupModal(false)} 
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"
                  title="Fermer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddGroup} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Config */}
                  <div className="space-y-6">
                    <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5">
                      <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                        <Car className="w-4 h-4" /> Config Générale
                      </h4>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Nom du Groupe</label>
                        <input 
                          type="text" 
                          required
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9] transition-all"
                          placeholder="Ex: Équipe Maintenance"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1.5">Volume (Litre)</label>
                          <input 
                            type="number" 
                            required
                            min="1"
                            value={fuelLimit}
                            onChange={(e) => setFuelLimit(Number(e.target.value))}
                            className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9] transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1.5">Période</label>
                          <select 
                            value={limitPeriod}
                            onChange={(e) => setLimitPeriod(e.target.value as LimitPeriod)}
                            className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9] transition-all"
                          >
                            <option value="day">Par jour</option>
                            <option value="week">Par semaine</option>
                            <option value="month">Par mois</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => setIsCumulable(!isCumulable)}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isCumulable ? 'bg-[#0ea5e9] text-white' : 'bg-white/10 text-transparent'}`}
                        >
                          {isCumulable ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                        <span className="text-sm text-slate-300">Volume cumulable</span>
                      </div>
                    </div>

                    <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5">
                      <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Fréquence & Autres
                      </h4>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Nombre de fois</label>
                        <select 
                          value={frequency}
                          onChange={(e) => setFrequency(e.target.value as Frequency)}
                          className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9] transition-all"
                        >
                          <option value="once">Une seule fois</option>
                          <option value="once_per_day">Une fois par jour</option>
                          <option value="once_per_week">Une fois par semaine</option>
                          <option value="once_per_month">Une fois par mois</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Sites</label>
                          {['Site 1', 'Site 2'].map(site => (
                            <button
                              key={site}
                              type="button"
                              onClick={() => toggleSelection(selectedSites, setSelectedSites, site)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${selectedSites.includes(site) ? 'bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]' : 'bg-white/5 border-white/5 text-slate-400'}`}
                            >
                              {selectedSites.includes(site) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                              {site}
                            </button>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Carburant</label>
                          {(['essence', 'gasoil'] as FuelType[]).map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => toggleSelection(selectedFuelTypes, setSelectedFuelTypes, type)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm capitalize ${selectedFuelTypes.includes(type) ? 'bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]' : 'bg-white/5 border-white/5 text-slate-400'}`}
                            >
                              {selectedFuelTypes.includes(type) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => setIsKmRequired(!isKmRequired)}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isKmRequired ? 'bg-orange-500 text-white' : 'bg-white/10 text-transparent'}`}
                        >
                          {isKmRequired ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                        <span className="text-sm text-slate-300 font-medium">KM Obligatoire</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Selections */}
                  <div className="space-y-6">
                    <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5 h-[280px] flex flex-col">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                          <Users className="w-4 h-4" /> Agents
                        </h4>
                        <span className="text-xs text-[#0ea5e9] bg-[#0ea5e9]/10 px-2 py-0.5 rounded-full">{selectedAgents.length} sélectionnés</span>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {agents.map(agent => (
                          <button
                            key={agent.uid}
                            type="button"
                            onClick={() => toggleSelection(selectedAgents, setSelectedAgents, agent.uid)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-sm ${selectedAgents.includes(agent.uid) ? 'bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]' : 'bg-[#0f172a] border-white/5 text-slate-400 italic font-light'}`}
                          >
                            <span>{agent.firstName} {agent.lastName}</span>
                            {selectedAgents.includes(agent.uid) ? <CheckSquare className="w-4 h-4" /> : <Plus className="w-3 h-3 opacity-30" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5 h-[340px] flex flex-col">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                          <Car className="w-4 h-4" /> Voitures
                        </h4>
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer bg-[#0ea5e9] hover:bg-[#0284c7] text-white p-1.5 rounded-lg transition-all" title="Importer Excel">
                            <FileSpreadsheet className="w-4 h-4" />
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleGroupVehicleImport} />
                          </label>
                          <span className="text-xs text-[#0ea5e9] bg-[#0ea5e9]/10 px-2 py-0.5 rounded-full">{selectedVehicles.length} sélectionnées</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {vehicles.map(vehicle => (
                          <button
                            key={vehicle.chassisNumber}
                            type="button"
                            onClick={() => toggleSelection(selectedVehicles, setSelectedVehicles, vehicle.chassisNumber)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-sm ${selectedVehicles.includes(vehicle.chassisNumber) ? 'bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]' : 'bg-[#0f172a] border-white/5 text-slate-400 font-mono'}`}
                          >
                            <span>{vehicle.chassisNumber} ({vehicle.brand})</span>
                            {selectedVehicles.includes(vehicle.chassisNumber) ? <CheckSquare className="w-4 h-4" /> : <Plus className="w-3 h-3 opacity-30" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-white/10">
                  <button 
                    type="button"
                    onClick={() => setShowGroupModal(false)}
                    className="flex-1 px-8 py-4 rounded-xl text-slate-400 hover:bg-white/5 transition-all font-semibold"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#0ea5e9]/20 flex items-center justify-center gap-3"
                  >
                    <Check className="w-5 h-5" />
                    Créer le Groupe & Affecter
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddModal && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#1e293b] w-full max-w-md p-8 rounded-2xl border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">Nouveau Véhicule</h3>
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)} 
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"
                  title="Fermer"
                >
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
