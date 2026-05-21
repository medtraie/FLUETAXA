import React, { useState, useEffect } from 'react';
import { db, secondaryAuth } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, deleteDoc } from 'firebase/firestore';
import { Agent, FuelType, Brand, VehicleGroup, Vehicle } from '../types';
import { Users, Shield, UserMinus, UserCheck, Edit2, X, Check, Plus, Trash2, Smartphone, Layers, Car, Ban, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { setDoc, deleteField } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

const BRANDS: Brand[] = ['Skoda', 'Volkswagen', 'Seat', 'Cupra', 'Audi', 'Porsche', 'Bentley', 'Autre'];
const SITES = ['Site 1', 'Site 2'];
const FUEL_TYPES: FuelType[] = ['gasoil', 'essence'];

export default function AgentsModule() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [vehicleGroups, setVehicleGroups] = useState<VehicleGroup[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [resetConfirmId, setResetConfirmId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'agent'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [newAgentData, setNewAgentData] = useState<Partial<Agent>>({
    firstName: '',
    lastName: '',
    password: '',
    role: 'agent',
    status: 'active',
    permissions: {
      sites: ['Site 1'],
      fuelTypes: ['gasoil'],
      brands: ['Skoda'],
      allowUnregisteredChassis: false,
      monthlyLimit: 0,
      fillLimit: 0
    }
  });

  useEffect(() => {
    const unsubAgents = onSnapshot(collection(db, 'agents'), (snap) => {
      setAgents(snap.docs.map(doc => doc.data() as Agent));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'agents'));
    
    const unsubGroups = onSnapshot(collection(db, 'vehicle_groups'), (snap) => {
      setVehicleGroups(snap.docs.map(doc => doc.data() as VehicleGroup));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'vehicle_groups'));

    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setVehicles(snap.docs.map(doc => doc.data() as Vehicle));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'vehicles'));

    return () => {
      unsubAgents();
      unsubGroups();
      unsubVehicles();
    };
  }, []);

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentData.firstName || !newAgentData.lastName || !newAgentData.password) return;
    
    setIsCreating(true);
    setCreateError('');

    try {
      // Create a virtual email for the agent
      const email = `${newAgentData.firstName.toLowerCase().trim()}.${newAgentData.lastName.toLowerCase().trim()}@smartfuel.local`;
      
      // Use secondaryAuth to create the user without signing out the admin
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, newAgentData.password);
      const uid = userCredential.user.uid;

      const agent: Agent = {
        uid,
        firstName: newAgentData.firstName,
        lastName: newAgentData.lastName,
        password: newAgentData.password,
        role: newAgentData.role as any,
        status: 'active',
        permissions: newAgentData.permissions as any
      };
      
      await setDoc(doc(db, 'agents', uid), agent);
      
      // Important: Since createUserWithEmailAndPassword logged in the new user, 
      // the admin might need to log back in if the session was swapped.
      // However, for simplicity in this demo, we'll just close the modal.
      
      setShowAddModal(false);
      setNewAgentData({
        firstName: '',
        lastName: '',
        password: '',
        role: 'agent',
        status: 'active',
        permissions: {
          sites: ['Site 1'],
          fuelTypes: ['gasoil'],
          brands: ['Skoda'],
          allowUnregisteredChassis: false,
          monthlyLimit: 0,
          fillLimit: 0
        }
      });
    } catch (error: any) {
      console.error("Add agent failed", error);
      if (error.code === 'auth/email-already-in-use') {
        setCreateError('هذا الموظف موجود بالفعل (الاسم واللقب مكرران).');
      } else if (error.code === 'auth/weak-password') {
        setCreateError('كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).');
      } else {
        setCreateError(`خطأ: ${error.message}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const toggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'suspended' : 'active';
    await updateDoc(doc(db, 'agents', agent.uid), { status: newStatus });
  };

  const handleUpdatePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;

    try {
      const updateData: any = {
        permissions: selectedAgent.permissions,
        role: selectedAgent.role,
        firstName: selectedAgent.firstName,
        lastName: selectedAgent.lastName
      };
      if (selectedAgent.password) {
        updateData.password = selectedAgent.password;
      }
      await updateDoc(doc(db, 'agents', selectedAgent.uid), updateData);
      setShowEditModal(false);
    } catch (error) {
      console.error("Update failed", error);
    }
  };

  const togglePermission = (type: 'sites' | 'fuelTypes' | 'brands' | 'groupIds' | 'specificVehicleIds' | 'excludedVehicleIdsFromGroups', value: string) => {
    if (!selectedAgent) return;
    const current = [...((selectedAgent.permissions[type] || []) as any[])];
    const index = current.indexOf(value);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(value);
    }
    setSelectedAgent({
      ...selectedAgent,
      permissions: { ...selectedAgent.permissions, [type]: current }
    });
  };

  const handleResetDevice = async (agentId: string) => {
    try {
      await updateDoc(doc(db, 'agents', agentId), {
        registeredDeviceId: deleteField(),
        deviceDescription: deleteField()
      });
      setResetConfirmId(null);
    } catch (error) {
      console.error("Reset device failed", error);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await deleteDoc(doc(db, 'agents', agentId));
      setDeleteConfirmId(null);
      setShowEditModal(false);
    } catch (error) {
      console.error("Delete agent failed", error);
    }
  };

  const filteredAgents = agents.filter(agent => {
    const searchString = `${agent.firstName} ${agent.lastName} ${agent.uid}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || agent.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Gestion des Agents</h2>
          <p className="text-sm text-slate-500">Gérez les accès et les permissions de votre équipe</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-[#0ea5e9]/20"
        >
          <Plus className="w-4 h-4" />
          Nouvel Agent
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            type="text"
            placeholder="Rechercher un agent par nom, prénom ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e293b] border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9]"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
          {/* Role Filter */}
          <div className="flex gap-1 p-1 bg-[#1e293b] rounded-xl border border-white/5 whitespace-nowrap overflow-x-auto custom-scrollbar">
            {([
              { id: 'all', label: 'Tous les rôles' },
              { id: 'agent', label: 'Agents' },
              { id: 'admin', label: 'Admins' }
            ] as const).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRoleFilter(f.id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  roleFilter === f.id
                    ? 'bg-[#0ea5e9] text-white shadow-md shadow-[#0ea5e9]/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex gap-1 p-1 bg-[#1e293b] rounded-xl border border-white/5 whitespace-nowrap overflow-x-auto custom-scrollbar">
            {([
              { id: 'all', label: 'Tous les statuts' },
              { id: 'active', label: 'Actifs' },
              { id: 'suspended', label: 'Suspendus' }
            ] as const).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === f.id
                    ? 'bg-[#0ea5e9] text-white shadow-md shadow-[#0ea5e9]/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#1e293b] rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Agent</th>
                <th className="px-6 py-4 font-semibold">Rôle</th>
                <th className="px-6 py-4 font-semibold">Statut</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredAgents.map((agent) => (
                <tr key={agent.uid} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#0ea5e9]/10 rounded-full flex items-center justify-center text-[#0ea5e9] font-bold">
                        {agent.firstName[0]}{agent.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{agent.firstName} {agent.lastName}</p>
                        <p className="text-xs text-slate-500">{agent.uid.substring(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      agent.role === 'admin' ? 'bg-indigo-400/10 text-indigo-400' : 'bg-slate-400/10 text-slate-400'
                    }`}>
                      {agent.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      agent.status === 'active' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
                    }`}>
                      {agent.status === 'active' ? 'Actif' : 'Suspendu'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => {
                        setSelectedAgent(agent);
                        setShowEditModal(true);
                      }}
                      className="p-2 text-slate-500 hover:text-[#0ea5e9] transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => toggleStatus(agent)}
                      className={`p-2 transition-colors ${agent.status === 'active' ? 'text-slate-500 hover:text-red-400' : 'text-slate-500 hover:text-emerald-400'}`}
                    >
                      {agent.status === 'active' ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Device Confirmation */}
      {resetConfirmId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="bg-[#1e293b] p-8 rounded-2xl border border-white/10 shadow-2xl max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500">
              <Smartphone className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Réinitialiser l'appareil ?</h3>
            <p className="text-slate-400 text-sm mb-8">L'agent devra s'enregistrer à nouveau sur un nouvel appareil.</p>
            <div className="flex gap-4">
              <button onClick={() => setResetConfirmId(null)} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-400 font-bold">Annuler</button>
              <button onClick={() => handleResetDevice(resetConfirmId)} className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold">Confirmer</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Agent Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="bg-[#1e293b] p-8 rounded-2xl border border-white/10 shadow-2xl max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Supprimer l'agent ?</h3>
            <p className="text-slate-400 text-sm mb-8">Cette action est irréversible et supprimera définitivement l'agent.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-400 font-bold">Annuler</button>
              <button onClick={() => handleDeleteAgent(deleteConfirmId)} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">Supprimer</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      <AnimatePresence>
        {showEditModal && selectedAgent && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#1e293b] w-full max-w-2xl p-8 rounded-2xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">Autorisations - {selectedAgent.firstName}</h3>
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)} 
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"
                  title="Fermer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUpdatePermissions} className="space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  {/* Role */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-3">Rôle Système</label>
                    <select 
                      value={selectedAgent.role}
                      onChange={(e) => setSelectedAgent({...selectedAgent, role: e.target.value as any})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9]"
                    >
                      <option value="agent" className="bg-[#1e293b]">Agent</option>
                      <option value="admin" className="bg-[#1e293b]">Administrateur</option>
                    </select>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-3">Modifier Mot de Passe</label>
                    <input 
                      type="text"
                      placeholder="Nouveau mot de passe"
                      onChange={(e) => setSelectedAgent({...selectedAgent, password: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9]"
                    />
                  </div>
                </div>

                {/* Sites & Fuel Types */}
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-3">Accès par Site</label>
                    <div className="space-y-2">
                      {SITES.map(site => (
                        <label key={site} className="flex items-center gap-3 cursor-pointer group">
                          <div 
                            onClick={() => togglePermission('sites', site)}
                            className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                              selectedAgent.permissions.sites.includes(site) ? 'bg-[#0ea5e9] border-[#0ea5e9]' : 'border-white/20 group-hover:border-white/40'
                            }`}
                          >
                            {selectedAgent.permissions.sites.includes(site) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm text-slate-300">{site}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-3">Types de Carburant</label>
                    <div className="space-y-2">
                      {FUEL_TYPES.map(type => (
                        <label key={type} className="flex items-center gap-3 cursor-pointer group">
                          <div 
                            onClick={() => togglePermission('fuelTypes', type)}
                            className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                              selectedAgent.permissions.fuelTypes.includes(type) ? 'bg-[#0ea5e9] border-[#0ea5e9]' : 'border-white/20 group-hover:border-white/40'
                            }`}
                          >
                            {selectedAgent.permissions.fuelTypes.includes(type) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm text-slate-300 capitalize">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fleet Permissions Layout matching screenshot */}
                <div className="space-y-6">
                  <div className="bg-[#2d2d2d] p-6 rounded-2xl border border-white/5 space-y-6">
                    {/* Action Tabs Header */}
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white p-3 rounded text-center text-black font-bold text-sm shadow-inner">
                        add liste
                      </div>
                      <div className="flex-1 bg-white p-3 rounded text-center text-black font-bold text-sm shadow-inner opacity-80">
                        add Voiture
                      </div>
                      <div className="flex-1 bg-white p-3 rounded text-center text-black font-bold text-sm shadow-inner opacity-80">
                        exclure voiture
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Listes autorisées (Groupes)</label>
                        <div className="grid grid-cols-2 gap-2">
                          {vehicleGroups.map(group => (
                            <button
                              key={group.id}
                              type="button"
                              onClick={() => togglePermission('groupIds', group.id)}
                              className={`px-4 py-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-between ${
                                selectedAgent.permissions.groupIds?.includes(group.id)
                                  ? 'bg-[#0ea5e9] border-[#0ea5e9] text-white shadow-lg shadow-[#0ea5e9]/20'
                                  : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4" />
                                {group.name}
                              </div>
                              {selectedAgent.permissions.groupIds?.includes(group.id) && <Check className="w-4 h-4" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Voitures Additionnelles</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                          {vehicles.map(vehicle => (
                            <button
                              key={vehicle.chassisNumber}
                              type="button"
                              onClick={() => togglePermission('specificVehicleIds', vehicle.chassisNumber)}
                              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left truncate ${
                                selectedAgent.permissions.specificVehicleIds?.includes(vehicle.chassisNumber)
                                  ? 'bg-emerald-400 border-emerald-400 text-white'
                                  : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                              }`}
                            >
                              {vehicle.chassisNumber}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-red-400/60 uppercase tracking-widest mb-3">Exclure des voitures</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                          {vehicles.map(vehicle => (
                            <button
                              key={vehicle.chassisNumber}
                              type="button"
                              onClick={() => togglePermission('excludedVehicleIdsFromGroups', vehicle.chassisNumber)}
                              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left truncate ${
                                selectedAgent.permissions.excludedVehicleIdsFromGroups?.includes(vehicle.chassisNumber)
                                  ? 'bg-red-400 border-red-400 text-white'
                                  : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                              }`}
                            >
                              {vehicle.chassisNumber}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Device Lock Section */}
                  <div className="bg-[#1a2b3c] p-6 rounded-2xl border border-[#0ea5e9]/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${selectedAgent.registeredDeviceId ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                          <Smartphone className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-white font-bold">Appareil lié</p>
                          <p className="text-xs text-slate-400">{selectedAgent.deviceDescription || 'Aucun appareil lié'}</p>
                        </div>
                      </div>
                      {selectedAgent.registeredDeviceId && (
                        <button 
                          type="button"
                          onClick={() => setResetConfirmId(selectedAgent.uid)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black p-2 rounded-lg border border-red-500/20 uppercase tracking-tighter"
                        >
                          DÉLIER L'APPAREIL
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 p-4 bg-black/20 rounded-xl border border-white/5">
                      <input 
                        type="checkbox"
                        id="unreg"
                        checked={selectedAgent.permissions.allowUnregisteredChassis}
                        onChange={(e) => setSelectedAgent({...selectedAgent, permissions: {...selectedAgent.permissions, allowUnregisteredChassis: e.target.checked}})}
                        className="w-5 h-5 rounded border-white/10 bg-white/5 text-[#0ea5e9] focus:ring-[#0ea5e9]"
                      />
                      <label htmlFor="unreg" className="text-sm text-slate-300 font-medium cursor-pointer">
                        Autoriser les châssis non inscrits dans la base de données
                      </label>
                    </div>
                  </div>
                </div>


                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setDeleteConfirmId(selectedAgent.uid)}
                    className="sm:mr-auto px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-semibold hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer l'agent
                  </button>
                  
                  <div className="flex gap-3 w-full sm:sm:w-auto">
                    <button 
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all"
                    >
                      Annuler
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 sm:flex-none bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-[#0ea5e9]/20"
                    >
                      Enregistrer les modifications
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Agent Modal */}
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
              className="bg-[#1e293b] w-full max-w-2xl p-8 rounded-2xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">Nouvel Agent</h3>
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)} 
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"
                  title="Fermer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddAgent} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Prénom</label>
                    <input 
                      type="text"
                      required
                      value={newAgentData.firstName}
                      onChange={(e) => setNewAgentData({...newAgentData, firstName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Nom</label>
                    <input 
                      type="text"
                      required
                      value={newAgentData.lastName}
                      onChange={(e) => setNewAgentData({...newAgentData, lastName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Rôle</label>
                    <select 
                      value={newAgentData.role}
                      onChange={(e) => setNewAgentData({...newAgentData, role: e.target.value as any})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9]"
                    >
                      <option value="agent" className="bg-[#1e293b]">Agent</option>
                      <option value="admin" className="bg-[#1e293b]">Administrateur</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Mot de passe</label>
                    <input 
                      type="password"
                      required
                      value={newAgentData.password}
                      onChange={(e) => setNewAgentData({...newAgentData, password: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ea5e9]"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-white border-b border-white/5 pb-2">Permissions par défaut</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Sites</label>
                      <div className="flex flex-wrap gap-2">
                        {SITES.map(site => (
                          <button
                            key={site}
                            type="button"
                            onClick={() => {
                              const sites = [...(newAgentData.permissions?.sites || [])];
                              const idx = sites.indexOf(site);
                              if (idx > -1) sites.splice(idx, 1);
                              else sites.push(site);
                              setNewAgentData({...newAgentData, permissions: {...newAgentData.permissions!, sites}});
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              newAgentData.permissions?.sites.includes(site)
                                ? 'bg-[#0ea5e9]/10 border-[#0ea5e9] text-[#0ea5e9]'
                                : 'bg-white/5 border-white/5 text-slate-500'
                            }`}
                          >
                            {site}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Carburants</label>
                      <div className="flex flex-wrap gap-2">
                        {FUEL_TYPES.map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              const types = [...(newAgentData.permissions?.fuelTypes || [])];
                              const idx = types.indexOf(type);
                              if (idx > -1) types.splice(idx, 1);
                              else types.push(type);
                              setNewAgentData({...newAgentData, permissions: {...newAgentData.permissions!, fuelTypes: types as any}});
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              newAgentData.permissions?.fuelTypes.includes(type)
                                ? 'bg-[#0ea5e9]/10 border-[#0ea5e9] text-[#0ea5e9]'
                                : 'bg-white/5 border-white/5 text-slate-500'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {createError && (
                  <p className="text-red-400 text-xs text-center">{createError}</p>
                )}

                <div className="flex gap-3 pt-6">
                  <button 
                    type="button"
                    disabled={isCreating}
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-6 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-[#0ea5e9]/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCreating ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Créer l'agent"
                    )}
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
