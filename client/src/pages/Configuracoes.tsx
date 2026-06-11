/**
 * Configurações — conexão de APIs (gateway). Visível apenas para ADMINISTRADOR.
 * Campos: BASE URL DO GATEWAY, CLIENT ID, CLIENT SECRET, X-TOKEN.
 * Atualização automática a cada 1 minuto (não sobrescreve edições em andamento).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Settings, Loader2, Save, PlugZap, Eye, EyeOff, Globe, KeyRound, Lock,
  ShieldCheck, RotateCcw, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Cfg = { baseUrl: string; clientId: string; clientSecret: string; xToken: string };
type CfgResp = Cfg & { dtAlteracao: string | null; alteradoPor: string | null };

const VAZIO: Cfg = { baseUrl: "", clientId: "", clientSecret: "", xToken: "" };
const REFRESH_MS = 60000; // 1 minuto

export default function Configuracoes() {
  const { user } = useAuth();
  const [form, setForm] = useState<Cfg>(VAZIO);
  const [meta, setMeta] = useState<{ dtAlteracao: string | null; alteradoPor: string | null }>({ dtAlteracao: null, alteradoPor: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<{ ok: boolean; status: number; statusText?: string; erro?: string; tempoMs: number } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [lastUpd, setLastUpd] = useState<Date | null>(null);
  // dirty = admin editando; o refresh automático não sobrescreve o formulário
  const dirtyRef = useRef(false);

  const carregar = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get<CfgResp>("/config/api");
      setMeta({ dtAlteracao: data.dtAlteracao, alteradoPor: data.alteradoPor });
      if (!dirtyRef.current) {
        setForm({ baseUrl: data.baseUrl ?? "", clientId: data.clientId ?? "", clientSecret: data.clientSecret ?? "", xToken: data.xToken ?? "" });
      }
      setLastUpd(new Date());
    } catch (e) {
      if (!silent) toast.error(extractErrorMessage(e, "Erro ao carregar configurações"));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  // Atualização automática a cada 1 minuto
  useEffect(() => {
    const t = setInterval(() => carregar(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [carregar]);

  const setCampo = (campo: keyof Cfg, valor: string) => {
    dirtyRef.current = true;
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  const salvar = async () => {
    if (form.baseUrl && !/^https?:\/\/.+/i.test(form.baseUrl.trim())) {
      toast.error("BASE URL inválida — informe uma URL http(s) completa.");
      return;
    }
    setSaving(true);
    try {
      await api.put("/config/api", form);
      dirtyRef.current = false;
      toast.success("Configurações salvas");
      carregar(true);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Falha ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  const testarConexao = async () => {
    setTestando(true);
    setTeste(null);
    try {
      const { data } = await api.post("/config/api/testar", form);
      setTeste(data);
      if (data.ok) toast.success(`Conexão OK (HTTP ${data.status} em ${data.tempoMs}ms)`);
      else toast.error(data.erro ?? `Gateway respondeu HTTP ${data.status}`);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Falha ao testar conexão"));
    } finally {
      setTestando(false);
    }
  };

  // Guarda extra no cliente (o backend já bloqueia com 403)
  if (user?.perfil !== "ADMINISTRADOR") {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center space-y-3">
        <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-lg font-bold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">As configurações de conexão de APIs são visíveis apenas para o perfil Administrador.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-5 h-5" /> Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conexão de APIs (gateway). Atualização automática a cada 1 minuto.
          {lastUpd && <span className="ml-1 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> atualizado {lastUpd.toLocaleTimeString("pt-BR")}</span>}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PlugZap className="w-4 h-4 text-primary" /> Conexão de APIs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Carregando…
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs flex items-center gap-1 mb-1.5"><Globe className="w-3.5 h-3.5" /> Base URL do Gateway</Label>
                <Input
                  placeholder="https://api.gateway.exemplo.com.br"
                  className="h-9 font-mono text-sm"
                  value={form.baseUrl}
                  onChange={(e) => setCampo("baseUrl", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-1.5"><KeyRound className="w-3.5 h-3.5" /> Client ID</Label>
                  <Input
                    placeholder="client_id"
                    className="h-9 font-mono text-sm"
                    value={form.clientId}
                    onChange={(e) => setCampo("clientId", e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-1.5"><Lock className="w-3.5 h-3.5" /> Client Secret</Label>
                  <div className="relative">
                    <Input
                      type={showSecret ? "text" : "password"}
                      placeholder="client_secret"
                      className="h-9 font-mono text-sm pr-9"
                      value={form.clientSecret}
                      onChange={(e) => setCampo("clientSecret", e.target.value)}
                      autoComplete="new-password"
                    />
                    <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSecret((v) => !v)} title={showSecret ? "Ocultar" : "Mostrar"}>
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1 mb-1.5"><ShieldCheck className="w-3.5 h-3.5" /> X-Token</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="x-token"
                    className="h-9 font-mono text-sm pr-9"
                    value={form.xToken}
                    onChange={(e) => setCampo("xToken", e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowToken((v) => !v)} title={showToken ? "Ocultar" : "Mostrar"}>
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {teste && (
                <div className={cn("text-xs px-3 py-2 rounded-md border flex items-center gap-2",
                  teste.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200")}>
                  {teste.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                  {teste.ok
                    ? `Conexão OK — HTTP ${teste.status} ${teste.statusText ?? ""} em ${teste.tempoMs}ms`
                    : (teste.erro ?? `Gateway respondeu HTTP ${teste.status} em ${teste.tempoMs}ms`)}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Button onClick={salvar} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar configurações
                </Button>
                <Button variant="outline" onClick={testarConexao} disabled={testando} className="gap-1.5">
                  {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />} Testar conexão
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5 ml-auto text-xs"
                  onClick={() => { dirtyRef.current = false; carregar(); }}>
                  <RotateCcw className="w-3.5 h-3.5" /> Recarregar
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {meta.dtAlteracao
                  ? <>Última alteração em <b>{meta.dtAlteracao}</b>{meta.alteradoPor ? <> por <b>{meta.alteradoPor}</b></> : null}.</>
                  : "Nenhuma configuração salva ainda."}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
