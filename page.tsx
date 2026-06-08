'use client';

import { useState, useCallback, useRef } from 'react';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import type { Libraries } from '@react-google-maps/api';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';
import {
  formatCurrency,
  formatDistance,
  formatDuration,
  generateId,
  calcularValorTotal,
} from '@/lib/utils';
import {
  Plus,
  X,
  Navigation,
  DollarSign,
  Clock,
  Route,
  Share2,
  FileText,
  MapPin,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Home,
  GripVertical,
  Pencil,
} from 'lucide-react';

const MapaGoogle = dynamic(() => import('../components/MapaGoogle'), { ssr: false });

const LIBRARIES: Libraries = ['places'];

interface Parada {
  id: string;
  endereco: string;
}

interface RotaResult {
  paradasOrdenadas: Parada[];
  legs: google.maps.DirectionsLeg[];
  distanciaTotal: number; // km
  tempoTotal: number; // minutes
  mapsUrl: string;
  directions: google.maps.DirectionsResult;
}

export default function RotasPage() {
  const { configuracoes, addHistorico } = useAppStore();
  const [paradas, setParadas] = useState<Parada[]>([{ id: generateId(), endereco: '' }]);
  const [calculando, setCalculando] = useState(false);
  const [rota, setRota] = useState<RotaResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState(false);
  const [salva, setSalva] = useState(false);
  const [kmEditado, setKmEditado] = useState<number | null>(null);
  const [editandoKm, setEditandoKm] = useState(false);
  const [kmInput, setKmInput] = useState('');

  const autocompleteRefs = useRef<Map<string, google.maps.places.Autocomplete>>(new Map());

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: LIBRARIES,
    language: 'pt-BR',
    region: 'BR',
  });

  const origemCompleta = `${configuracoes.origemEndereco}, ${configuracoes.origemCidade}`;

  const addParada = useCallback(() => {
    setParadas((p) => [...p, { id: generateId(), endereco: '' }]);
    setRota(null);
    setSalva(false);
  }, []);

  const removeParada = useCallback((id: string) => {
    setParadas((p) => p.filter((x) => x.id !== id));
    setRota(null);
    setSalva(false);
  }, []);

  const updateParada = useCallback((id: string, endereco: string) => {
    setParadas((p) => p.map((x) => (x.id === id ? { ...x, endereco } : x)));
    setRota(null);
    setSalva(false);
  }, []);

  const onAutocompleteLoad = useCallback(
    (id: string, ac: google.maps.places.Autocomplete) => {
      autocompleteRefs.current.set(id, ac);
    },
    []
  );

  const onPlaceChanged = useCallback((id: string) => {
    const ac = autocompleteRefs.current.get(id);
    if (!ac) return;
    const place = ac.getPlace();
    const addr = place.formatted_address || place.name || '';
    if (addr) {
      setParadas((prev) => prev.map((p) => (p.id === id ? { ...p, endereco: addr } : p)));
      setRota(null);
      setSalva(false);
    }
  }, []);

  async function otimizarRota() {
    const validas = paradas.filter((p) => p.endereco.trim());
    if (!validas.length) return;

    setCalculando(true);
    setErro(null);
    setRota(null);
    setKmEditado(null);
    setEditandoKm(false);

    try {
      const service = new google.maps.DirectionsService();
      const result = await service.route({
        origin: origemCompleta,
        destination: origemCompleta,
        waypoints: validas.map((p) => ({ location: p.endereco, stopover: true })),
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        region: 'BR',
      });

      const route = result.routes[0];
      const optimizedOrder: number[] = route.waypoint_order;
      const paradasOrdenadas = optimizedOrder.map((i) => validas[i]);

      let distMetros = 0;
      let tempoSeg = 0;
      route.legs.forEach((leg) => {
        distMetros += leg.distance?.value ?? 0;
        tempoSeg += leg.duration?.value ?? 0;
      });

      const distKm = distMetros / 1000;
      const tempoMin = tempoSeg / 60;

      const mapsParams = new URLSearchParams();
      mapsParams.set('api', '1');
      mapsParams.set('origin', origemCompleta);
      mapsParams.set('destination', origemCompleta);
      mapsParams.set('waypoints', paradasOrdenadas.map((p) => p.endereco).join('|'));
      mapsParams.set('travelmode', 'driving');
      const mapsUrl = `https://www.google.com/maps/dir/?${mapsParams.toString()}`;

      setRota({
        paradasOrdenadas,
        legs: route.legs,
        distanciaTotal: distKm,
        tempoTotal: tempoMin,
        mapsUrl,
        directions: result,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('ZERO_RESULTS')) {
        setErro('Não foi possível encontrar rota entre os endereços. Verifique os endereços e tente novamente.');
      } else if (msg.includes('NOT_FOUND')) {
        setErro('Um ou mais endereços não foram encontrados. Use o autocomplete para selecionar os endereços corretamente.');
      } else {
        setErro('Erro ao calcular rota. Verifique os endereços e tente novamente.');
      }
    } finally {
      setCalculando(false);
    }
  }

  function salvarRota() {
    if (!rota || salva) return;
    const clinicas = rota.paradasOrdenadas.map((p) => ({
      id: p.id,
      nome: p.endereco,
      endereco: p.endereco,
      bairro: '',
      cidade: '',
      cep: '',
      telefone: '',
      whatsapp: '',
    }));
    addHistorico({
      id: generateId(),
      data: new Date().toISOString(),
      nomeMotoBoy: configuracoes.nomeMotoBoy,
      clinicas,
      distanciaTotal: kmFinal,
      tempoEstimado: rota.tempoTotal,
      valorTotal: calcularValorTotal(
        configuracoes.diaria,
        rota.distanciaTotal,
        configuracoes.valorPorKm
      ),
      valorDiaria: configuracoes.diaria,
      valorKm: configuracoes.valorPorKm,
      ordemRota: rota.paradasOrdenadas.map((p) => p.id),
      mapsUrl: rota.mapsUrl,
    });
    setSalva(true);
  }

  const kmFinal = rota ? (kmEditado ?? rota.distanciaTotal) : 0;
  const valorTotal = rota
    ? calcularValorTotal(configuracoes.diaria, kmFinal, configuracoes.valorPorKm)
    : 0;

  function whatsappMsg() {
    if (!rota) return '#';
    const lista = rota.paradasOrdenadas
      .map((p, i) => `${i + 1}. ${p.endereco}`)
      .join('\n');
    const msg =
      `🚛 *ROTA DO DIA*\n\n` +
      `Motoboy: ${configuracoes.nomeMotoBoy}\n\n` +
      `📍 *Origem:* ${configuracoes.origemNome}\n\n` +
      `🏥 *Paradas:*\n${lista}\n\n` +
      `📏 *Distância Total:* ${formatDistance(rota.distanciaTotal)}\n` +
      `⏱ *Tempo Estimado:* ${formatDuration(rota.tempoTotal)}\n\n` +
      `💰 *Valor da Diária:* ${formatCurrency(configuracoes.diaria)}\n` +
      `📐 *Valor por KM:* ${formatCurrency(configuracoes.valorPorKm)}\n` +
      `💵 *Total a Receber:* ${formatCurrency(valorTotal)}\n\n` +
      `🗺 *Link da rota:*\n${rota.mapsUrl}\n\n` +
      `Boa rota! 🚀`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-400 font-semibold">Erro ao carregar Google Maps</p>
          <p className="text-gray-500 text-sm mt-1">
            Verifique se a chave de API está configurada corretamente no arquivo .env.local
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Painel esquerdo ── */}
      <div className="w-full lg:w-96 xl:w-[430px] flex-shrink-0 flex flex-col bg-gray-950 border-r border-gray-800 overflow-y-auto">
        <div className="p-5 border-b border-gray-800">
          <h1 className="text-lg font-bold">Calcular Rota</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Otimização real via Google Maps · menor distância
          </p>
        </div>

        <div className="flex-1 p-4 space-y-4">

          {/* Origem fixa */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Origem &amp; Retorno
            </p>
            <div className="flex items-center gap-2.5 bg-green-500/10 border border-green-500/25 rounded-xl px-3 py-2.5">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <Home size={11} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-300 truncate">
                  {configuracoes.origemNome}
                </p>
                <p className="text-xs text-green-700 truncate">
                  {configuracoes.origemEndereco}, {configuracoes.origemCidade}
                </p>
              </div>
            </div>
          </div>

          {/* Paradas */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Destinos
            </p>
            <div className="space-y-2">
              {paradas.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <GripVertical size={14} className="text-gray-700 flex-shrink-0" />
                  <div className="flex items-center gap-2 flex-1 bg-gray-900 border border-gray-700 focus-within:border-blue-500 rounded-xl px-3 py-2.5 transition-colors">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    {isLoaded ? (
                      <Autocomplete
                        onLoad={(ac) => onAutocompleteLoad(p.id, ac)}
                        onPlaceChanged={() => onPlaceChanged(p.id)}
                        options={{ componentRestrictions: { country: 'br' } }}
                        className="flex-1 min-w-0"
                      >
                        <input
                          value={p.endereco}
                          onChange={(e) => updateParada(p.id, e.target.value)}
                          placeholder="Rua, número, bairro, cidade..."
                          className="w-full bg-transparent text-sm focus:outline-none placeholder-gray-600"
                        />
                      </Autocomplete>
                    ) : (
                      <input
                        value={p.endereco}
                        onChange={(e) => updateParada(p.id, e.target.value)}
                        placeholder="Carregando Google Maps..."
                        className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600 min-w-0"
                        disabled
                      />
                    )}
                  </div>
                  {paradas.length > 1 && (
                    <button
                      onClick={() => removeParada(p.id)}
                      className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addParada}
              className="mt-2 w-full flex items-center justify-center gap-1.5 text-blue-400 hover:text-blue-300 border border-dashed border-gray-700 hover:border-blue-500/40 rounded-xl py-2 text-sm font-medium transition-colors"
            >
              <Plus size={14} /> Adicionar parada
            </button>
          </div>

          {/* Botão otimizar */}
          <button
            onClick={otimizarRota}
            disabled={!isLoaded || !paradas.some((p) => p.endereco.trim()) || calculando}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            {calculando ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Calculando via Google Maps...
              </>
            ) : (
              <>
                <Navigation size={16} /> OTIMIZAR ROTA
              </>
            )}
          </button>

          {/* Erro */}
          {erro && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <p className="whitespace-pre-wrap">{erro}</p>
            </div>
          )}

          {/* ── Resultado ── */}
          {rota && (
            <div className="space-y-3 pb-4">

              {/* Resumo financeiro */}
              <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4 space-y-2 text-sm">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                  Resumo do dia · {new Date().toLocaleDateString('pt-BR')}
                </p>
                <p className="text-xs text-gray-400">
                  Motoboy: <span className="text-white font-medium">{configuracoes.nomeMotoBoy}</span>
                </p>
                <p className="text-xs text-gray-400">
                  Clínicas: <span className="text-white font-medium">{rota.paradasOrdenadas.length}</span>
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                {/* Km editável */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center relative group">
                  <Route size={16} className="mx-auto text-blue-400 mb-1" />
                  {editandoKm ? (
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={kmInput}
                        onChange={(e) => setKmInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const v = parseFloat(kmInput);
                            if (!isNaN(v) && v > 0) setKmEditado(v);
                            setEditandoKm(false);
                          }
                          if (e.key === 'Escape') setEditandoKm(false);
                        }}
                        onBlur={() => {
                          const v = parseFloat(kmInput);
                          if (!isNaN(v) && v > 0) setKmEditado(v);
                          setEditandoKm(false);
                        }}
                        autoFocus
                        className="w-14 bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-xs text-center focus:outline-none"
                      />
                      <span className="text-xs text-gray-400">km</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setKmInput(String(kmFinal.toFixed(1)));
                        setEditandoKm(true);
                      }}
                      className="group/btn flex items-center justify-center gap-1 mx-auto"
                      title="Clique para editar o km"
                    >
                      <span className="text-sm font-bold">{formatDistance(kmFinal)}</span>
                      <Pencil size={10} className="text-gray-600 group-hover/btn:text-blue-400 transition-colors" />
                    </button>
                  )}
                  {kmEditado !== null && (
                    <p className="text-[10px] text-blue-400 mt-0.5">editado</p>
                  )}
                  {kmEditado === null && <p className="text-xs text-gray-500">Total</p>}
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                  <Clock size={16} className="mx-auto text-yellow-400 mb-1" />
                  <p className="text-sm font-bold">{formatDuration(rota.tempoTotal)}</p>
                  <p className="text-xs text-gray-500">Estimado</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                  <DollarSign size={16} className="mx-auto text-green-400 mb-1" />
                  <p className="text-sm font-bold text-green-400">{formatCurrency(valorTotal)}</p>
                  <p className="text-xs text-gray-500">A pagar</p>
                </div>
              </div>

              {/* Cálculo */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Cálculo do pagamento</p>
                <div className="flex justify-between text-gray-400">
                  <span>Diária</span>
                  <span className="text-white">{formatCurrency(configuracoes.diaria)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{formatDistance(kmFinal)} × {formatCurrency(configuracoes.valorPorKm)}/km</span>
                  <span className="text-white">
                    {formatCurrency(kmFinal * configuracoes.valorPorKm)}
                  </span>
                </div>
                <div className="flex justify-between font-bold border-t border-gray-800 pt-2">
                  <span>Total a pagar</span>
                  <span className="text-green-400 text-base">{formatCurrency(valorTotal)}</span>
                </div>
              </div>

              {/* Ordem otimizada */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setDetalhes(!detalhes)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-gray-800/50 transition-colors"
                >
                  <span>Ordem otimizada pelo Google</span>
                  {detalhes ? (
                    <ChevronUp size={15} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={15} className="text-gray-400" />
                  )}
                </button>
                {detalhes && (
                  <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gray-800">
                    {/* Origem */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <Home size={10} className="text-white" />
                      </div>
                      <div className="pt-0.5">
                        <p className="text-xs font-semibold text-green-300">{configuracoes.origemNome}</p>
                        <p className="text-xs text-gray-500">{configuracoes.origemEndereco}</p>
                      </div>
                    </div>
                    {/* Paradas */}
                    {rota.paradasOrdenadas.map((p, i) => {
                      const leg = rota.legs[i];
                      return (
                        <div key={p.id} className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold flex-shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 pt-0.5">
                            <p className="text-xs font-medium leading-snug">{p.endereco}</p>
                            {leg && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {leg.distance?.text} · {leg.duration?.text}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Retorno */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <Home size={10} className="text-green-400" />
                      </div>
                      <div className="pt-0.5">
                        <p className="text-xs font-semibold text-green-400">Retorno ao laboratório</p>
                        {rota.legs[rota.legs.length - 1] && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {rota.legs[rota.legs.length - 1].distance?.text} · {rota.legs[rota.legs.length - 1].duration?.text}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Ações */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={rota.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-medium transition-colors"
                >
                  <MapPin size={14} /> Abrir no Maps
                </a>
                <a
                  href={whatsappMsg()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-xs font-medium transition-colors"
                >
                  <Share2 size={14} /> WhatsApp
                </a>
              </div>
              <button
                onClick={salvarRota}
                disabled={salva}
                className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  salva
                    ? 'bg-gray-800 text-gray-500'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                }`}
              >
                <FileText size={14} />
                {salva ? '✓ Salvo no histórico' : 'Salvar no histórico'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mapa direito ── */}
      <div className="flex-1 relative min-h-[350px] bg-gray-900">
        {isLoaded ? (
          <MapaGoogle
            directions={rota?.directions ?? null}
            center={undefined}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-8">
            <div className="w-12 h-12 rounded-full border-3 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-gray-400 text-sm">Carregando Google Maps...</p>
          </div>
        )}

        {/* Placeholder quando sem rota */}
        {isLoaded && !rota && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-8 pointer-events-none">
            <div className="bg-gray-900/80 backdrop-blur rounded-2xl p-6 border border-gray-700">
              <Navigation size={28} className="mx-auto text-blue-400 mb-2" />
              <p className="text-gray-300 font-semibold text-sm">O mapa aparecerá aqui</p>
              <p className="text-gray-500 text-xs mt-1">
                Digite os endereços e clique em &ldquo;Otimizar Rota&rdquo;
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
