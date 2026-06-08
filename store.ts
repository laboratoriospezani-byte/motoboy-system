import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Clinica {
  id: string;
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  cep: string;
  telefone: string;
  whatsapp: string;
}

export interface RotaHistorico {
  id: string;
  data: string;
  nomeMotoBoy: string;
  clinicas: Clinica[];
  distanciaTotal: number;
  tempoEstimado: number;
  valorTotal: number;
  valorDiaria: number;
  valorKm: number;
  ordemRota: string[];
  mapsUrl: string;
}

export interface Configuracoes {
  diaria: number;
  valorPorKm: number;
  nomeMotoBoy: string;
  origemNome: string;
  origemEndereco: string;
  origemCidade: string;
}

interface AppState {
  clinicas: Clinica[];
  historico: RotaHistorico[];
  configuracoes: Configuracoes;
  addClinica: (clinica: Clinica) => void;
  updateClinica: (id: string, clinica: Partial<Clinica>) => void;
  deleteClinica: (id: string) => void;
  addHistorico: (rota: RotaHistorico) => void;
  updateConfiguracoes: (config: Partial<Configuracoes>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      clinicas: [],
      historico: [],
      configuracoes: {
        diaria: 50,
        valorPorKm: 1,
        nomeMotoBoy: 'João',
        origemNome: 'Laboratório Spezani',
        origemEndereco: 'Rua Principal, Nº 100',
        origemCidade: 'São Paulo, SP',
      },
      addClinica: (clinica) =>
        set((state) => ({ clinicas: [...state.clinicas, clinica] })),
      updateClinica: (id, clinica) =>
        set((state) => ({
          clinicas: state.clinicas.map((c) => (c.id === id ? { ...c, ...clinica } : c)),
        })),
      deleteClinica: (id) =>
        set((state) => ({ clinicas: state.clinicas.filter((c) => c.id !== id) })),
      addHistorico: (rota) =>
        set((state) => ({ historico: [rota, ...state.historico] })),
      updateConfiguracoes: (config) =>
        set((state) => ({ configuracoes: { ...state.configuracoes, ...config } })),
    }),
    { name: 'spezani-storage' }
  )
);
