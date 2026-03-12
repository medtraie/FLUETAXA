import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, addDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { Agent, Tank, Vehicle, FuelType } from '../types';
import { QrCode, Scan, Car, Fuel, MapPin, CheckCircle2, AlertCircle, ArrowLeft, Keyboard } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';

interface MobileAppProps {
  agent: Agent | null;
}

export default function MobileApp({ agent }: MobileAppProps) {
  const [step, setStep] = useState<'home' | 'scan' | 'manual' | 'mileage' | 'fueling' | 'success'>('home');
  const [scannedChassis, setScannedChassis] = useState('');
  const [mileage, setMileage] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState<FuelType>('gasoil');
  const [fuelQuantity, setFuelQuantity] = useState('');
  const [error, setError] = useState('');
  const [tanks, setTanks] = useState<Tank[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tanks'), (snap) => {
      setTanks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tank)));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (step === 'scan') {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        handleChassisSubmit(decodedText);
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

    if (!vehicle && !agent.permissions.allowUnregisteredChassis) {
      setError('Châssis non autorisé (non inscrit dans la base)');
      return;
    }

    if (vehicle && !agent.permissions.brands.includes(vehicle.brand) && agent.role !== 'admin') {
      setError(`Marque ${vehicle.brand} non autorisée pour votre compte`);
      return;
    }

    setScannedChassis(chassisUpper);
    setStep('mileage');
  };

  const handleFueling = async () => {
    if (!agent || !fuelQuantity || !selectedSite || !selectedFuelType) return;

    const quantity = parseFloat(fuelQuantity);
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
        mileage: parseInt(mileage) || 0
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

          {step === 'manual' && (
            <motion.div key="manual" className="flex-1 flex flex-col">
              <button onClick={() => setStep('home')} className="flex items-center gap-2 text-slate-400 mb-6">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
              <h4 className="text-white font-bold mb-4">Saisie Manuelle du Châssis</h4>
              <input 
                type="text"
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white font-mono text-lg mb-4 focus:border-[#0ea5e9] outline-none"
                placeholder="WVWZZZ..."
                onChange={(e) => {
                  if (e.target.value.length >= 8) handleChassisSubmit(e.target.value);
                }}
              />
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-4 rounded-xl">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}
            </motion.div>
          )}

          {step === 'mileage' && (
            <motion.div key="mileage" className="flex-1 flex flex-col">
              <h4 className="text-white font-bold mb-2">Kilométrage du Véhicule</h4>
              <p className="text-slate-400 text-sm mb-6">Châssis: <span className="text-white font-mono">{scannedChassis}</span></p>
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
