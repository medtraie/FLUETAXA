import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, updateDoc, writeBatch } from 'firebase/firestore';
import { Vehicle, Brand, Agent, VehicleGroup, LimitPeriod, Frequency, FuelType } from '../types';
import { Car, Plus, Trash2, Download, Upload, Search, X, Users, Layers, FileSpreadsheet, CheckSquare, Square, Check, Pause, Play, Edit2, ChevronRight, ChevronDown, Calendar } from 'lucide-react';
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

const parseExcelDate = (val: any): string => {
  if (!val) return new Date().toISOString();
  // If it's a number, it's likely an Excel serial date
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
  // If it's a string, try direct parsing
  const str = String(val).trim();
  // Check DD/MM/YYYY format
  const dmYMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (dmYMatch) {
    const day = parseInt(dmYMatch[1], 10);
    const month = parseInt(dmYMatch[2], 10) - 1;
    const year = parseInt(dmYMatch[3], 10);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
  const date = new Date(str);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
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
  
  // Custom states for nested hierarchy lists and Excel imports
  const [importReport, setImportReport] = useState<{ accepted: number; ignored: number } | null>(null);
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  
  // Custom states for modal selections (Agents and Vehicles)
  const [modalAgentSearch, setModalAgentSearch] = useState('');
  const [modalVehicleSearch, setModalVehicleSearch] = useState('');
  const [modalExpandedBrands, setModalExpandedBrands] = useState<Record<string, boolean>>({});
  const [modalExpandedDates, setModalExpandedDates] = useState<Record<string, boolean>>({});
  
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
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [groupStatusFilter, setGroupStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [editingGroup, setEditingGroup] = useState<VehicleGroup | null>(null);

  useEffect(() => {
    if (editingGroup) {
      setGroupName(editingGroup.name);
      setSelectedVehicles(editingGroup.vehicleIds || []);
      setSelectedAgents(editingGroup.agentIds || []);
      setFuelLimit(editingGroup.fuelLimit || 0);
      setLimitPeriod(editingGroup.limitPeriod || 'month');
      setIsCumulable(editingGroup.isCumulable || false);
      setFrequency(editingGroup.frequency || 'once_per_month');
      setSelectedSites(editingGroup.sites || []);
      setSelectedFuelTypes(editingGroup.fuelTypes || []);
      setIsKmRequired(editingGroup.isKmRequired || false);
    } else {
      resetGroupForm();
    }
  }, [editingGroup]);

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

    const groupId = editingGroup ? editingGroup.id : crypto.randomUUID();
    const groupData: VehicleGroup = {
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
      status: editingGroup ? (editingGroup.status || 'active') : 'active',
      createdAt: editingGroup ? editingGroup.createdAt : new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'vehicle_groups', groupId), groupData);
      resetGroupForm();
      setEditingGroup(null);
      setShowGroupModal(false);
    } catch (error) {
      console.error("Error saving group:", error);
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
    setModalAgentSearch('');
    setModalVehicleSearch('');
    setModalExpandedBrands({});
    setModalExpandedDates({});
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let accepted = 0;
        let ignored = 0;
        const processedChassis = new Set<string>();

        // We create a check set from existing vehicles
        const existingChassis = new Set(vehicles.map(v => v.chassisNumber.toUpperCase()));

        // We write in chunks of 500
        const batchChunks = [];
        let currentBatch = writeBatch(db);
        let currentCount = 0;

        for (const row of data) {
          const rawChassis = row['numéro de châssis'] || row['numéro de Châssis'] || row['numéro de chassis'] || row['Numéro de Châssis'] || row['Numéro de châssis'] || row['chassis'] || row['Chassis'] || row['CHASSIS'] || row['Numero de chassis'] || row['Numero de Chassis'];
          const rawBrand = row['marque'] || row['Marque'] || row['brand'] || row['Brand'] || row['BRAND'];
          const rawDate = row["date d'ajout"] || row["Date d'ajout"] || row['date'] || row['Date'] || row['addedAt'] || row['AddedAt'] || row["date d'ajoute"] || row["Date d'ajoute"];

          if (!rawChassis) continue;

          const chassisStr = String(rawChassis).trim().toUpperCase();
          if (!chassisStr) continue;

          // Check if it is a duplicate (either exists in db or already seen in sheet)
          if (existingChassis.has(chassisStr) || processedChassis.has(chassisStr)) {
            ignored++;
            continue;
          }

          processedChassis.add(chassisStr);
          const brandStr = String(rawBrand || 'Autre').trim();
          const matchedBrand = BRANDS.find(b => b.toLowerCase() === brandStr.toLowerCase()) || 'Autre';
          const finalDateStr = parseExcelDate(rawDate);

          currentBatch.set(doc(db, 'vehicles', chassisStr), {
            chassisNumber: chassisStr,
            brand: matchedBrand,
            addedAt: finalDateStr
          });
          accepted++;
          currentCount++;

          if (currentCount === 450) { // Keep safe margin
            batchChunks.push(currentBatch.commit());
            currentBatch = writeBatch(db);
            currentCount = 0;
          }
        }

        if (currentCount > 0) {
          batchChunks.push(currentBatch.commit());
        }

        if (batchChunks.length > 0) {
          await Promise.all(batchChunks);
        }

        setImportReport({ accepted, ignored });
        // Reset file input
        e.target.value = '';
      } catch (error) {
        console.error("Error importing vehicles:", error);
      }
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

  interface GroupedDate {
    dateStr: string;
    rawDate: string;
    vehicles: Vehicle[];
  }

  interface GroupedBrand {
    brand: Brand;
    count: number;
    latestDate: string;
    dates: GroupedDate[];
  }

  const getGroupedVehicles = (vehiclesList: Vehicle[]): GroupedBrand[] => {
    const brandGroups: Record<string, Vehicle[]> = {};
    vehiclesList.forEach(v => {
      const b = v.brand || 'Autre';
      if (!brandGroups[b]) {
        brandGroups[b] = [];
      }
      brandGroups[b].push(v);
    });

    const result: GroupedBrand[] = [];

    Object.entries(brandGroups).forEach(([brandName, brandVehicles]) => {
      const dateGroups: Record<string, { rawDate: string; list: Vehicle[] }> = {};
      brandVehicles.forEach(v => {
        const d = new Date(v.addedAt);
        const formattedDate = isNaN(d.getTime()) ? 'Inconnue' : d.toLocaleDateString('fr-FR');
        if (!dateGroups[formattedDate]) {
          dateGroups[formattedDate] = {
            rawDate: v.addedAt,
            list: []
          };
        }
        dateGroups[formattedDate].list.push(v);
      });

      const sortedDates: GroupedDate[] = Object.entries(dateGroups)
        .map(([dateStr, info]) => ({
          dateStr,
          rawDate: info.rawDate,
          vehicles: info.list.sort((a,b) => b.addedAt.localeCompare(a.addedAt))
        }))
        .sort((a, b) => b.rawDate.localeCompare(a.rawDate));

      let latestDate = 'Inconnue';
      if (sortedDates.length > 0) {
        const maxRawDate = sortedDates[0].rawDate;
        const d = new Date(maxRawDate);
        latestDate = isNaN(d.getTime()) ? 'Inconnue' : d.toLocaleDateString('fr-FR');
      }

      result.push({
        brand: brandName as Brand,
        count: brandVehicles.length,
        latestDate,
        dates: sortedDates
      });
    });

    return result.sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand));
  };

  const groupedBrands = getGroupedVehicles(filteredVehicles);

  const toggleBrandExpand = (brand: string) => {
    setExpandedBrands(prev => ({
      ...prev,
      [brand]: !prev[brand]
    }));
  };

  const toggleDateExpand = (brand: string, dateStr: string) => {
    const key = `${brand}_${dateStr}`;
    setExpandedDates(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleModalBrandExpand = (brand: string) => {
    setModalExpandedBrands(prev => ({
      ...prev,
      [brand]: !prev[brand]
    }));
  };

  const toggleModalDateExpand = (brand: string, dateStr: string) => {
    const key = `${brand}_${dateStr}`;
    setModalExpandedDates(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const sortedModalAgents = [...agents].sort((a, b) => {
    const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
    const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
    return nameA.localeCompare(nameB, 'fr');
  });

  const filteredModalAgents = sortedModalAgents.filter(agent => {
    const fullName = `${agent.firstName || ''} ${agent.lastName || ''}`.toLowerCase();
    return fullName.includes(modalAgentSearch.toLowerCase());
  });

  const filteredModalVehicles = vehicles.filter(v => 
    v.chassisNumber.toLowerCase().includes(modalVehicleSearch.toLowerCase())
  );

  const modalGroupedBrands = getGroupedVehicles(filteredModalVehicles);

  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(groupSearchTerm.toLowerCase());
    const matchesStatus = groupStatusFilter === 'all' || (group.status || 'active') === groupStatusFilter;
    return matchesSearch && matchesStatus;
  });

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
            onClick={() => { setEditingGroup(null); resetGroupForm(); setShowGroupModal(true); }}
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

          {/* Grouped Accordion Hierarchy: Brand -> Date Added -> Chassis Number */}
          <div className="space-y-4">
            {groupedBrands.map((brandGroup) => {
              const isBrandExpanded = !!expandedBrands[brandGroup.brand];
              return (
                <div 
                  key={brandGroup.brand} 
                  className="bg-[#1e293b] rounded-2xl border border-white/5 overflow-hidden transition-all duration-300"
                >
                  {/* Level 1: Brand Header (Marque, Nombre de chassis, Dernière date d'ajout) */}
                  <div 
                    onClick={() => toggleBrandExpand(brandGroup.brand)}
                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/5 transition-colors select-none group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Brand Logo */}
                      <div className="w-12 h-12 flex items-center justify-center bg-white rounded-xl p-2 shadow-inner">
                        <img 
                          src={BRAND_LOGOS[brandGroup.brand] || BRAND_LOGOS['Autre']} 
                          alt={brandGroup.brand} 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getFallbackLogo(brandGroup.brand);
                          }}
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      
                      <div>
                        <h4 className="font-bold text-white text-base">
                          {brandGroup.brand}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                            <Car className="w-3.5 h-3.5 text-[#0ea5e9]" />
                            {brandGroup.count} {brandGroup.count > 1 ? 'Châssis' : 'Châssis'}
                          </span>
                          <span className="text-slate-500 font-normal">
                            Dernier ajout: {brandGroup.latestDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                        {isBrandExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Level 2: Dates of this Brand */}
                  <AnimatePresence initial={false}>
                    {isBrandExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-white/5 bg-[#151f32]/40 divide-y divide-white/5"
                      >
                        {brandGroup.dates.map((dateGroup) => {
                          const isDateExpanded = !!expandedDates[`${brandGroup.brand}_${dateGroup.dateStr}`];
                          return (
                            <div key={dateGroup.dateStr} className="pl-6">
                              {/* Date Added Header */}
                              <div 
                                onClick={() => toggleDateExpand(brandGroup.brand, dateGroup.dateStr)}
                                className="flex items-center justify-between py-4 pr-5 cursor-pointer hover:bg-white/5 transition-colors select-none"
                              >
                                <div className="flex items-center gap-3 text-sm text-slate-300">
                                  <Calendar className="w-4 h-4 text-slate-500" />
                                  <span className="font-semibold text-slate-200">
                                    {dateGroup.dateStr}
                                  </span>
                                  <span className="text-xs bg-white/5 text-slate-400 px-2 py-0.5 rounded-full font-normal">
                                    {dateGroup.vehicles.length} {dateGroup.vehicles.length > 1 ? 'véhicules' : 'véhicule'}
                                  </span>
                                </div>
                                <div className="text-slate-500">
                                  {isDateExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </div>
                              </div>

                              {/* Level 3: list of Chassis added on this Date */}
                              <AnimatePresence initial={false}>
                                {isDateExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="pl-6 pr-5 py-2 space-y-1.5"
                                  >
                                    {dateGroup.vehicles.map((vehicle) => (
                                      <div 
                                        key={vehicle.chassisNumber}
                                        className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                                      >
                                        <div className="flex items-center gap-2.5 font-mono text-white text-sm">
                                          <div className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9]" />
                                          {vehicle.chassisNumber}
                                        </div>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteConfirmChassis(vehicle.chassisNumber);
                                          }}
                                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all rounded-lg"
                                          title="Supprimer"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {groupedBrands.length === 0 && (
              <div className="py-12 text-center text-slate-500 italic bg-white/5 rounded-2xl border border-dashed border-white/10">
                Aucun véhicule trouvé
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Search Input for Groups */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="text"
                placeholder="Rechercher un groupe par nom..."
                value={groupSearchTerm}
                onChange={(e) => setGroupSearchTerm(e.target.value)}
                className="w-full bg-[#1e293b] border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9] transition-all"
              />
            </div>

            {/* Status Filter for Groups */}
            <div className="flex gap-1 p-1 bg-[#1e293b] rounded-xl border border-white/5 whitespace-nowrap overflow-x-auto custom-scrollbar w-full md:w-auto">
              {([
                { id: 'all', label: 'Tous les statuts' },
                { id: 'active', label: 'Actifs' },
                { id: 'suspended', label: 'Suspendus' }
              ] as const).map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setGroupStatusFilter(f.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    groupStatusFilter === f.id
                      ? 'bg-[#0ea5e9] text-white shadow-md shadow-[#0ea5e9]/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map(group => (
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
                      onClick={() => {
                        setEditingGroup(group);
                        setShowGroupModal(true);
                      }}
                      className="p-2 text-slate-550 hover:text-[#0ea5e9] transition-all rounded-lg hover:bg-[#0ea5e9]/10"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmGroupId(group.id)}
                      className="p-2 text-slate-500 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 transition-all rounded-lg hover:bg-red-400/10"
                      title="Supprimer"
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
                    <p className="text-sm text-white font-medium">
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
                      <span>{group.vehicleIds ? group.vehicleIds.length : 0} Voitures</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      <span>{group.agentIds ? group.agentIds.length : 0} Agents</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {filteredGroups.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 italic bg-white/5 rounded-2xl border border-dashed border-white/10">
                Aucun groupe trouvé
              </div>
            )}
          </div>
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

      {/* Excel Import Summary Report Dialog */}
      {importReport && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-[#1e293b] p-8 rounded-2xl border border-white/10 shadow-2xl max-w-md w-full text-center"
          >
            <div className="w-16 h-16 bg-[#0ea5e9]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-[#0ea5e9]">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Rapport d'importation</h3>
            <p className="text-slate-400 text-sm mb-6">L'importation de votre liste s'est déroulée avec succès.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-xl text-center">
                <p className="text-2xl font-black text-emerald-400">{importReport.accepted}</p>
                <p className="text-xs text-slate-400 mt-1">Acceptés</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-xl text-center">
                <p className="text-2xl font-black text-amber-400">{importReport.ignored}</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">Doublons ignorés</p>
              </div>
            </div>

            <button 
              onClick={() => setImportReport(null)} 
              className="w-full py-3.5 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold transition-all"
            >
              Fermer
            </button>
          </motion.div>
        </div>
      )}

      {/* Add Group Modal */}
      <AnimatePresence>
        {showGroupModal && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
            onClick={() => { setShowGroupModal(false); setEditingGroup(null); resetGroupForm(); }}
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
                    <h3 className="text-2xl font-bold text-white">
                      {editingGroup ? 'Modifier le Groupe' : 'Nouveau Groupe'}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {editingGroup ? 'Modifier les détails et affectations du groupe' : 'Gérer une flotte de véhicules et agents'}
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => { setShowGroupModal(false); setEditingGroup(null); resetGroupForm(); }} 
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
                    <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5 h-[340px] flex flex-col">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                          <Users className="w-4 h-4" /> Agents
                        </h4>
                        <span className="text-xs text-[#0ea5e9] bg-[#0ea5e9]/10 px-2.5 py-0.5 rounded-full font-medium">{selectedAgents.length} sélectionnés</span>
                      </div>

                      {/* Agents Quick Search Input */}
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <Search className="w-4 h-4 text-slate-500" />
                        </span>
                        <input
                          type="text"
                          placeholder="Rechercher un agent..."
                          value={modalAgentSearch}
                          onChange={(e) => setModalAgentSearch(e.target.value)}
                          className="w-full pl-9 pr-8 py-2 bg-[#0f172a]/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#0ea5e9] transition-all"
                        />
                        {modalAgentSearch && (
                          <button
                            type="button"
                            onClick={() => setModalAgentSearch('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {filteredModalAgents.map(agent => (
                          <button
                            key={agent.uid}
                            type="button"
                            onClick={() => toggleSelection(selectedAgents, setSelectedAgents, agent.uid)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-sm ${selectedAgents.includes(agent.uid) ? 'bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]' : 'bg-[#0f172a] border-white/5 text-slate-400 hover:bg-white/5 font-normal'}`}
                          >
                            <span>{agent.firstName} {agent.lastName}</span>
                            {selectedAgents.includes(agent.uid) ? <CheckSquare className="w-4 h-4" /> : <Plus className="w-3 h-3 opacity-30" />}
                          </button>
                        ))}
                        {filteredModalAgents.length === 0 && (
                          <div className="py-8 text-center text-slate-500 text-xs italic bg-[#0f172a]/20 rounded-xl border border-dashed border-white/5">
                            Aucun agent trouvé
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5 h-[450px] flex flex-col">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                          <Car className="w-4 h-4" /> Voitures
                        </h4>
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer bg-[#0ea5e9] hover:bg-[#0284c7] text-white p-1.5 rounded-lg transition-all" title="Importer Excel">
                            <FileSpreadsheet className="w-4 h-4" />
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleGroupVehicleImport} />
                          </label>
                          <span className="text-xs text-[#0ea5e9] bg-[#0ea5e9]/10 px-2.5 py-0.5 rounded-full font-medium">{selectedVehicles.length} sélectionnées</span>
                        </div>
                      </div>

                      {/* Voitures Quick Search Input */}
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <Search className="w-4 h-4 text-slate-500" />
                        </span>
                        <input
                          type="text"
                          placeholder="Rechercher par châssis..."
                          value={modalVehicleSearch}
                          onChange={(e) => setModalVehicleSearch(e.target.value)}
                          className="w-full pl-9 pr-8 py-2 bg-[#0f172a]/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#0ea5e9] transition-all"
                        />
                        {modalVehicleSearch && (
                          <button
                            type="button"
                            onClick={() => setModalVehicleSearch('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {modalGroupedBrands.map((brandGroup) => {
                          const isBrandExpanded = !!modalExpandedBrands[brandGroup.brand];
                          return (
                            <div 
                              key={brandGroup.brand} 
                              className="bg-[#0f172a]/45 rounded-xl border border-white/5 overflow-hidden transition-all duration-200"
                            >
                              {/* Level 1: Marque (Header) */}
                              <div 
                                onClick={() => toggleModalBrandExpand(brandGroup.brand)}
                                className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-white/5 transition-colors select-none group"
                              >
                                <div className="flex items-center gap-3">
                                  {/* Brand Logo */}
                                  <div className="w-9 h-9 flex items-center justify-center bg-white rounded-lg p-1.5 shadow-sm">
                                    <img 
                                      src={BRAND_LOGOS[brandGroup.brand] || BRAND_LOGOS['Autre']} 
                                      alt={brandGroup.brand} 
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = getFallbackLogo(brandGroup.brand);
                                      }}
                                      className="max-w-full max-h-full object-contain"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  
                                  <div>
                                    <h5 className="font-bold text-white text-xs">
                                      {brandGroup.brand}
                                    </h5>
                                    <div className="flex items-center gap-x-2 text-[10px] text-slate-400 mt-0.5">
                                      <span className="flex items-center gap-1 font-medium text-[#0ea5e9]">
                                        <Car className="w-3 h-3" />
                                        {brandGroup.count} Chassis
                                      </span>
                                      <span className="text-slate-500">
                                        Max: {brandGroup.latestDate}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-slate-400 group-hover:text-white transition-colors">
                                  {isBrandExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </div>
                              </div>

                              {/* Level 2: Dates of this Brand */}
                              <AnimatePresence initial={false}>
                                {isBrandExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="border-t border-white/5 bg-[#151f32]/25 divide-y divide-white/5"
                                  >
                                    {brandGroup.dates.map((dateGroup) => {
                                      const isDateExpanded = !!modalExpandedDates[`${brandGroup.brand}_${dateGroup.dateStr}`];
                                      return (
                                        <div key={dateGroup.dateStr} className="pl-3">
                                          {/* Date Added Header */}
                                          <div 
                                            onClick={() => toggleModalDateExpand(brandGroup.brand, dateGroup.dateStr)}
                                            className="flex items-center justify-between py-2.5 pr-3 cursor-pointer hover:bg-white/5 transition-colors select-none"
                                          >
                                            <div className="flex items-center gap-2 text-xs">
                                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                              <span className="font-semibold text-slate-300">
                                                {dateGroup.dateStr}
                                              </span>
                                              <span className="text-[9px] bg-white/5 text-slate-400 px-1.5 py-0.2 rounded-full font-normal">
                                                {dateGroup.vehicles.length}
                                              </span>
                                            </div>
                                            <div className="text-slate-500">
                                              {isDateExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                            </div>
                                          </div>

                                          {/* Level 3: list of Chassis added on this Date */}
                                          <AnimatePresence initial={false}>
                                            {isDateExpanded && (
                                              <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="pl-3 pr-3 py-1.5 space-y-1.5"
                                              >
                                                {dateGroup.vehicles.map((vehicle) => {
                                                  const isSelected = selectedVehicles.includes(vehicle.chassisNumber);
                                                  return (
                                                    <div 
                                                      key={vehicle.chassisNumber}
                                                      onClick={() => toggleSelection(selectedVehicles, setSelectedVehicles, vehicle.chassisNumber)}
                                                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#0ea5e9]' : 'bg-[#0f172a]/60 border-transparent text-slate-300 hover:bg-white/5'}`}
                                                    >
                                                      <div className="flex items-center gap-2 font-mono text-xs">
                                                        <button
                                                          type="button"
                                                          className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-[#0ea5e9] text-white' : 'bg-white/10 text-transparent hover:bg-white/20'}`}
                                                        >
                                                          {isSelected ? <CheckSquare className="w-3 h-3 animate-pulse" /> : <Square className="w-3 h-3 text-slate-500" />}
                                                        </button>
                                                        <span className={isSelected ? 'font-bold text-white' : 'font-medium'}>
                                                          {vehicle.chassisNumber}
                                                        </span>
                                                      </div>
                                                      
                                                      {isSelected && (
                                                        <button 
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleSelection(selectedVehicles, setSelectedVehicles, vehicle.chassisNumber);
                                                          }}
                                                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all rounded-md"
                                                          title="Désélectionner"
                                                        >
                                                          <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}

                        {modalGroupedBrands.length === 0 && (
                          <div className="py-8 text-center text-slate-500 text-xs italic bg-[#0f172a]/20 rounded-xl border border-dashed border-white/5">
                            Aucun véhicule trouvé
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-white/10">
                  <button 
                    type="button"
                    onClick={() => { setShowGroupModal(false); setEditingGroup(null); resetGroupForm(); }}
                    className="flex-1 px-8 py-4 rounded-xl text-slate-400 hover:bg-white/5 transition-all font-semibold"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#0ea5e9]/20 flex items-center justify-center gap-3"
                  >
                    <Check className="w-5 h-5" />
                    {editingGroup ? 'Enregistrer les modifications' : 'Créer le Groupe & Affecter'}
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
