import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, addDoc, updateDoc, increment, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { Agent, Tank, Vehicle, FuelType, VehicleGroup, Voucher } from '../types';
import { QrCode, Scan, Car, Fuel, MapPin, CheckCircle2, AlertCircle, ArrowLeft, Keyboard, Layers, Ticket, Search as SearchIcon, Droplets } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

interface MobileAppProps {
  agent: Agent | null;
}

export default function MobileApp({ agent }: MobileAppProps) {
  const [step, setStep] = useState<'home' | 'scan' | 'manual' | 'mileage' | 'fueling' | 'success' | 'scan_voucher' | 'voucher_details'>('home');
  const [scannedChassis, setScannedChassis] = useState('');
  const [mileage, setMileage] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState<FuelType>('gasoil');
  const [fuelQuantity, setFuelQuantity] = useState('');
  const [error, setError] = useState('');
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [vehicleGroups, setVehicleGroups] = useState<VehicleGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<VehicleGroup | null>(null);
  const [scannedVoucher, setScannedVoucher] = useState<Voucher | null>(null);

  useEffect(() => {
    const unsubTanks = onSnapshot(collection(db, 'tanks'), (snap) => {
      setTanks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tank)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'tanks'));

    const unsubGroups = onSnapshot(collection(db, 'vehicle_groups'), (snap) => {
      setVehicleGroups(snap.docs.map(doc => doc.data() as VehicleGroup));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'vehicle_groups'));

    return () => {
      unsubTanks();
      unsubGroups();
    };
  }, []);

  useEffect(() => {
    if (step === 'scan' || step === 'scan_voucher') {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        if (step === 'scan') {
          handleChassisSubmit(decodedText);
        } else {
          handleVoucherScan(decodedText);
        }
        scanner.clear();
      }, (err) => {});
      return () => scanner.clear();
    }
  }, [step]);

  const handleChassisSubmit = async (chassis: string) => {
    setError('');
    const chassisUpper = chassis.toUpperCase();
    
    // Check permissions
    if (!agent) return;

    const vehicleDoc = await getDoc(doc(db, 'vehicles', chassisUpper));
    const vehicle = vehicleDoc.exists() ? vehicleDoc.data() as Vehicle : null;

    // 1. CHECK GROUPS ASSIGNED TO AGENT
    const adminGroups = vehicleGroups.filter(g => g.agentIds.includes(agent.uid) && g.status === 'active');
    
    // Check if the agent is explicitly allowed to use this vehicle via permissions.groupIds
    const allowedGroupIds = agent.permissions.groupIds || [];
    const agentGroups = vehicleGroups.filter(g => allowedGroupIds.includes(g.id) && g.status === 'active');
    
    const combinedGroups = Array.from(new Set([...adminGroups, ...agentGroups]));

    // FIND MATCHING GROUP FOR THIS VEHICLE
    const matchingGroup = combinedGroups.find(g => 
      g.vehicleIds.includes(chassisUpper) && 
      !(agent.permissions.excludedVehicleIdsFromGroups || []).includes(chassisUpper)
    );

    if (matchingGroup) {
      setActiveGroup(matchingGroup);
    } else {
      setActiveGroup(null);
      
      // 2. CHECK SPECIFIC VEHICLES PERMISSION
      const isSpeciallyAllowed = (agent.permissions.specificVehicleIds || []).includes(chassisUpper);
      
      if (!isSpeciallyAllowed) {
        if (!vehicle && !agent.permissions.allowUnregisteredChassis) {
          setError('Châssis non autorisé (non inscrit dans la base)');
          return;
        }

        if (vehicle && !agent.permissions.brands.includes(vehicle.brand) && agent.role !== 'admin') {
          setError(`Marque ${vehicle.brand} non autorisée pour votre compte`);
          return;
        }
      }
    }

    setScannedChassis(chassisUpper);
    setStep('mileage');
  };

  const handleVoucherScan = async (code: string) => {
    setError('');
    try {
      const q = query(collection(db, 'vouchers'), where('code', '==', code.toUpperCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setError('Bon invalide ou introuvable');
        return;
      }

      const voucher = snap.docs[0].data() as Voucher;
      
      // VALIDATE VOUCHER
      if (voucher.status !== 'created' && voucher.status !== 'valid_unused') {
        setError('Ce bon est déjà utilisé, expiré ou suspendu');
        return;
      }

      if (voucher.expirationDate && new Date(voucher.expirationDate) < new Date()) {
        setError('Ce bon est expiré');
        return;
      }

      setScannedVoucher(voucher);
      setStep('voucher_details');
    } catch (err) {
      setError('Erreur lors du scan du bon');
    }
  };

  const handleFueling = async () => {
    if (!agent || !fuelQuantity || !selectedSite || !selectedFuelType) return;
    setError('');

    const quantity = parseFloat(fuelQuantity);
    
    // VALIDATE VOUCHER PERMISSIONS
    if (scannedVoucher) {
      if (!scannedVoucher.sites.includes(selectedSite)) {
        setError(`Ce bon n'est pas valable pour le site ${selectedSite}.`);
        return;
      }
      if (!scannedVoucher.fuelTypes.includes(selectedFuelType)) {
        setError(`Ce bon n'est pas valable pour le carburant ${selectedFuelType}.`);
        return;
      }
      if (!scannedVoucher.isOpen && !scannedVoucher.authorizedVehicleIds.includes(scannedChassis)) {
        setError(`Véhicule ${scannedChassis} non autorisé pour ce bon.`);
        return;
      }
      if (quantity > scannedVoucher.liters) {
        setError(`Quantité (${quantity}L) dépasse la limite du bon (${scannedVoucher.liters}L).`);
        return;
      }
    }

    // VALIDATE GROUP PERMISSIONS
    if (activeGroup) {
      if (activeGroup.isKmRequired && (!mileage || parseInt(mileage) <= 0)) {
        setError('Le kilométrage est obligatoire pour ce véhicule.');
        return;
      }

      if (!activeGroup.sites.includes(selectedSite)) {
        setError(`Site ${selectedSite} non autorisé pour ce groupe.`);
        return;
      }

      if (!activeGroup.fuelTypes.includes(selectedFuelType)) {
        setError(`Carburant ${selectedFuelType} non autorisé pour ce groupe.`);
        return;
      }

      // Check limit (simplified logic for demo, real would query firestore for period usage)
      if (quantity > activeGroup.fuelLimit) {
        setError(`Limite de ${activeGroup.fuelLimit}L dépassée pour ce groupe.`);
        return;
      }
    }

    const tank = tanks.find(t => t.site === selectedSite && t.fuelType === selectedFuelType);

    if (!tank) {
      setError('Citerne introuvable pour ce site/carburant');
      return;
    }

    if (tank.currentLevel < quantity) {
      setError('Stock insuffisant dans la citerne');
      return;
    }

      try {
        // 0. Update voucher if it's a voucher usage
        if (scannedVoucher) {
          await updateDoc(doc(db, 'vouchers', scannedVoucher.id), {
            status: 'used',
            usedAt: new Date().toISOString(),
            usedBy: agent.uid
          });
        }

      // 1. Record usage
      await addDoc(collection(db, 'fuel_usages'), {
        date: new Date().toISOString(),
        quantity,
        agentId: agent.uid,
        agentName: `${agent.firstName} ${agent.lastName}`,
        vehicleId: scannedChassis,
        chassisNumber: scannedChassis,
        site: selectedSite,
        fuelType: selectedFuelType,
        mileage: parseInt(mileage) || 0,
        voucherCode: scannedVoucher?.code || null
      });

      // 2. Deduct from tank
      await updateDoc(doc(db, 'tanks', tank.id), {
        currentLevel: increment(-quantity),
        lastUpdated: new Date().toISOString()
      });

      setStep('success');
    } catch (err) {
      console.error(err);
      setError('Erreur lors de l\'enregistrement');
    }
  };

  if (!agent) return null;

  return (
    <div className="max-w-md mx-auto bg-[#1e293b] rounded-3xl border border-white/5 overflow-hidden shadow-2xl min-h-[600px] flex flex-col">
      {/* Header */}
      <div className="bg-[#0ea5e9] p-6 text-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">SmartFuel Mobile</h3>
          <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium">
            {agent.firstName}
          </div>
        </div>
        <p className="text-white/80 text-sm">Identification & Distribution</p>
      </div>

      <div className="flex-1 p-6 flex flex-col">
        <AnimatePresence mode="wait">
          {step === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
            >
              <div className="bg-white p-4 rounded-2xl shadow-xl">
                <QRCodeSVG value={agent.uid} size={180} />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Votre Badge Numérique</h4>
                <p className="text-slate-400 text-sm mt-2">Scannez ce code sur la pompe pour vous identifier</p>
              </div>
              <div className="w-full grid grid-cols-2 gap-4 pt-4">
                <button 
                  onClick={() => setStep('scan')}
                  className="flex flex-col items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all"
                >
                  <Scan className="w-8 h-8 text-[#0ea5e9]" />
                  <span className="text-xs font-medium">Scanner Châssis</span>
                </button>
                <button 
                  onClick={() => setStep('scan_voucher')}
                  className="flex flex-col items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all"
                >
                  <Ticket className="w-8 h-8 text-amber-400" />
                  <span className="text-xs font-medium">Scanner Bon</span>
                </button>
                <button 
                  onClick={() => setStep('manual')}
                  className="flex flex-col items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all"
                >
                  <Keyboard className="w-8 h-8 text-[#0ea5e9]" />
                  <span className="text-xs font-medium">Saisie Manuelle</span>
                </button>
              </div>
            </motion.div>
          )}

          {step === 'scan' && (
            <motion.div key="scan" className="flex-1 flex flex-col">
              <button onClick={() => setStep('home')} className="flex items-center gap-2 text-slate-400 mb-6">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
              <h4 className="text-white font-bold mb-4">Scanner le Châssis</h4>
              <div id="reader" className="rounded-2xl overflow-hidden border border-white/10" />
              <p className="text-center text-slate-500 text-xs mt-4">Placez le numéro de châssis dans le cadre</p>
            </motion.div>
          )}

          {step === 'scan_voucher' && (
            <motion.div key="scan_voucher" className="flex-1 flex flex-col">
              <button onClick={() => setStep('home')} className="flex items-center gap-2 text-slate-400 mb-6">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
              <h4 className="text-white font-bold mb-4">Scanner un Bon (Voucher)</h4>
              <div id="reader" className="rounded-2xl overflow-hidden border border-white/10" />
              <p className="text-center text-slate-500 text-xs mt-4">Placez le QR Code du bon dans le cadre</p>
            </motion.div>
          )}

          {step === 'voucher_details' && scannedVoucher && (
            <motion.div key="voucher_details" className="flex-1 flex flex-col space-y-6">
              <button onClick={() => setStep('home')} className="flex items-center gap-2 text-slate-400 mb-2">
                <ArrowLeft className="w-4 h-4" /> Annuler
              </button>
              
              <div className="bg-[#0ea5e9]/10 p-6 rounded-2xl border border-[#0ea5e9]/20 text-center space-y-2">
                <Ticket className="w-12 h-12 text-[#0ea5e9] mx-auto mb-2" />
                <h4 className="text-3xl font-bold text-white">{scannedVoucher.liters}L</h4>
                <p className="text-xs font-mono text-[#0ea5e9] uppercase tracking-widest">{scannedVoucher.code}</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3">
                  <h5 className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2">
                    <Droplets className="w-3 h-3" /> Conditions du Bon
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {scannedVoucher.fuelTypes.map(f => (
                      <span key={f} className="text-[10px] px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize">{f}</span>
                    ))}
                    {scannedVoucher.sites.map(s => (
                      <span key={s} className="text-[10px] px-2 py-1 rounded-full bg-slate-500/10 text-slate-300 border border-white/10">{s}</span>
                    ))}
                    {scannedVoucher.isOpen && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">BON OUVERT</span>
                    )}
                  </div>
                </div>

                {!scannedVoucher.isOpen && (
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3">
                    <h5 className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2">
                      <Car className="w-3 h-3" /> Véhicules Autorisés
                    </h5>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                      {scannedVoucher.authorizedVehicleIds.map(id => (
                        <p key={id} className="text-xs font-mono text-white opacity-60">{id}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto space-y-3">
                <button 
                  onClick={() => {
                    // Pre-fill fields but don't skip car scan if it's an open voucher
                    setSelectedFuelType(scannedVoucher.fuelTypes[0] || 'gasoil');
                    setFuelQuantity(scannedVoucher.liters.toString());
                    
                    if (!scannedChassis) {
                      setStep('scan'); // Go back to scan the car
                    } else {
                      setStep('mileage');
                    }
                  }}
                  className="w-full bg-[#0ea5e9] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#0ea5e9]/20"
                >
                  Continuer avec ce Bon
                </button>
              </div>
            </motion.div>
          )}

          {step === 'mileage' && (
            <motion.div key="mileage" className="flex-1 flex flex-col">
              <h4 className="text-white font-bold mb-2">Kilométrage du Véhicule</h4>
              <div className="flex items-center gap-2 mb-4">
                <p className="text-slate-400 text-sm">Châssis: <span className="text-white font-mono">{scannedChassis}</span></p>
                {activeGroup && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0ea5e9]/10 text-[#0ea5e9] text-[10px] font-bold border border-[#0ea5e9]/20">
                    <Layers className="w-3 h-3" />
                    {activeGroup.name}
                  </div>
                )}
              </div>
              <input 
                type="number"
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-2xl font-bold mb-4 focus:border-[#0ea5e9] outline-none"
                placeholder="000000"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
              />
              <p className="text-slate-500 text-xs mb-8 italic">Entrez 0000 pour ignorer cette étape</p>
              <button 
                onClick={() => setStep('fueling')}
                disabled={!mileage}
                className="w-full bg-[#0ea5e9] text-white font-bold py-4 rounded-xl disabled:opacity-50"
              >
                Continuer
              </button>
            </motion.div>
          )}

          {step === 'fueling' && (
            <motion.div key="fueling" className="flex-1 flex flex-col space-y-6">
              <h4 className="text-white font-bold">Détails de Distribution</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Site</label>
                  <div className="grid grid-cols-2 gap-2">
                    {agent.permissions.sites.map(site => (
                      <button 
                        key={site}
                        onClick={() => setSelectedSite(site)}
                        className={`py-3 rounded-xl border transition-all text-sm font-medium ${
                          selectedSite === site ? 'bg-[#0ea5e9] border-[#0ea5e9] text-white' : 'bg-white/5 border-white/5 text-slate-400'
                        }`}
                      >
                        {site}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Carburant</label>
                  <div className="grid grid-cols-2 gap-2">
                    {agent.permissions.fuelTypes.map(type => (
                      <button 
                        key={type}
                        onClick={() => setSelectedFuelType(type)}
                        className={`py-3 rounded-xl border transition-all text-sm font-medium capitalize ${
                          selectedFuelType === type ? 'bg-[#0ea5e9] border-[#0ea5e9] text-white' : 'bg-white/5 border-white/5 text-slate-400'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Quantité (Litres)</label>
                  <input 
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-2xl font-bold focus:border-[#0ea5e9] outline-none"
                    placeholder="0.00"
                    value={fuelQuantity}
                    onChange={(e) => setFuelQuantity(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-4 rounded-xl">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

              <button 
                onClick={handleFueling}
                disabled={!fuelQuantity || !selectedSite}
                className="w-full bg-[#0ea5e9] text-white font-bold py-4 rounded-xl disabled:opacity-50 mt-auto shadow-lg shadow-[#0ea5e9]/20"
              >
                Valider la Distribution
              </button>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
            >
              <div className="w-24 h-24 bg-emerald-400/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-white font-bold text-2xl">Succès !</h4>
                <p className="text-slate-400 mt-2 px-8">La distribution de {fuelQuantity}L a été enregistrée avec succès.</p>
              </div>
              <button 
                onClick={() => {
                  setStep('home');
                  setFuelQuantity('');
                  setScannedChassis('');
                  setMileage('');
                  setError('');
                }}
                className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-xl border border-white/5 transition-all"
              >
                Nouvelle Distribution
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
