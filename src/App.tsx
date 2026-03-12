import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User, signInWithEmailAndPassword, signInWithRedirect } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { Agent, Tank, FuelUsage, Vehicle } from './types';
import Dashboard from './components/Dashboard';
import TanksModule from './components/TanksModule';
import VehiclesModule from './components/VehiclesModule';
import AgentsModule from './components/AgentsModule';
import MobileApp from './components/MobileApp';
import MovementsModule from './components/MovementsModule';
import { Layout, Fuel, Car, Users, Smartphone, History, LogOut, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const agentDoc = await getDoc(doc(db, 'agents', u.uid));
        if (agentDoc.exists()) {
          setAgent(agentDoc.data() as Agent);
        } else {
          // Create default agent for the first user (admin)
          const isFirstAdmin = u.email === 'medoraelis93@gmail.com';
          const newAgent: Agent = {
            uid: u.uid,
            firstName: u.displayName?.split(' ')[0] || 'Admin',
            lastName: u.displayName?.split(' ')[1] || 'User',
            role: isFirstAdmin ? 'admin' : 'agent',
            status: 'active',
            permissions: {
              sites: ['Site 1', 'Site 2'],
              fuelTypes: ['gasoil', 'essence'],
              brands: ['Skoda', 'Volkswagen', 'Seat', 'Cupra', 'Audi', 'Porsche', 'Bentley', 'Autre'],
              allowUnregisteredChassis: true,
              monthlyLimit: 0,
              fillLimit: 0
            }
          };
          await setDoc(doc(db, 'agents', u.uid), newAgent);
          setAgent(newAgent);
        }
      } else {
        setAgent(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const [loginData, setLoginData] = useState({ firstName: '', lastName: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    
    try {
      // Create a virtual email from the names
      const email = `${loginData.firstName.toLowerCase().trim()}.${loginData.lastName.toLowerCase().trim()}@smartfuel.local`;
      
      // Use Firebase Auth directly - this bypasses Firestore permission issues for login
      const userCredential = await signInWithEmailAndPassword(auth, email, loginData.password);
      const u = userCredential.user;

      const agentDoc = await getDoc(doc(db, 'agents', u.uid));
      if (agentDoc.exists()) {
        const agentData = agentDoc.data() as Agent;
        if (agentData.status === 'suspended') {
          await signOut(auth);
          setLoginError('Votre compte est suspendu.');
          setLoading(false);
          return;
        }
        setAgent(agentData);
        setUser(u);
      } else {
        setLoginError("Compte authentifié mais données d'agent introuvables.");
      }
    } catch (error: any) {
      console.error("Login error", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setLoginError('Identifiants incorrects (Prénom, Nom ou Mot de passe).');
      } else if (error.code === 'auth/invalid-email') {
        setLoginError('Format de nom invalide.');
      } else {
        setLoginError(`Erreur: ${error.message || 'Une erreur est survenue'}`);
      }
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setLoading(true);
      setLoginError('');
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch {}
      }
      if (code === 'auth/operation-not-allowed') {
        setLoginError('Connexion Google non activée dans Firebase.');
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setLoginError(`Domaine non autorisé dans Firebase Authentication: ${host}`);
      } else if (code === 'auth/popup-closed-by-user') {
        setLoginError('Fenêtre de connexion fermée avant la fin.');
      } else if (code === 'auth/network-request-failed') {
        setLoginError('Échec réseau lors de la connexion.');
      } else {
        setLoginError('Impossible de se connecter avec Google. Réessayez plus tard.');
      }
    }
    setLoading(false);
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e1726] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0ea5e9]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0e1726] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1e293b] p-8 rounded-2xl shadow-xl max-w-md w-full border border-white/5"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#0ea5e9]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Fuel className="w-8 h-8 text-[#0ea5e9]" />
            </div>
            <h1 className="text-2xl font-bold text-white">SmartFuel</h1>
            <p className="text-slate-400 text-sm">Système de Gestion de Carburant</p>
          </div>

          <form onSubmit={handleCustomLogin} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Prénom</label>
                <input 
                  type="text"
                  required
                  value={loginData.firstName}
                  onChange={(e) => setLoginData({...loginData, firstName: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#0ea5e9] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Nom</label>
                <input 
                  type="text"
                  required
                  value={loginData.lastName}
                  onChange={(e) => setLoginData({...loginData, lastName: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#0ea5e9] outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Mot de passe</label>
              <input 
                type="password"
                required
                value={loginData.password}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#0ea5e9] outline-none"
              />
            </div>

            {loginError && (
              <p className="text-red-400 text-xs text-center">{loginError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-[#0ea5e9]/20"
            >
              Se connecter
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#1e293b] px-2 text-slate-500">Ou Administration</span></div>
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 border border-white/5"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
            Admin Google Login
          </button>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Layout, roles: ['admin', 'agent'] },
    { id: 'tanks', label: 'Citernes', icon: Fuel, roles: ['admin'] },
    { id: 'vehicles', label: 'Véhicules', icon: Car, roles: ['admin'] },
    { id: 'agents', label: 'Agents & Permissions', icon: Users, roles: ['admin'] },
    { id: 'movements', label: 'Mouvements', icon: History, roles: ['admin'] },
    { id: 'mobile', label: 'App Agent', icon: Smartphone, roles: ['admin', 'agent'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(agent?.role || 'agent'));

  return (
    <div className="min-h-screen bg-[#0e1726] text-slate-200 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#1e293b] border-r border-white/5 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-8 h-8 bg-[#0ea5e9] rounded-lg flex items-center justify-center">
            <Fuel className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">SmartFuel</span>
        </div>
        
        <nav className="p-4 space-y-2">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-[#0ea5e9] text-white shadow-lg shadow-[#0ea5e9]/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-white/10" alt="Avatar" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 capitalize">{agent?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-[#1e293b] border-b border-white/5 flex items-center justify-between px-6 lg:px-8">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-white"
          >
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
          <h2 className="text-lg font-semibold text-white">
            {navItems.find(i => i.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs text-slate-500">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'tanks' && <TanksModule />}
              {activeTab === 'vehicles' && <VehiclesModule />}
              {activeTab === 'agents' && <AgentsModule />}
              {activeTab === 'movements' && <MovementsModule />}
              {activeTab === 'mobile' && <MobileApp agent={agent} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
