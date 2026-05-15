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

export type LimitPeriod = 'day' | 'week' | 'month';
export type Frequency = 'once' | 'once_per_day' | 'once_per_week' | 'once_per_month';

export interface VehicleGroup {
  id: string;
  name: string;
  vehicleIds: string[]; // chassis numbers
  agentIds: string[]; // agent UIDs
  fuelLimit: number;
  limitPeriod: LimitPeriod;
  isCumulable: boolean;
  frequency: Frequency;
  sites: string[];
  fuelTypes: FuelType[];
  isKmRequired: boolean;
  status: AgentStatus;
  createdAt: string;
}

export interface AgentPermissions {
  sites: string[];
  fuelTypes: FuelType[];
  brands: Brand[];
  allowUnregisteredChassis: boolean;
  monthlyLimit: number;
  fillLimit: number;
  groupIds?: string[];
  specificVehicleIds?: string[];
  excludedVehicleIdsFromGroups?: string[];
}

export interface Agent {
  uid: string;
  firstName: string;
  lastName: string;
  password?: string;
  role: AgentRole;
  status: AgentStatus;
  permissions: AgentPermissions;
  registeredDeviceId?: string;
  deviceDescription?: string;
}

export type VoucherStatus = 'created' | 'used' | 'expired' | 'valid_unused' | 'suspended';
export type VoucherValidity = '1_month' | '2_months' | '1_year' | 'unlimited';

export interface Voucher {
  id: string;
  code: string; // The QR content
  liters: number;
  authorizedVehicleIds: string[];
  isOpen: boolean;
  validity: VoucherValidity;
  expirationDate?: string;
  isSellable: boolean;
  status: VoucherStatus;
  fuelTypes: FuelType[];
  sites: string[];
  creationDate: string;
  createdAt: string;
  usedAt?: string;
  usedBy?: string;
}
