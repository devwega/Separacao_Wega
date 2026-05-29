import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

/**
 * Extrai SEMPRE uma string de um erro de requisicao.
 * O backend retorna { error: "msg" }, mas erros de plataforma (ex.: 500 do Vercel)
 * retornam { error: { code, message } } — renderizar esse objeto direto quebra o React.
 */
export function extractErrorMessage(e: any, fallback = "Erro"): string {
  const data = e?.response?.data;
  const err = data?.error;
  if (typeof err === "string" && err) return err;
  if (err && typeof err === "object") return err.message || err.code || JSON.stringify(err);
  if (typeof data?.message === "string") return data.message;
  if (typeof e?.message === "string") return e.message;
  return fallback;
}

export type Pedido = {
  nunota: number;
  id: string;
  cliente: string;
  embarcacao: string;
  horarioCarregamento: string;
  status: "pendente" | "separacao" | "conforme" | "bloqueado";
  totalItens: number;
  itensSeparados: number;
  pendencias: number;
  alertaValidade: boolean;
  prioridade: "critica" | "alta" | "media" | "baixa" | "normal";
  vlrNota: number;
  percProgresso: number;
  statusPedido:
    | "LANCADO"
    | "LIBERADO_SEPARACAO"
    | "EM_SEPARACAO"
    | "COM_FALTA_ANALISE"
    | "AGUARDANDO_DECISAO"
    | "APROVADO_ALTERACAO"
    | "REPROVADO"
    | "APROVADO_FLUXO_DISTINTO"
    | "LIBERADO_FATURAMENTO"
    | "FATURADO";
};

export type PedidoSummary = {
  totalPedidos: number;
  emSeparacao: number;
  comPendencias: number;
  concluidos: number;
};

export type ItemPedido = {
  id: number;
  codprod: number;
  descricao: string;
  codigo: string;
  eanEsperado: string;
  qtdPedida: number;
  qtdSeparada: number;
  lote: string;
  statusLote: string;
  status: "conforme" | "separacao" | "pendente";
};

export type PedidoDetalhe = {
  NUNOTA: number;
  NUNNOTA: string;
  cliente: string;
  embarcacao: string;
  horarioCarregamento: string;
  vendedor: string;
  separador: string;
  prioridade: string;
  percProgresso: number;
  itens: ItemPedido[];
};

export type Divergencia = {
  id: number;
  pedido: string;
  cliente: string;
  itemOriginal: string;
  codOriginal: string;
  itemSeparado: string;
  codSeparado: string;
  tipoDivergencia: string;
  homologada: boolean;
  necessidadeCliente: string;
  qtdOriginal: number;
  qtdEquivalente: number;
  fatorConversao: string;
  motivo: string;
  status: "pendente" | "aprovado" | "rejeitado" | "bloqueado" | "conforme";
};

export type Falta = {
  id: number;
  pedido: string;
  cliente: string;
  item: string;
  codigo: string;
  qtdPedida: number;
  qtdFaltante: number;
  tipo: "total" | "parcial";
  embarcacao: string;
  horarioCarregamento: string;
  criticidade: "critica" | "alta" | "media" | "baixa";
  acaoProposta: "apanho" | "compra" | "corte" | null;
  prazoRetorno: string | null;
  tempoRestante: string;
};

export type FluxoDistinto = {
  id: number;
  pedido: string;
  cliente: string;
  itemPedidoNF: string;
  codPedidoNF: string;
  itemFisico: string;
  codFisico: string;
  tipo: string;
  justificativa: string;
  impacto: string;
  status: string;
  solicitante: string;
  aprovador: string | null;
  dataSolicitacao: string;
  dataAprovacao: string | null;
  historico: { data: string; acao: string; usuario: string }[];
};

export type PreFaturamento = {
  pedidoResumo: {
    id: string;
    cliente: string;
    embarcacao: string;
    horario: string;
    responsavel: string;
    totalItens: number;
    conformes: number;
    substituidos: number;
    faltas: number;
    fluxoDistinto: number;
    pendenciasImpeditivas: number;
  };
  itensConformes: { codigo: string; descricao: string; qtd: number; lote: string; validade: string }[];
  itensSubstituidos: {
    codOriginal: string; descOriginal: string;
    codSubstituto: string; descSubstituto: string;
    qtdOriginal: number; qtdSubstituta: number;
    tipo: string; aprovadoPor: string;
  }[];
  itensFalta: { codigo: string; descricao: string; qtdPedida: number; qtdFaltante: number; acao: string; previsao: string }[];
  itensFluxoDistinto: { codNF: string; descNF: string; codFisico: string; descFisico: string; aprovadoPor: string; justificativa: string }[];
  pendencias: { tipo: string; descricao: string; impeditiva: boolean }[];
};
