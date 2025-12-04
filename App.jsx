// App.jsx
import React, { useEffect, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { ethers } from "ethers";

/**
 * ChronoLog DApp - Single-file React App (App.jsx)
 * - Tailwind CSS assumed available in the host project
 * - Uses ethers.js v6
 *
 * Network: Arbitrum Sepolia (chainId: 421614)
 * Contract: 0x1A46b403A29c8cBDA564E1f4B9c6332b8873532f
 *
 * ABI note: fixed a small typo in the provided ABI (uint2mj256 -> uint256)
 */

const CONTRACT_ADDRESS = "0x1A46b403A29c8cBDA564E1f4B9c6332b8873532f";
const ARBITRUM_SEPOLIA_CHAIN_ID_DEC = 421614;
const ARBITRUM_SEPOLIA_CHAIN_ID_HEX = "0x66E16"; // 421614 -> hex

const ABI = [
  {
    inputs: [
      { internalType: "string", name: "_content", type: "string" },
      { internalType: "uint256", name: "_unlockTime", type: "uint256" },
    ],
    name: "createLog",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllLogs",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "id", type: "uint256" },
          { internalType: "address", name: "author", type: "address" },
          { internalType: "string", name: "content", type: "string" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
          { internalType: "uint256", name: "unlockTime", type: "uint256" },
        ],
        internalType: "struct ChronoLog.Log[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// Utility: short address
function shortAddr(addr = "") {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

// Utility: format unix timestamp (seconds) to local string
function fmtTs(ts) {
  try {
    const n = Number(ts);
    if (!n) return "-";
    // if value seems like ms > 1e12, convert
    const ms = n > 1e12 ? n : n * 1000;
    return new Date(ms).toLocaleString();
  } catch {
    return "-";
  }
}

// Toast-ish simple component
function Notice({ children, kind = "info" }) {
  const color =
    kind === "error"
      ? "bg-red-100 text-red-800"
      : kind === "success"
      ? "bg-green-100 text-green-800"
      : "bg-blue-50 text-blue-800";
  return (
    <div className={`px-3 py-2 rounded ${color} text-sm`}>
      {children}
    </div>
  );
}

export default function App() {
  // wallet/provider state
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [contract, setContract] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState("moment"); // 'moment' | 'capsule'
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  // Form inputs
  const [momentContent, setMomentContent] = useState("");
  const [capsuleContent, setCapsuleContent] = useState("");
  const [capsuleUnlockAt, setCapsuleUnlockAt] = useState(""); // ISO datetime-local

  // Logs
  const [logs, setLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Initialize on mount: detect injected wallet
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum, "any");
      setProvider(p);
      // listen for accounts changed
      window.ethereum.on &&
        window.ethereum.on("accountsChanged", (accounts) => {
          if (!accounts || accounts.length === 0) {
            setAccount(null);
            setSigner(null);
          } else {
            setAccount(ethers.getAddress(accounts[0]));
            // re-init signer
            (async () => {
              try {
                const s = await p.getSigner();
                setSigner(s);
                setContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, s));
              } catch (e) {
                console.error(e);
              }
            })();
          }
        });
      // network changes
      window.ethereum.on &&
        window.ethereum.on("chainChanged", (chainIdHex) => {
          // update provider & network info
          (async () => {
            try {
              const p2 = new ethers.BrowserProvider(window.ethereum, "any");
              setProvider(p2);
              const net = await p2.getNetwork();
              setNetwork(net);
            } catch (e) {
              console.error(e);
            }
          })();
        });
    } else {
      setNotice(
        "No injected wallet detected. Install MetaMask or another Web3 wallet to interact with ChronoLog."
      );
    }
  }, []);

  // When provider + signer are ready, set contract read-only if no signer
  useEffect(() => {
    (async () => {
      try {
        if (!provider) return;
        const net = await provider.getNetwork();
        setNetwork(net);
        // try to get signer if available
        let s;
        try {
          s = await provider.getSigner();
          const addr = await s.getAddress().catch(() => null);
          if (addr) {
            setSigner(s);
            setAccount(addr);
            setContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, s));
            return;
          }
        } catch {
          // no signer yet
        }
        // read-only contract
        const readOnlyContract = new ethers.Contract(
          CONTRACT_ADDRESS,
          ABI,
          provider
        );
        setContract(readOnlyContract);
      } catch (e) {
        console.error("init error", e);
      }
    })();
  }, [provider]);

  // Short helper to clear notices/errors after n ms
  useEffect(() => {
    if (!notice && !error) return;
    const t = setTimeout(() => {
      setNotice(null);
      setError(null);
    }, 6000);
    return () => clearTimeout(t);
  }, [notice, error]);

  // Connect wallet handler
  const connectWallet = async () => {
    setError(null);
    setNotice(null);
    try {
      if (!window.ethereum) {
        setError("No injected wallet found.");
        return;
      }
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!accounts || accounts.length === 0) {
        setError("No accounts returned from wallet.");
        return;
      }
      const p = new ethers.BrowserProvider(window.ethereum, "any");
      setProvider(p);
      const s = await p.getSigner();
      setSigner(s);
      const addr = await s.getAddress();
      setAccount(addr);
      const net = await p.getNetwork();
      setNetwork(net);
      setContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, s));
      setNotice("Wallet connected: " + shortAddr(addr));
    } catch (e) {
      console.error(e);
      setError("Failed to connect wallet: " + (e.message || e));
    }
  };

  // Request wallet to switch to Arbitrum Sepolia
  const switchToArbitrumSepolia = async () => {
    setError(null);
    try {
      if (!window.ethereum) throw new Error("No wallet available");
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARBITRUM_SEPOLIA_CHAIN_ID_HEX }],
      });
      // optionally add the network if not present
    } catch (switchErr) {
      // If the chain has not been added to MetaMask, request to add
      if (switchErr?.code === 4902 || /Unrecognized chain/.test(String(switchErr))) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: ARBITRUM_SEPOLIA_CHAIN_ID_HEX,
                chainName: "Arbitrum Sepolia",
                nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
                blockExplorerUrls: ["https://sepolia.arbiscan.io"],
              },
            ],
          });
        } catch (addErr) {
          console.error(addErr);
          setError("Failed to add Arbitrum Sepolia to wallet: " + (addErr.message || addErr));
          return;
        }
      } else {
        console.error(switchErr);
        setError("Failed to switch chain: " + (switchErr.message || switchErr));
        return;
      }
    }
    // refresh provider/network
    if (provider) {
      const net = await provider.getNetwork();
      setNetwork(net);
    }
    setNotice("Switched to Arbitrum Sepolia.");
  };

  // Fetch logs from contract
  const fetchLogs = async () => {
    setRefreshing(true);
    setError(null);
    try {
      if (!contract) throw new Error("Contract not initialized");
      // call as read-only; if contract connected to signer this will still work
      const raw = await contract.getAllLogs();
      // raw is array of tuples/objects; map to consistent shape
      const mapped = raw.map((r) => ({
        id: r.id ? Number(r.id) : undefined,
        author: r.author,
        content: r.content,
        timestamp: r.timestamp ? Number(r.timestamp) : undefined,
        unlockTime: r.unlockTime ? Number(r.unlockTime) : undefined,
      }));
      // sort by id or timestamp desc
      mapped.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
      setLogs(mapped);
    } catch (e) {
      console.error("fetchLogs error", e);
      setError("Failed to load logs: " + (e.message || e));
    } finally {
      setRefreshing(false);
    }
  };

  // Create log helper (shared)
  const createLogTx = async (content, unlockTimeUnixSec) => {
    setError(null);
    setNotice(null);
    setTxHash(null);
    if (!signer) {
      setError("Please connect your wallet with a signer before creating logs.");
      return;
    }
    if (!content || content.trim().length === 0) {
      setError("Content cannot be empty.");
      return;
    }
    if (!Number.isFinite(Number(unlockTimeUnixSec))) {
      setError("Invalid unlock time.");
      return;
    }

    try {
      setLoading(true);
      // ensure correct network
      const net = await signer.provider.getNetwork();
      if (net.chainId !== ARBITRUM_SEPOLIA_CHAIN_ID_DEC) {
        setError(
          `Please switch your wallet to Arbitrum Sepolia (chainId ${ARBITRUM_SEPOLIA_CHAIN_ID_DEC}).`
        );
        setLoading(false);
        return;
      }

      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      // send transaction
      const tx = await c.createLog(content, BigInt(Math.floor(unlockTimeUnixSec)));
      setTxHash(tx.hash);
      setNotice(`Transaction submitted: ${shortAddr(tx.hash)} — waiting for confirmation...`);
      // wait for 1 confirmation
      const receipt = await tx.wait();
      if (receipt && receipt.status === 1) {
        setNotice("Transaction confirmed ✅");
        // refresh logs
        await fetchLogs();
      } else {
        setError("Transaction failed or was reverted.");
      }
    } catch (e) {
      console.error("createLogTx error", e);
      // ethers v6 errors may have cause/messages
      setError("Failed to create log: " + (e?.shortMessage || e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  // Handlers for Moment (immediate log with unlockTime = now)
  const handleCreateMoment = async (e) => {
    e?.preventDefault();
    const content = momentContent.trim();
    const nowSec = Math.floor(Date.now() / 1000);
    await createLogTx(content, nowSec);
    setMomentContent("");
  };

  // Handlers for Capsule (future unlock time)
  const handleCreateCapsule = async (e) => {
    e?.preventDefault();
    const content = capsuleContent.trim();
    if (!capsuleUnlockAt) {
      setError("Please choose a future unlock date/time.");
      return;
    }
    // parse ISO-local input to unix seconds
    const ts = new Date(capsuleUnlockAt);
    if (Number.isNaN(ts.getTime())) {
      setError("Invalid unlock time format.");
      return;
    }
    const unlockSec = Math.floor(ts.getTime() / 1000);
    const nowSec = Math.floor(Date.now() / 1000);
    if (unlockSec <= nowSec) {
      setError("Unlock time must be in the future for a Capsule.");
      return;
    }
    await createLogTx(content, unlockSec);
    setCapsuleContent("");
    setCapsuleUnlockAt("");
  };

  // auto-fetch logs on contract ready
  useEffect(() => {
    if (!contract) return;
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract]);

  // derived: isConnected to correct network
  const onCorrectNetwork = useMemo(() => {
    return network && network.chainId === ARBITRUM_SEPOLIA_CHAIN_ID_DEC;
  }, [network]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">ChronoLog</h1>
            <p className="text-sm text-slate-500">Moment & Capsule chrono-journaling on Arbitrum Sepolia</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500">Network</div>
              <div className="text-sm font-medium">{network ? network.name || `chain:${network.chainId}` : "Unknown"}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Account</div>
              <div className="text-sm font-mono">{account ? shortAddr(account) : "Not connected"}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={connectWallet}
                className="px-3 py-2 bg-indigo-600 text-white rounded shadow-sm text-sm hover:bg-indigo-700"
              >
                {account ? "Reconnect" : "Connect Wallet"}
              </button>
              {!onCorrectNetwork && (
                <button
                  onClick={switchToArbitrumSepolia}
                  className="px-3 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50"
                >
                  Switch to Arbitrum Sepolia
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="bg-white rounded-2xl shadow-md p-6">
          {/* Tabs */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab("moment")}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === "moment" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                Moment
              </button>
              <button
                onClick={() => setActiveTab("capsule")}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === "capsule" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                Capsule
              </button>
            </div>
            <div className="text-sm text-slate-500">Contract: <span className="font-mono text-slate-700">{shortAddr(CONTRACT_ADDRESS)}</span></div>
          </div>

          {/* Tab content */}
          <div>
            {activeTab === "moment" ? (
              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <form onSubmit={handleCreateMoment} className="space-y-3">
                    <label className="text-sm font-medium text-slate-700">Write a Moment</label>
                    <textarea
                      value={momentContent}
                      onChange={(e) => setMomentContent(e.target.value)}
                      rows={6}
                      maxLength={1024}
                      placeholder="Capture the present — this Moment will be logged with current timestamp."
                      className="w-full rounded-lg border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      required
                    />
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500">Public log on-chain (gas required)</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCreateMoment}
                          type="button"
                          disabled={loading}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {loading ? "Sending..." : "Create Moment"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                <aside className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-2">Moment quick info</h3>
                  <p className="text-sm text-slate-600 mb-3">Moments are immediate logs. They are timestamped with the current block time when you submit the transaction.</p>
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500">Transaction</div>
                    <div className="text-sm font-mono">{txHash ? shortAddr(txHash) : "—"}</div>
                    <div className="text-xs text-slate-500">Status</div>
                    <div className="text-sm">{loading ? "Pending..." : "Idle"}</div>
                  </div>
                </aside>
              </section>
            ) : (
              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <form onSubmit={handleCreateCapsule} className="space-y-3">
                    <label className="text-sm font-medium text-slate-700">Write a Capsule</label>
                    <textarea
                      value={capsuleContent}
                      onChange={(e) => setCapsuleContent(e.target.value)}
                      rows={5}
                      maxLength={4096}
                      placeholder="Write your capsule content — choose a future unlock time below."
                      className="w-full rounded-lg border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      required
                    />
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                      <div className="flex flex-col">
                        <label className="text-xs text-slate-500">Unlock at (local)</label>
                        <input
                          type="datetime-local"
                          value={capsuleUnlockAt}
                          onChange={(e) => setCapsuleUnlockAt(e.target.value)}
                          className="mt-1 rounded-md border border-slate-200 p-2 text-sm focus:outline-none"
                          required
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCreateCapsule}
                          type="button"
                          disabled={loading}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {loading ? "Sending..." : "Seal Capsule"}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">Capsules record a future unlock timestamp. They stay private until the unlock time is reached (enforced by your app logic when reading).</div>
                  </form>
                </div>

                <aside className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-2">Capsule quick info</h3>
                  <p className="text-sm text-slate-600 mb-3">Capsules let you lock content until a future moment. Choose a local date/time — it'll be converted to UNIX seconds when submitting.</p>
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500">Tips</div>
                    <ul className="list-disc list-inside text-sm text-slate-600">
                      <li>Ensure your wallet is set to Arbitrum Sepolia.</li>
                      <li>Gas will be paid in Sepolia ETH.</li>
                    </ul>
                  </div>
                </aside>
              </section>
            )}
          </div>

          {/* Notices */}
          <div className="mt-6 space-y-3">
            {notice && <Notice>{notice}</Notice>}
            {error && <Notice kind="error">{error}</Notice>}
          </div>

          {/* Logs viewer */}
          <section className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Chrono Logs</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchLogs}
                  disabled={refreshing}
                  className="px-3 py-2 bg-slate-100 rounded text-sm hover:bg-slate-200 disabled:opacity-60"
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
                <button
                  onClick={() => {
                    // try to open contract in block explorer if network is sepolia arbiscan
                    const url = onCorrectNetwork
                      ? `https://sepolia.arbiscan.io/address/${CONTRACT_ADDRESS}`
                      : `https://sepolia.arbiscan.io/address/${CONTRACT_ADDRESS}`;
                    window.open(url, "_blank");
                  }}
                  className="px-3 py-2 bg-white border border-slate-200 rounded text-sm hover:bg-slate-50"
                >
                  View on Arbiscan
                </button>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded text-sm text-slate-500">No logs yet — be the first to create a Moment or Capsule.</div>
            ) : (
              <div className="space-y-4">
                {logs.map((l) => {
                  const locked = l.unlockTime && Number(l.unlockTime) > Math.floor(Date.now() / 1000);
                  return (
                    <article key={String(l.id ?? Math.random())} className="p-4 bg-white border border-slate-100 rounded-lg shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium text-slate-800">{locked ? "Capsule" : "Moment"}</div>
                          <div className="text-xs text-slate-500">by {shortAddr(l.author)}</div>
                        </div>
                        <div className="text-xs text-slate-400 text-right">
                          <div>{fmtTs(l.timestamp)}</div>
                          <div className="mt-1">{locked ? <span className="text-emerald-600">Locked until {fmtTs(l.unlockTime)}</span> : <span className="text-slate-500">Unlocked</span>}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-slate-700">
                        {locked ? <em className="text-slate-400">[Locked content — unlocks later]</em> : l.content}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                        <div>ID: #{String(l.id ?? "-")}</div>
                        <div>Unlock (unix): {String(l.unlockTime ?? "-")}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Footer */}
          <footer className="mt-8 text-center text-xs text-slate-400">
            ChronoLog • On-chain journaling demo for Arbitrum Sepolia. Use responsibly — on-chain transactions cost testnet ETH.
          </footer>
        </main>
      </div>
    </div>
  );
}

/** If you're mounting in a plain HTML file with a div#root, uncomment below:
 *
 * const root = createRoot(document.getElementById("root"));
 * root.render(<App />);
 *
 * Make sure your build pipeline supports JSX, Tailwind CSS is included, and ethers v6 is installed.
 */
