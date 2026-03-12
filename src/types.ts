export type FuelType = 'gasoil' | 'essence';
export type Brand = 'Skoda' | 'Volkswagen' | 'Seat' | 'Cupra' | 'Audi' | 'Porsche' | 'Bentley' | 'Autre';
export type AgentRole = 'admin' | 'agent';
export type AgentStatus = 'active' | 'suspended';

export interface Tank {
  id: string;
  name: string;
  site: string;
  fuelType: FuelType;
  capacity: number;
  currentLevel: number;
  lastUpdated: string;
}

export interface FuelSupply {
  id?: string;
  date: string;
  quantity: number;
  supplier: string;
  site: string;
  fuelType: FuelType;
  tankId: string;
}

export interface FuelUsage {
  id?: string;
  date: string;
  quantity: number;
  agentId: string;
  agentName: string;
  vehicleId: string;
  chassisNumber: string;
  site: string;
  fuelType: FuelType;
  mileage: number;
}

export interface Vehicle {
  chassisNumber: string;
  brand: Brand;
  addedAt: string;
}

export interface AgentPermissions {
  sites: string[];
  fuelTypes: FuelType[];
  brands: Brand[];
  allowUnregisteredChassis: boolean;
  monthlyLimit: number;
  fillLimit: number;
}

export interface Agent {
  uid: string;
  firstName: string;
  lastName: string;
  password?: string; // Added for custom login
  role: AgentRole;
  status: AgentStatus;
  permissions: AgentPermissions;
}
