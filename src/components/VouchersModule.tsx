import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, updateDoc, writeBatch } from 'firebase/firestore';
import { Voucher, VoucherStatus, VoucherValidity, FuelType, Vehicle, VehicleGroup } from '../types';
import { Ticket, Plus, Search, Filter, Archive, CheckCircle2, AlertCircle, Clock, Ban, Trash2, Copy, Download, QrCode, Building2, Droplets, Car, X, Layers, CheckSquare, Square, Check, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'react-qr-code';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

const VALIDITY_OPTIONS: { label: string; value: VoucherValidity }[] = [
  { label: '1 Mois', value: '1_month' },
  { label: '2 Mois', value: '2_months' },
  { label: '1 An', value: '1_year' },
  { label: 'Illimitée', value: 'unlimited' }
];

const FUEL_TYPES: FuelType[] = ['gasoil', 'essence'];
const SITES = ['Site 1', 'Site 2'];

export default function VouchersModule() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleGroups, setVehicleGroups] = useState<VehicleGroup[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | 'all'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    liters: 0,
    validity: '1_month' as VoucherValidity,
    isSellable: false,
    fuelTypes: [] as FuelType[],
    sites: [] as string[],
    authorizedVehicleIds: [] as string[],
    isOpen: false,
    quantity: 1 // For mass creation/duplication
  });

  useEffect(() => {
    const vQuery = query(collection(db, 'vouchers'), orderBy('createdAt', 'desc'));
    const unsubVouchers = onSnapshot(vQuery, (snap) => {
      setVouchers(snap.docs.map(doc => doc.data() as Voucher));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'vouchers'));

    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setVehicles(snap.docs.map(doc => doc.data() as Vehicle));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'vehicles'));

    const unsubGroups = onSnapshot(collection(db, 'vehicle_groups'), (snap) => {
      setVehicleGroups(snap.docs.map(doc => doc.data() as VehicleGroup));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'vehicle_groups'));

    return () => {
      unsubVouchers();
      unsubVehicles();
      unsubGroups();
    };
  }, []);

  const handleCreateVouchers = async (e: React.FormEvent) => {
    e.preventDefault();
    const batch = writeBatch(db);
    
    for (let i = 0; i < formData.quantity; i++) {
      const id = crypto.randomUUID();
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expirationDate = calculateExpiry(formData.validity);
      
      const voucher: Voucher = {
        id,
        code,
        liters: formData.liters,
        status: 'created',
        validity: formData.validity,
        isSellable: formData.isSellable,
        fuelTypes: formData.fuelTypes,
        sites: formData.sites,
        authorizedVehicleIds: formData.isOpen ? [] : formData.authorizedVehicleIds,
        isOpen: formData.isOpen,
        creationDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      if (expirationDate) {
        voucher.expirationDate = expirationDate.toISOString();
      }
      
      batch.set(doc(db, 'vouchers', id), voucher);
    }

    try {
      await batch.commit();
      setShowAddModal(false);
      setFormData({
        liters: 0,
        validity: '1_month',
        isSellable: false,
        fuelTypes: [],
        sites: [],
        authorizedVehicleIds: [],
        isOpen: false,
        quantity: 1
      });
    } catch (error) {
      console.error("Batch voucher creation failed", error);
    }
  };

  const calculateExpiry = (validity: VoucherValidity) => {
    if (validity === 'unlimited') return null;
    const date = new Date();
    if (validity === '1_month') date.setMonth(date.getMonth() + 1);
    if (validity === '2_months') date.setMonth(date.getMonth() + 2);
    if (validity === '1_year') date.setFullYear(date.getFullYear() + 1);
    return date;
  };

  const toggleStatus = async (voucherId: string, currentStatus: VoucherStatus) => {
    const newStatus: VoucherStatus = currentStatus === 'suspended' ? 'created' : 'suspended';
    try {
      await updateDoc(doc(db, 'vouchers', voucherId), { status: newStatus });
    } catch (error) {
      console.error("Status toggle failed", error);
    }
  };

  const handleDelete = async (voucherId: string) => {
    try {
      await deleteDoc(doc(db, 'vouchers', voucherId));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Delete voucher failed", error);
    }
  };

  const handleDuplicate = async (voucher: Voucher) => {
    const id = crypto.randomUUID();
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create copy without usage information
    const { usedAt, usedBy, ...baseVoucher } = voucher;
    
    const newVoucher: Voucher = {
      ...baseVoucher,
      id,
      code,
      status: 'created',
      createdAt: new Date().toISOString(),
      creationDate: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'vouchers', id), newVoucher);
    } catch (error) {
      console.error("Duplicate failed", error);
    }
  };

  const filteredVouchers = vouchers.filter(v => {
    const matchesSearch = v.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status: VoucherStatus) => {
    switch (status) {
      case 'created': return { icon: Ticket, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Bon créé' };
      case 'used': return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Bon utilisé' };
      case 'expired': return { icon: Clock, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Bon expiré' };
      case 'suspended': return { icon: Ban, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Bon suspendu' };
      case 'valid_unused': return { icon: Ticket, color: 'text-indigo-400', bg: 'bg-indigo-400/10', label: 'Bon valide non utilisé' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Ticket className="w-8 h-8 text-[#0ea5e9]" />
            Gestion des Bons (Vouchers)
          </h2>
          <p className="text-slate-400 mt-1">Gérez vos bons de carburant et QR codes</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0ea5e9]/20"
        >
          <Plus className="w-4 h-4" />
          Nouveau Bon
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            type="text"
            placeholder="Rechercher par code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e293b] border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9]"
          />
        </div>
        <div className="flex gap-2 p-1 bg-[#1e293b] rounded-xl border border-white/5 whitespace-nowrap overflow-x-auto custom-scrollbar">
          {/* Updated Status Filter with Arabic/French labels */}
          {(['all', 'created', 'used', 'expired', 'suspended', 'valid_unused'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${statusFilter === f ? 'bg-[#0ea5e9] text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {f === 'all' ? 'Tous' : getStatusConfig(f).label}
            </button>
          ))}
        </div>
        
        {/* Bulk Actions */}
        <div className="flex gap-2">
          {filteredVouchers.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm(`Suspendre les ${filteredVouchers.length} bons affichés ?`)) return;
                const batch = writeBatch(db);
                filteredVouchers.forEach(v => {
                  batch.update(doc(db, 'vouchers', v.id), { status: 'suspended' });
                });
                await batch.commit();
              }}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-xl border border-amber-500/20 text-xs font-bold"
            >
              Suspendre la Liste
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredVouchers.map(voucher => {
            const config = getStatusConfig(voucher.status);
            return (
              <motion.div
                layout
                key={voucher.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1e293b] rounded-2xl border border-white/5 p-6 space-y-4 hover:border-[#0ea5e9]/30 transition-all group relative overflow-hidden"
              >
                {/* Status Badge */}
                <div className={`absolute top-0 right-0 px-4 py-1 rounded-bl-xl text-[10px] font-bold uppercase ${config.bg} ${config.color} flex items-center gap-1.5`}>
                  <config.icon className="w-3 h-3" />
                  {config.label}
                </div>

                <div className="flex gap-4">
                  <div className="bg-white p-2 rounded-xl shadow-lg h-fit">
                    <QRCode value={voucher.code} size={64} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-mono text-[#0ea5e9] tracking-widest">{voucher.code}</p>
                    <h4 className="text-2xl font-bold text-white">{voucher.liters}L</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      {voucher.fuelTypes.join(' & ') || 'Tous carburants'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>Expire le: {voucher.expirationDate ? new Date(voucher.expirationDate).toLocaleDateString() : 'Illimitée'}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {voucher.sites.map(site => (
                      <span key={site} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5">
                        {site}
                      </span>
                    ))}
                    {voucher.isSellable && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        VENDABLE
                      </span>
                    )}
                    {voucher.isOpen && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                        OUVERT
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-white/5">
                  <button 
                    onClick={() => handleDuplicate(voucher)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white p-2.5 rounded-xl transition-all border border-white/5 flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span className="text-xs font-bold">COPIER</span>
                  </button>
                  <button 
                    onClick={() => toggleStatus(voucher.id, voucher.status)}
                    className={`p-2.5 rounded-xl transition-all border ${voucher.status === 'suspended' ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400' : 'bg-amber-400/10 border-amber-400/20 text-amber-400'}`}
                  >
                    {voucher.status === 'suspended' ? <RefreshCw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmId(voucher.id)}
                    className="p-2.5 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 hover:bg-red-400/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add Voucher Modal */}
      <AnimatePresence>
        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#1e293b] p-8 rounded-2xl border border-white/10 shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Confirmer la suppression</h3>
              <p className="text-slate-400 text-sm mb-8">Voulez-vous vraiment supprimer ce bon ? Cette action est irréversible.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddModal && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
            onClick={() => setShowAddModal(false)}
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
                  <div className="w-12 h-12 rounded-2xl bg-[#0ea5e9]/20 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-[#0ea5e9]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Nouveau Bon / Série</h3>
                    <p className="text-sm text-slate-400">Configurez les paramètres de validité et restriction</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)} 
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"
                  title="Fermer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateVouchers} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
                      <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                        <Droplets className="w-4 h-4" /> Carburant & Volume
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1.5">Volume (Litre)</label>
                          <input 
                            type="number" 
                            required
                            min="1"
                            value={formData.liters}
                            onChange={(e) => setFormData({...formData, liters: Number(e.target.value)})}
                            className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1.5">Quantité à créer</label>
                          <input 
                            type="number" 
                            required
                            min="1"
                            max="50"
                            value={formData.quantity}
                            onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                            className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</label>
                          {FUEL_TYPES.map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                const current = [...formData.fuelTypes];
                                if (current.includes(type)) {
                                  setFormData({...formData, fuelTypes: current.filter(t => t !== type)});
                                } else {
                                  setFormData({...formData, fuelTypes: [...current, type]});
                                }
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm capitalize ${formData.fuelTypes.includes(type) ? 'bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]' : 'bg-white/5 border-white/5 text-slate-400'}`}
                            >
                              {formData.fuelTypes.includes(type) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                              {type}
                            </button>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Site</label>
                          {SITES.map(site => (
                            <button
                              key={site}
                              type="button"
                              onClick={() => {
                                const current = [...formData.sites];
                                if (current.includes(site)) {
                                  setFormData({...formData, sites: current.filter(s => s !== site)});
                                } else {
                                  setFormData({...formData, sites: [...current, site]});
                                }
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${formData.sites.includes(site) ? 'bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]' : 'bg-white/5 border-white/5 text-slate-400'}`}
                            >
                              {formData.sites.includes(site) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                              {site}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
                      <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Validité
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {VALIDITY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFormData({...formData, validity: opt.value})}
                            className={`px-4 py-3 rounded-xl border text-xs font-bold transition-all ${formData.validity === opt.value ? 'bg-[#0ea5e9] text-white border-[#0ea5e9] shadow-lg shadow-[#0ea5e9]/20' : 'bg-[#0f172a] border-white/5 text-slate-500'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, isSellable: !formData.isSellable})}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${formData.isSellable ? 'bg-emerald-500 text-white' : 'bg-white/10 text-transparent'}`}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <div>
                          <p className="text-sm text-white font-medium">Bon Vendable</p>
                          <p className="text-[10px] text-slate-500">Marquer ce bon comme produit destiné à la vente</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4 h-[500px] flex flex-col">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                          <Car className="w-4 h-4" /> Véhicules Autorisés
                        </h4>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, isOpen: !formData.isOpen})}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${formData.isOpen ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/5 text-slate-600'}`}
                          >
                            {formData.isOpen ? 'Bon Ouvert' : 'Limiter'}
                          </button>
                        </div>
                      </div>

                      {!formData.isOpen ? (
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {vehicles.map(v => (
                            <button
                              key={v.chassisNumber}
                              type="button"
                              onClick={() => {
                                const current = [...formData.authorizedVehicleIds];
                                if (current.includes(v.chassisNumber)) {
                                  setFormData({...formData, authorizedVehicleIds: current.filter(id => id !== v.chassisNumber)});
                                } else {
                                  setFormData({...formData, authorizedVehicleIds: [...current, v.chassisNumber]});
                                }
                              }}
                              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-sm font-mono ${formData.authorizedVehicleIds.includes(v.chassisNumber) ? 'bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]' : 'bg-[#0f172a] border-white/5 text-slate-400'}`}
                            >
                              <span>{v.chassisNumber} ({v.brand})</span>
                              {formData.authorizedVehicleIds.includes(v.chassisNumber) ? <Check className="w-4 h-4" /> : <Plus className="w-3 h-3 opacity-30" />}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-8">
                          <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center">
                            <Layers className="w-8 h-8 text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-white font-bold">Bon Universel ACTIVÉ</p>
                            <p className="text-xs text-slate-500 mt-1">N'importe quel véhicule pourra utiliser ce bon s'il respecte les autres critères (sites/carburant).</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-white/10">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-8 py-4 rounded-xl text-slate-400 hover:bg-white/5 transition-all font-semibold"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#0ea5e9]/20 flex items-center justify-center gap-3"
                  >
                    <Plus className="w-5 h-5" />
                    Générer les Bons
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
