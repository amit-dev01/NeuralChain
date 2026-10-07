import { useState } from "react"
import { Link } from "react-router-dom"
import {
  BookOpen,
  ChevronRight,
  Cpu,
  Layers,
  Sparkles,
  Shield,
  FileText,
  Terminal,
  ExternalLink,
  Code2,
  CheckCircle2,
  Copy,
} from "lucide-react"

import AppHeader from "@/components/common/AppHeader"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function DocsPage() {
  const [copied, setCopied] = useState(false)

  const copyColabCode = () => {
    navigator.clipboard.writeText("!git clone https://github.com/neuralchain/core.git\ncd core/ml_notebooks\npython train_colab.py")
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 editorial-glow selection:bg-amber-500/20 flex flex-col">
      <AppHeader />

      <main className="mx-auto max-w-screen-2xl w-full px-6 py-8 space-y-8 flex-1">
        {/* ── BREADCRUMB & TITLE ── */}
        <div className="space-y-1">
          <nav className="flex items-center gap-2 text-xs text-zinc-400">
            <Link to="/overview" className="hover:text-amber-400 transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3 text-zinc-600" />
            <span className="text-zinc-200 font-medium">Documentation</span>
          </nav>
          <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
            <div>
              <h1 className="text-3xl sm:text-4xl font-display font-medium text-white tracking-tight flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-amber-400" />
                System Architecture &amp; Forensic Specifications
              </h1>
              <p className="text-xs text-zinc-400 mt-1 font-light tracking-wide max-w-2xl">
                Technical documentation for the NeuralChain Autonomous Bitcoin Transaction Forensics Platform (SIH26146).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                v1.4.0 • Enterprise Edition
              </span>
            </div>
          </div>
        </div>

        {/* ── MAIN TABS ── */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-slate-900/80 border border-white/10 p-1 rounded-xl flex flex-wrap gap-1 mb-6">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
              Platform Overview
            </TabsTrigger>
            <TabsTrigger value="ml-models" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
              4-Tier ML Ensemble
            </TabsTrigger>
            <TabsTrigger value="gemma4" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
              Google Gemma 4 AI
            </TabsTrigger>
            <TabsTrigger value="colab" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
              Colab Training
            </TabsTrigger>
            <TabsTrigger value="api" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
              REST API Reference
            </TabsTrigger>
            <TabsTrigger value="compliance" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
              Legal Compliance (§65B)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="editorial-surface border-white/10 p-6 rounded-2xl space-y-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="font-display text-base font-semibold text-white">Full-Spectrum Pipeline</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Ingests raw Bitcoin UTXO transaction datasets across CSV, JSON, and XML formats. Automatically enriches records with offline MaxMind GeoIP and ASN intelligence.
                </p>
              </Card>

              <Card className="editorial-surface border-white/10 p-6 rounded-2xl space-y-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Cpu className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="font-display text-base font-semibold text-white">Graph Intelligence</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Dual-database topology uniting PostgreSQL for relational metadata and Neo4j for multi-hop graph traversal. Detects co-spending clusters and peel chains.
                </p>
              </Card>

              <Card className="editorial-surface border-white/10 p-6 rounded-2xl space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="font-display text-base font-semibold text-white">Sovereign Air-Gapped Mode</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Built to operate securely inside classified law enforcement enclaves with zero external cloud dependencies or telemetry leakage.
                </p>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: 4-TIER ML ENSEMBLE */}
          <TabsContent value="ml-models" className="space-y-6">
            <div className="editorial-surface border border-white/10 rounded-2xl p-6 space-y-6">
              <h2 className="text-lg font-display text-white">Four-Tier Hierarchical Threat Detection Ensemble</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-blue-400">Tier 1: Isolation Forest</span>
                    <Badge variant="blue" className="text-[10px]">Unsupervised</Badge>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Isolates statistical anomalies in high-dimensional space without requiring prior threat labels. Flags sudden fee deviations, fan-out spikes, and temporal bursts.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-purple-400">Tier 2: PyTorch Deep Autoencoder</span>
                    <Badge variant="purple" className="text-[10px]">Bottleneck-4 Latent</Badge>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Compresses 20 forensic features through a 4-dimensional bottleneck latent representation. High reconstruction Mean Squared Error (MSE) indicates suspicious UTXO manipulation.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-emerald-400">Tier 3: Graph Node2Vec &amp; DBSCAN</span>
                    <Badge variant="green" className="text-[10px]">Topological</Badge>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Generates continuous vector representations of wallet co-spending subgraphs. DBSCAN clustering identifies uncoordinated syndicates and mixer pool operations.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-amber-400">Tier 4: XGBoost Classifier + TreeSHAP</span>
                    <Badge variant="amber" className="text-[10px]">Supervised + XAI</Badge>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Multi-class classification attributing suspicious entities into 5 typologies (Normal, Peel Chain, Tumbler, Ransomware, Darknet). TreeSHAP delivers transparent, court-admissible feature attributions.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: GEMMA 4 */}
          <TabsContent value="gemma4" className="space-y-6">
            <div className="editorial-surface border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-amber-400" />
                <h2 className="text-lg font-display text-white">Google Gemma 4 Mixture-of-Experts Integration</h2>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                NeuralChain leverages <code className="text-amber-300 font-mono">gemma-4-26b-a4b-it</code> via the official Google GenAI SDK. If offline or experiencing quota limits, the platform gracefully switches to <code className="text-zinc-300 font-mono">gemini-2.5-flash</code> or sovereign air-gapped simulated reasoning.
              </p>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 font-mono text-xs text-zinc-300 space-y-2">
                <p className="text-amber-400 font-semibold">// Configured in backend/.env</p>
                <p>GEMINI_API_KEY=your_gemini_api_key_here</p>
                <p>GEMINI_MODEL=gemma-4-26b-a4b-it</p>
                <p>GEMINI_FALLBACK_MODEL=gemini-2.5-flash</p>
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: COLAB TRAINING */}
          <TabsContent value="colab" className="space-y-6">
            <div className="editorial-surface border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display text-white">Google Colab Model Training Workflow</h2>
                <button
                  onClick={copyColabCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-zinc-200 transition-colors"
                >
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied Command" : "Copy Command"}
                </button>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                A complete, self-contained Jupyter notebook is available at <code className="text-amber-300 font-mono">ml_notebooks/neuralchain_colab_training.ipynb</code> and a single-cell executable script at <code className="text-amber-300 font-mono">ml_notebooks/train_colab.py</code>.
              </p>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2 text-xs">
                <p className="font-semibold text-zinc-200">Execution Steps in Colab:</p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                  <li>Open <a href="https://colab.research.google.com" target="_blank" rel="noreferrer" className="text-amber-400 underline">Google Colab</a> and create a New Notebook.</li>
                  <li>Select GPU runtime: <em>Runtime &gt; Change runtime type &gt; T4 GPU</em>.</li>
                  <li>Copy and paste the code from <code className="font-mono text-zinc-200">train_colab.py</code> into cell 1.</li>
                  <li>Press <em>Shift + Enter</em>. All 4 models train in ~2 minutes and automatically download as <code className="font-mono text-amber-300">neuralchain_models.zip</code>.</li>
                </ol>
              </div>
            </div>
          </TabsContent>

          {/* TAB 5: REST API */}
          <TabsContent value="api" className="space-y-6">
            <div className="editorial-surface border border-white/10 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-display text-white">Core REST API Endpoints</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400">
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3">Endpoint</th>
                      <th className="py-2 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-zinc-300">
                    <tr>
                      <td className="py-2 px-3 text-emerald-400">GET</td>
                      <td className="py-2 px-3">/api/v1/analytics/stats/overview</td>
                      <td className="py-2 px-3 font-sans text-zinc-400">Global forensic KPIs and volume counts</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-emerald-400">GET</td>
                      <td className="py-2 px-3">/api/v1/alerts</td>
                      <td className="py-2 px-3 font-sans text-zinc-400">Paginated and filtered suspicious anomaly alerts</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-blue-400">POST</td>
                      <td className="py-2 px-3">/api/v1/ai/copilot</td>
                      <td className="py-2 px-3 font-sans text-zinc-400">Conversational Gemma 4 forensic assistant query</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-blue-400">POST</td>
                      <td className="py-2 px-3">/api/v1/ai/explain-shap</td>
                      <td className="py-2 px-3 font-sans text-zinc-400">Translates SHAP mathematical attributions to English</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-emerald-400">GET</td>
                      <td className="py-2 px-3">/api/v1/graph/nodes</td>
                      <td className="py-2 px-3 font-sans text-zinc-400">Ego-network graph nodes and links around wallet address</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-blue-400">POST</td>
                      <td className="py-2 px-3">/api/v1/reports/generate</td>
                      <td className="py-2 px-3 font-sans text-zinc-400">Dispatches dossier generation with Section 65B hash</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 6: COMPLIANCE */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="editorial-surface border border-white/10 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-display text-white">Section 65B Indian Evidence Act Forensic Standards</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Generated investigation dossiers conform to Indian Evidence Act Section 65B requirements:
              </p>
              <ul className="list-disc list-inside space-y-2 text-xs text-zinc-300">
                <li><strong className="text-white">Cryptographic Hashing:</strong> Every generated PDF and CSV report is hashed using SHA-256 at the moment of creation.</li>
                <li><strong className="text-white">Deterministic Chain of Custody:</strong> Ingestion timestamps, raw block identifiers, and analyst session IDs are stamped immutably.</li>
                <li><strong className="text-white">XAI Explainability:</strong> TreeSHAP feature attributions prove that decisions are mathematically deterministic and free of algorithmic bias.</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
